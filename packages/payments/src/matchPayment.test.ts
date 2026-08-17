import { describe, expect, it } from "vitest";
import { compareDecimalStrings, matchPayment } from "./matchPayment.js";
import type { ObservedTransfer, PendingPayment } from "./types.js";

const SENDER = "0xAbC0000000000000000000000000000000dEf1";

function expected(overrides: Partial<PendingPayment> = {}): PendingPayment {
  return {
    id: "payment-1",
    campaignId: "campaign-1",
    chainKey: "ETHEREUM",
    token: "USDC",
    expectedAmount: "125.00",
    fromAddress: SENDER,
    windowExpiresAt: new Date("2026-01-01T12:00:00Z"),
    ...overrides,
  };
}

function transfer(overrides: Partial<ObservedTransfer> = {}): ObservedTransfer {
  return {
    token: "USDC",
    amount: "125.00",
    fromAddress: SENDER,
    txHash: "0xtx1",
    occurredAt: new Date("2026-01-01T10:00:00Z"),
    ...overrides,
  };
}

describe("compareDecimalStrings", () => {
  it("compares decimals of differing precision correctly", () => {
    expect(compareDecimalStrings("125", "125.00")).toBe(0);
    expect(compareDecimalStrings("125.5", "125.499999")).toBe(1);
    expect(compareDecimalStrings("0.1", "0.2")).toBe(-1);
  });
});

describe("matchPayment — payment verification (must not break)", () => {
  it("verifies an exact token/amount match from the expected sender", () => {
    const result = matchPayment({
      expected: expected(),
      observed: [transfer()],
      alreadyConsumedTxHashes: new Set(),
    });
    expect(result).toEqual({ status: "VERIFIED", txHash: "0xtx1" });
  });

  it("verifies an overpayment (same token, amount >= expected)", () => {
    const result = matchPayment({
      expected: expected(),
      observed: [transfer({ amount: "200.00" })],
      alreadyConsumedTxHashes: new Set(),
    });
    expect(result.status).toBe("VERIFIED");
  });

  it("stays AWAITING when nothing has arrived from the sender yet", () => {
    const result = matchPayment({
      expected: expected(),
      observed: [],
      alreadyConsumedTxHashes: new Set(),
    });
    expect(result).toEqual({ status: "AWAITING" });
  });

  it("ignores transfers from a different address entirely", () => {
    const result = matchPayment({
      expected: expected(),
      observed: [transfer({ fromAddress: "0x0000000000000000000000000000000000dead" })],
      alreadyConsumedTxHashes: new Set(),
    });
    expect(result).toEqual({ status: "AWAITING" });
  });

  it("flags underpayment", () => {
    const result = matchPayment({
      expected: expected(),
      observed: [transfer({ amount: "100.00" })],
      alreadyConsumedTxHashes: new Set(),
    });
    expect(result).toEqual({ status: "UNDERPAID", txHash: "0xtx1", observedAmount: "100.00" });
  });

  it("flags the wrong token even at the right amount", () => {
    const result = matchPayment({
      expected: expected({ token: "USDC" }),
      observed: [transfer({ token: "USDT" })],
      alreadyConsumedTxHashes: new Set(),
    });
    expect(result).toEqual({ status: "WRONG_TOKEN", txHash: "0xtx1", observedToken: "USDT" });
  });

  it("flags a correct payment that arrived after the window closed", () => {
    const result = matchPayment({
      expected: expected({ windowExpiresAt: new Date("2026-01-01T09:00:00Z") }),
      observed: [transfer({ occurredAt: new Date("2026-01-01T10:00:00Z") })],
      alreadyConsumedTxHashes: new Set(),
    });
    expect(result).toEqual({ status: "LATE", txHash: "0xtx1" });
  });

  it("flags a tx hash already consumed by another payment as duplicate", () => {
    const result = matchPayment({
      expected: expected(),
      observed: [transfer()],
      alreadyConsumedTxHashes: new Set(["0xtx1"]),
    });
    expect(result).toEqual({ status: "DUPLICATE", txHash: "0xtx1" });
  });

  it("skips a consumed tx and matches a later valid one from the same sender", () => {
    const result = matchPayment({
      expected: expected(),
      observed: [
        transfer({ txHash: "0xtx1", occurredAt: new Date("2026-01-01T09:00:00Z") }),
        transfer({ txHash: "0xtx2", occurredAt: new Date("2026-01-01T10:00:00Z") }),
      ],
      alreadyConsumedTxHashes: new Set(["0xtx1"]),
    });
    expect(result).toEqual({ status: "VERIFIED", txHash: "0xtx2" });
  });

  it("never verifies against an unconsumed but wrong-token tx when a later correct one exists", () => {
    const result = matchPayment({
      expected: expected(),
      observed: [
        transfer({ txHash: "0xtx1", token: "USDT", occurredAt: new Date("2026-01-01T09:00:00Z") }),
        transfer({ txHash: "0xtx2", token: "USDC", occurredAt: new Date("2026-01-01T10:00:00Z") }),
      ],
      alreadyConsumedTxHashes: new Set(),
    });
    expect(result).toEqual({ status: "VERIFIED", txHash: "0xtx2" });
  });
});
