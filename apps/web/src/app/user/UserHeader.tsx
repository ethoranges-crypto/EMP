"use client";

import { EmpMark } from "../EmpMark";
import { truncateAddress } from "@/lib/address";

/**
 * The shared top bar for every /user state past the bare landing-page
 * chrome. The design's own mockup shows two slightly different header
 * variants (states 2-3 show the wallet + account-type chip; states 4-5 show
 * the wallet + "sign out" instead) — this deliberately merges them into one:
 * once signed in, both the account-type chip and sign-out are real,
 * independently useful actions (e.g. backing out mid-onboarding if the
 * wrong wallet connected), so there's no reason either should be
 * state-dependent chrome instead of always-available capability.
 */
export function UserHeader({
  connected,
  wallet,
  accountType,
  onSignOut,
}: {
  connected: boolean;
  wallet?: string;
  accountType?: "EOA" | "SAFE";
  onSignOut?: () => void;
}) {
  return (
    <header className="flex h-[57px] shrink-0 items-center justify-between border-b border-white/[.07] px-10">
      <div className="flex items-center gap-3">
        <EmpMark size={18} />
        <span className="text-[14px] font-semibold tracking-[.22em]">EMP</span>
        <span className="font-mono text-[10px] tracking-[.14em] text-ink-5">/USER</span>
      </div>
      {!connected ? (
        <div className="flex items-center gap-2.5">
          <span className="motion-safe:animate-empBreathe h-1.5 w-1.5 rounded-full bg-pulse-amber" />
          <span className="font-mono text-[10.5px] tracking-[.12em] text-ink-3">not connected</span>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10.5px] text-ink-3">{wallet ? truncateAddress(wallet) : ""}</span>
          {accountType && (
            <span className="rounded-chip border border-pulse-cyan/30 px-[7px] py-[3px] font-mono text-[9.5px] tracking-[.12em] text-pulse-cyan">
              {accountType}
            </span>
          )}
          {onSignOut && (
            <button onClick={onSignOut} className="font-mono text-[10.5px] text-ink-5 transition hover:text-ink-3">
              sign out
            </button>
          )}
        </div>
      )}
    </header>
  );
}
