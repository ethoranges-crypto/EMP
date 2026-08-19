"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useSiweSignIn } from "@/lib/useSiwe";
import { SAFE_CHAIN_OPTIONS, chainKeyForChainId } from "@/lib/wagmiConfig";

const BUTTON_LABEL: Record<string, string> = {
  nonce: "Preparing…",
  "awaiting-signature": "Check your wallet…",
  verifying: "Verifying…",
};

/**
 * SPEC §4.2: protocol onboarding supports both a plain EOA and a Gnosis
 * Safe (protocols commonly operate/pay from a multisig treasury) — same
 * flow as the user side: connect an owner wallet, sign SIWE, EMP verifies
 * on-chain that the address is a Safe owner.
 */
export function SignInPanel({ onSignedIn }: { onSignedIn: () => void }) {
  const { address, chainId } = useAccount();
  const { signIn, status, error } = useSiweSignIn();
  const [useSafe, setUseSafe] = useState(false);
  const [safeAddress, setSafeAddress] = useState("");
  const [chainKey, setChainKey] = useState<string>(() => chainKeyForChainId(chainId));
  const [chainKeyTouched, setChainKeyTouched] = useState(false);

  // Track the wallet's actual connected chain, not a hardcoded default —
  // but stop overriding once the user has picked one themselves.
  useEffect(() => {
    if (chainKeyTouched) return;
    setChainKey(chainKeyForChainId(chainId));
  }, [chainId, chainKeyTouched]);

  const busy = status === "nonce" || status === "awaiting-signature" || status === "verifying";

  async function handleClick() {
    if (!address || !chainId) return;
    const result = await signIn({
      address,
      chainId,
      role: "protocol",
      accountType: useSafe ? "SAFE" : "EOA",
      safeAddress: useSafe ? safeAddress.trim() : undefined,
      chainKey: useSafe ? chainKey : undefined,
    });
    if (result.ok) onSignedIn();
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-surface p-6">
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={useSafe}
          onChange={(e) => setUseSafe(e.target.checked)}
          className="accent-pulse-violet"
        />
        We&apos;re signing in as a Gnosis Safe owner
      </label>

      {useSafe && (
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Safe address (0x…)"
            value={safeAddress}
            onChange={(e) => setSafeAddress(e.target.value)}
            className="rounded-md border border-white/10 bg-void px-3 py-2 text-sm text-slate-100 outline-none focus:border-pulse-violet/50"
          />
          <select
            value={chainKey}
            onChange={(e) => {
              setChainKeyTouched(true);
              setChainKey(e.target.value);
            }}
            className="rounded-md border border-white/10 bg-void px-3 py-2 text-sm text-slate-100"
          >
            {SAFE_CHAIN_OPTIONS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            One signature from your owner wallet — EMP verifies on-chain that it&apos;s an owner of this Safe.
          </p>
        </div>
      )}

      <button
        onClick={handleClick}
        disabled={busy || !address || (useSafe && !safeAddress.trim())}
        className="rounded-full bg-pulse-violet px-6 py-2 font-medium text-void transition hover:shadow-glow disabled:opacity-50"
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
