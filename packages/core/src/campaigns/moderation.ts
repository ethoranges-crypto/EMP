export type CampaignStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "AWAITING_PAYMENT"
  | "SENDING"
  | "COMPLETE"
  | "CANCELLED";

/**
 * Encodes CLAUDE.md rule 2 (moderate -> pay -> send) as data, so no code
 * path can accidentally skip a step. APPROVED -> AWAITING_PAYMENT and
 * AWAITING_PAYMENT -> SENDING are the two gates: the first only fires after
 * admin approval (which also triggers the snapshot, see snapshot.ts), the
 * second only fires after payment verification (see @emp/payments).
 *
 * REJECTED -> IN_REVIEW is the resubmit path: a rejected campaign stays
 * editable (see updateCompose.ts/updateCampaignImage.ts's
 * EDITABLE_CAMPAIGN_STATUSES) and goes back through moderation via the same
 * submit action a fresh DRAFT uses (submitForReview.ts) — it never silently
 * reverts to DRAFT, so the rejection and its reason stay visible in the
 * protocol's campaign list until a new submission actually happens.
 *
 * AWAITING_PAYMENT -> APPROVED (retry) and AWAITING_PAYMENT -> CANCELLED
 * (give up) are the way out of a payment attempt that didn't pan out
 * (expired with nothing ever received, underpaid, wrong token, ...) — see
 * paymentWindowRecovery.ts. Both only fire once the *current* Payment row
 * is past AWAITING (matchPayment.ts's window-expiry check is what gets a
 * payment there in the first place) — otherwise a still-live payment
 * window and a fresh retry attempt could both be open at once, and an
 * on-chain transfer arriving late could match either.
 */
const ALLOWED_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: ["IN_REVIEW"],
  IN_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["AWAITING_PAYMENT"],
  REJECTED: ["IN_REVIEW"],
  AWAITING_PAYMENT: ["SENDING", "APPROVED", "CANCELLED"],
  SENDING: ["COMPLETE"],
  COMPLETE: [],
  CANCELLED: [],
};

export function canTransition(from: CampaignStatus, to: CampaignStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export class InvalidCampaignTransitionError extends Error {
  constructor(from: CampaignStatus, to: CampaignStatus) {
    super(`Cannot move campaign from ${from} to ${to}`);
    this.name = "InvalidCampaignTransitionError";
  }
}

export function assertTransition(from: CampaignStatus, to: CampaignStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidCampaignTransitionError(from, to);
  }
}
