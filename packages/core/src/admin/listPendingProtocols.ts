import type { AccountType, PrismaClient } from "@emp/db";

export interface PendingProtocolRow {
  id: string;
  name: string;
  wallet: string;
  accountType: AccountType;
  safeAddress: string | null;
  /** The applicant's X handle, cross-referenced against the out-of-band DM (SPEC §4.2). Null for protocols created before this field existed. */
  xHandle: string | null;
  createdAt: Date;
}

/**
 * The admin approval queue (SPEC §4.2) — every field an admin needs to
 * cross-reference a pending application against its out-of-band proof
 * (name + wallet + account type/Safe address + when it arrived).
 *
 * Pulled out of the API route into its own function specifically so an
 * integration test can run this exact `select` against a real, migrated
 * Postgres and the real generated Prisma Client — catching schema-vs-client
 * drift (e.g. a field added to schema.prisma without `prisma generate`/
 * `migrate` having actually run) before it reaches a browser as a 500.
 */
export async function listPendingProtocols(prisma: PrismaClient): Promise<PendingProtocolRow[]> {
  return prisma.protocol.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, wallet: true, accountType: true, safeAddress: true, xHandle: true, createdAt: true },
  });
}
