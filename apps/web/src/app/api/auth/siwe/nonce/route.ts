import { NextResponse } from "next/server";
import { createNonce } from "@/lib/auth-siwe";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  session.nonce = createNonce();
  await session.save();
  return NextResponse.json({ nonce: session.nonce });
}
