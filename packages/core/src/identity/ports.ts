export type UnlinkReason = "USER_UNLINK" | "ADMIN_BAN";

/**
 * Storage port for telegram linking. Kept separate from Prisma so the
 * uniqueness invariant in telegramLinking.ts is unit-testable with an
 * in-memory fake, no database required — this logic is one of the three
 * things CLAUDE.md rule 8 says must never break, so it needs to be cheap to
 * test exhaustively.
 */
export interface TelegramLinkPort {
  /** The VERIFIED link currently bound to this chat_id, if any. */
  findActiveLinkByChatId(chatId: string): Promise<{ userId: string } | null>;
  /** The VERIFIED link currently held by this account, if any. */
  findActiveLinkByUserId(userId: string): Promise<{ chatId: string } | null>;
  /** Most recent unlink event for this chat_id, across any account. */
  findMostRecentUnlink(chatId: string): Promise<{ unlinkedAt: Date } | null>;
  /** Creates a VERIFIED link and its opening history row, atomically. */
  createVerifiedLink(userId: string, chatId: string, now: Date): Promise<void>;
  /** Marks the account's active link UNLINKED and closes its history row. Returns the freed chat_id, or null if there was no active link. */
  unlink(userId: string, now: Date, reason: UnlinkReason): Promise<{ chatId: string } | null>;
}
