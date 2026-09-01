"use client";

import { useAccount } from "wagmi";
import { useSiweSignIn } from "@/lib/useSiwe";

const BUTTON_LABEL: Record<string, string> = {
  nonce: "Preparing…",
  "awaiting-signature": "Check your wallet…",
  verifying: "Verifying…",
};

/**
 * Admin auth is just SIWE plus the ADMIN_WALLETS allowlist — checked
 * server-side in /api/auth/siwe/verify (isAdminWallet), not here. No Safe
 * option: nothing in SPEC calls for admin access via a multisig.
 */
export function SignInPanel({ onSignedIn }: { onSignedIn: () => void }) {
  const { address, chainId } = useAccount();
  const { signIn, status, error } = useSiweSignIn();

  const busy = status === "nonce" || status === "awaiting-signature" || status === "verifying";

  async function handleClick() {
    if (!address || !chainId) return;
    const result = await signIn({ address, chainId, role: "admin", accountType: "EOA" });
    if (result.ok) onSignedIn();
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-surface p-6">
      <button
        onClick={handleClick}
        disabled={busy || !address}
        className="rounded-full bg-pulse-cyan px-6 py-2 font-medium text-void transition hover:shadow-glow disabled:opacity-50"
      >
        {BUTTON_LABEL[status] ?? "Sign in with Ethereum"}
      </button>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error.kind === "rejected" && "Signature request was cancelled or rejected. Try again."}
          {error.kind === "safe-not-owner" && error.message}
          {error.kind === "other" && error.message}
        </p>
      )}
    </div>
  );
}
