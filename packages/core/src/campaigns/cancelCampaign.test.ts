import { describe, expect, it, vi } from "vitest";
import { CampaignNotCancellableError, cancelCampaign, type CancelCampaignPort } from "./cancelCampaign.js";
import { CampaignNotFoundError, CampaignNotOwnedError } from "./updateCompose.js";

const PROTOCOL_ID = "protocol-1";
const CAMPAIGN_ID = "campaign-1";

function fakePort(overrides: Partial<CancelCampaignPort> = {}): CancelCampaignPort {
  return {
    getCampaignOwnerStatusAndPayment: vi
      .fn()
      .mockResolvedValue({ protocolId: PROTOCOL_ID, status: "IN_REVIEW", hasVerifiedPayment: false }),
    cancel: vi.fn(),
    ...overrides,
  };
}

describe("cancelCampaign — giving up before any payment exists", () => {
  it("cancels an IN_REVIEW campaign", async () => {
    const port = fakePort();
    await cancelCampaign(port, { campaignId: CAMPAIGN_ID, protocolId: PROTOCOL_ID });
    expect(port.cancel).toHaveBeenCalledWith(CAMPAIGN_ID);
  });

  it("cancels an APPROVED campaign that hasn't picked a chain/token yet", async () => {
    const port = fakePort({
      getCampaignOwnerStatusAndPayment: vi
        .fn()
        .mockResolvedValue({ protocolId: PROTOCOL_ID, status: "APPROVED", hasVerifiedPayment: false }),
    });
    await cancelCampaign(port, { campaignId: CAMPAIGN_ID, protocolId: PROTOCOL_ID });
    expect(port.cancel).toHaveBeenCalledWith(CAMPAIGN_ID);
  });

  it("throws when the campaign doesn't exist", async () => {
    const port = fakePort({ getCampaignOwnerStatusAndPayment: vi.fn().mockResolvedValue(null) });
    await expect(cancelCampaign(port, { campaignId: CAMPAIGN_ID, protocolId: PROTOCOL_ID })).rejects.toThrow(
      CampaignNotFoundError,
    );
  });

  it("throws when the campaign belongs to a different protocol", async () => {
    const port = fakePort({
      getCampaignOwnerStatusAndPayment: vi
        .fn()
        .mockResolvedValue({ protocolId: "someone-else", status: "IN_REVIEW", hasVerifiedPayment: false }),
    });
    await expect(cancelCampaign(port, { campaignId: CAMPAIGN_ID, protocolId: PROTOCOL_ID })).rejects.toThrow(
      CampaignNotOwnedError,
    );
  });

  it.each(["DRAFT", "REJECTED", "AWAITING_PAYMENT", "SCHEDULED", "SENDING", "COMPLETE", "CANCELLED"])(
    "refuses to cancel a %s campaign",
    async (status) => {
      const port = fakePort({
        getCampaignOwnerStatusAndPayment: vi
          .fn()
          .mockResolvedValue({ protocolId: PROTOCOL_ID, status, hasVerifiedPayment: false }),
      });
      await expect(cancelCampaign(port, { campaignId: CAMPAIGN_ID, protocolId: PROTOCOL_ID })).rejects.toThrow(
        CampaignNotCancellableError,
      );
      expect(port.cancel).not.toHaveBeenCalled();
    },
  );

  it("refuses to cancel an APPROVED campaign if a verified payment somehow already exists — never trusts the status label alone", async () => {
    const port = fakePort({
      getCampaignOwnerStatusAndPayment: vi
        .fn()
        .mockResolvedValue({ protocolId: PROTOCOL_ID, status: "APPROVED", hasVerifiedPayment: true }),
    });
    await expect(cancelCampaign(port, { campaignId: CAMPAIGN_ID, protocolId: PROTOCOL_ID })).rejects.toThrow(
      CampaignNotCancellableError,
    );
    expect(port.cancel).not.toHaveBeenCalled();
  });
});
