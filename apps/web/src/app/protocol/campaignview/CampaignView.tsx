"use client";

import { useCallback, useEffect, useState } from "react";
import { StepRail, type Step } from "../StepRail";
import { BackButton } from "../BackButton";
import { MessagePreview } from "../MessagePreview";
import { statusChipClass } from "../dashboard/statusStyle";
import { formatDateTime, formatScheduledSendAt } from "../schedule";
import type { CampaignDetail, CampaignStatus } from "../types";

const PAYMENT_ELIGIBLE: CampaignStatus[] = ["APPROVED", "AWAITING_PAYMENT", "SCHEDULED"];
const CANCELLABLE: CampaignStatus[] = ["IN_REVIEW", "APPROVED"];

// CANCELLED can happen from either IN_REVIEW or APPROVED (cancelCampaign.ts)
// — either way, this freezes the rail at "moderation" rather than guessing
// which one it was.
const STEP_RANK: Record<CampaignStatus, number> = {
  DRAFT: 1,
  REJECTED: 2,
  IN_REVIEW: 2,
  CANCELLED: 2,
  APPROVED: 3,
  AWAITING_PAYMENT: 3,
  SCHEDULED: 4,
  SENDING: 4,
  COMPLETE: 5,
};

function stepsForStatus(status: CampaignStatus): Step[] {
  const r = STEP_RANK[status];
  const state = (n: number): Step["state"] => (n < r ? "done" : n === r ? "current" : "future");
  return [
    { n: 1, label: "Target", sub: "categories locked", state: state(1) },
    { n: 2, label: "Compose", sub: status === "IN_REVIEW" ? "awaiting review" : "content locked", state: state(2) },
    { n: 3, label: "Moderation", sub: status === "APPROVED" || status === "AWAITING_PAYMENT" ? "approved" : "EMP reviews\nmanually, by hand", state: state(3) },
    { n: 4, label: "Pay", sub: "locked at\nsnapshot", state: state(4) },
    { n: 5, label: "Send", sub: "queued burst", state: state(5) },
  ];
}

/**
 * A read-only view for anything past DRAFT/REJECTED (which stay editable
 * via Composer) — SPEC gives content no way back once it's IN_REVIEW+
 * (CLAUDE.md rule 2), but until now those campaigns had literally no
 * detail screen: IN_REVIEW had no click-through at all, and
 * APPROVED/AWAITING_PAYMENT/SCHEDULED only opened PaymentScreen, which is
 * about payment mechanics, not content. This shows the message/image/CTAs
 * that were actually submitted, alongside status and schedule.
 *
 * Rescheduling a SCHEDULED campaign's send time is real, existing
 * capability (rescheduleCampaign.ts) — already paid, so changing or
 * clearing the time is a plain field update, never a new payment. It
 * already lives in PaymentScreen; this view links there rather than
 * reimplementing it, so there's exactly one place that logic exists.
 *
 * Cancelling (IN_REVIEW/APPROVED, nothing paid yet) is enforced
 * server-side by cancelCampaign() — this view only offers the button when
 * the status makes it plausible; the API is the actual gate.
 */
