"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { truncateAddress } from "@/lib/address";
import { UserHeader } from "./UserHeader";
import type { UserMe } from "./types";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function SummaryCard({
  label,
  dotColor,
  corner,
  children,
  muted,
}: {
  label: string;
  dotColor?: string;
  corner?: React.ReactNode;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-3 rounded-md border border-white/[.07] bg-surface p-[22px] ${muted ? "opacity-50" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9.5px] tracking-[.2em] text-ink-5">{label}</span>
        {dotColor && <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />}
        {corner}
      </div>
      {children}
    </div>
  );
}

/**
 * States 4 (messageable) and 5 (paused) — one component, since the design's
 * two frames share almost everything (the three summary cards, the
 * footer). Differs in: hero icon/headline, the pause vs resume action, and
 * a paused-only banner strip.
 *
 * Flagged deviations:
 *  - Dropped the mockup's "0x71C4…4fA2 · EOA · Ethereum" wallet-card claim
 *    of a specific chain — nothing here tracks a canonical "chain" for an
 *    EOA account (only a Safe's chainKey is stored), so showing one would
 *    be invented. Shows accountType + "verified via SIWE" only.
 *  - "Delete account" is rendered disabled with an explanatory title — no
 *    account-deletion endpoint exists. "Unlink Telegram" is real (DELETE
 *    /api/user/telegram-link, unchanged).
 */
