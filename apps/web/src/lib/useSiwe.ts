"use client";

import { useCallback, useState } from "react";
import { useSignMessage } from "wagmi";
import { SiweMessage } from "siwe";

export type SignInStatus = "idle" | "nonce" | "awaiting-signature" | "verifying" | "error";

export type SignInError =
  | { kind: "rejected" }
  | { kind: "safe-not-owner"; message: string }
  | { kind: "other"; message: string };

export interface SignInParams {
  address: string;
  chainId: number;
  role: "user" | "protocol";
  accountType: "EOA" | "SAFE";
  safeAddress?: string;
  chainKey?: string;
}

/**
 * Drives the SIWE flow client-side: nonce -> sign -> verify (CLAUDE.md Auth).
 * Every step hits the real API route — nothing here is mocked. Wallet
 * rejection (the user cancels the signature prompt) and Safe-ownership
 * failure are surfaced as distinct, user-facing error states rather than a
 * generic failure. Shared by the /user and /protocol journeys — the verify
 * route branches on `role`, this hook doesn't need to.
 */
export function useSiweSignIn() {
  const { signMessageAsync } = useSignMessage();
  const [status, setStatus] = useState<SignInStatus>("idle");
  const [error, setError] = useState<SignInError | null>(null);

  const signIn = useCallback(
    async (params: SignInParams): Promise<{ ok: boolean }> => {
      setError(null);

      setStatus("nonce");
      const nonceRes = await fetch("/api/auth/siwe/nonce");
      if (!nonceRes.ok) {
        setStatus("error");
        setError({ kind: "other", message: "Could not start sign-in. Try again." });
        return { ok: false };
      }
      const { nonce } = (await nonceRes.json()) as { nonce: string };

      const siweMessage = new SiweMessage({
        domain: window.location.host,
        address: params.address,
        statement: "Sign in to EMP to manage your notifications.",
        uri: window.location.origin,
        version: "1",
        chainId: params.chainId,
        nonce,
      });
      const preparedMessage = siweMessage.prepareMessage();

      setStatus("awaiting-signature");
      let signature: string;
      try {
        signature = await signMessageAsync({ message: preparedMessage });
      } catch {
        // wagmi/viem throw for both an explicit user rejection and most
        // wallet-side failures here — both read the same to the user
        // ("try again"), so they're not worth distinguishing further.
        setStatus("error");
        setError({ kind: "rejected" });
        return { ok: false };
      }

      setStatus("verifying");
      const verifyRes = await fetch("/api/auth/siwe/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: preparedMessage,
          signature,
          role: params.role,
          accountType: params.accountType,
          safeAddress: params.safeAddress,
          chainKey: params.chainKey,
        }),
      });

      if (!verifyRes.ok) {
        const data = (await verifyRes.json().catch(() => ({}))) as { error?: string };
        setStatus("error");
        if (verifyRes.status === 403) {
          setError({ kind: "safe-not-owner", message: data.error ?? "Not an owner of that Safe." });
        } else {
          setError({ kind: "other", message: data.error ?? "Sign-in failed." });
        }
        return { ok: false };
      }

      setStatus("idle");
      return { ok: true };
    },
    [signMessageAsync],
  );

  return { signIn, status, error };
}
