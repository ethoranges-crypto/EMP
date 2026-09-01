import { describe, expect, it } from "vitest";
import {
  AlreadyBoundError,
  AlreadyLinkedError,
  CooldownActiveError,
  attemptLink,
  unlinkTelegram,
  type TelegramLinkPort,
} from "./telegramLinking.js";

interface FakeLink {
  userId: string;
  chatId: string;
  active: boolean;
}

interface FakeHistoryRow {
  userId: string;
  chatId: string;
  unlinkedAt: Date;
}

/** Minimal in-memory model of the invariant, standing in for Postgres. */
function createFakeStore() {
  const links: FakeLink[] = [];
  const history: FakeHistoryRow[] = [];

  const port: TelegramLinkPort = {
    async findActiveLinkByChatId(chatId) {
      const link = links.find((l) => l.chatId === chatId && l.active);
      return link ? { userId: link.userId } : null;
    },
    async findActiveLinkByUserId(userId) {
      const link = links.find((l) => l.userId === userId && l.active);
      return link ? { chatId: link.chatId } : null;
    },
    async findMostRecentUnlink(chatId) {
      const rows = history
        .filter((h) => h.chatId === chatId)
        .sort((a, b) => b.unlinkedAt.getTime() - a.unlinkedAt.getTime());
      return rows[0] ? { unlinkedAt: rows[0].unlinkedAt } : null;
    },
    async createVerifiedLink(userId, chatId) {
      links.push({ userId, chatId, active: true });
    },
    async unlink(userId, now) {
      const link = links.find((l) => l.userId === userId && l.active);
      if (!link) return null;
      link.active = false;
      history.push({ userId, chatId: link.chatId, unlinkedAt: now });
      return { chatId: link.chatId };
    },
  };

  return { port, links, history };
}

describe("attemptLink — SPEC §7.5 account uniqueness", () => {
  it("links a fresh chat_id to a fresh account", async () => {
    const { port, links } = createFakeStore();
    await attemptLink(port, { userId: "user-1", chatId: "chat-1", cooldownDays: 30 });
    expect(links).toEqual([{ userId: "user-1", chatId: "chat-1", active: true }]);
  });

  it("is idempotent when the same account re-links the same chat_id", async () => {
    const { port, links } = createFakeStore();
    await attemptLink(port, { userId: "user-1", chatId: "chat-1", cooldownDays: 30 });
    await expect(
      attemptLink(port, { userId: "user-1", chatId: "chat-1", cooldownDays: 30 }),
    ).resolves.toBeUndefined();
    expect(links).toHaveLength(1);
  });

  it("rejects a chat_id already VERIFIED on a different account", async () => {
    const { port } = createFakeStore();
    await attemptLink(port, { userId: "user-1", chatId: "chat-1", cooldownDays: 30 });
    await expect(
      attemptLink(port, { userId: "user-2", chatId: "chat-1", cooldownDays: 30 }),
    ).rejects.toBeInstanceOf(AlreadyBoundError);
  });

  it("rejects a second chat_id for an account that already has one", async () => {
    const { port } = createFakeStore();
    await attemptLink(port, { userId: "user-1", chatId: "chat-1", cooldownDays: 30 });
    await expect(
      attemptLink(port, { userId: "user-1", chatId: "chat-2", cooldownDays: 30 }),
    ).rejects.toBeInstanceOf(AlreadyLinkedError);
  });

  it("rejects a re-link to a different account inside the cooldown window", async () => {
    const { port } = createFakeStore();
    const linkedAt = new Date("2026-01-01T00:00:00Z");
    await attemptLink(port, { userId: "user-1", chatId: "chat-1", cooldownDays: 30, now: linkedAt });
    await unlinkTelegram(port, { userId: "user-1", now: linkedAt });

    const tooSoon = new Date("2026-01-20T00:00:00Z"); // 19 days later
    await expect(
      attemptLink(port, { userId: "user-2", chatId: "chat-1", cooldownDays: 30, now: tooSoon }),
    ).rejects.toBeInstanceOf(CooldownActiveError);
  });

  it("allows a re-link to a different account once the cooldown has elapsed", async () => {
    const { port, links } = createFakeStore();
    const linkedAt = new Date("2026-01-01T00:00:00Z");
    await attemptLink(port, { userId: "user-1", chatId: "chat-1", cooldownDays: 30, now: linkedAt });
    await unlinkTelegram(port, { userId: "user-1", now: linkedAt });

    const later = new Date("2026-02-01T00:01:00Z"); // 31 days later
    await attemptLink(port, { userId: "user-2", chatId: "chat-1", cooldownDays: 30, now: later });

    const activeLinks = links.filter((l) => l.active);
    expect(activeLinks).toEqual([{ userId: "user-2", chatId: "chat-1", active: true }]);
  });

  it("frees the account and closes the history row on unlink", async () => {
    const { port } = createFakeStore();
    await attemptLink(port, { userId: "user-1", chatId: "chat-1", cooldownDays: 30 });
    const result = await unlinkTelegram(port, { userId: "user-1" });
    expect(result).toEqual({ chatId: "chat-1" });
    await expect(attemptLink(port, { userId: "user-2", chatId: "chat-1", cooldownDays: 0 })).resolves.toBeUndefined();
  });

  it("unlinking an account with no active link is a no-op", async () => {
    const { port } = createFakeStore();
    await expect(unlinkTelegram(port, { userId: "ghost" })).resolves.toBeNull();
  });
});
