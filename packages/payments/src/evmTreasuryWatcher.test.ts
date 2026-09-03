import { describe, expect, it, vi } from "vitest";
import type { PublicClient } from "viem";
import { EvmTreasuryWatcher } from "./evmTreasuryWatcher.js";
import type { PayableChainConfig } from "./types.js";

const TREASURY = "0x1111111111111111111111111111111111111d" as const;
const USDC_ADDRESS = "0x2222222222222222222222222222222222222d" as const;
const USDT_ADDRESS = "0x3333333333333333333333333333333333333d" as const;

function chain(): PayableChainConfig {
  return {
    key: "ETHEREUM",
    displayName: "Ethereum",
    chainId: 1,
    rpcUrl: "https://example.invalid/rpc",
    treasuryAddress: TREASURY,
    tokenAddresses: { USDC: USDC_ADDRESS, USDT: USDT_ADDRESS },
  };
}

/**
 * Minimal fake covering only the PublicClient methods EvmTreasuryWatcher
 * actually calls — real RPC I/O is exactly what this watcher's constructor
 * accepts an injectable client to avoid in tests.
 */
function fakeClient(overrides: {
  latestBlock?: bigint;
  getLogs?: ReturnType<typeof vi.fn>;
  getBlock?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    getBlockNumber: vi.fn().mockResolvedValue(overrides.latestBlock ?? 1000n),
    getLogs: overrides.getLogs ?? vi.fn().mockResolvedValue([]),
    getBlock: overrides.getBlock ?? vi.fn().mockResolvedValue({ timestamp: 1700000000n, transactions: [] }),
  } as unknown as PublicClient;
}

describe("EvmTreasuryWatcher.fetchNewTransfers — RPC-volume fix", () => {
  it("on a chain's first tick (no cursor), scans exactly the capped lookback window, not further back", async () => {
    const client = fakeClient({ latestBlock: 1000n });
    const watcher = new EvmTreasuryWatcher({ chain: chain(), maxLookbackBlocks: 300n, client });

    const result = await watcher.fetchNewTransfers(null);

    expect(client.getLogs).toHaveBeenCalledWith(expect.objectContaining({ fromBlock: 700n, toBlock: 1000n }));
    expect(result.scannedToBlock).toBe(1000n);
  });

  it("on a later tick, scans only the new range since the persisted cursor — not the wide lookback window again", async () => {
    const client = fakeClient({ latestBlock: 1010n });
    const watcher = new EvmTreasuryWatcher({ chain: chain(), maxLookbackBlocks: 300n, client });

    await watcher.fetchNewTransfers(1005n);

    // fromBlock is cursor+1, nowhere near the 300-block lookback window —
    // this is the actual RPC-volume fix: a tiny delta, not a fixed re-scan.
    expect(client.getLogs).toHaveBeenCalledWith(expect.objectContaining({ fromBlock: 1006n, toBlock: 1010n }));
  });

  it("caps a very stale cursor at maxLookbackBlocks instead of scanning the entire gap in one call", async () => {
    // Worker was down a long time — cursor is 10,000 blocks behind the tip.
    const client = fakeClient({ latestBlock: 100_000n });
    const watcher = new EvmTreasuryWatcher({ chain: chain(), maxLookbackBlocks: 300n, client });

    await watcher.fetchNewTransfers(90_000n);

    expect(client.getLogs).toHaveBeenCalledWith(expect.objectContaining({ fromBlock: 99_700n, toBlock: 100_000n }));
  });

  it("returns no transfers and does not call getLogs again for a tick where the chain hasn't advanced", async () => {
    const client = fakeClient({ latestBlock: 1000n });
    const watcher = new EvmTreasuryWatcher({ chain: chain(), maxLookbackBlocks: 300n, client });

    const result = await watcher.fetchNewTransfers(1000n); // already fully scanned

    expect(client.getLogs).not.toHaveBeenCalled();
    expect(result).toEqual({ transfers: [], scannedToBlock: 1000n });
  });

  it("fetches each distinct block's timestamp only once even when multiple transfer logs land in the same block", async () => {
    const getBlock = vi.fn().mockResolvedValue({ timestamp: 1700000000n, transactions: [] });
    const getLogs = vi.fn().mockImplementation(async ({ address }: { address: string }) => {
      if (address !== USDC_ADDRESS) return [];
      return [
        { blockNumber: 900n, args: { value: 100_000000n, from: "0xsender" }, transactionHash: "0xtx1" },
        { blockNumber: 900n, args: { value: 200_000000n, from: "0xsender" }, transactionHash: "0xtx2" },
        { blockNumber: 901n, args: { value: 300_000000n, from: "0xsender" }, transactionHash: "0xtx3" },
      ];
    });
    const client = fakeClient({ latestBlock: 1000n, getLogs, getBlock });
    const watcher = new EvmTreasuryWatcher({ chain: chain(), maxLookbackBlocks: 300n, client });

    const result = await watcher.fetchNewTransfers(null);

    expect(result.transfers).toHaveLength(3);
    // Two distinct block numbers touched (900, 901) — not three getBlock
    // calls, one per log.
    expect(getBlock).toHaveBeenCalledTimes(2);
  });

  it("does not scan native transfers (the heaviest call) unless scanNativeTransfers is explicitly enabled", async () => {
    const getBlock = vi.fn().mockResolvedValue({ timestamp: 1700000000n, transactions: [] });
    const client = fakeClient({ latestBlock: 1000n, getBlock });
    const watcher = new EvmTreasuryWatcher({ chain: chain(), maxLookbackBlocks: 5n, client }); // scanNativeTransfers omitted -> defaults off

    await watcher.fetchNewTransfers(null);

    // getBlock would be called once per block in [995..1000] (6 blocks) if
    // native scanning ran — it shouldn't have run at all since there were
    // no ERC20 logs either.
    expect(getBlock).not.toHaveBeenCalled();
  });

  it("scans native transfers when explicitly enabled, over the same small delta range", async () => {
    const getBlock = vi.fn().mockImplementation(async ({ blockNumber }: { blockNumber: bigint }) => ({
      timestamp: 1700000000n,
      transactions: [
        {
          to: TREASURY.toUpperCase(), // case-insensitive match
          from: "0xsender",
          value: 1_000000000000000000n,
          hash: `0xnative-${blockNumber}`,
        },
      ],
    }));
    const client = fakeClient({ latestBlock: 1002n, getBlock });
    const watcher = new EvmTreasuryWatcher({ chain: chain(), maxLookbackBlocks: 300n, scanNativeTransfers: true, client });

    const result = await watcher.fetchNewTransfers(1000n); // delta = blocks 1001, 1002

    expect(getBlock).toHaveBeenCalledTimes(2);
    expect(result.transfers).toHaveLength(2);
    expect(result.transfers.every((t) => t.token === "ETH")).toBe(true);
  });
});
