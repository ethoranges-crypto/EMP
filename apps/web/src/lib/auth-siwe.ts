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
}

/** Verifies the SIWE signature and domain/nonce (EIP-4361) — the ownership proof for an EOA. */
export async function verifySiwe(params: VerifySiweParams): Promise<SiweMessage> {
  const env = loadEnv();
  const siweMessage = new SiweMessage(params.message);
  const result = await siweMessage.verify({
    signature: params.signature,
    domain: env.SIWE_DOMAIN,
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
