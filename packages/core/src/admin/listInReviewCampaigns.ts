import type { PrismaClient, TokenSymbol } from "@emp/db";

export interface InReviewCampaignCta {
  id: string;
  label: string;
  targetUrl: string;
}

export interface InReviewCampaignRow {
  id: string;
  title: string;
  protocolName: string;
  chain: string;
  token: TokenSymbol;
  categoryNames: string[];
  bodyText: string | null;
  /** True iff an image is attached — the route derives the actual serving URL, same split as GET .../campaigns/[id]. */
  hasImage: boolean;
  ctas: InReviewCampaignCta[];
  createdAt: Date;
}

/**
 * The admin moderation queue (SPEC §4.3 steps 4-6) — every field an admin
 * needs to review exactly what a recipient would receive (title for their
 * own context, then text/image/CTAs as the actual message) before
 * approving or rejecting. No user data anywhere on Campaign/Protocol/Cta,
 * so — same reasoning as listPendingProtocols.ts — a direct query is fine
 * here; this isn't the privacy boundary CLAUDE.md rule 1 protects.
 *
 * Explicitly `select`s imageMimeType rather than imageData so reviewing
 * the queue never pulls every pending campaign's raw image bytes (up to
 * 10MB each) into memory at once — the actual bytes are only read by
 * .../campaigns/[id]/image, one at a time, on demand.
 *
 * Pulled out of the API route into its own function specifically so an
 * integration test can run this exact `select` against a real, migrated
 * Postgres and the real generated Prisma Client — same reasoning as
 * listPendingProtocols.ts.
 */
export async function listInReviewCampaigns(prisma: PrismaClient): Promise<InReviewCampaignRow[]> {
  const campaigns = await prisma.campaign.findMany({
    where: { status: "IN_REVIEW" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      chain: true,
      token: true,
      bodyText: true,
      imageMimeType: true,
      createdAt: true,
      protocol: { select: { name: true } },
      categories: { select: { category: { select: { name: true } } } },
      ctas: { select: { id: true, label: true, targetUrl: true } },
    },
  });

  return campaigns.map((c) => ({
    id: c.id,
    title: c.title,
    protocolName: c.protocol.name,
    chain: c.chain,
    token: c.token,
    categoryNames: c.categories.map((cc) => cc.category.name),
    bodyText: c.bodyText,
    hasImage: c.imageMimeType !== null,
    ctas: c.ctas,
    createdAt: c.createdAt,
  }));
}
