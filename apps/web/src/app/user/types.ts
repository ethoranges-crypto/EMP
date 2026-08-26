export type TelegramLinkStatus = "not_configured" | "none" | "pending" | "rejected" | "expired" | "linked";

/** Mirrors GET /api/user/me's response shape exactly. */
export interface UserMe {
  wallet: string;
  accountType: "EOA" | "SAFE";
  safeAddress: string | null;
  interestCategoryIds: string[];
  interestCategoryNames: string[];
  messageable: boolean;
  /** Self-service opt-out — true excludes this account from every audience/snapshot until resumed (POST /api/user/resume). */
  paused: boolean;
  telegramLinkStatus: TelegramLinkStatus;
  /** ISO timestamp, present only while telegramLinkStatus is "linked". */
  telegramVerifiedAt?: string;
  rejectionReason?: string;
  deepLink?: string;
  codeExpiresAt?: string;
}
