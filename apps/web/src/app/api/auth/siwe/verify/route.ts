import { NextResponse } from "next/server";
import { prisma } from "@emp/db";
import { getChain } from "@emp/config";
import { isAdminWallet, verifySafeOwnership, verifySiwe } from "@/lib/auth-siwe";
import { getSession } from "@/lib/session";

interface VerifyBody {
  message: string;
  signature: string;
  role: "user" | "protocol" | "admin";
  accountType?: "EOA" | "SAFE";
  safeAddress?: string;
  chainKey?: string;
}

/**
 * Shared by the user and protocol branches (CLAUDE.md Auth: EOA or Safe on
 * either side, Safe verified the same way regardless of role — owner signs
 * SIWE, we verify on-chain owner membership). Returns the Safe address to
 * persist (null for a plain EOA) or a ready-to-return error response.
 */
async function resolveSafeAddress(
  address: string,
  body: VerifyBody,
): Promise<{ safeAddress: string | null } | { error: NextResponse }> {
  if ((body.accountType ?? "EOA") !== "SAFE") return { safeAddress: null };

  if (!body.safeAddress || !body.chainKey) {
    return {
      error: NextResponse.json({ error: "safeAddress and chainKey are required for a Safe account" }, { status: 400 }),
    };
  }
  const chain = getChain(body.chainKey);
  if (!chain) {
    return { error: NextResponse.json({ error: `${body.chainKey} isn't a supported chain` }, { status: 400 }) };
  }
  const isOwner = await verifySafeOwnership({
    safeAddress: body.safeAddress,
    ownerAddress: address,
    chainKey: body.chainKey,
  });
  if (!isOwner) {
    return {
      error: NextResponse.json(
        {
          error: `This address isn't an owner of a Safe on ${chain.displayName} — switch chain or check the address.`,
        },
        { status: 403 },
      ),
    };
  }
  return { safeAddress: body.safeAddress };
}

/**
 * One SIWE verification endpoint for all three roles (CLAUDE.md Auth): the
 * signature always proves control of `address`; what differs per role is
 * what that address is then checked against (Safe ownership for a user or
 * protocol signing in via a Safe, the admin wallet allowlist for admin).
 */
export async function POST(request: Request) {
  const body = (await request.json()) as VerifyBody;
  const session = await getSession();

  if (!session.nonce) {
    return NextResponse.json({ error: "No pending nonce — call /api/auth/siwe/nonce first" }, { status: 400 });
  }

  // The client embeds window.location.host as the message's domain (see
  // useSiwe.ts) — checking against this request's own Host header, rather
  // than a static config value, means those two are guaranteed to be the
  // same thing by construction, for every host this app is ever served on.
  const requestHost = request.headers.get("host");
  if (!requestHost) {
    return NextResponse.json({ error: "Missing Host header" }, { status: 400 });
  }

  let address: string;
  try {
    const siwe = await verifySiwe({
      message: body.message,
      signature: body.signature,
      expectedNonce: session.nonce,
      expectedDomain: requestHost,
    });
    address = siwe.address;
  } catch {
    return NextResponse.json({ error: "SIWE verification failed" }, { status: 401 });
  }
  session.nonce = undefined;

  if (body.role === "admin") {
    if (!isAdminWallet(address)) {
      return NextResponse.json({ error: "Not an admin wallet" }, { status: 403 });
    }
    session.role = "admin";
    session.address = address;
    session.accountId = address;
    await session.save();
    return NextResponse.json({ ok: true, role: "admin" });
  }

  if (body.role === "protocol") {
    const accountType = body.accountType ?? "EOA";
    const safeResult = await resolveSafeAddress(address, body);
    if ("error" in safeResult) return safeResult.error;

    const protocol = await prisma.protocol.upsert({
      where: { wallet: address },
      create: { wallet: address, accountType, safeAddress: safeResult.safeAddress, name: "", status: "PENDING" },
      update: {},
    });
    session.role = "protocol";
    session.address = address;
    session.accountId = protocol.id;
    await session.save();
    return NextResponse.json({ ok: true, role: "protocol", status: protocol.status });
  }

  // role === "user"
  const accountType = body.accountType ?? "EOA";
  const safeResult = await resolveSafeAddress(address, body);
  if ("error" in safeResult) return safeResult.error;

  const user = await prisma.user.upsert({
    where: { primaryWallet: address },
    create: { primaryWallet: address, accountType, safeAddress: safeResult.safeAddress },
    update: {},
  });

  session.role = "user";
  session.address = address;
  session.accountId = user.id;
  await session.save();
  return NextResponse.json({ ok: true, role: "user", accountId: user.id });
}
