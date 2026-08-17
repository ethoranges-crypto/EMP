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

