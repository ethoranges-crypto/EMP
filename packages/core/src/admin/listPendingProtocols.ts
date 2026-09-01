import type { AccountType, PrismaClient } from "@emp/db";

export interface PendingProtocolRow {
  id: string;
  name: string;
  wallet: string;
  accountType: AccountType;
  safeAddress: string | null;
  /** The applicant's X handle, cross-referenced against the out-of-band DM (SPEC §4.2). Null for protocols created before this field existed. */
  xHandle: string | null;
  /** When the application form was actually submitted — never null here, since the where clause below excludes rows without one. */
  submittedAt: Date;
}

/**
 * The admin approval queue (SPEC §4.2) — every field an admin needs to
 * cross-reference a pending application against its out-of-band proof
 * (name + wallet + account type/Safe address + when it arrived).
 *
 * Filters on submittedAt, not just status: Protocol.status is PENDING from
 * the moment a wallet first signs in (see the upsert in
 * /api/auth/siwe/verify), before any application has been submitted, so a
 * bare `status: "PENDING"` filter would surface rows an admin has nothing
 * to review yet (blank name, no real submission time). submittedAt is set
 * only by an actual POST /api/protocol submit/resubmit, and doubles as the
 * queue's "when it arrived" — Protocol.createdAt is sign-in time, not
 * submission time, and must never be shown as "Submitted" (that was this
 * query's bug before submittedAt existed).
 *
 * Pulled out of the API route into its own function specifically so an
 * integration test can run this exact `select` against a real, migrated
 * Postgres and the real generated Prisma Client — catching schema-vs-client
 * drift (e.g. a field added to schema.prisma without `prisma generate`/
 * `migrate` having actually run) before it reaches a browser as a 500.
 */
export async function listPendingProtocols(prisma: PrismaClient): Promise<PendingProtocolRow[]> {
  const rows = await prisma.protocol.findMany({
    where: { status: "PENDING", submittedAt: { not: null } },
    orderBy: { submittedAt: "asc" },
    select: { id: true, name: true, wallet: true, accountType: true, safeAddress: true, xHandle: true, submittedAt: true },
  });
  // The where clause guarantees submittedAt is non-null; Prisma's generated
  // type doesn't narrow on that, so this cast documents the invariant
  // rather than propagating an outward-facing `Date | null` no caller
  // should ever have to null-check.
  return rows as PendingProtocolRow[];
}
