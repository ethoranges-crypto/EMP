import { describe, expect, it, vi } from "vitest";

vi.mock("@emp/config", () => ({
  getChains: () => [
    { key: "ETHEREUM", displayName: "Ethereum", chainId: 1, rpcUrl: "http://rpc", tokenAddresses: {} },
    { key: "ARBITRUM", displayName: "Arbitrum", chainId: 42161, rpcUrl: "http://rpc2", tokenAddresses: {} },
  ],
}));

const { getPayableChains, setChainTreasuryAddress, InvalidTreasuryChainError, InvalidTreasuryAddressError } =
  await import("./treasuryConfig.js");

function createFakePort(treasuries: Record<string, string> = {}) {
  const store = { ...treasuries };
  return {
    listTreasuryAddresses: async () => ({ ...store }),
    setTreasuryAddress: async (chainKey: string, address: string) => {
      store[chainKey] = address;
    },
  };
}

describe("getPayableChains — SPEC §6 / CLAUDE.md Payments", () => {
  it("only returns chains with both RPC (config) and treasury (DB) configured", async () => {
    const port = createFakePort({ ETHEREUM: "0x1111111111111111111111111111111111111111" });
    const chains = await getPayableChains(port);
    expect(chains).toEqual([
      {
        key: "ETHEREUM",
        displayName: "Ethereum",
        chainId: 1,
        rpcUrl: "http://rpc",
        tokenAddresses: {},
        treasuryAddress: "0x1111111111111111111111111111111111111111",
      },
    ]);
  });

  it("returns nothing when no chain has a treasury address set", async () => {
    const port = createFakePort();
    expect(await getPayableChains(port)).toEqual([]);
  });
});

describe("setChainTreasuryAddress", () => {
  it("saves a valid address for a known chain", async () => {
    const port = createFakePort();
    await setChainTreasuryAddress(port, {
      chainKey: "ETHEREUM",
      treasuryAddress: "0x1111111111111111111111111111111111111111",
      validChainKeys: ["ETHEREUM", "ARBITRUM"],
    });
    expect(await port.listTreasuryAddresses()).toEqual({
      ETHEREUM: "0x1111111111111111111111111111111111111111",
    });
  });

  it("rejects a chain EMP doesn't know about", async () => {
    const port = createFakePort();
    await expect(
      setChainTreasuryAddress(port, {
        chainKey: "SOLANA",
        treasuryAddress: "0x1111111111111111111111111111111111111111",
        validChainKeys: ["ETHEREUM"],
      }),
    ).rejects.toThrow(InvalidTreasuryChainError);
  });

  it("rejects a malformed address", async () => {
    const port = createFakePort();
    await expect(
      setChainTreasuryAddress(port, {
        chainKey: "ETHEREUM",
        treasuryAddress: "not-an-address",
        validChainKeys: ["ETHEREUM"],
      }),
    ).rejects.toThrow(InvalidTreasuryAddressError);
  });
});
