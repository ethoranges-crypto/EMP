import { generateNonce, SiweMessage } from "siwe";
import { loadEnv } from "@emp/config";
import { isSafeOwner } from "@emp/core";
import { getChain } from "@emp/config";

export function createNonce(): string {
  return generateNonce();
}

export interface VerifySiweParams {
  message: string;
  signature: string;
  expectedNonce: string;
  /**
   * The domain the wallet should have seen when signing — always the
   * incoming request's actual Host header (see the verify route), never a
   * static env value. A hardcoded expected domain can silently drift from
   * whatever host is actually serving the app (a new deployment domain, a
   * preview URL, being reached via an IP), which would either reject
   * legitimate logins or — if the drift went the other way — mean this
   * check was never really binding the session to the page that requested
   * it. Tying it to the live request closes that gap entirely.
   */
  expectedDomain: string;
}

/** Verifies the SIWE signature and domain/nonce (EIP-4361) — the ownership proof for an EOA. */
export async function verifySiwe(params: VerifySiweParams): Promise<SiweMessage> {
  const siweMessage = new SiweMessage(params.message);
  const result = await siweMessage.verify({
    signature: params.signature,
    domain: params.expectedDomain,
    nonce: params.expectedNonce,
  });
  if (!result.success) {
    throw new Error(`SIWE verification failed: ${result.error?.type ?? "unknown"}`);
  }
  return result.data;
}

export interface VerifySafeAuthParams {
  safeAddress: string;
  ownerAddress: string;
  chainKey: string;
}

/** CLAUDE.md Auth: Safe support = owner signs SIWE, we verify on-chain owner membership. */
export async function verifySafeOwnership(params: VerifySafeAuthParams): Promise<boolean> {
  const chain = getChain(params.chainKey);
  if (!chain) throw new Error(`Unknown or unconfigured chain: ${params.chainKey}`);
  return isSafeOwner({
    safeAddress: params.safeAddress,
    ownerAddress: params.ownerAddress,
    rpcUrl: chain.rpcUrl,
  });
}

export function isAdminWallet(address: string): boolean {
  const env = loadEnv();
  return env.ADMIN_WALLETS.includes(address.toLowerCase());
}
