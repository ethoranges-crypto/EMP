import { randomBytes } from "node:crypto";

/**
 * Storage port for the one-time link code (SPEC §3.1). Kept separate from
 * Prisma so single-use + time-bound behavior is unit-testable with an
 * in-memory fake — this is a §7.5-adjacent invariant (a pile of
 * simultaneously-valid codes for one account is an attack surface: an old
 * code leaked via browser history/logs stays redeemable indefinitely unless
 * regenerating a code kills the old one).
 */
export interface LinkRequestPort {
  /** Deletes any existing un-redeemed request(s) for this user — regenerating supersedes whatever came before. */
  invalidateExisting(userId: string): Promise<void>;
  create(params: { userId: string; code: string; expiresAt: Date }): Promise<void>;
  /** The single point that decides redeemability: must exist AND not be expired. A superseded (deleted) or expired code both resolve to null here. */
  findRedeemable(code: string, now: Date): Promise<{ id: string; userId: string } | null>;
  deleteById(id: string): Promise<void>;
}

export interface CreateLinkRequestParams {
  userId: string;
  ttlMinutes: number;
  now?: Date;
}

export interface CreateLinkRequestResult {
  code: string;
  expiresAt: Date;
}

/**
 * Issues a new one-time code, first invalidating any prior un-redeemed code
 * for this account — single-use AND time-bound, not just time-bound. Used
 * by POST /api/user/telegram-link-request.
 */
export async function createLinkRequest(
  port: LinkRequestPort,
  params: CreateLinkRequestParams,
): Promise<CreateLinkRequestResult> {
  const now = params.now ?? new Date();
  await port.invalidateExisting(params.userId);
  const code = randomBytes(9).toString("base64url");
  const expiresAt = new Date(now.getTime() + params.ttlMinutes * 60 * 1000);
  await port.create({ userId: params.userId, code, expiresAt });
  return { code, expiresAt };
}

export interface RedeemLinkRequestResult {
  userId: string;
  requestId: string;
}

/**
 * The single place that decides whether a code is redeemable — used by
 * apps/bot's /start handler. Expired and superseded codes both resolve to
 * null here; callers don't need to know which.
 */
export async function redeemLinkRequest(
  port: LinkRequestPort,
  code: string,
  now: Date = new Date(),
): Promise<RedeemLinkRequestResult | null> {
  const request = await port.findRedeemable(code, now);
  if (!request) return null;
  return { userId: request.userId, requestId: request.id };
}
