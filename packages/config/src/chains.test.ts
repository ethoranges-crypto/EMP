import { beforeEach, describe, expect, it } from "vitest";
import { getChain, getChains, getPayableChains, resetChainsCacheForTests } from "./chains.js";

const TREASURY = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

describe("getChains", () => {
  beforeEach(() => resetChainsCacheForTests());

  it("excludes a chain with no RPC URL set at all", () => {
    const chains = getChains({} as NodeJS.ProcessEnv);
    expect(chains).toHaveLength(0);
  });

  it("excludes a chain whose RPC URL is blank, same as unset — not an error", () => {
    const chains = getChains({ ETHEREUM_RPC_URL: "" } as NodeJS.ProcessEnv);
    expect(chains).toHaveLength(0);
  });

  it("excludes a chain whose RPC URL is genuinely malformed", () => {
    const chains = getChains({ ETHEREUM_RPC_URL: "not-a-url" } as NodeJS.ProcessEnv);
    expect(chains).toHaveLength(0);
  });

  it("includes a chain with only a valid RPC URL — no treasury/token vars required", () => {
    const chains = getChains({ ETHEREUM_RPC_URL: "http://127.0.0.1:8545" } as NodeJS.ProcessEnv);
    expect(chains).toHaveLength(1);
    expect(chains[0]).toMatchObject({ key: "ETHEREUM", treasuryAddress: undefined, tokenAddresses: {} });
  });

  it("is usable with only USDC configured — a blank USDT address does not invalidate the chain", () => {
    const chains = getChains({
      ETHEREUM_RPC_URL: "http://127.0.0.1:8545",
      ETHEREUM_USDC_ADDRESS: USDC,
      ETHEREUM_USDT_ADDRESS: "",
    } as NodeJS.ProcessEnv);
    expect(chains).toHaveLength(1);
    expect(chains[0]!.tokenAddresses).toEqual({ USDC });
  });

  it("includes a well-formed treasury address on the chain", () => {
    const chains = getChains({
      ETHEREUM_RPC_URL: "http://127.0.0.1:8545",
      ETHEREUM_TREASURY_ADDRESS: TREASURY,
    } as NodeJS.ProcessEnv);
    expect(chains[0]!.treasuryAddress).toBe(TREASURY);
  });

  it("drops a malformed treasury address without invalidating the chain's RPC availability", () => {
    const chains = getChains({
      ETHEREUM_RPC_URL: "http://127.0.0.1:8545",
      ETHEREUM_TREASURY_ADDRESS: "not-an-address",
    } as NodeJS.ProcessEnv);
    expect(chains).toHaveLength(1);
    expect(chains[0]!.treasuryAddress).toBeUndefined();
  });

  it("treats a blank treasury address the same as unset", () => {
    const chains = getChains({
      ETHEREUM_RPC_URL: "http://127.0.0.1:8545",
      ETHEREUM_TREASURY_ADDRESS: "",
    } as NodeJS.ProcessEnv);
    expect(chains[0]!.treasuryAddress).toBeUndefined();
  });

  it("a bad env var on one chain doesn't take down another chain", () => {
    const chains = getChains({
      ETHEREUM_RPC_URL: "http://127.0.0.1:8545",
      ARBITRUM_RPC_URL: "not-a-url",
    } as NodeJS.ProcessEnv);
    expect(chains.map((c) => c.key)).toEqual(["ETHEREUM"]);
  });
});

describe("getChain", () => {
  beforeEach(() => resetChainsCacheForTests());

  it("finds a configured chain by key", () => {
    const env = { ETHEREUM_RPC_URL: "http://127.0.0.1:8545" } as NodeJS.ProcessEnv;
    expect(getChain("ETHEREUM", env)?.key).toBe("ETHEREUM");
  });

  it("returns undefined for an unconfigured chain", () => {
    expect(getChain("ARBITRUM", {} as NodeJS.ProcessEnv)).toBeUndefined();
  });
});

describe("getPayableChains", () => {
  beforeEach(() => resetChainsCacheForTests());

  it("excludes an RPC-configured chain with no treasury address", () => {
    const env = { ETHEREUM_RPC_URL: "http://127.0.0.1:8545" } as NodeJS.ProcessEnv;
    expect(getPayableChains(env)).toHaveLength(0);
  });

  it("excludes a treasury address with no RPC configured", () => {
    const env = { ETHEREUM_TREASURY_ADDRESS: TREASURY } as NodeJS.ProcessEnv;
    expect(getPayableChains(env)).toHaveLength(0);
  });

  it("includes a chain with both RPC and treasury configured", () => {
    const env = {
      ETHEREUM_RPC_URL: "http://127.0.0.1:8545",
      ETHEREUM_TREASURY_ADDRESS: TREASURY,
    } as NodeJS.ProcessEnv;
    const payable = getPayableChains(env);
    expect(payable).toHaveLength(1);
    expect(payable[0]).toMatchObject({ key: "ETHEREUM", treasuryAddress: TREASURY });
  });
});
