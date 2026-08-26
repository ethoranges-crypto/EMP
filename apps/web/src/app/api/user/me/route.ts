import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { isValidTelegramBotUsername, loadEnv } from "@emp/config";
import { UnauthorizedError, requireAccount } from "@/lib/session";

type TelegramLinkStatus = "not_configured" | "none" | "pending" | "rejected" | "expired" | "linked";

/**
 * Aggregated self-service status for the user journey UI: wallet identity,
 * interests, and — the point of this endpoint — "messageable" (SPEC §7.5:
 * true only while a *currently verified* Telegram link exists), plus enough
 * about the current link attempt for the UI to show the real state
 * (pending/expired/rejected) rather than a bare boolean. This is
 * self-service data about the caller's own account, not a protocol-facing
 * response — the privacy boundary (CLAUDE.md rule 1) doesn't apply here.
 *
 * `messageable` folds in `paused` (POST /api/user/pause) — it's the same
 * truth the audience-count/snapshot chokepoints use (countMessageableUsers,
 * listMessageableChatIds), so a paused user sees the same "not currently
 * messageable" the rest of the system sees. `telegramLinkStatus` stays
 * keyed off the *link* alone (hasVerifiedLink), not `messageable` — a
 * paused user is still genuinely "linked" (design's "Linked · muted"), just
 * excluded from audiences while paused, and this endpoint must say so
 * accurately rather than showing a stale/wrong link status while paused.
 */
export async function GET() {
  try {
    const env = loadEnv();
    const { account: user, accountId, address } = await requireAccount("user", (id) =>
      prisma.user.findUniqueOrThrow({
        where: { id },
        include: {
          telegramLinks: { where: { status: "VERIFIED" }, take: 1 },
          interests: { select: { categoryId: true, category: { select: { name: true } } } },
        },
      }),
    );

    const hasVerifiedLink = user.telegramLinks.length > 0;
    const verifiedAt = user.telegramLinks[0]?.verifiedAt?.toISOString();
    const messageable = hasVerifiedLink && !user.paused;

    let telegramLinkStatus: TelegramLinkStatus = "none";
    let rejectionReason: string | undefined;
    let deepLink: string | undefined;
    let codeExpiresAt: string | undefined;

    if (!hasVerifiedLink && !isValidTelegramBotUsername(env.TELEGRAM_BOT_USERNAME)) {
      // Nothing downstream can complete regardless of any LinkRequest state
      // — don't even look, and don't hand back a t.me link to a bot that
      // (as far as we can tell without a live getMe() call) doesn't exist.
      telegramLinkStatus = "not_configured";
    } else if (!hasVerifiedLink) {
      const latestRequest = await prisma.linkRequest.findFirst({
        where: { userId: accountId },
        orderBy: { createdAt: "desc" },
      });

      if (latestRequest?.rejectedReason) {
        telegramLinkStatus = "rejected";
        rejectionReason = latestRequest.rejectedReason;
      } else if (latestRequest && latestRequest.expiresAt > new Date()) {
        telegramLinkStatus = "pending";
        codeExpiresAt = latestRequest.expiresAt.toISOString();
        deepLink = `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${latestRequest.code}`;
      } else if (latestRequest) {
        telegramLinkStatus = "expired";
      }
    } else {
      telegramLinkStatus = "linked";
    }

    return NextResponse.json({
      wallet: address,
      accountType: user.accountType,
      safeAddress: user.safeAddress,
      interestCategoryIds: user.interests.map((i) => i.categoryId),
      interestCategoryNames: user.interests.map((i) => i.category.name),
      messageable,
      paused: user.paused,
      telegramLinkStatus,
      telegramVerifiedAt: verifiedAt,
      rejectionReason,
      deepLink,
      codeExpiresAt,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
