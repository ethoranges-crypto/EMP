import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@emp/db";
import { AlreadyBoundError, CooldownActiveError, attemptLink, unlinkTelegram } from "./telegramLinking.js";
import { createPrismaTelegramLinkStore } from "./prismaTelegramLinkStore.js";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required for the integration lane. Start Postgres " +
      "and run via `pnpm test:integration` — see packages/core/vitest.integration.config.ts.",
  );
}

/**
 * telegramLinking.test.ts proves the SPEC §7.5 rules against a fake
 * in-memory port; dbUniquenessBackstop.integration.test.ts proves the raw
 * Postgres partial-unique-index by writing directly via Prisma, bypassing
 * attemptLink() entirely. Neither exercises attemptLink() together with the
 * real Prisma-backed port (createPrismaTelegramLinkStore) against a real
 * database — the exact combination the bot's /start handler runs in
 * production. This file closes that gap, and specifically reproduces the
 * "second wallet links the same Telegram account" scenario end-to-end.
 */
describe("attemptLink + createPrismaTelegramLinkStore — SPEC §7.5 against real Postgres", () => {
  const store = createPrismaTelegramLinkStore(prisma);

  beforeEach(async () => {
    await prisma.$transaction([
      prisma.telegramLinkHistory.deleteMany(),
      prisma.telegramLink.deleteMany(),
      prisma.linkRequest.deleteMany(),
      prisma.userInterest.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("blocks a second wallet from linking a chat_id that is still actively (VERIFIED) linked elsewhere", async () => {
    const userA = await prisma.user.create({ data: { primaryWallet: "0xit-wallet-a", accountType: "EOA" } });
    const userB = await prisma.user.create({ data: { primaryWallet: "0xit-wallet-b", accountType: "EOA" } });
    const chatId = "it-shared-chat";

    await attemptLink(store, { userId: userA.id, chatId, cooldownDays: 30 });

    await expect(attemptLink(store, { userId: userB.id, chatId, cooldownDays: 30 })).rejects.toBeInstanceOf(
      AlreadyBoundError,
    );

    const active = await prisma.telegramLink.findFirst({ where: { chatId, status: "VERIFIED" } });
    expect(active?.userId).toBe(userA.id);
  });

  it("blocks a re-link to a different wallet inside the cooldown window after an unlink", async () => {
    const userA = await prisma.user.create({ data: { primaryWallet: "0xit-wallet-c", accountType: "EOA" } });
    const userB = await prisma.user.create({ data: { primaryWallet: "0xit-wallet-d", accountType: "EOA" } });
    const chatId = "it-cooldown-chat";

    await attemptLink(store, { userId: userA.id, chatId, cooldownDays: 30 });
    await unlinkTelegram(store, { userId: userA.id });

    await expect(attemptLink(store, { userId: userB.id, chatId, cooldownDays: 30 })).rejects.toBeInstanceOf(
      CooldownActiveError,
    );
  });

  it("allows a re-link to a different wallet once telegram_link_history no longer has the unlink row (e.g. a dev DB reset) — the active-uniqueness block still held while the row existed", async () => {
    const userA = await prisma.user.create({ data: { primaryWallet: "0xit-wallet-e", accountType: "EOA" } });
    const userB = await prisma.user.create({ data: { primaryWallet: "0xit-wallet-f", accountType: "EOA" } });
    const chatId = "it-reset-chat";

    await attemptLink(store, { userId: userA.id, chatId, cooldownDays: 30 });
    await unlinkTelegram(store, { userId: userA.id });
    await expect(attemptLink(store, { userId: userB.id, chatId, cooldownDays: 30 })).rejects.toBeInstanceOf(
      CooldownActiveError,
    );

    // Simulate wiping telegram_link_history (a dev DB reset), leaving no
    // record of the prior unlink for the cooldown check to find.
    await prisma.telegramLinkHistory.deleteMany({ where: { chatId } });

    await attemptLink(store, { userId: userB.id, chatId, cooldownDays: 30 });
    const active = await prisma.telegramLink.findFirst({ where: { chatId, status: "VERIFIED" } });
    expect(active?.userId).toBe(userB.id);
  });
});
