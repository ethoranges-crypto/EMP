import { describe, expect, it, vi } from "vitest";
import { CampaignNotDeletableError, deleteCampaign, type DeleteCampaignPort } from "./deleteCampaign.js";
import { CampaignNotFoundError, CampaignNotOwnedError } from "./updateCompose.js";

const PROTOCOL_ID = "protocol-1";
const CAMPAIGN_ID = "campaign-1";

function fakePort(overrides: Partial<DeleteCampaignPort> = {}): DeleteCampaignPort {
  return {
    getCampaignOwnerStatusAndPayment: vi
      .fn()
      .mockResolvedValue({ protocolId: PROTOCOL_ID, status: "DRAFT", hasVerifiedPayment: false }),
    deleteCampaign: vi.fn(),
    ...overrides,
  };
}

describe("deleteCampaign — hard-deleting a campaign nothing was ever paid or sent for", () => {
  it("deletes a DRAFT campaign", async () => {
    const port = fakePort();
    await deleteCampaign(port, { campaignId: CAMPAIGN_ID, protocolId: PROTOCOL_ID });
    expect(port.deleteCampaign).toHaveBeenCalledWith(CAMPAIGN_ID);
  });

  it("deletes a REJECTED campaign", async () => {
    const port = fakePort({
      getCampaignOwnerStatusAndPayment: vi
        .fn()
        .mockResolvedValue({ protocolId: PROTOCOL_ID, status: "REJECTED", hasVerifiedPayment: false }),
    });
    await deleteCampaign(port, { campaignId: CAMPAIGN_ID, protocolId: PROTOCOL_ID });
    expect(port.deleteCampaign).toHaveBeenCalledWith(CAMPAIGN_ID);
  });

  it("throws when the campaign doesn't exist", async () => {
    const port = fakePort({ getCampaignOwnerStatusAndPayment: vi.fn().mockResolvedValue(null) });
    await expect(deleteCampaign(port, { campaignId: CAMPAIGN_ID, protocolId: PROTOCOL_ID })).rejects.toThrow(
      CampaignNotFoundError,
    );
  });

  it("throws when the campaign belongs to a different protocol", async () => {
    const port = fakePort({
      getCampaignOwnerStatusAndPayment: vi
        .fn()
        .mockResolvedValue({ protocolId: "someone-else", status: "DRAFT", hasVerifiedPayment: false }),
    });
    await expect(deleteCampaign(port, { campaignId: CAMPAIGN_ID, protocolId: PROTOCOL_ID })).rejects.toThrow(
      CampaignNotOwnedError,
    );
  });

  it.each(["IN_REVIEW", "APPROVED", "AWAITING_PAYMENT", "SCHEDULED", "SENDING", "COMPLETE", "CANCELLED"])(
    "refuses to delete a %s campaign",
    async (status) => {
      const port = fakePort({
        getCampaignOwnerStatusAndPayment: vi
          .fn()
          .mockResolvedValue({ protocolId: PROTOCOL_ID, status, hasVerifiedPayment: false }),
      });
      await expect(deleteCampaign(port, { campaignId: CAMPAIGN_ID, protocolId: PROTOCOL_ID })).rejects.toThrow(
        CampaignNotDeletableError,
      );
      expect(port.deleteCampaign).not.toHaveBeenCalled();
    },
  );

  it("refuses to delete a DRAFT campaign if a verified payment somehow already exists — never trusts the status label alone", async () => {
    const port = fakePort({
      getCampaignOwnerStatusAndPayment: vi
        .fn()
        .mockResolvedValue({ protocolId: PROTOCOL_ID, status: "DRAFT", hasVerifiedPayment: true }),
    });
    await expect(deleteCampaign(port, { campaignId: CAMPAIGN_ID, protocolId: PROTOCOL_ID })).rejects.toThrow(
      CampaignNotDeletableError,
    );
    expect(port.deleteCampaign).not.toHaveBeenCalled();
  });
});
