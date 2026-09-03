import { createPublicClient, formatEther, formatUnits, http, parseAbiItem, type PublicClient } from "viem";
import { matchPayment } from "./matchPayment.js";
import type { ObservedTransfer, PayableChainConfig, PaymentVerificationResult, PaymentVerifier, PendingPayment, TokenSymbol } from "./types.js";

const ERC20_TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

/** Standard decimal places for the accepted tokens (SPEC §6). ETH is native, handled separately. */
const TOKEN_DECIMALS: Record<Exclude<TokenSymbol, "ETH">, number> = {
  USDC: 6,
  USDT: 6,
};

export interface NewTransfersResult {
  transfers: ObservedTransfer[];
  /** Persist this as the chain's new scan cursor — the next call's `sinceBlock`. */
  scannedToBlock: bigint;
}

export interface EvmTreasuryWatcherOptions {
  chain: PayableChainConfig;
  /**
   * Caps two different things with one number: the scan window on a
   * chain's very first tick (before any cursor exists), and the worst-case
   * catch-up window after a long worker outage — without this cap, a stale
   * cursor would try to scan the entire gap in one eth_getLogs call.
   * Defaults to ~1hr of Ethereum blocks. Every tick after the first only
   * ever scans the small delta since the last tick, never this whole
   * window — see fetchNewTransfers.
   */
  maxLookbackBlocks?: bigint;
  /**
   * Also scan full block bodies for native-asset (ETH) transfers to the
   * treasury, for a WRONG_TOKEN diagnostic if a protocol sends ETH by
   * mistake. Off by default: ETH isn't an accepted payment token (SPEC §6),
   * and this is by far the heaviest call this watcher can make
   * (eth_getBlockByNumber with `true`, i.e. full transactions, once per
   * block in range) — not worth paying for a diagnostic-only feature on a
   * free RPC tier.
   */
  scanNativeTransfers?: boolean;
  /** Retry attempts for the RPC transport's built-in 429/5xx backoff. Defaults to 5 (viem's own library default is 3). */
  rpcRetryCount?: number;
  /** Base retry delay in ms — doubles each attempt (viem's standard exponential backoff). Defaults to 1000 (viem's own library default is 150). */
  rpcRetryDelayMs?: number;
  client?: PublicClient;
}

/**
 * MVP payment verifier (SPEC §6, CLAUDE.md Payments): polls the chain via
 * RPC for ERC-20 Transfer logs and (optionally) native value transfers into
 * the EMP treasury, then hands candidates to matchPayment for the actual
 * verification decision. Chosen over a webhook indexer to avoid a vendor
 * dependency — works against any RPC URL in @emp/config.
 *
 * Expected RPC call volume per tick, per payable chain, with
 * scanNativeTransfers off (the default): 1 eth_blockNumber + 1
 * eth_getLogs per accepted token (2, for USDC+USDT) + 1 lightweight
 * eth_getBlock per *distinct block* that actually contained a matching
 * transfer (almost always 0 on a quiet tick, since real payments are rare
 * relative to poll frequency) = 3 calls/tick/chain in the common case,
 * independent of how many campaigns/payments are AWAITING on that chain —
 * see fetchNewTransfers's doc comment for why call volume no longer scales
 * with pending-payment count. With scanNativeTransfers on, add roughly
 * (poll interval ÷ chain's block time) extra eth_getBlockByNumber(true)
 * calls per tick — e.g. ~8 more on Ethereum mainnet at a 90s poll interval,
 * more on a fast L2.
 */
export class EvmTreasuryWatcher implements PaymentVerifier {
  private readonly chain: PayableChainConfig;
  private readonly maxLookbackBlocks: bigint;
  private readonly scanNativeTransfers: boolean;
  private readonly client: PublicClient;

  constructor(options: EvmTreasuryWatcherOptions) {
    this.chain = options.chain;
    this.maxLookbackBlocks = options.maxLookbackBlocks ?? 300n;
    this.scanNativeTransfers = options.scanNativeTransfers ?? false;
    this.client =
      options.client ??
      (createPublicClient({
        transport: http(options.chain.rpcUrl, {
          // viem's http transport already retries 429/408/413/5xx with
          // exponential backoff and honors a Retry-After header when the
          // provider sends one — this just tunes attempts/delay to survive
          // a free-tier rate-limit burst rather than viem's own (much
          // shorter) library defaults. See this class's own doc comment.
          retryCount: options.rpcRetryCount ?? 5,
          retryDelay: options.rpcRetryDelayMs ?? 1000,
        }),
      }) as PublicClient);
  }

  /**
   * Single-payment convenience method fulfilling the PaymentVerifier
   * interface — always scans this.maxLookbackBlocks freshly (no cursor),
   * so it's correct but NOT the optimized path. The payment-watch tick
   * (apps/worker's watchPayments.ts) does not call this: it calls
   * fetchNewTransfers once per chain per tick and runs the pure
   * matchPayment function directly against the result for every AWAITING
   * payment on that chain, so RPC cost is paid once per chain, not once
   * per pending payment.
   */
  async checkPayment(payment: PendingPayment): Promise<PaymentVerificationResult> {
    const { transfers } = await this.fetchNewTransfers(null);
    return matchPayment({ expected: payment, observed: transfers, alreadyConsumedTxHashes: new Set() });
  }

