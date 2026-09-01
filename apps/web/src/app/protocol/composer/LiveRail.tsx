"use client";

/**
 * Right rail — live truth for whatever's currently targeted, updating as
 * categories are toggled (or, once a draft exists and targeting is locked,
 * reflecting the current live count for that fixed target — see
 * Composer's own doc comment on why categories lock after creation).
 *
 * The design's mockup shows a two-row breakdown — "Matching categories"
 * then "Verified Telegram" as a narrower subset — implying a two-stage
 * funnel. getAudienceCount (packages/core/src/protocolQueries) returns one
 * already-final number: matching-categories-AND-verified-Telegram
 * combined, with no separate pre-filter count anywhere to show as the
 * first row. Rather than invent one, this shows only the one real number,
 * same as the dashboard/gate LiveRails' pulse circles.
 */
export function LiveRail({
  audienceCount,
  countLoading,
  flatCostPerUser,
}: {
  audienceCount: number | null;
  countLoading: boolean;
  flatCostPerUser: number | null;
}) {
  const estCost = typeof audienceCount === "number" && typeof flatCostPerUser === "number" ? audienceCount * flatCostPerUser : null;

  return (
    <aside className="flex flex-col gap-5 overflow-y-auto border-l border-white/[.07] bg-rail px-[22px] py-6">
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
          <div className="font-mono text-[24px] font-medium text-pulse-cyan">
            {countLoading ? "…" : typeof audienceCount === "number" ? audienceCount.toLocaleString() : "—"}
          </div>
          <div className="font-mono text-[9.5px] tracking-[.1em] text-ink-4">MESSAGEABLE</div>
        </div>
      </div>

      <div className="flex flex-col gap-[11px]">
        <div className="flex justify-between text-[12.5px]">
          <span className="text-ink-4">Cost per user</span>
          <span className="font-mono">{typeof flatCostPerUser === "number" ? `$${flatCostPerUser.toFixed(2)}` : "—"}</span>
        </div>
        <div className="h-px bg-white/[.09]" />
        <div className="flex items-baseline justify-between">
          <span className="text-[12.5px] text-ink-2">Est. cost</span>
          <span className="font-mono text-[22px] font-medium">{typeof estCost === "number" ? `$${estCost.toFixed(2)}` : "—"}</span>
        </div>
        <div className="font-mono text-[10.5px] leading-[1.5] text-ink-5">
          Locked exactly at approval, against the recipient snapshot. You are never charged for a rejected campaign.
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-[9px] rounded-card border border-white/[.08] bg-surface p-[14px]">
        <div className="font-mono text-[9.5px] font-medium tracking-[.12em] text-ink-5">WHAT YOU&apos;LL SEE BACK</div>
        <div className="text-[12.5px] text-ink-2">Delivered % · click % per CTA · audience size</div>
        <div className="font-mono text-[10.5px] leading-[1.5] text-ink-5">
          Never: wallets, handles, or per-user rows. There is no &quot;read&quot; metric.
        </div>
      </div>
    </aside>
  );
}
