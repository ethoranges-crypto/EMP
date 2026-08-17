import type { CategoryFilter } from "../protocolQueries/ports.js";
import { assertTransition } from "./moderation.js";

/**
 * Internal-only port: unlike ProtocolQueryPort, this one does return
 * chat_ids — because writing campaign_recipients requires them. This port
 * must never be reachable from a protocol-facing route; only the
 * admin-approval code path may use it. See CLAUDE.md rule 1.
 */
export interface SnapshotPort {
  listMessageableChatIds(filter: CategoryFilter): Promise<string[]>;
  /** Writes campaign_recipients for the snapshot and locks snapshotCount/costAmount on the campaign, atomically. */
  writeSnapshot(params: {
    campaignId: string;
    chatIds: string[];
    costAmount: string;
    now: Date;
  }): Promise<void>;
}

export interface ApproveCampaignParams {
  campaignId: string;
  categoryFilter: CategoryFilter;
  flatCostPerUser: number;
  now?: Date;
}

export interface ApproveCampaignResult {
  snapshotCount: number;
  costAmount: string;
}

/**
 * SPEC §4.3 step 5 / CLAUDE.md rule 3: on approval, snapshot the recipient
 * set and lock cost = flat_cost_per_user * snapshot_count. Both are
 * immutable afterwards — nothing downstream re-derives the audience.
 */
export async function approveCampaign(
  port: SnapshotPort,
  params: ApproveCampaignParams,
): Promise<ApproveCampaignResult> {
  assertTransition("IN_REVIEW", "APPROVED");
  const now = params.now ?? new Date();

  const chatIds = await port.listMessageableChatIds(params.categoryFilter);
  const costAmount = (params.flatCostPerUser * chatIds.length).toFixed(18);

  await port.writeSnapshot({
    campaignId: params.campaignId,
    chatIds,
    costAmount,
    now,
  });

  return { snapshotCount: chatIds.length, costAmount };
}
