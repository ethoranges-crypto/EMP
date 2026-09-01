import { CampaignNotFoundError, CampaignNotOwnedError, InvalidScheduledSendAtError } from "./updateCompose.js";
import type { CampaignStatus } from "./moderation.js";

export class CampaignNotScheduledError extends Error {
  constructor(status: CampaignStatus) {
    super(`Campaign is ${status} — only a SCHEDULED campaign's send time can be changed.`);
    this.name = "CampaignNotScheduledError";
  }
}

export interface RescheduleCampaignPort {
  getCampaignOwnerAndStatus(campaignId: string): Promise<{ protocolId: string; status: CampaignStatus } | null>;
  updateScheduledSendAt(campaignId: string, scheduledSendAt: Date | null): Promise<void>;
}

export interface RescheduleCampaignParams {
  campaignId: string;
  protocolId: string;
  /** A new send time (ISO-8601, same parsing as compose's — see updateCompose.ts), or null to cancel the scheduled send. */
  scheduledSendAt: string | null;
}

function parseScheduledSendAt(raw: string | null): Date | null {
  if (raw === null) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new InvalidScheduledSendAtError(raw);
  return parsed;
}

/**
 * A SCHEDULED campaign is already paid (CLAUDE.md's scheduled-sending
 * addendum: "a scheduled campaign that hasn't fired yet is still paid") —
 * changing when it fires, or cancelling the send outright, is a plain field
 * update, never a new payment or a new campaign. There is deliberately no
 * status transition here: the campaign stays SCHEDULED whether a time is
 * set or just cleared (null == "paid, no active send time — pick one when
 * ready"), which is exactly what lets "cancel, then reschedule to a new
 * slot" (an explicit MVP requirement) work with no dead end and no
 * credits/refund bookkeeping. The periodic worker scan that fires due
 * campaigns (watchPayments.ts) only ever looks at rows with a non-null,
 * past-or-due scheduledSendAt, so clearing it here is enough to pull a
 * campaign out of the send queue.
 */
export async function rescheduleCampaign(port: RescheduleCampaignPort, params: RescheduleCampaignParams): Promise<void> {
  const campaign = await port.getCampaignOwnerAndStatus(params.campaignId);
  if (!campaign) throw new CampaignNotFoundError(params.campaignId);
  if (campaign.protocolId !== params.protocolId) throw new CampaignNotOwnedError(params.campaignId);
  if (campaign.status !== "SCHEDULED") throw new CampaignNotScheduledError(campaign.status);

  const scheduledSendAt = parseScheduledSendAt(params.scheduledSendAt);
  await port.updateScheduledSendAt(params.campaignId, scheduledSendAt);
}
