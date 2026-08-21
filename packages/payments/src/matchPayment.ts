import type { ObservedTransfer, PaymentVerificationResult, PendingPayment } from "./types.js";

/**
 * Precise decimal string comparison — avoids float error on-chain amounts
 * would otherwise cause (e.g. 0.1 + 0.2 style bugs) at 6-18 decimal places.
 */
export function compareDecimalStrings(a: string, b: string): number {
  const [aInt, aFrac = ""] = a.split(".");
  const [bInt, bFrac = ""] = b.split(".");
  const fracLen = Math.max(aFrac.length, bFrac.length);
  const aNorm = BigInt(aInt + aFrac.padEnd(fracLen, "0"));
  const bNorm = BigInt(bInt + bFrac.padEnd(fracLen, "0"));
  if (aNorm < bNorm) return -1;
  if (aNorm > bNorm) return 1;
  return 0;
}

export interface MatchPaymentParams {
  expected: PendingPayment;
  /** Transfers to the treasury observed on-chain, already filtered to this chain. */
  observed: ObservedTransfer[];
  /** tx hashes already consumed by a different payment — guards against double-counting one payment. */
  alreadyConsumedTxHashes: ReadonlySet<string>;
  /** Injectable for tests; defaults to the real current time. */
  now?: Date;
}

/**
 * The core payment-verification decision, isolated from RPC I/O so it's
 * exhaustively unit-testable. This is one of the three things CLAUDE.md
 * rule 8 says must never break.
 *
 * Matches only transfers from the payment's known `fromAddress` (SPEC §6
 * MVP verification), then classifies the best candidate:
 *   same token + amount >= expected + within window -> VERIFIED
 *   otherwise, the most specific failure reason on the first candidate tx.
 *
 * A payment with *no* candidate transfer at all stays AWAITING only while
 * its window hasn't closed yet — once `now` passes `windowExpiresAt` with
 * nothing ever having arrived, this returns LATE instead of AWAITING
 * forever. Without this, a payment that's never paid at all has no way to
 * ever leave AWAITING (unlike a late-but-real transfer, which the loop
 * below already classifies as LATE) — the campaign it belongs to would
 * wait indefinitely with no path to retry or cancel.
 */
export function matchPayment(params: MatchPaymentParams): PaymentVerificationResult {
  const { expected, observed, alreadyConsumedTxHashes, now = new Date() } = params;

  const fromSender = observed
    .filter((t) => t.fromAddress.toLowerCase() === expected.fromAddress.toLowerCase())
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  if (fromSender.length === 0) {
    return now > expected.windowExpiresAt ? { status: "LATE" } : { status: "AWAITING" };
  }

  for (const transfer of fromSender) {
    if (alreadyConsumedTxHashes.has(transfer.txHash)) continue;
    if (transfer.token !== expected.token) continue;
    if (compareDecimalStrings(transfer.amount, expected.expectedAmount) < 0) continue;
    if (transfer.occurredAt > expected.windowExpiresAt) continue;
    return { status: "VERIFIED", txHash: transfer.txHash };
  }

  // No clean match — report the most specific reason found on the first
  // unconsumed candidate, so the admin/protocol sees why, not just "no".
  const candidate = fromSender.find((t) => !alreadyConsumedTxHashes.has(t.txHash));
  if (!candidate) {
    return { status: "DUPLICATE", txHash: fromSender[0]!.txHash };
  }
  if (candidate.token !== expected.token) {
    return { status: "WRONG_TOKEN", txHash: candidate.txHash, observedToken: candidate.token };
  }
  if (compareDecimalStrings(candidate.amount, expected.expectedAmount) < 0) {
    return { status: "UNDERPAID", txHash: candidate.txHash, observedAmount: candidate.amount };
  }
  if (candidate.occurredAt > expected.windowExpiresAt) {
    return { status: "LATE", txHash: candidate.txHash };
  }
  // Unreachable given the loop above already returns VERIFIED for this case.
  return { status: "AWAITING" };
}
