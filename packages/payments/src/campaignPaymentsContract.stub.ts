import type { PaymentVerificationResult, PaymentVerifier, PendingPayment } from "./types.js";

/**
 * Phase-2 (SPEC §6 / §12) — NOT IMPLEMENTED. Placeholder so callers can code
 * against PaymentVerifier today and swap EvmTreasuryWatcher for this without
 * changing anything else, once the on-chain CampaignPaymentsContract exists:
 * `pay(campaignId, token, amount)` emitting `PaymentReceived`, with a single
 * `withdraw()` to treasury. Verification would then read that event instead
 * of polling raw transfers, giving explicit on-chain campaign<->payment
 * linkage instead of MVP's sender+amount+window heuristic.
 *
 * CLAUDE.md rule 6: stub behind a clean interface, do not implement.
 */
export class CampaignPaymentsContractVerifier implements PaymentVerifier {
  checkPayment(_payment: PendingPayment): Promise<PaymentVerificationResult> {
    throw new Error("CampaignPaymentsContractVerifier is a Phase-2 stub — not implemented in the MVP.");
  }
}
