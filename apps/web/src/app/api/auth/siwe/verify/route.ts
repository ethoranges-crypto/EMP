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
 * One SIWE verification endpoint for all three roles (CLAUDE.md Auth): the
 * signature always proves control of `address`; what differs per role is
 * what that address is then checked against (Safe ownership for a user
 * linking a Safe, the admin wallet allowlist for admin, nothing extra for a
 * protocol beyond its own wallet identity).
 */
export async function POST(request: Request) {
  const body = (await request.json()) as VerifyBody;
  const session = await getSession();

  if (!session.nonce) {
    return NextResponse.json({ error: "No pending nonce — call /api/auth/siwe/nonce first" }, { status: 400 });
  }

  let address: string;
  try {
    const siwe = await verifySiwe({
      message: body.message,
      signature: body.signature,
      expectedNonce: session.nonce,
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
    const protocol = await prisma.protocol.upsert({
      where: { wallet: address },
      create: { wallet: address, name: "", status: "PENDING" },
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
  if (accountType === "SAFE") {
    if (!body.safeAddress || !body.chainKey) {
      return NextResponse.json({ error: "safeAddress and chainKey are required for a Safe account" }, { status: 400 });
    }
    const chain = getChain(body.chainKey);
    if (!chain) {
      return NextResponse.json({ error: `${body.chainKey} isn't a supported chain` }, { status: 400 });
    }
    const isOwner = await verifySafeOwnership({
      safeAddress: body.safeAddress,
      ownerAddress: address,
      chainKey: body.chainKey,
    });
    if (!isOwner) {
      return NextResponse.json(
        {
          error: `This address isn't an owner of a Safe on ${chain.displayName} — switch chain or check the address.`,
        },
        { status: 403 },
      );
    }
  }

  const user = await prisma.user.upsert({
    where: { primaryWallet: address },
    create: {
      primaryWallet: address,
      accountType,
      safeAddress: accountType === "SAFE" ? body.safeAddress : null,
    },
    update: {},
  });

  session.role = "user";
  session.address = address;
  session.accountId = user.id;
  await session.save();
  return NextResponse.json({ ok: true, role: "user", accountId: user.id });
}
