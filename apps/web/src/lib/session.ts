import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { loadEnv } from "@emp/config";

export type SessionRole = "user" | "protocol" | "admin";

export interface EmpSessionData {
  nonce?: string;
  address?: string;
  role?: SessionRole;
  /** users.id / protocols.id — set once SIWE + (for role=user, Safe ownership) verification succeeds. */
  accountId?: string;
}

export function sessionOptions(): SessionOptions {
  const env = loadEnv();
  return {
    cookieName: "emp_session",
    password: env.SESSION_SECRET,
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  };
}

export async function getSession() {
  return getIronSession<EmpSessionData>(await cookies(), sessionOptions());
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

/** Throws UnauthorizedError unless the session is signed in with the given role. Callers turn that into a 401 JSON response. */
export async function requireRole(role: SessionRole): Promise<{ accountId: string; address: string }> {
  const session = await getSession();
  if (session.role !== role || !session.accountId || !session.address) {
    throw new UnauthorizedError();
  }
  return { accountId: session.accountId, address: session.address };
}

/**
 * Same as requireRole, but also loads the caller's own account row (User or
 * Protocol, keyed by session.accountId) via `fetchAccount` — the pattern
 * every self-service route (GET /api/user/me, GET /api/protocol, ...) needs.
 *
 * A session cookie outlives the database row it points at: a dev DB reset,
 * or in prod a row genuinely deleted, leaves a signed-in browser holding a
 * session whose accountId no longer resolves. Without this, `fetchAccount`
 * throwing Prisma's "no record found" (P2025) bubbles up as an unhandled
 * exception -> a bare non-JSON 500 the client can't parse — indistinguishable
 * from a real server error, and with no path back to sign-in. Since a session
 * is only ever attached to one account, "the account is gone" and "the
 * session is invalid" are the same fact here, so it's treated identically to
 * "was never signed in" (UnauthorizedError -> 401): destroy the stale cookie
 * and let the client's existing "signed out" branch show the sign-in flow,
 * which re-creates the account on the next SIWE verify (see the upsert in
 * /api/auth/siwe/verify).
 */
export async function requireAccount<T>(
  role: SessionRole,
  fetchAccount: (accountId: string) => Promise<T>,
): Promise<{ account: T; accountId: string; address: string }> {
  const { accountId, address } = await requireRole(role);
  try {
    const account = await fetchAccount(accountId);
    return { account, accountId, address };
  } catch (err) {
    // Duck-typed rather than `instanceof Prisma.PrismaClientKnownRequestError`:
    // Next.js's per-route RSC bundling can give this file and the route
    // handler calling it separate module instances of @emp/db's re-exported
    // @prisma/client, which makes `instanceof` fail even for a genuine
    // PrismaClientKnownRequestError. The `.code` string survives that.
    if (err && typeof err === "object" && "code" in err && err.code === "P2025") {
      const session = await getSession();
      session.destroy();
      throw new UnauthorizedError();
    }
    throw err;
  }
}

