"use client";

import { PAYMENT_TOKENS } from "@emp/config/paymentTokens";

/**
 * Right rail — "live truth" for the onboarding gate. Two things the design
 * shows here that this build won't fake:
 *  - "~18h MEDIAN WAIT" — no query anywhere aggregates past review
 *    turnaround, and Protocol.createdAt is set at first SIWE sign-in (not
 *    at application-submit time), so it can't stand in for one either
 *    without misrepresenting the wait. Shown as a plain status pulse
 *    instead of a fabricated number.
 *  - "Start a draft campaign" while waiting — the backend hard-blocks
 *    draft creation until a protocol is APPROVED (createDraftCampaign
 *    throws ProtocolNotApprovedError), so this renders disabled rather
 *    than linking to an action that would just fail.
 */
export function LiveRail({
  pending,
  messageableCount,
  flatCostPerUser,
}: {
  pending: boolean;
  messageableCount: number | null;
  flatCostPerUser: number | null;
}) {
  return (
    <aside className="flex flex-col gap-5 overflow-y-auto border-l border-white/[.07] bg-void px-[22px] py-6">
      {pending ? (
        <div className="relative flex h-[150px] items-center justify-center">
          <div className="motion-safe:animate-empPulse absolute h-[120px] w-[120px] rounded-full border border-pulse-amber/40" />
          <div
            className="relative flex h-[104px] w-[104px] flex-col items-center justify-center gap-1 rounded-full border border-pulse-amber/30"
            style={{ background: "radial-gradient(circle, rgba(255,203,107,.12), transparent 70%)" }}
          >
            <div className="font-mono text-[13px] font-medium text-pulse-amber">IN REVIEW</div>
            <div className="text-center font-mono text-[9.5px] leading-[1.3] tracking-[.08em] text-ink-4">
              WAITING ON
              <br />
              AN ADMIN
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 rounded-lg border border-white/[.08] p-3.5">
          <div className="font-mono text-[9.5px] font-medium tracking-[.12em] text-ink-5">WHAT HAPPENS NEXT</div>
          <div className="text-[12.5px] text-ink-2">
            Once your application is submitted, an EMP admin reviews it manually — there&apos;s no automated
            approval path.
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <div className="font-mono text-[9.5px] font-medium tracking-[.12em] text-ink-5">WHILE YOU WAIT</div>
        <div className="text-[12.5px] text-ink-2">
          You can&apos;t create a campaign until you&apos;re approved — drafting isn&apos;t open yet.
        </div>
        <button
          disabled
          title="Available once your application is approved"
          className="cursor-not-allowed rounded-md border border-white/[.12] px-[11px] py-[11px] text-center text-[12.5px] text-ink-4 opacity-50"
        >
          Start a draft campaign
        </button>
      </div>

      <div className="flex flex-col gap-[11px] border-t border-white/[.08] pt-4">
        <div className="font-mono text-[9.5px] font-medium tracking-[.12em] text-ink-5">NETWORK RIGHT NOW</div>
        <div className="flex justify-between text-[12.5px]">
          <span className="text-ink-4">Messageable users</span>
          <span className="font-mono">{messageableCount !== null ? messageableCount.toLocaleString() : "—"}</span>
        </div>
        <div className="flex justify-between text-[12.5px]">
          <span className="text-ink-4">Cost per user</span>
          <span className="font-mono">{flatCostPerUser !== null ? `$${flatCostPerUser.toFixed(2)}` : "—"}</span>
        </div>
        <div className="flex justify-between text-[12.5px]">
          <span className="text-ink-4">Accepted tokens</span>
          <span className="font-mono">{PAYMENT_TOKENS.join(" · ")}</span>
        </div>
      </div>

      <div className="mt-auto font-mono text-[10.5px] leading-[1.5] text-ink-5">
        One wallet ↔ one account ↔ one Telegram. Audience size approximates distinct humans, which is what
        you&apos;re paying for.
      </div>
    </aside>
  );
}
