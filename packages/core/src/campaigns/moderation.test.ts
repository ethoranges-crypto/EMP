import { describe, expect, it } from "vitest";
import { assertTransition, canTransition, InvalidCampaignTransitionError } from "./moderation.js";

describe("campaign status transitions — CLAUDE.md rule 2 (moderate -> pay -> send)", () => {
  it("allows the full happy path", () => {
    expect(canTransition("DRAFT", "IN_REVIEW")).toBe(true);
    expect(canTransition("IN_REVIEW", "APPROVED")).toBe(true);
    expect(canTransition("APPROVED", "AWAITING_PAYMENT")).toBe(true);
    expect(canTransition("AWAITING_PAYMENT", "SENDING")).toBe(true);
    expect(canTransition("SENDING", "COMPLETE")).toBe(true);
  });

  it("allows a rejected campaign to be resubmitted", () => {
    expect(canTransition("IN_REVIEW", "REJECTED")).toBe(true);
    expect(canTransition("REJECTED", "IN_REVIEW")).toBe(true);
  });

  it("never lets a campaign skip moderation straight to APPROVED", () => {
    expect(canTransition("DRAFT", "APPROVED")).toBe(false);
    expect(canTransition("REJECTED", "APPROVED")).toBe(false);
  });

  it("never lets a campaign skip payment straight to SENDING", () => {
    expect(canTransition("APPROVED", "SENDING")).toBe(false);
    expect(canTransition("IN_REVIEW", "SENDING")).toBe(false);
  });

  it("COMPLETE is terminal", () => {
    expect(canTransition("COMPLETE", "DRAFT")).toBe(false);
    expect(canTransition("COMPLETE", "IN_REVIEW")).toBe(false);
  });

  it("allows retrying a payment that didn't pan out — back to APPROVED for a fresh attempt", () => {
    expect(canTransition("AWAITING_PAYMENT", "APPROVED")).toBe(true);
  });

  it("allows cancelling a payment that didn't pan out", () => {
    expect(canTransition("AWAITING_PAYMENT", "CANCELLED")).toBe(true);
  });

  it("CANCELLED is terminal", () => {
    expect(canTransition("CANCELLED", "APPROVED")).toBe(false);
    expect(canTransition("CANCELLED", "AWAITING_PAYMENT")).toBe(false);
  });

  it("never lets a campaign jump straight to CANCELLED from outside a payment attempt", () => {
    expect(canTransition("APPROVED", "CANCELLED")).toBe(false);
    expect(canTransition("DRAFT", "CANCELLED")).toBe(false);
  });

  it("allows payment verification to hold a scheduled campaign instead of sending immediately", () => {
    expect(canTransition("AWAITING_PAYMENT", "SCHEDULED")).toBe(true);
  });

  it("allows a scheduled campaign to fire once its send time arrives", () => {
    expect(canTransition("SCHEDULED", "SENDING")).toBe(true);
  });

  it("never lets a scheduled campaign skip straight to COMPLETE, or jump into SCHEDULED from outside payment verification", () => {
    expect(canTransition("SCHEDULED", "COMPLETE")).toBe(false);
    expect(canTransition("APPROVED", "SCHEDULED")).toBe(false);
    expect(canTransition("DRAFT", "SCHEDULED")).toBe(false);
  });

  it("SCHEDULED has no cancel-to-CANCELLED transition — cancelling a scheduled send is a field update (rescheduleCampaign.ts), not a status move, so it's never a dead end requiring a new campaign", () => {
    expect(canTransition("SCHEDULED", "CANCELLED")).toBe(false);
  });

  it("assertTransition throws InvalidCampaignTransitionError for a disallowed move", () => {
    expect(() => assertTransition("DRAFT", "APPROVED")).toThrow(InvalidCampaignTransitionError);
  });

  it("assertTransition is silent for an allowed move", () => {
    expect(() => assertTransition("IN_REVIEW", "APPROVED")).not.toThrow();
  });
});
