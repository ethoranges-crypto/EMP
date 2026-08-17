import { AlreadyBoundError, AlreadyLinkedError, CooldownActiveError } from "./errors.js";
import type { TelegramLinkPort, UnlinkReason } from "./ports.js";

export { AlreadyBoundError, AlreadyLinkedError, CooldownActiveError };
export type { TelegramLinkPort, UnlinkReason };

export interface AttemptLinkParams {
  userId: string;
  chatId: string;
  /** RELINK_COOLDOWN_DAYS from @emp/config — passed in, not read here, to keep this pure. */
  cooldownDays: number;
  now?: Date;
}

/**
 * Enforces SPEC §7.5's strict 1:1:1 mapping before writing a link:
 *  1. This chat_id isn't already VERIFIED on a different account.
 *  2. This account doesn't already have a different VERIFIED link.
 *  3. If this chat_id was unlinked before, the cooldown has elapsed.
 *
 * Throws a typed error for each rejection reason so callers (the bot) can
 * surface a clear, specific message — never a generic failure.
 */
export async function attemptLink(port: TelegramLinkPort, params: AttemptLinkParams): Promise<void> {
  const now = params.now ?? new Date();

  const activeForChat = await port.findActiveLinkByChatId(params.chatId);
  if (activeForChat) {
    if (activeForChat.userId === params.userId) return; // already linked here — idempotent
    throw new AlreadyBoundError(params.chatId);
  }

  const activeForUser = await port.findActiveLinkByUserId(params.userId);
  if (activeForUser) {
    throw new AlreadyLinkedError(params.userId);
  }

  const lastUnlink = await port.findMostRecentUnlink(params.chatId);
  if (lastUnlink) {
    const cooldownEndsAt = new Date(
      lastUnlink.unlinkedAt.getTime() + params.cooldownDays * 24 * 60 * 60 * 1000,
    );
    if (now < cooldownEndsAt) {
      throw new CooldownActiveError(cooldownEndsAt);
    }
  }

  await port.createVerifiedLink(params.userId, params.chatId, now);
}

export interface UnlinkTelegramParams {
  userId: string;
  reason?: UnlinkReason;
  now?: Date;
}

/** Self-service (or admin-ban) unlink. A no-op if the account has no active link. */
export async function unlinkTelegram(
  port: TelegramLinkPort,
  params: UnlinkTelegramParams,
): Promise<{ chatId: string } | null> {
  return port.unlink(params.userId, params.now ?? new Date(), params.reason ?? "USER_UNLINK");
}
