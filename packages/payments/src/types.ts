import type { ChainConfig } from "@emp/config";

export type TokenSymbol = "USDC" | "USDT" | "ETH";

/**
 * A chain EMP can actually receive payment on: RPC-configured (env,
 * @emp/config's ChainConfig) AND treasury-configured (DB, admin-set — see
 * @emp/core's getPayableChains, the only place this type is constructed).
 */
export interface PayableChainConfig extends ChainConfig {
  treasuryAddress: `0x${string}`;
}

export type PaymentStatus = "AWAITING" | "VERIFIED" | "UNDERPAID" | "WRONG_TOKEN" | "LATE" | "DUPLICATE";

export interface PendingPayment {
  id: string;
  campaignId: string;
  chainKey: string;
  token: TokenSymbol;
  /** Decimal string in human units, e.g. "125.50". */
  expectedAmount: string;
  /** The protocol's authenticated wallet — MVP verification keys off this (SPEC §6). */
  fromAddress: string;
  windowExpiresAt: Date;
}

/** A transfer to the EMP treasury observed on-chain, normalized to human units. */
export interface ObservedTransfer {
  token: TokenSymbol;
  amount: string;
  fromAddress: string;
  txHash: string;
  occurredAt: Date;
}

export interface PaymentVerificationResult {
  status: PaymentStatus;
  txHash?: string;
  observedAmount?: string;
  observedToken?: TokenSymbol;
}

/**
 * Behind-an-interface per CLAUDE.md rule 6 / SPEC §6: MVP implementation is
 * EvmTreasuryWatcher (RPC polling, see evmTreasuryWatcher.ts). Phase-2's
 * CampaignPaymentsContract verifier (campaignPaymentsContract.stub.ts) slots
 * in later without callers changing — how each implementation observes the
 * chain is its own business, hidden behind this one method.
 */
export interface PaymentVerifier {
  checkPayment(payment: PendingPayment): Promise<PaymentVerificationResult>;
}