export function HomeState({
  me,
  onChange,
  onEditInterests,
  onSignOut,
}: {
  me: UserMe;
  onChange: () => void;
  onEditInterests: () => void;
  onSignOut: () => void;
}) {
  const { address } = useAccount();
  const [pausing, setPausing] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [confirmingUnlink, setConfirmingUnlink] = useState(false);

  async function togglePause() {
    setPausing(true);
    await fetch(me.paused ? "/api/user/resume" : "/api/user/pause", { method: "POST" });
    setPausing(false);
    onChange();
  }

  async function unlinkTelegram() {
    setUnlinking(true);
    await fetch("/api/user/telegram-link", { method: "DELETE" });
    setUnlinking(false);
    setConfirmingUnlink(false);
    onChange();
  }

  const paused = me.paused;

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-void text-[13px] text-ink-1">
      <UserHeader connected wallet={address} onSignOut={onSignOut} />

      {paused && (
        <div className="flex h-11 shrink-0 items-center gap-3 border-b border-pulse-amber/25 bg-pulse-amber/[.07] px-10">
          <span className="h-1.5 w-1.5 rounded-full bg-pulse-amber" />
          <span className="text-[13px] text-pulse-amber/90">
            Messages are paused. You&apos;re excluded from every audience and snapshot until you resume.
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col items-center overflow-y-auto px-10 pt-14">
        <div className="relative flex h-[132px] w-[132px] items-center justify-center">
          {paused ? (
            <>
              <div className="absolute h-[112px] w-[112px] rounded-full border border-dashed border-pulse-amber/35" />
              <div
                className="flex h-16 w-16 items-center justify-center gap-1.5 rounded-full border border-pulse-amber/50"
                style={{ background: "radial-gradient(circle, rgba(255,203,107,.12), transparent 70%)" }}
              >
                <span className="h-[18px] w-1 bg-pulse-amber" />
                <span className="h-[18px] w-1 bg-pulse-amber" />
              </div>
            </>
          ) : (
            <>
              <div className="motion-safe:animate-empPulse absolute h-[112px] w-[112px] rounded-full border border-pulse-green/45" />
              <div
                className="motion-safe:animate-empPulse absolute h-[112px] w-[112px] rounded-full border border-pulse-green/28"
                style={{ animationDelay: "1.8s" }}
              />
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full border border-pulse-green/60"
                style={{ background: "radial-gradient(circle, rgba(94,242,168,.18), transparent 70%)", boxShadow: "0 0 34px rgba(94,242,168,.28)" }}
              >
                <span className="text-2xl text-pulse-green">✓</span>
              </div>
            </>
          )}
        </div>

        <h2 className="mt-5 text-[40px] font-medium leading-none tracking-[-.028em]">
          {paused ? "Signal paused." : "You're messageable."}
        </h2>
        <p className="mt-3 text-[15px] text-ink-3">
          {paused
            ? "Nothing is deleted. Your interests and Telegram link are waiting exactly as you left them."
            : "Wallet signed, interests set, Telegram linked. Signal will reach you."}
        </p>

        {paused ? (
          <button
            onClick={() => void togglePause()}
            disabled={pausing}
            className="mt-9 w-[472px] rounded-md border border-pulse-amber/50 bg-pulse-amber/[.09] px-4 py-4 text-center text-[14.5px] font-semibold text-pulse-amber transition hover:bg-pulse-amber/[.16] disabled:opacity-50"
          >
            {pausing ? "Resuming…" : "Resume messages"}
          </button>
        ) : null}

        <div className={`mb-11 mt-11 grid w-[900px] grid-cols-3 gap-4 ${paused ? "opacity-50" : ""}`}>
          <SummaryCard label="WALLET" dotColor={paused ? "bg-ink-5" : "bg-pulse-green"}>
            <span className="font-mono text-[15px]">{address ? truncateAddress(address) : "—"}</span>
            <span className="text-[12.5px] text-ink-3">
              {me.accountType} · {paused ? "still signed in" : "verified via SIWE"}
            </span>
          </SummaryCard>

          <SummaryCard
            label="INTERESTS"
            corner={
              !paused && (
                <button onClick={onEditInterests} className="font-mono text-[10px] text-pulse-cyan hover:text-pulse-cyan/80">
                  edit
                </button>
              )
            }
          >
            <div className="flex flex-wrap gap-1.5">
              {me.interestCategoryNames.length === 0 && <span className="text-[12px] text-ink-5">none yet</span>}
              {me.interestCategoryNames.map((name) => (
                <span
                  key={name}
                  className={`rounded-chip border px-2.5 py-1 text-[12px] ${
                    paused ? "border-white/[.1] text-ink-3" : "border-pulse-cyan/35 bg-pulse-cyan/[.08]"
                  }`}
                >
                  {name}
                </span>
              ))}
            </div>
            <span className="text-[12.5px] text-ink-3">{me.interestCategoryNames.length} categor{me.interestCategoryNames.length === 1 ? "y" : "ies"}</span>
          </SummaryCard>

          <SummaryCard label="TELEGRAM" dotColor={paused ? "bg-ink-5" : "bg-pulse-green"}>
            <span className={`text-[15px] ${paused ? "text-ink-3" : ""}`}>{paused ? "Linked · muted" : "Linked"}</span>
            <span className="text-[12.5px] text-ink-3">
              {paused
                ? "Bot stays connected while paused"
                : me.telegramVerifiedAt
                  ? `Verified ${formatDateTime(me.telegramVerifiedAt)} · chat bound`
                  : "Chat bound"}
            </span>
          </SummaryCard>
        </div>

        {!paused && (
          <div className="mb-11 flex w-[900px] items-center justify-between rounded-md border border-white/[.07] bg-surface p-6">
            <div className="flex flex-col gap-1.5">
              <span className="text-[16px] font-medium">Pause messages</span>
              <span className="max-w-[520px] text-[13px] text-ink-3">
                Stops every message immediately. Your interests and Telegram link stay as they are — resume
                any time.
              </span>
            </div>
            <button
              onClick={() => void togglePause()}
              disabled={pausing}
              aria-pressed={false}
              aria-label="Pause messages"
              className="relative h-7 w-[52px] shrink-0 rounded-full border border-white/[.12] bg-white/[.08] transition hover:border-white/25 disabled:opacity-50"
            >
              <span className="absolute left-[3px] top-[3px] h-5 w-5 rounded-full bg-ink-5" />
            </button>
          </div>
        )}
      </div>

      <div className="flex h-[60px] shrink-0 items-center justify-between border-t border-white/[.07] px-10">
        <span className="font-mono text-[10px] tracking-[.12em] text-ink-5">
          {paused
            ? "PAUSING TAKES EFFECT IMMEDIATELY · NO SNAPSHOT CAN INCLUDE YOU"
            : "EMP NEVER SHARES YOUR ADDRESS, HANDLE OR ACTIVITY WITH PROTOCOLS"}
        </span>
        <div className="flex items-center gap-5">
          {!confirmingUnlink ? (
            <button onClick={() => setConfirmingUnlink(true)} className="text-[12.5px] text-ink-3 transition hover:text-ink-1">
              Unlink Telegram
            </button>
          ) : (
            <span className="flex items-center gap-2 text-[12.5px]">
              <span className="text-ink-4">Unlink for good?</span>
              <button onClick={() => void unlinkTelegram()} disabled={unlinking} className="font-medium text-pulse-red">
                {unlinking ? "Unlinking…" : "Yes"}
              </button>
              <button onClick={() => setConfirmingUnlink(false)} className="text-ink-4 hover:text-ink-2">
                No
              </button>
            </span>
          )}
          <span
            title="Account deletion isn't available yet — contact EMP."
            className="cursor-not-allowed text-[12.5px] text-ink-5"
          >
            Delete account
          </span>
        </div>
      </div>
    </main>
  );
}
