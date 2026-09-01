import { describe, expect, it } from "vitest";
import {
  setCampaignPaymentMethod,
  CampaignCostNotLockedError,
  CampaignNotApprovedError,
  InvalidPaymentChainError,
  InvalidPaymentTokenError,
  type SetPaymentMethodPort,
} from "./setPaymentMethod.js";
import { CampaignNotFoundError, CampaignNotOwnedError } from "./updateCompose.js";

function createFakePort(overrides: Partial<SetPaymentMethodPort> = {}): SetPaymentMethodPort {
  return {
    getCampaignOwnerAndStatus: async () => ({ protocolId: "protocol-1", status: "APPROVED", costAmount: "125.5" }),
    openPaymentWindow: async () => {},
    ...overrides,
  };
}

const baseParams = {
  campaignId: "campaign-1",
  protocolId: "protocol-1",
  protocolWallet: "0xProtocolWallet",
  chain: "ETHEREUM",
  token: "USDC",
  validChainKeys: ["ETHEREUM", "ARBITRUM"],
  paymentWindowMinutes: 60,
  now: new Date("2026-01-01T00:00:00Z"),
};

describe("setCampaignPaymentMethod — SPEC §6", () => {
  it("opens the payment window with the locked cost, the protocol's wallet, and a window from now", async () => {
    let opened: unknown;
    const port = createFakePort({ openPaymentWindow: async (params) => { opened = params; } });
    await setCampaignPaymentMethod(port, baseParams);
    expect(opened).toEqual({
      campaignId: "campaign-1",
      chain: "ETHEREUM",
      token: "USDC",
      amount: "125.5",
      fromAddress: "0xProtocolWallet",
      windowExpiresAt: new Date("2026-01-01T01:00:00Z"),
    });
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
      getCampaignOwnerAndStatus: async () => ({ protocolId: "someone-else", status: "APPROVED", costAmount: "1" }),
    });
    await expect(setCampaignPaymentMethod(port, baseParams)).rejects.toThrow(CampaignNotOwnedError);
  });

  it("refuses a campaign that isn't APPROVED yet (e.g. still DRAFT)", async () => {
    const port = createFakePort({
      getCampaignOwnerAndStatus: async () => ({ protocolId: "protocol-1", status: "DRAFT", costAmount: null }),
    });
    await expect(setCampaignPaymentMethod(port, baseParams)).rejects.toThrow(CampaignNotApprovedError);
  });

  it("refuses a campaign that's already moved past APPROVED (e.g. AWAITING_PAYMENT)", async () => {
    const port = createFakePort({
      getCampaignOwnerAndStatus: async () => ({
        protocolId: "protocol-1",
        status: "AWAITING_PAYMENT",
        costAmount: "125.5",
      }),
    });
    await expect(setCampaignPaymentMethod(port, baseParams)).rejects.toThrow(CampaignNotApprovedError);
  });

  it("refuses an APPROVED campaign with no locked cost (shouldn't happen, but don't open a $0 window)", async () => {
    const port = createFakePort({
      getCampaignOwnerAndStatus: async () => ({ protocolId: "protocol-1", status: "APPROVED", costAmount: null }),
    });
    await expect(setCampaignPaymentMethod(port, baseParams)).rejects.toThrow(CampaignCostNotLockedError);
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
    let openCalled = false;
    const port = createFakePort({
      getCampaignOwnerAndStatus: async () => ({ protocolId: "someone-else", status: "APPROVED", costAmount: "1" }),
      openPaymentWindow: async () => { openCalled = true; },
    });
    await expect(setCampaignPaymentMethod(port, { ...baseParams, chain: "NOT-A-CHAIN" })).rejects.toThrow(
      CampaignNotOwnedError,
    );
    expect(openCalled).toBe(false);
  });
});
