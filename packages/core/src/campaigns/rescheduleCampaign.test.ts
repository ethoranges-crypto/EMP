import { describe, expect, it, vi } from "vitest";
import { CampaignNotScheduledError, rescheduleCampaign, type RescheduleCampaignPort } from "./rescheduleCampaign.js";
import { CampaignNotFoundError, CampaignNotOwnedError, InvalidScheduledSendAtError } from "./updateCompose.js";

const PROTOCOL_ID = "protocol-1";
const CAMPAIGN_ID = "campaign-1";

function fakePort(overrides: Partial<RescheduleCampaignPort> = {}): RescheduleCampaignPort {
  return {
    getCampaignOwnerAndStatus: vi.fn().mockResolvedValue({ protocolId: PROTOCOL_ID, status: "SCHEDULED" }),
    updateScheduledSendAt: vi.fn(),
    ...overrides,
  };
}

describe("rescheduleCampaign — a SCHEDULED campaign is already paid, so this is always a plain field update", () => {
  it("sets a new send time on a SCHEDULED campaign", async () => {
    const port = fakePort();
    await rescheduleCampaign(port, { campaignId: CAMPAIGN_ID, protocolId: PROTOCOL_ID, scheduledSendAt: "2026-09-01T15:00:00.000Z" });
    expect(port.updateScheduledSendAt).toHaveBeenCalledWith(CAMPAIGN_ID, new Date("2026-09-01T15:00:00.000Z"));
  });

  it("cancelling a scheduled send is the same call with null — pulls it out of the worker's due-scan without touching status or payment", async () => {
    const port = fakePort();
    await rescheduleCampaign(port, { campaignId: CAMPAIGN_ID, protocolId: PROTOCOL_ID, scheduledSendAt: null });
    expect(port.updateScheduledSendAt).toHaveBeenCalledWith(CAMPAIGN_ID, null);
  });

  it("rejects an unparseable send time", async () => {
    const port = fakePort();
    await expect(
      rescheduleCampaign(port, { campaignId: CAMPAIGN_ID, protocolId: PROTOCOL_ID, scheduledSendAt: "not-a-date" }),
    ).rejects.toThrow(InvalidScheduledSendAtError);
    expect(port.updateScheduledSendAt).not.toHaveBeenCalled();
  });

  it("throws when the campaign doesn't exist", async () => {
    const port = fakePort({ getCampaignOwnerAndStatus: vi.fn().mockResolvedValue(null) });
    await expect(
      rescheduleCampaign(port, { campaignId: CAMPAIGN_ID, protocolId: PROTOCOL_ID, scheduledSendAt: null }),
    ).rejects.toThrow(CampaignNotFoundError);
  });

  it("throws when the campaign belongs to a different protocol", async () => {
    const port = fakePort({
      getCampaignOwnerAndStatus: vi.fn().mockResolvedValue({ protocolId: "someone-else", status: "SCHEDULED" }),
    });
    await expect(
      rescheduleCampaign(port, { campaignId: CAMPAIGN_ID, protocolId: PROTOCOL_ID, scheduledSendAt: null }),
    ).rejects.toThrow(CampaignNotOwnedError);
    expect(port.updateScheduledSendAt).not.toHaveBeenCalled();
  });

  it.each(["AWAITING_PAYMENT", "SENDING", "COMPLETE", "APPROVED", "DRAFT"])(
    "refuses to reschedule a campaign that isn't SCHEDULED (e.g. %s)",
    async (status) => {
      const port = fakePort({
        getCampaignOwnerAndStatus: vi.fn().mockResolvedValue({ protocolId: PROTOCOL_ID, status }),
      });
      await expect(
        rescheduleCampaign(port, { campaignId: CAMPAIGN_ID, protocolId: PROTOCOL_ID, scheduledSendAt: null }),
      ).rejects.toThrow(CampaignNotScheduledError);
      expect(port.updateScheduledSendAt).not.toHaveBeenCalled();
    },
  );
});
