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

export interface EvmTreasuryWatcherOptions {
  chain: PayableChainConfig;
  /** How many blocks of history to scan per poll. Defaults to ~1hr of Ethereum blocks. */
  lookbackBlocks?: bigint;
  client?: PublicClient;
}

/**
 * MVP payment verifier (SPEC §6, CLAUDE.md Payments): polls the chain via
 * RPC for ERC-20 Transfer logs and native value transfers into the EMP
 * treasury, then hands candidates to matchPayment for the actual
 * verification decision. Chosen over a webhook indexer to avoid a vendor
 * dependency — works against any RPC URL in @emp/config.
 */
export class EvmTreasuryWatcher implements PaymentVerifier {
  private readonly chain: PayableChainConfig;
  private readonly lookbackBlocks: bigint;
  private readonly client: PublicClient;

  constructor(options: EvmTreasuryWatcherOptions) {
    this.chain = options.chain;
    this.lookbackBlocks = options.lookbackBlocks ?? 300n;
    this.client = options.client ?? (createPublicClient({ transport: http(options.chain.rpcUrl) }) as PublicClient);
  }

  async checkPayment(payment: PendingPayment): Promise<PaymentVerificationResult> {
    const observed = await this.fetchObservedTransfers();
    return matchPayment({ expected: payment, observed, alreadyConsumedTxHashes: new Set() });
  }

  private async fetchObservedTransfers(): Promise<ObservedTransfer[]> {
    const latestBlock = await this.client.getBlockNumber();
    const fromBlock = latestBlock > this.lookbackBlocks ? latestBlock - this.lookbackBlocks : 0n;

    const [erc20Transfers, nativeTransfers] = await Promise.all([
      this.fetchErc20Transfers(fromBlock, latestBlock),
      this.fetchNativeTransfers(fromBlock, latestBlock),
    ]);

    return [...erc20Transfers, ...nativeTransfers];
  }

  private async fetchErc20Transfers(fromBlock: bigint, toBlock: bigint): Promise<ObservedTransfer[]> {
    const tokenEntries = Object.entries(this.chain.tokenAddresses) as Array<
      [Exclude<TokenSymbol, "ETH">, `0x${string}`]
    >;

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
            const block = await this.client.getBlock({ blockNumber: log.blockNumber });
            return {
              token: symbol,
              amount: formatUnits(log.args.value ?? 0n, TOKEN_DECIMALS[symbol]),
              fromAddress: log.args.from ?? "0x0",
              txHash: log.transactionHash,
              occurredAt: new Date(Number(block.timestamp) * 1000),
            };
          }),
        );
      }),
    );

    return perToken.flat();
  }

  /**
   * Native ETH has no Transfer event, so this scans full block bodies over
   * the lookback window rather than filtering logs. Fine at the
   * thousands-of-users MVP scale target (SPEC §12); if lookbackBlocks grows
   * large enough for this to matter, swap in a webhook indexer behind this
   * same PaymentVerifier interface rather than optimizing this loop.
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
