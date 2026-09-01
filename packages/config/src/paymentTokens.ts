/**
 * SPEC §6: USDC/USDT only. Both are USD-pegged 1:1, so a locked USD cost is
 * directly the token amount to pay — no price feed, no conversion buffer.
 * ETH is deliberately not here (see schema.prisma's TokenSymbol comment).
 * Shared between the client (payment-step token picker) and the server
 * (real enforcement) so the two can never drift.
 */
export const PAYMENT_TOKENS = ["USDC", "USDT"] as const;

export type PaymentToken = (typeof PAYMENT_TOKENS)[number];

export function isPaymentToken(value: string): value is PaymentToken {
  return (PAYMENT_TOKENS as readonly string[]).includes(value);
}
