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
 * Also covers the submittedAt-vs-createdAt bug this query used to have: the
 * admin queue's "Submitted" label was reading createdAt (set at first
 * sign-in), so a protocol that connected today but didn't submit its
 * application until next week showed the wrong date. submittedAt is set
 * only by an actual application submit/resubmit — these tests seed it
 * explicitly (rather than letting it default) so a regression back to
 * createdAt-based ordering/filtering would fail here.
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
    /** Omit to simulate a protocol that has connected/signed in but never submitted an application. */
    submittedAt?: Date;
  }) {
    const protocol = await prisma.protocol.create({
      data: { accountType: "EOA", ...data },
    });
    createdIds.push(protocol.id);
    return protocol;
  }

  it("returns accountType and safeAddress for a Safe protocol, alongside a plain EOA one", async () => {
    await seedProtocol({
      wallet: `0xeoa-pending-${runId}`,
      name: `Acme EOA ${runId}`,
      status: "PENDING",
      submittedAt: new Date(),
    });
    await seedProtocol({
      wallet: `0xsafe-owner-${runId}`,
      name: `Acme Safe ${runId}`,
      status: "PENDING",
      accountType: "SAFE",
      safeAddress: `0xsafe-address-${runId}`,
      submittedAt: new Date(),
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
      submittedAt: new Date(),
    });
    await seedProtocol({
      wallet: `0xno-handle-${runId}`,
      name: `No handle ${runId}`,
      status: "PENDING",
      submittedAt: new Date(),
    });

    const rows = (await listPendingProtocols(prisma)).filter((r) => createdIds.includes(r.id));

    const handled = rows.find((r) => r.name === `Handled ${runId}`);
    const noHandle = rows.find((r) => r.name === `No handle ${runId}`);
    expect(handled?.xHandle).toBe(`@handled${runId}`);
    expect(noHandle?.xHandle).toBeNull();
  });

  it("excludes non-PENDING protocols", async () => {
    await seedProtocol({
      wallet: `0xapproved-${runId}`,
      name: `Already approved ${runId}`,
      status: "APPROVED",
      submittedAt: new Date(),
    });
    await seedProtocol({
      wallet: `0xrejected-${runId}`,
      name: `Already rejected ${runId}`,
      status: "REJECTED",
      submittedAt: new Date(),
    });
    await seedProtocol({
      wallet: `0xpending-${runId}`,
      name: `Still pending ${runId}`,
      status: "PENDING",
      submittedAt: new Date(),
    });

    const rows = (await listPendingProtocols(prisma)).filter((r) => createdIds.includes(r.id));

    expect(rows.map((r) => r.name)).toEqual([`Still pending ${runId}`]);
  });

  it("excludes a PENDING protocol that has connected/signed in but never submitted an application", async () => {
    // status is PENDING from first sign-in (see the upsert in
    // /api/auth/siwe/verify), before any application form has been
    // submitted — this row has nothing yet for an admin to review.
    await seedProtocol({ wallet: `0xnever-submitted-${runId}`, name: "", status: "PENDING" });
    await seedProtocol({
      wallet: `0xdid-submit-${runId}`,
      name: `Did submit ${runId}`,
      status: "PENDING",
      submittedAt: new Date(),
    });

    const rows = (await listPendingProtocols(prisma)).filter((r) => createdIds.includes(r.id));

    expect(rows.map((r) => r.name)).toEqual([`Did submit ${runId}`]);
  });

  it("reports the actual submission time, not Protocol.createdAt (first sign-in) — and orders oldest-submitted-first", async () => {
    const signedInLongAgo = new Date("2020-01-01T00:00:00Z");
    const submittedRecently = new Date("2026-06-01T00:00:00Z");
    const first = await prisma.protocol.create({
      data: {
        wallet: `0xfirst-${runId}`,
        name: `First ${runId}`,
        status: "PENDING",
        accountType: "EOA",
        createdAt: signedInLongAgo,
        submittedAt: submittedRecently,
      },
    });
    createdIds.push(first.id);
    const second = await seedProtocol({
      wallet: `0xsecond-${runId}`,
      name: `Second ${runId}`,
      status: "PENDING",
      submittedAt: new Date(submittedRecently.getTime() + 1000),
    });
    createdIds.push(second.id);

    const rows = (await listPendingProtocols(prisma)).filter((r) => createdIds.includes(r.id));

    expect(rows.map((r) => r.name)).toEqual([`First ${runId}`, `Second ${runId}`]);
    const firstRow = rows.find((r) => r.name === `First ${runId}`);
    expect(firstRow?.submittedAt.toISOString()).toBe(submittedRecently.toISOString());
  });
});
