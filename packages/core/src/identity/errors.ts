/** This Telegram chat_id is already the VERIFIED link for a different account. */
export class AlreadyBoundError extends Error {
  constructor(public readonly chatId: string) {
    super(
      "This Telegram account is already linked to a different EMP account. " +
        "Unlink it there first before linking here.",
    );
    this.name = "AlreadyBoundError";
  }
}

/** This account already has a different VERIFIED Telegram link. */
export class AlreadyLinkedError extends Error {
  constructor(public readonly userId: string) {
    super(
      "This account already has a linked Telegram. Unlink it before linking a different one.",
    );
    this.name = "AlreadyLinkedError";
  }
}

/** chat_id was unlinked recently; the re-link cooldown (SPEC §7.5) hasn't elapsed. */
export class CooldownActiveError extends Error {
  constructor(public readonly cooldownEndsAt: Date) {
    super(
      `This Telegram account was recently unlinked elsewhere and can't be relinked until ${cooldownEndsAt.toISOString()}.`,
    );
    this.name = "CooldownActiveError";
  }
}