  /**
   * Fetches only transfers to the treasury in blocks newer than
   * `sinceBlock` (or the last maxLookbackBlocks blocks, capped, if
   * `sinceBlock` is null — first tick for this chain, or the caller has no
   * cursor). Callers should persist `scannedToBlock` and pass it back as
   * `sinceBlock` on the next call — this is what turns "re-scan a fixed
   * window every tick" into "scan only what's new since last time" (the
   * RPC-volume fix). A transfer observed this way needs to stay matchable
   * in *later* ticks too (an AWAITING payment can still be open when the
   * matching transfer arrives, or arrive several ticks after it), so the
   * caller is expected to cache returned transfers (keyed by txHash)
   * rather than discard them after one tick — apps/worker does this via
   * the ObservedTransfer table.
   */
  async fetchNewTransfers(sinceBlock: bigint | null): Promise<NewTransfersResult> {
    const latestBlock = await this.client.getBlockNumber();
    const cappedFromBlock = latestBlock > this.maxLookbackBlocks ? latestBlock - this.maxLookbackBlocks : 0n;
    const fromBlock = sinceBlock !== null && sinceBlock + 1n > cappedFromBlock ? sinceBlock + 1n : cappedFromBlock;

    if (fromBlock > latestBlock) {
      // Chain hasn't advanced past what we've already scanned (a tick that
      // lands between blocks) — nothing new to fetch.
      return { transfers: [], scannedToBlock: latestBlock };
    }

    const [erc20Transfers, nativeTransfers] = await Promise.all([
      this.fetchErc20Transfers(fromBlock, latestBlock),
      this.scanNativeTransfers ? this.fetchNativeTransfers(fromBlock, latestBlock) : Promise.resolve([]),
    ]);

    return { transfers: [...erc20Transfers, ...nativeTransfers], scannedToBlock: latestBlock };
  }

  private async fetchErc20Transfers(fromBlock: bigint, toBlock: bigint): Promise<ObservedTransfer[]> {
    const tokenEntries = Object.entries(this.chain.tokenAddresses) as Array<
      [Exclude<TokenSymbol, "ETH">, `0x${string}`]
    >;

    // One eth_getBlock per *distinct* block number across every matching
    // log, not one per log — a block with several transfers to the
    // treasury (or the same block turning up for both USDC and USDT)
    // otherwise re-fetches the same block repeatedly for nothing but its
    // timestamp.
    const blockTimestampCache = new Map<bigint, Promise<bigint>>();
    const getBlockTimestamp = (blockNumber: bigint): Promise<bigint> => {
      let cached = blockTimestampCache.get(blockNumber);
      if (!cached) {
        cached = this.client.getBlock({ blockNumber }).then((block) => block.timestamp);
        blockTimestampCache.set(blockNumber, cached);
      }
      return cached;
    };

    const perToken = await Promise.all(
      tokenEntries.map(async ([symbol, tokenAddress]) => {
        const logs = await this.client.getLogs({
          address: tokenAddress,
          event: ERC20_TRANSFER_EVENT,
          args: { to: this.chain.treasuryAddress },
          fromBlock,
          toBlock,
        });

        return Promise.all(
          logs.map(async (log): Promise<ObservedTransfer> => {
            const timestamp = await getBlockTimestamp(log.blockNumber);
            return {
              token: symbol,
              amount: formatUnits(log.args.value ?? 0n, TOKEN_DECIMALS[symbol]),
              fromAddress: log.args.from ?? "0x0",
              txHash: log.transactionHash,
              occurredAt: new Date(Number(timestamp) * 1000),
            };
          }),
        );
      }),
    );

    return perToken.flat();
  }

  /**
   * Native ETH has no Transfer event, so this scans full block bodies over
   * the (now small, delta-only) range rather than filtering logs — by far
   * the heaviest call this class makes, hence scanNativeTransfers
   * defaulting to off. Only reachable when explicitly enabled.
   */
  private async fetchNativeTransfers(fromBlock: bigint, toBlock: bigint): Promise<ObservedTransfer[]> {
    const blockNumbers: bigint[] = [];
    for (let n = fromBlock; n <= toBlock; n++) blockNumbers.push(n);

    const blocks = await Promise.all(
      blockNumbers.map((blockNumber) => this.client.getBlock({ blockNumber, includeTransactions: true })),
    );

    const transfers: ObservedTransfer[] = [];
    for (const block of blocks) {
      for (const tx of block.transactions) {
        if (typeof tx === "string") continue; // shouldn't happen with includeTransactions: true
        if (tx.to?.toLowerCase() !== this.chain.treasuryAddress.toLowerCase()) continue;
        if (tx.value === 0n) continue;
        transfers.push({
          token: "ETH",
          amount: formatEther(tx.value),
          fromAddress: tx.from,
          txHash: tx.hash,
          occurredAt: new Date(Number(block.timestamp) * 1000),
        });
      }
    }
    return transfers;
  }
}
