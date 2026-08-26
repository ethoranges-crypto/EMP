"use client";

import type { PaymentStatus } from "../types";
import { formatDateTime } from "../schedule";

const FAILURE_LABEL: Record<Exclude<PaymentStatus, "AWAITING" | "VERIFIED">, string> = {
  UNDERPAID: "Underpaid",
  WRONG_TOKEN: "Wrong token",
  LATE: "Window expired",
  DUPLICATE: "Duplicate transaction",
};

/**
 * The design's right rail shows a live confirmation-count timeline ("Tx
 * seen · 1/12 confs", with the actual tx hash) between "awaiting" and
 * "verified" — apps/worker's watcher (matchPayment.ts) doesn't track or
 * expose confirmation counts or a mid-flight tx hash; it polls, then
 * resolves straight to a final status (VERIFIED or one of the failure
 * states) in one step. Rather than fabricate a granularity we don't have,
 * this only ever shows the two real states EMP can actually assert:
 * awaiting and resolved.
 */
export function LiveRail({
  paymentStatus,
  chain,
  approvedAt,
  snapshotCount,
}: {
  /** null = no payment window open yet (still picking a chain/token). */
  paymentStatus: PaymentStatus | null;
  chain: string | null;
  approvedAt: string | null;
  snapshotCount: number | null;
}) {
  const verified = paymentStatus === "VERIFIED";
  const failed = paymentStatus !== null && paymentStatus !== "AWAITING" && paymentStatus !== "VERIFIED";
  const watching = paymentStatus === "AWAITING";

  return (
    <aside className="flex flex-col gap-5 overflow-y-auto border-l border-white/[.07] bg-rail px-[22px] py-6">
      <div className="relative flex h-[150px] items-center justify-center">
        {watching && (
          <>
            <div className="motion-safe:animate-empPulse absolute h-[120px] w-[120px] rounded-full border border-pulse-amber/45" />
            <div
              className="motion-safe:animate-empPulse absolute h-[120px] w-[120px] rounded-full border border-pulse-amber/45"
              style={{ animationDelay: "1s" }}
            />
          </>
        )}
        <div
          className={`relative flex h-[104px] w-[104px] flex-col items-center justify-center gap-1 rounded-full border ${
            verified
              ? "border-pulse-green/40"
              : failed
                ? "border-pulse-red/40"
                : watching
                  ? "border-pulse-amber/35"
                  : "border-white/[.15]"
          }`}
          style={{
            background: verified
              ? "radial-gradient(circle, rgba(94,242,168,.14), transparent 70%)"
              : failed
                ? "radial-gradient(circle, rgba(255,122,107,.14), transparent 70%)"
                : watching
                  ? "radial-gradient(circle, rgba(255,203,107,.14), transparent 70%)"
                  : undefined,
          }}
        >
          <div
            className={`font-mono text-[13px] font-medium ${
              verified ? "text-pulse-green" : failed ? "text-pulse-red" : watching ? "text-pulse-amber" : "text-ink-4"
            }`}
          >
            {verified ? "VERIFIED" : failed ? "ACTION NEEDED" : watching ? "WATCHING" : "NOT YET OPEN"}
          </div>
          {watching && chain && (
            <div className="text-center font-mono text-[9.5px] leading-[1.3] tracking-[.08em] text-[#8b8069]">
              {chain.toUpperCase()}
              <br />
              MEMPOOL
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-0">
        <div className="mb-[14px] font-mono text-[9.5px] font-medium tracking-[.12em] text-ink-5">VERIFICATION</div>

        <div className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="mt-[5px] h-2 w-2 rounded-full bg-pulse-green" />
            <div className="min-h-[34px] w-px flex-1 bg-pulse-green" />
          </div>
          <div className="pb-[14px]">
            <div className="text-[12.5px]">Cost locked</div>
            <div className="font-mono text-[10.5px] text-ink-5">
              {approvedAt ? formatDateTime(approvedAt) : "—"}
              {snapshotCount !== null && ` · snapshot ${snapshotCount.toLocaleString()}`}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex flex-col items-center">
            <div
              className={`mt-[5px] h-2 w-2 rounded-full ${
                verified ? "bg-pulse-green" : failed ? "bg-pulse-red" : watching ? "bg-pulse-amber" : "border border-white/20"
              }`}
            />
            <div className={`min-h-[34px] w-px flex-1 ${verified ? "bg-pulse-green" : "bg-white/[.12]"}`} />
          </div>
          <div className="pb-[14px]">
            <div className={`text-[12.5px] ${verified ? "" : failed ? "text-pulse-red" : watching ? "text-pulse-amber" : "text-ink-4"}`}>
              {verified ? "Payment verified" : failed ? FAILURE_LABEL[paymentStatus as keyof typeof FAILURE_LABEL] : watching ? "Awaiting payment" : "Payment"}
            </div>
            <div className="font-mono text-[10.5px] text-ink-5">sender + token + amount</div>
          </div>
        </div>

        <div className="flex gap-3">
          <div className={`mt-[5px] h-2 w-2 rounded-full ${verified ? "bg-pulse-green" : "border border-white/20"}`} />
          <div>
            <div className={`text-[12.5px] ${verified ? "" : "text-ink-4"}`}>Queued to send</div>
            <div className="font-mono text-[10.5px] text-ink-5">throttled burst</div>
          </div>
        </div>
      </div>

      {verified && (
        <div className="flex flex-col gap-[6px] rounded-card border border-pulse-green/30 bg-pulse-green/5 p-[13px]">
          <div className="font-mono text-[9.5px] font-medium tracking-[.12em] text-pulse-green">VERIFIED</div>
          <div className="text-[12.5px] text-ink-2">
            This closes automatically — your campaign list will show it sending live.
          </div>
        </div>
      )}

      <div className="mt-auto font-mono text-[10.5px] leading-[1.5] text-ink-5">
        Duplicate payments are detected and never double-spent on a second send.
      </div>
    </aside>
  );
}
