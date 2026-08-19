export type TelegramLinkStatus = "not_configured" | "none" | "pending" | "rejected" | "expired" | "linked";

/** Mirrors GET /api/user/me's response shape exactly. */
export interface UserMe {
  wallet: string;
  accountType: "EOA" | "SAFE";
  safeAddress: string | null;
  interestCategoryIds: string[];
  messageable: boolean;
  telegramLinkStatus: TelegramLinkStatus;
  rejectionReason?: string;
  deepLink?: string;
  codeExpiresAt?: string;
}
