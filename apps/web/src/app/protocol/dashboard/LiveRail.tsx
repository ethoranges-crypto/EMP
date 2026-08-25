"use client";

import Link from "next/link";
import type { ProtocolCampaign } from "../types";
import { PAYMENT_TOKENS } from "@emp/config/paymentTokens";

/**
 * Right rail — "live truth": the one number that matters most (messageable
 * audience, real-time), a few network facts, the one thing that needs the
 * protocol's attention (if anything does), a best-performer callout, and
 * the privacy-boundary statement pinned to the bottom on every screen.
 *
 * Two things the design shows here that this build can't, honestly:
 *  - "Verified this week +N" — no time-windowed verification-delta query
 *    exists; nothing invented, just omitted.
 *  - "Your best CATEGORY" — click rate isn't aggregated per category
 *    anywhere; substituted with "your best CAMPAIGN" instead, using the
 *    same per-campaign metrics the history list already has.
 */
export function LiveRail({
  messageableCount,
  flatCostPerUser,
  needsActionCampaign,
  bestCampaign,
}: {
  messageableCount: number | null;
  flatCostPerUser: number | null;
  needsActionCampaign: ProtocolCampaign | null;
  bestCampaign: { title: string; ratePct: number } | null;
}) {
  return (
    <aside className="flex flex-col gap-[18px] overflow-y-auto border-l border-white/[.07] bg-rail px-[22px] py-6">
      <div className="relative flex h-[150px] items-center justify-center">
        <div className="motion-safe:animate-empPulse absolute h-[120px] w-[120px] rounded-full border border-pulse-cyan/50" />
        <div
          className="motion-safe:animate-empPulse absolute h-[120px] w-[120px] rounded-full border border-pulse-cyan/50"
          style={{ animationDelay: "1.3s" }}
        />
        <div
          className="relative flex h-[104px] w-[104px] flex-col items-center justify-center gap-1 rounded-full border border-pulse-cyan/35"
          style={{ background: "radial-gradient(circle, rgba(53,230,242,.14), transparent 70%)" }}
        >
          <div className="font-mono text-[22px] font-medium text-pulse-cyan">
            {typeof messageableCount === "number" ? messageableCount.toLocaleString() : "—"}
          </div>
          <div className="font-mono text-[9.5px] tracking-[.1em] text-ink-4">MESSAGEABLE</div>
        </div>
      </div>

      <div className="flex flex-col gap-[11px]">
        <div className="font-mono text-[9.5px] font-medium tracking-[.12em] text-ink-5">NETWORK RIGHT NOW</div>
        <div className="flex justify-between text-[12.5px]">
          <span className="text-ink-4">Cost per user</span>
          <span className="font-mono">{typeof flatCostPerUser === "number" ? `$${flatCostPerUser.toFixed(2)}` : "—"}</span>
        </div>
        <div className="flex justify-between text-[12.5px]">
          <span className="text-ink-4">Accepted tokens</span>
          <span className="font-mono">{PAYMENT_TOKENS.join(" · ")}</span>
        </div>
      </div>

      {needsActionCampaign && (
        <div className="flex flex-col gap-[9px] rounded-card border border-pulse-amber/30 bg-pulse-amber/5 p-[14px]">
          <div className="font-mono text-[9.5px] font-medium tracking-[.12em] text-[#8b8069]">NEEDS YOU</div>
          <div className="text-[12.5px] text-[#e0d3b6]">
            <strong className="text-inherit">{needsActionCampaign.title}</strong>
            {needsActionCampaign.status === "AWAITING_PAYMENT"
              ? " is approved and awaiting payment before it can send."
              : " is approved — pick a chain and token to open its payment window."}
          </div>
          <Link
            href="/protocol"
            className="self-start rounded-md bg-pulse-amber px-[13px] py-2 text-xs font-semibold text-onaccent-amber"
          >
            Go to payment
          </Link>
        </div>
      )}

      {bestCampaign && (
        <div className="flex flex-col gap-[9px] rounded-card border border-white/[.08] bg-surface p-[14px]">
          <div className="font-mono text-[9.5px] font-medium tracking-[.12em] text-ink-5">YOUR BEST CAMPAIGN</div>
          <div className="flex items-baseline gap-2">
            <div className="truncate font-mono text-lg font-medium">{bestCampaign.title}</div>
            <div className="shrink-0 font-mono text-[11px] text-pulse-violet">{bestCampaign.ratePct}% clicks</div>
          </div>
          <div className="font-mono text-[10.5px] leading-[1.5] text-ink-5">
            Derived from your own campaign aggregates — not from user profiles.
          </div>
        </div>
      )}

      <div className="mt-auto font-mono text-[10.5px] leading-[1.5] text-ink-5">
        PRIVACY BOUNDARY — every figure on this page is a count or a rate. No recipient lists, wallets, or handles, and no
        &quot;read&quot; metric.
      </div>
    </aside>
  );
}