export function CampaignView({
  campaignId,
  onClose,
  onChanged,
  onOpenPayment,
}: {
  campaignId: string;
  onClose: () => void;
  /** Fires after a successful cancel — the campaign list should refetch and this view should close. */
  onChanged: (message: string) => void;
  onOpenPayment: (campaignId: string) => void;
}) {
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    const res = await fetch(`/api/protocol/campaigns/${campaignId}`);
    if (!res.ok) return;
    setDetail((await res.json()) as CampaignDetail);
  }, [campaignId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  async function cancel() {
    setCancelling(true);
    setError(null);
    const res = await fetch(`/api/protocol/campaigns/${campaignId}/cancel`, { method: "POST" });
    setCancelling(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not cancel this campaign.");
      return;
    }
    onChanged("Campaign cancelled.");
  }

  if (!detail) {
    return (
      <main className="flex h-screen items-center justify-center bg-void">
        <p className="text-sm text-ink-4">Loading…</p>
      </main>
    );
  }

  const canCancel = CANCELLABLE.includes(detail.status);
  const canPay = PAYMENT_ELIGIBLE.includes(detail.status);
  const usd = detail.costAmount !== null ? Number(detail.costAmount) : null;

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-void text-[13px] text-ink-1">
      <header className="flex h-[57px] shrink-0 items-center gap-4 border-b border-white/[.07] px-[26px]">
        <div className="font-mono text-[13px] font-bold tracking-[.06em]">EMP</div>
        <BackButton onClick={onClose} />
        <div className="h-4 w-px bg-white/[.12]" />
        <div className="min-w-0 max-w-[280px] flex-1 truncate text-[13px] text-ink-2">{detail.title}</div>
        <span className={`whitespace-nowrap rounded-chip px-2.5 py-1 font-mono text-[10.5px] font-medium ${statusChipClass(detail.status)}`}>
          {detail.status.replace("_", " ")}
        </span>
        <div className="ml-auto flex items-center gap-[10px]">
          {canPay && (
            <button
              onClick={() => onOpenPayment(campaignId)}
              className="rounded-md bg-pulse-cyan px-[15px] py-2 text-[12.5px] font-semibold text-onaccent-cyan transition hover:shadow-glow"
            >
              {detail.status === "SCHEDULED" ? "Manage schedule" : detail.status === "AWAITING_PAYMENT" ? "View payment" : "Go to payment"}
            </button>
          )}
          {canCancel && !confirmingCancel && (
            <button
              onClick={() => setConfirmingCancel(true)}
              className="rounded-md border border-white/[.12] px-[13px] py-2 text-[12.5px] text-ink-2 transition hover:border-pulse-red/50 hover:text-pulse-red"
            >
              Cancel campaign
            </button>
          )}
          {canCancel && confirmingCancel && (
            <div className="flex items-center gap-2">
              <span className="text-[11.5px] text-ink-4">Cancel for good?</span>
              <button
                onClick={() => void cancel()}
                disabled={cancelling}
                className="rounded-md bg-pulse-red px-[13px] py-2 text-[12.5px] font-semibold text-white transition disabled:opacity-50"
              >
                {cancelling ? "Cancelling…" : "Yes, cancel"}
              </button>
              <button
                onClick={() => setConfirmingCancel(false)}
                className="rounded-md border border-white/[.12] px-[13px] py-2 text-[12.5px] text-ink-2 hover:border-white/25"
              >
                Never mind
              </button>
            </div>
          )}
          <button onClick={onClose} aria-label="Close" className="text-ink-4 hover:text-ink-1">
            ✕
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[210px_1fr_320px]">
        <StepRail
          steps={stepsForStatus(detail.status)}
          accent="cyan"
          footnote="MODERATE → PAY → SEND. Rejected messages are never charged."
        />

        <div className="flex min-h-0 min-w-0 flex-col gap-[18px] overflow-y-auto px-[26px] py-6">
          {error && (
            <p role="alert" className="text-[12.5px] text-pulse-red">
              {error}
            </p>
          )}

          <div>
            <div className="mb-[10px] font-mono text-[9.5px] font-medium tracking-[.12em] text-ink-5">01 · TARGET CATEGORIES</div>
            <div className="flex flex-wrap gap-2">
              {detail.categoryNames.map((name) => (
                <span
                  key={name}
                  className="rounded-chip border border-pulse-cyan/45 bg-pulse-cyan/10 px-[13px] py-[7px] text-[12.5px] text-pulse-cyan"
                  style={{ borderRadius: "20px" }}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-[10px]">
            <div className="font-mono text-[9.5px] font-medium tracking-[.12em] text-ink-5">02 · MESSAGE</div>
            <div className="flex flex-col gap-[14px] rounded-card border border-white/[.1] bg-surface p-4">
              <p className="whitespace-pre-wrap text-[13.5px] leading-[1.6] text-ink-1">{detail.bodyText}</p>
              {detail.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={detail.imageUrl} alt="" className="max-h-[220px] rounded-md border border-white/10 object-cover" />
              )}
              {detail.ctas.length > 0 && (
                <div className="flex flex-col gap-[9px]">
                  {detail.ctas.map((cta) => (
                    <div key={cta.id} className="flex items-center gap-2 text-[12.5px]">
                      <span className="rounded-md border border-pulse-cyan/40 bg-pulse-cyan/10 px-[13px] py-2 font-medium text-pulse-cyan">
                        {cta.label}
                      </span>
                      <span className="truncate text-ink-4">{cta.targetUrl}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="mb-[10px] font-mono text-[9.5px] font-medium tracking-[.12em] text-ink-5">03 · SCHEDULE</div>
            <div className="rounded-card border border-white/[.1] bg-surface p-4 text-[12.5px] text-ink-2">
              {detail.scheduledSendAt ? (
                <>
                  {detail.status === "SCHEDULED" ? "Scheduled for " : "Set to send at "}
                  {formatScheduledSendAt(detail.scheduledSendAt)}
                </>
              ) : (
                "Sends as soon as payment clears."
              )}
              {detail.sentAt && <div className="mt-1 text-ink-4">Actually sent: {formatDateTime(detail.sentAt)}</div>}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="font-mono text-[9.5px] font-medium tracking-[.12em] text-ink-5">04 · PREVIEW</div>
            <MessagePreview bodyText={detail.bodyText ?? ""} imageUrl={detail.imageUrl ?? ""} ctas={detail.ctas} />
          </div>
        </div>

        <aside className="flex flex-col gap-5 overflow-y-auto border-l border-white/[.07] bg-rail px-[22px] py-6">
          <div className="flex flex-col gap-[11px]">
            <div className="font-mono text-[9.5px] font-medium tracking-[.12em] text-ink-5">LOCKED AT APPROVAL</div>
            <div className="flex justify-between text-[12.5px]">
              <span className="text-ink-4">Audience</span>
              <span className="font-mono">{detail.snapshotCount !== null ? detail.snapshotCount.toLocaleString() : "not yet approved"}</span>
            </div>
            <div className="flex justify-between text-[12.5px]">
              <span className="text-ink-4">Cost</span>
              <span className="font-mono">{typeof usd === "number" ? `$${usd.toFixed(2)}` : "not yet approved"}</span>
            </div>
          </div>
          <div className="mt-auto font-mono text-[10.5px] leading-[1.5] text-ink-5">
            PRIVACY BOUNDARY — every figure here is a count or a rate. No recipient lists, wallets, or handles.
          </div>
        </aside>
      </div>
    </main>
  );
}
