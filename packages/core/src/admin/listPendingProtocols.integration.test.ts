import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@emp/db";
import { listPendingProtocols } from "./listPendingProtocols.js";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required for the integration lane. Run via `pnpm test:integration` — see packages/core/vitest.integration.config.ts.",
  );
}

/**
 * Real-Postgres proof that the admin pending-protocols query actually
 * works against the real migrated schema and the real generated Prisma
 * Client — not just that it type-checks. This is exactly the gap that let
 * a real bug through once already: schema.prisma and the migration both
 * added Protocol.accountType/safeAddress, but nothing ran this select
 * against a real database until it 500'd in a browser. A unit test against
 * an in-memory fake couldn't have caught it — the failure mode was Prisma's
 * generated client not knowing about a field, which only exists once real
 * codegen + a real migration are both involved.
 *
 * Deliberately does NOT do a blanket protocol/campaign table wipe (other
 * integration files in this shared-database lane — see
 * vitest.integration.config.ts — seed their own protocol+campaign fixtures
 * with a deeper FK chain than this file wants to know about). Instead:
 * unique-per-run wallets (never collide, so no cleanup is even needed for
 * re-runs) and assertions scoped to just the rows this file created, so
 * leftover state from any other test — or a stale row from someone's own
 * manual testing against the same dev database — can't make this flaky.
 */
describe("listPendingProtocols (integration, real Postgres)", () => {
  const createdIds: string[] = [];
  const runId = `${Date.now()}-${Math.random()}`;

  afterEach(async () => {
    if (createdIds.length === 0) return;
    await prisma.protocol.deleteMany({ where: { id: { in: createdIds } } });
    createdIds.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedProtocol(data: {
    wallet: string;
    name: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    accountType?: "EOA" | "SAFE";
    safeAddress?: string;
    xHandle?: string;
    createdAt?: Date;
  }) {
    const protocol = await prisma.protocol.create({
      data: { accountType: "EOA", ...data },
    });
    createdIds.push(protocol.id);
    return protocol;
  }

  it("returns accountType and safeAddress for a Safe protocol, alongside a plain EOA one", async () => {
    await seedProtocol({ wallet: `0xeoa-pending-${runId}`, name: `Acme EOA ${runId}`, status: "PENDING" });
    await seedProtocol({
      wallet: `0xsafe-owner-${runId}`,
      name: `Acme Safe ${runId}`,
      status: "PENDING",
      accountType: "SAFE",
      safeAddress: `0xsafe-address-${runId}`,
    });

    const rows = (await listPendingProtocols(prisma)).filter((r) => createdIds.includes(r.id));

    expect(rows).toHaveLength(2);
    const eoaRow = rows.find((r) => r.name === `Acme EOA ${runId}`);
    const safeRow = rows.find((r) => r.name === `Acme Safe ${runId}`);
    expect(eoaRow).toMatchObject({ wallet: `0xeoa-pending-${runId}`, accountType: "EOA", safeAddress: null });
    expect(safeRow).toMatchObject({
      wallet: `0xsafe-owner-${runId}`,
      accountType: "SAFE",
      safeAddress: `0xsafe-address-${runId}`,
    });
  });

  it("returns the applicant's X handle for cross-referencing, and null for a protocol with none", async () => {
    await seedProtocol({
      wallet: `0xhandled-${runId}`,
      name: `Handled ${runId}`,
      status: "PENDING",
      xHandle: `@handled${runId}`,
    });
    await seedProtocol({ wallet: `0xno-handle-${runId}`, name: `No handle ${runId}`, status: "PENDING" });

    const rows = (await listPendingProtocols(prisma)).filter((r) => createdIds.includes(r.id));

    const handled = rows.find((r) => r.name === `Handled ${runId}`);
    const noHandle = rows.find((r) => r.name === `No handle ${runId}`);
    expect(handled?.xHandle).toBe(`@handled${runId}`);
    expect(noHandle?.xHandle).toBeNull();
  });

  it("excludes non-PENDING protocols", async () => {
    await seedProtocol({ wallet: `0xapproved-${runId}`, name: `Already approved ${runId}`, status: "APPROVED" });
    await seedProtocol({ wallet: `0xrejected-${runId}`, name: `Already rejected ${runId}`, status: "REJECTED" });
    await seedProtocol({ wallet: `0xpending-${runId}`, name: `Still pending ${runId}`, status: "PENDING" });

    const rows = (await listPendingProtocols(prisma)).filter((r) => createdIds.includes(r.id));

    expect(rows.map((r) => r.name)).toEqual([`Still pending ${runId}`]);
  });

  it("orders oldest-first, so the queue is worked in submission order", async () => {
    const first = await seedProtocol({ wallet: `0xfirst-${runId}`, name: `First ${runId}`, status: "PENDING" });
    // Force a distinct, later createdAt rather than relying on real-clock
    // timing between two `create` calls in the same test.
    await seedProtocol({
      wallet: `0xsecond-${runId}`,
      name: `Second ${runId}`,
      status: "PENDING",
      createdAt: new Date(first.createdAt.getTime() + 1000),
    });

    const rows = (await listPendingProtocols(prisma)).filter((r) => createdIds.includes(r.id));

    expect(rows.map((r) => r.name)).toEqual([`First ${runId}`, `Second ${runId}`]);
  });
});
