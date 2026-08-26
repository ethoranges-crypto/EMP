"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useSiweSignIn } from "@/lib/useSiwe";
import { SAFE_CHAIN_OPTIONS, chainKeyForChainId } from "@/lib/wagmiConfig";
import { UserHeader } from "./UserHeader";
import { StepRow } from "./StepRow";
import { OnboardingFooter } from "./OnboardingFooter";

const BUTTON_LABEL: Record<string, string> = {
  nonce: "Preparing…",
  "awaiting-signature": "Check your wallet…",
  verifying: "Verifying…",
};

/**
 * State 1 — connect + SIWE. Two real sub-states inside one screen, exactly
 * as before this restyle: wallet not connected yet (RainbowKit's own
 * ConnectButton — same precedent as the landing page and protocol's
 * onboarding gate, which don't reskin RainbowKit's modal either) vs
 * connected-but-not-signed-in (the SIWE panel). The design's single static
 * frame shows both the wallet-type cards and the sign-in button at once
 * because a mockup can't depict "connect" as a separate prior step the way
 * a real wallet extension forces — the cards here are the same
 * EOA/Safe choice the old checkbox drove, just reshaped to match.
 */
export function ConnectState({ onSignedIn }: { onSignedIn: () => void }) {
  const { address, chainId, isConnected } = useAccount();
  const { signIn, status, error } = useSiweSignIn();
  const [useSafe, setUseSafe] = useState(false);
  const [safeAddress, setSafeAddress] = useState("");
  const [chainKey, setChainKey] = useState<string>(() => chainKeyForChainId(chainId));
  const [chainKeyTouched, setChainKeyTouched] = useState(false);

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
      role: "user",
      accountType: useSafe ? "SAFE" : "EOA",
      safeAddress: useSafe ? safeAddress.trim() : undefined,
      chainKey: useSafe ? chainKey : undefined,
    });
    if (result.ok) onSignedIn();
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-void text-[13px] text-ink-1">
      <UserHeader connected={isConnected} wallet={address} />
      <StepRow current="wallet" />

      <div className="flex flex-1 flex-col items-center justify-center gap-0 overflow-y-auto px-6 py-8">
        <div className="relative mb-9 flex h-[150px] w-[150px] items-center justify-center">
          <div className="motion-safe:animate-empPulse absolute h-[130px] w-[130px] rounded-full border border-pulse-cyan/45" />
          <div
            className="motion-safe:animate-empPulse absolute h-[130px] w-[130px] rounded-full border border-pulse-cyan/30"
            style={{ animationDelay: "1.3s" }}
          />
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full border border-pulse-cyan/55"
            style={{ background: "radial-gradient(circle, rgba(53,230,242,.16), transparent 70%)" }}
          >
            <div className="h-3 w-3 rounded-full bg-pulse-cyan shadow-glow" />
          </div>
        </div>

        <h2 className="text-[38px] font-medium leading-none tracking-[-.025em]">Connect your wallet</h2>
        <p className="mt-3.5 max-w-[430px] text-center text-[15px] leading-[1.6] text-ink-3">
          One signature proves the wallet is yours. Nothing is spent, and no transaction is made.
        </p>

        {!isConnected ? (
          <div className="mt-10">
            <ConnectButton />
          </div>
        ) : (
          <div className="mt-10 flex w-[472px] flex-col gap-2.5">
            <button
              type="button"
              onClick={() => setUseSafe(false)}
              className={`flex items-center justify-between rounded-md border px-[18px] py-4 text-left transition ${
                !useSafe ? "border-pulse-cyan/40 bg-pulse-cyan/[.06]" : "border-white/[.09] hover:border-white/25"
              }`}
            >
              <div className="flex flex-col gap-1">
                <span className="text-[15px] font-medium">Standard wallet</span>
                <span className="text-[12.5px] text-ink-3">MetaMask, Rabby, WalletConnect</span>
              </div>
              <span className="rounded-chip border border-pulse-cyan/35 px-2 py-1 font-mono text-[9.5px] tracking-[.14em] text-pulse-cyan">
                EOA
              </span>
            </button>
            <button
              type="button"
              onClick={() => setUseSafe(true)}
              className={`flex items-center justify-between rounded-md border px-[18px] py-4 text-left transition ${
                useSafe ? "border-pulse-cyan/40 bg-pulse-cyan/[.06]" : "border-white/[.09] hover:border-white/25"
              }`}
            >
              <div className="flex flex-col gap-1">
                <span className="text-[15px] font-medium">Gnosis Safe</span>
                <span className="text-[12.5px] text-ink-3">Connect an owner wallet — one signature</span>
              </div>
              <span className="rounded-chip border border-white/[.12] px-2 py-1 font-mono text-[9.5px] tracking-[.14em] text-ink-3">
                SAFE
              </span>
            </button>

            {useSafe && (
              <div className="flex flex-col gap-2.5 rounded-md border border-white/[.08] bg-surface p-3.5">
                <input
                  type="text"
                  placeholder="Safe address (0x…)"
                  value={safeAddress}
                  onChange={(e) => setSafeAddress(e.target.value)}
                  className="rounded-md border border-white/[.1] bg-void px-3 py-2.5 font-mono text-[12.5px] text-ink-1 outline-none focus:border-pulse-cyan/50"
                />
                <select
                  value={chainKey}
                  onChange={(e) => {
                    setChainKeyTouched(true);
                    setChainKey(e.target.value);
                  }}
                  className="rounded-md border border-white/[.1] bg-void px-3 py-2.5 text-[12.5px] text-ink-1"
                >
                  {SAFE_CHAIN_OPTIONS.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11.5px] text-ink-4">
                  One signature from your owner wallet — EMP verifies on-chain that it&apos;s an owner of this Safe.
                </p>
              </div>
            )}

            <button
              onClick={() => void handleClick()}
              disabled={busy || !address || (useSafe && !safeAddress.trim())}
              className="mt-1.5 rounded-md bg-pulse-cyan px-4 py-4 text-center text-[14.5px] font-semibold text-onaccent-cyan transition hover:shadow-glow disabled:opacity-50"
            >
              {BUTTON_LABEL[status] ?? "Sign in with Ethereum"}
            </button>
            <span className="mt-2 self-center font-mono text-[10px] tracking-[.14em] text-ink-5">
              SIWE · EIP-4361 · SESSION EXPIRES IN 24H
            </span>

            {error && (
              <p role="alert" className="mt-2 text-center text-[12.5px] text-pulse-red">
                {error.kind === "rejected" && "Signature request was cancelled or rejected. Try again."}
                {error.kind === "safe-not-owner" && error.message}
                {error.kind === "other" && error.message}
              </p>
            )}
          </div>
        )}
      </div>

      <OnboardingFooter left="step 1 of 3 · takes about a minute" right="we never ask for a seed phrase" />
    </main>
  );
}
