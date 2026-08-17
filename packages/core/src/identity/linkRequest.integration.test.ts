import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@emp/db";
import { createLinkRequest, redeemLinkRequest } from "./linkRequest.js";
import { createPrismaLinkRequestStore } from "./prismaLinkRequestStore.js";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required for the integration lane. Run via `pnpm test:integration` — see packages/core/vitest.integration.config.ts.",
  );
}

/**
 * Real-Postgres proof that a one-time link code is genuinely single-use AND
 * time-bound (SPEC §7.5-adjacent — a pile of simultaneously-valid codes for
 * one account is an attack surface: an old code sitting in browser history
 * or a log file stays redeemable forever unless regenerating kills it).
 */
describe("LinkRequest — single-use + time-bound (integration, real Postgres)", () => {
  let userId: string;

  beforeEach(async () => {
    await prisma.linkRequest.deleteMany();
    await prisma.user.deleteMany();
    const user = await prisma.user.create({
      data: { primaryWallet: `0xlinkrequest-test-${Date.now()}-${Math.random()}`, accountType: "EOA" },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("an expired code is rejected", async () => {
    const store = createPrismaLinkRequestStore(prisma);
    const now = new Date();
    const { code } = await createLinkRequest(store, { userId, ttlMinutes: 15, now });

    const sixteenMinutesLater = new Date(now.getTime() + 16 * 60 * 1000);
    const redeemed = await redeemLinkRequest(store, code, sixteenMinutesLater);
    expect(redeemed).toBeNull();
  });

  it("a superseded code (regenerated over) is rejected, even though it hasn't expired yet", async () => {
    const store = createPrismaLinkRequestStore(prisma);
    const now = new Date();
    const old = await createLinkRequest(store, { userId, ttlMinutes: 15, now });
    const fresh = await createLinkRequest(store, { userId, ttlMinutes: 15, now });

    expect(old.code).not.toBe(fresh.code);
    await expect(redeemLinkRequest(store, old.code, now)).resolves.toBeNull();
    const redemption = await redeemLinkRequest(store, fresh.code, now);
    expect(redemption).toMatchObject({ userId });
  });

  it("only the latest, unexpired code redeems — three codes issued in a row, only the third works", async () => {
    const store = createPrismaLinkRequestStore(prisma);
    const now = new Date();
    const first = await createLinkRequest(store, { userId, ttlMinutes: 15, now });
    const second = await createLinkRequest(store, { userId, ttlMinutes: 15, now });
    const third = await createLinkRequest(store, { userId, ttlMinutes: 15, now });

    await expect(redeemLinkRequest(store, first.code, now)).resolves.toBeNull();
    await expect(redeemLinkRequest(store, second.code, now)).resolves.toBeNull();
    await expect(redeemLinkRequest(store, third.code, now)).resolves.toMatchObject({ userId });

    // and confirm it's a real single row in the DB, not just port-level bookkeeping
    const rows = await prisma.linkRequest.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.code).toBe(third.code);
  });

  it("regenerating for one account never invalidates another account's code", async () => {
    const otherUser = await prisma.user.create({
      data: { primaryWallet: `0xlinkrequest-test-other-${Date.now()}-${Math.random()}`, accountType: "EOA" },
    });
    const store = createPrismaLinkRequestStore(prisma);
    const now = new Date();
    const mine = await createLinkRequest(store, { userId, ttlMinutes: 15, now });
    const theirs = await createLinkRequest(store, { userId: otherUser.id, ttlMinutes: 15, now });
    await createLinkRequest(store, { userId, ttlMinutes: 15, now }); // I regenerate again

    await expect(redeemLinkRequest(store, theirs.code, now)).resolves.toMatchObject({ userId: otherUser.id });
    await expect(redeemLinkRequest(store, mine.code, now)).resolves.toBeNull();
  });
});
