import type { PrismaClient, Prisma } from "@emp/db";
import { EVERYTHING_CATEGORY_NAME } from "@emp/config";
import type { CategoryFilter } from "./ports.js";

/**
 * The single source of truth for "which users does this CategoryFilter
 * match" — shared by countMessageableUsers (prismaAdapter.ts, the preview a
 * protocol sees while composing) and listMessageableChatIds
 * (prismaSnapshotStore.ts, what actually gets messaged at approval). Both
 * call this so they can never drift apart; do not reimplement this
 * where-clause inline anywhere else.
 *
 * "Everything" means the same thing on both sides of the match:
 *   - A PROTOCOL targeting Everything (filter.includeAll) is a broadcast
 *     override — every verified, unpaused user counts, regardless of their
 *     own interests (including a user with none selected at all).
 *   - A USER who selected Everything matches ANY specific-category
 *     targeting too — achieved here by unioning Everything's own category
 *     id into the IN clause, so a single UserInterest row is sufficient;
 *     the expansion happens at query time, not by writing one row per real
 *     category. Without this, "Everything" was an inert tag on the user's
 *     side (matched only a protocol campaign that *also* targeted
 *     Everything) while being a full broadcast override on the protocol's
 *     side — an asymmetry a user picking "Everything" would not expect.
 */
export async function buildMessageableUsersWhere(
  prisma: PrismaClient,
  filter: CategoryFilter,
): Promise<Prisma.UserWhereInput> {
  const interestFilter = filter.includeAll ? {} : { interests: { some: { categoryId: { in: await categoryIdsWithEverything(prisma, filter.categoryIds) } } } };

  return {
    telegramLinks: { some: { status: "VERIFIED" } },
    // Paused is a self-service opt-out (SPEC "Signal paused") — a paused
    // user must never count toward an audience a protocol pays for, even
    // though their Telegram link is still verified.
    paused: false,
    ...interestFilter,
  };
}

async function categoryIdsWithEverything(prisma: PrismaClient, categoryIds: string[]): Promise<string[]> {
  const everything = await prisma.category.findUnique({ where: { name: EVERYTHING_CATEGORY_NAME } });
  return everything ? [...categoryIds, everything.id] : categoryIds;
}
