import { describe, expect, it } from "vitest";
import {
  setCampaignPaymentMethod,
  CampaignNotApprovedError,
  InvalidPaymentChainError,
  InvalidPaymentTokenError,
  type SetPaymentMethodPort,
} from "./setPaymentMethod.js";
import { CampaignNotFoundError, CampaignNotOwnedError } from "./updateCompose.js";

function createFakePort(overrides: Partial<SetPaymentMethodPort> = {}): SetPaymentMethodPort {
  return {
    getCampaignOwnerAndStatus: async () => ({ protocolId: "protocol-1", status: "APPROVED" }),
    savePaymentMethod: async () => {},
    ...overrides,
  };
}

const baseParams = {
  campaignId: "campaign-1",
  protocolId: "protocol-1",
  chain: "ETHEREUM",
  token: "USDC",
  validChainKeys: ["ETHEREUM", "ARBITRUM"],
};

describe("setCampaignPaymentMethod — SPEC §6", () => {
  it("saves a valid chain/token choice", async () => {
    let saved: unknown;
    const port = createFakePort({ savePaymentMethod: async (id, chain, token) => { saved = { id, chain, token }; } });
    await setCampaignPaymentMethod(port, baseParams);
    expect(saved).toEqual({ id: "campaign-1", chain: "ETHEREUM", token: "USDC" });
  });

  it("accepts USDT too", async () => {
    const port = createFakePort();
    await expect(setCampaignPaymentMethod(port, { ...baseParams, token: "USDT" })).resolves.toBeUndefined();
  });

  it("refuses a campaign that doesn't exist", async () => {
    const port = createFakePort({ getCampaignOwnerAndStatus: async () => null });
    await expect(setCampaignPaymentMethod(port, baseParams)).rejects.toThrow(CampaignNotFoundError);
  });

  it("refuses a campaign owned by a different protocol", async () => {
    const port = createFakePort({
      getCampaignOwnerAndStatus: async () => ({ protocolId: "someone-else", status: "APPROVED" }),
    });
    await expect(setCampaignPaymentMethod(port, baseParams)).rejects.toThrow(CampaignNotOwnedError);
  });

  it("refuses a campaign that isn't APPROVED yet (e.g. still DRAFT)", async () => {
    const port = createFakePort({
      getCampaignOwnerAndStatus: async () => ({ protocolId: "protocol-1", status: "DRAFT" }),
    });
    await expect(setCampaignPaymentMethod(port, baseParams)).rejects.toThrow(CampaignNotApprovedError);
  });

  it("refuses a campaign that's already moved past APPROVED (e.g. AWAITING_PAYMENT)", async () => {
    const port = createFakePort({
      getCampaignOwnerAndStatus: async () => ({ protocolId: "protocol-1", status: "AWAITING_PAYMENT" }),
    });
    await expect(setCampaignPaymentMethod(port, baseParams)).rejects.toThrow(CampaignNotApprovedError);
  });

  it("rejects a chain that isn't in validChainKeys", async () => {
    const port = createFakePort();
    await expect(setCampaignPaymentMethod(port, { ...baseParams, chain: "SOLANA" })).rejects.toThrow(
      InvalidPaymentChainError,
    );
  });

  it("rejects ETH — only USDC/USDT are accepted", async () => {
    const port = createFakePort();
    await expect(setCampaignPaymentMethod(port, { ...baseParams, token: "ETH" })).rejects.toThrow(
      InvalidPaymentTokenError,
    );
  });

  it("checks ownership/status before ever validating chain/token", async () => {
    let saveCalled = false;
    const port = createFakePort({
      getCampaignOwnerAndStatus: async () => ({ protocolId: "someone-else", status: "APPROVED" }),
      savePaymentMethod: async () => { saveCalled = true; },
    });
    await expect(setCampaignPaymentMethod(port, { ...baseParams, chain: "NOT-A-CHAIN" })).rejects.toThrow(
      CampaignNotOwnedError,
    );
    expect(saveCalled).toBe(false);
  });
});
