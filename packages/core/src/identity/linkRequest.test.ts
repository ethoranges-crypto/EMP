import { describe, expect, it } from "vitest";
import { createLinkRequest, redeemLinkRequest, type LinkRequestPort } from "./linkRequest.js";

interface FakeRequest {
  id: string;
  userId: string;
  code: string;
  expiresAt: Date;
}

function createFakeStore() {
  const requests: FakeRequest[] = [];
  let nextId = 1;

  const port: LinkRequestPort = {
    async invalidateExisting(userId) {
      for (let i = requests.length - 1; i >= 0; i--) {
        if (requests[i]!.userId === userId) requests.splice(i, 1);
      }
    },
    async create({ userId, code, expiresAt }) {
      requests.push({ id: String(nextId++), userId, code, expiresAt });
    },
    async findRedeemable(code, now) {
      const found = requests.find((r) => r.code === code && r.expiresAt > now);
      return found ? { id: found.id, userId: found.userId } : null;
    },
    async deleteById(id) {
      const idx = requests.findIndex((r) => r.id === id);
      if (idx >= 0) requests.splice(idx, 1);
    },
  };

  return { port, requests };
}

describe("createLinkRequest / redeemLinkRequest — single-use + time-bound (SPEC §7.5-adjacent)", () => {
  it("issues a redeemable code", async () => {
    const { port } = createFakeStore();
    const now = new Date("2026-01-01T00:00:00Z");
    const { code, expiresAt } = await createLinkRequest(port, { userId: "user-1", ttlMinutes: 15, now });
    expect(expiresAt.getTime()).toBe(now.getTime() + 15 * 60 * 1000);

    const redeemed = await redeemLinkRequest(port, code, now);
    expect(redeemed).toEqual({ userId: "user-1", requestId: "1" });
  });

  it("rejects an expired code", async () => {
    const { port } = createFakeStore();
    const now = new Date("2026-01-01T00:00:00Z");
    const { code } = await createLinkRequest(port, { userId: "user-1", ttlMinutes: 15, now });

    const later = new Date(now.getTime() + 16 * 60 * 1000);
    const redeemed = await redeemLinkRequest(port, code, later);
    expect(redeemed).toBeNull();
  });

  it("regenerating a code invalidates the prior one — the old code no longer redeems", async () => {
    const { port } = createFakeStore();
    const now = new Date("2026-01-01T00:00:00Z");
    const first = await createLinkRequest(port, { userId: "user-1", ttlMinutes: 15, now });
    const second = await createLinkRequest(port, { userId: "user-1", ttlMinutes: 15, now });

    expect(first.code).not.toBe(second.code);
    await expect(redeemLinkRequest(port, first.code, now)).resolves.toBeNull();
    await expect(redeemLinkRequest(port, second.code, now)).resolves.toEqual({ userId: "user-1", requestId: "2" });
  });

  it("regenerating for one user never touches another user's code", async () => {
    const { port } = createFakeStore();
    const now = new Date("2026-01-01T00:00:00Z");
    const userA = await createLinkRequest(port, { userId: "user-A", ttlMinutes: 15, now });
    await createLinkRequest(port, { userId: "user-B", ttlMinutes: 15, now });
    // user-A regenerates again
    const userA2 = await createLinkRequest(port, { userId: "user-A", ttlMinutes: 15, now });

    await expect(redeemLinkRequest(port, userA.code, now)).resolves.toBeNull();
    await expect(redeemLinkRequest(port, userA2.code, now)).resolves.not.toBeNull();
  });

  it("rejects an unknown code", async () => {
    const { port } = createFakeStore();
    await expect(redeemLinkRequest(port, "never-issued", new Date())).resolves.toBeNull();
  });

  it("a code is only redeemable once (redeeming does not itself delete — caller deletes on success, but a deleted code never redeems again)", async () => {
    const { port } = createFakeStore();
    const now = new Date("2026-01-01T00:00:00Z");
    const { code } = await createLinkRequest(port, { userId: "user-1", ttlMinutes: 15, now });
    const redemption = await redeemLinkRequest(port, code, now);
    expect(redemption).not.toBeNull();

    await port.deleteById(redemption!.requestId);
    await expect(redeemLinkRequest(port, code, now)).resolves.toBeNull();
  });
});
