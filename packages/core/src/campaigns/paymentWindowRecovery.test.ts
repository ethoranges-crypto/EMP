import { describe, expect, it, vi } from "vitest";
import {
  CampaignNotAwaitingPaymentError,
  PaymentWindowStillActiveError,
  cancelPaymentWindow,
  retryPaymentWindow,
} from "./paymentWindowRecovery.js";
import { CampaignNotFoundError, CampaignNotOwnedError } from "./updateCompose.js";
import type { PaymentWindowRecoveryPort } from "./paymentWindowRecovery.js";

const PROTOCOL_ID = "protocol-1";
const CAMPAIGN_ID = "campaign-1";

function fakePort(overrides: Partial<PaymentWindowRecoveryPort> = {}): PaymentWindowRecoveryPort {
  return {
    getCampaignAndLatestPaymentStatus: vi
      .fn()
      .mockResolvedValue({ protocolId: PROTOCOL_ID, status: "AWAITING_PAYMENT", latestPaymentStatus: "LATE" }),
    revertToApproved: vi.fn(),
    cancel: vi.fn(),
    ...overrides,
  };
}

describe("retryPaymentWindow", () => {
  it("reverts to APPROVED once the current payment is LATE", async () => {
    const port = fakePort();
    await retryPaymentWindow(port, { campaignId: CAMPAIGN_ID, protocolId: PROTOCOL_ID });
    expect(port.revertToApproved).toHaveBeenCalledWith(CAMPAIGN_ID);
  });

  it.each(["UNDERPAID", "WRONG_TOKEN", "DUPLICATE"])(
    "also allows retry when the payment came back %s",
    async (latestPaymentStatus) => {
      const port = fakePort({
        getCampaignAndLatestPaymentStatus: vi
          .fn()
          .mockResolvedValue({ protocolId: PROTOCOL_ID, status: "AWAITING_PAYMENT", latestPaymentStatus }),
      });
      await retryPaymentWindow(port, { campaignId: CAMPAIGN_ID, protocolId: PROTOCOL_ID });
      expect(port.revertToApproved).toHaveBeenCalledOnce();
    },
  );

  it("throws when the campaign doesn't exist", async () => {
    const port = fakePort({ getCampaignAndLatestPaymentStatus: vi.fn().mockResolvedValue(null) });
    await expect(retryPaymentWindow(port, { campaignId: CAMPAIGN_ID, protocolId: PROTOCOL_ID })).rejects.toThrow(
      CampaignNotFoundError,
    );
  });

  it("throws when the campaign belongs to a different protocol", async () => {
    const port = fakePort({
      getCampaignAndLatestPaymentStatus: vi
        .fn()
        .mockResolvedValue({ protocolId: "someone-else", status: "AWAITING_PAYMENT", latestPaymentStatus: "LATE" }),
    });
    await expect(retryPaymentWindow(port, { campaignId: CAMPAIGN_ID, protocolId: PROTOCOL_ID })).rejects.toThrow(
      CampaignNotOwnedError,
    );
  });

  it("throws when the campaign isn't AWAITING_PAYMENT", async () => {
    const port = fakePort({
      getCampaignAndLatestPaymentStatus: vi
        .fn()
        .mockResolvedValue({ protocolId: PROTOCOL_ID, status: "APPROVED", latestPaymentStatus: null }),
    });
    await expect(retryPaymentWindow(port, { campaignId: CAMPAIGN_ID, protocolId: PROTOCOL_ID })).rejects.toThrow(
      CampaignNotAwaitingPaymentError,
    );
  });

  it("refuses to retry while the current window is still actively AWAITING", async () => {
    const port = fakePort({
      getCampaignAndLatestPaymentStatus: vi
        .fn()
        .mockResolvedValue({ protocolId: PROTOCOL_ID, status: "AWAITING_PAYMENT", latestPaymentStatus: "AWAITING" }),
    });
    await expect(retryPaymentWindow(port, { campaignId: CAMPAIGN_ID, protocolId: PROTOCOL_ID })).rejects.toThrow(
      PaymentWindowStillActiveError,
    );
    expect(port.revertToApproved).not.toHaveBeenCalled();
  });
});

describe("cancelPaymentWindow", () => {
  it("cancels once the current payment is LATE", async () => {
    const port = fakePort();
    await cancelPaymentWindow(port, { campaignId: CAMPAIGN_ID, protocolId: PROTOCOL_ID });
    expect(port.cancel).toHaveBeenCalledWith(CAMPAIGN_ID);
  });

  it("refuses to cancel while the current window is still actively AWAITING", async () => {
    const port = fakePort({
      getCampaignAndLatestPaymentStatus: vi
        .fn()
        .mockResolvedValue({ protocolId: PROTOCOL_ID, status: "AWAITING_PAYMENT", latestPaymentStatus: "AWAITING" }),
    });
    await expect(cancelPaymentWindow(port, { campaignId: CAMPAIGN_ID, protocolId: PROTOCOL_ID })).rejects.toThrow(
      PaymentWindowStillActiveError,
    );
    expect(port.cancel).not.toHaveBeenCalled();
  });

  it("throws when the campaign doesn't own the caller", async () => {
    const port = fakePort({
      getCampaignAndLatestPaymentStatus: vi
        .fn()
        .mockResolvedValue({ protocolId: "someone-else", status: "AWAITING_PAYMENT", latestPaymentStatus: "LATE" }),
    });
    await expect(cancelPaymentWindow(port, { campaignId: CAMPAIGN_ID, protocolId: PROTOCOL_ID })).rejects.toThrow(
      CampaignNotOwnedError,
    );
  });
});
