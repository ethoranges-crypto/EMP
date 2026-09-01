"use client";

import { useEffect, useState } from "react";
import { MessagePreview } from "../MessagePreview";
import { PaidPanel } from "../PaidPanel";
import { statusChipClass } from "./statusStyle";
import { formatDateTime, formatScheduledSendAt } from "../schedule";
import type { CampaignDetail, CampaignFullMetrics } from "../types";

const METRICS_VISIBLE_STATUSES = new Set(["SENDING", "COMPLETE"]);

function TimelinePoint({ label, value, done }: { label: string; value: string | null; done: boolean }) {
  return (
    <div className="flex gap-2.5">
      <div className={`mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full ${done ? "bg-pulse-cyan" : "border border-white/25"}`} />
      <div className="flex flex-col">
        <div className="font-mono text-[9.5px] tracking-[.1em] text-ink-5">{label}</div>
        <div className={`text-[12.5px] ${done ? "text-ink-1" : "text-ink-4"}`}>{value ?? "—"}</div>
      </div>
    </div>
  );
}

/**
 * The dashboard's per-campaign detail view (2d, restyled to the 1b
 * language) — reached only for SENDING/COMPLETE/CANCELLED (HistoryList's
 * actionFor "detail" fallback), so payment here is either verified
 * (SENDING/COMPLETE — flow ordering guarantees it) or, for a CANCELLED
 * campaign, absent or a failed attempt from before it was cancelled;
 * never both possible at once, so PaidPanel only renders for a genuinely
 * verified payment rather than faking a "Paid" state for a failed one.
 *
 * Body is the design's two-column split: left is what was actually sent
 * — the same frozen MessagePreview compose/CampaignView use, plus the
 * CTA target URLs (not visible inside the phone mockup itself) — right is
 * aggregate results only: delivered %, click % per CTA, and the send
 * timeline. Results (GET .../metrics) only fetched once there's anything
 * to show — before SENDING, nothing has gone out yet, and the right
 * column says so instead of just being empty. No "read" metric exists
 * (Telegram has none — CLAUDE.md) — stated explicitly rather than
 * silently missing, per the design.
 */
export function CampaignDetailView({ campaignId, onClose }: { campaignId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [metrics, setMetrics] = useState<CampaignFullMetrics | null>(null);

  useEffect(() => {
    setDetail(null);
    setMetrics(null);

    fetch(`/api/protocol/campaigns/${campaignId}`)
      .then((r) => r.json())
      .then((data: CampaignDetail) => {
        setDetail(data);
        if (METRICS_VISIBLE_STATUSES.has(data.status)) {
          fetch(`/api/protocol/campaigns/${campaignId}/metrics`)
            .then((r) => r.json())
            .then((m: CampaignFullMetrics) => setMetrics(m));
        }
      });
  }, [campaignId]);

  if (!detail) {
    return (
      <section className="rounded-card border border-white/[.08] bg-surface p-5">
        <p className="text-[12.5px] text-ink-4">Loading…</p>
      </section>
    );
  }

  const usd = detail.costAmount !== null ? Number(detail.costAmount) : null;
  const verifiedPayment = detail.payment?.status === "VERIFIED" ? detail.payment : null;
  const failedPayment = detail.payment && detail.payment.status !== "VERIFIED" ? detail.payment : null;

  return (
    <section className="flex flex-col gap-4 rounded-card border border-pulse-cyan/30 bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="truncate text-[15px] font-medium text-ink-1">{detail.title}</h2>
          <p className="truncate font-mono text-[10.5px] text-ink-5">{detail.categoryNames.join(", ") || "No categories"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className={`rounded-chip px-2.5 py-1 font-mono text-[10.5px] font-medium ${statusChipClass(detail.status)}`}>
            {detail.status.replace("_", " ")}
          </span>
          <button onClick={onClose} aria-label="Close" className="text-ink-4 hover:text-ink-1">
            ✕
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex min-w-[220px] flex-1 justify-between gap-4 rounded-card border border-white/[.08] bg-void/40 p-[13px_14px]">
          <div>
            <div className="font-mono text-[9.5px] tracking-[.1em] text-ink-5">AUDIENCE</div>
            <div className="mt-1 font-mono text-[13px]">
              {detail.snapshotCount !== null ? detail.snapshotCount.toLocaleString() : "not locked"}
            </div>
          </div>
          <div>
            <div className="font-mono text-[9.5px] tracking-[.1em] text-ink-5">COST</div>
            <div className="mt-1 font-mono text-[13px]">{usd !== null ? `$${usd.toFixed(2)}` : "not locked"}</div>
          </div>
        </div>
        {failedPayment && (
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-card border border-pulse-red/35 bg-pulse-red/5 p-[13px_14px]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-pulse-red" />
            <span className="text-[12.5px] text-ink-2">Payment attempt: {failedPayment.status.replace("_", " ").toLowerCase()}</span>
          </div>
        )}
      </div>

      {verifiedPayment && <PaidPanel payment={verifiedPayment} />}

      {detail.status === "REJECTED" && detail.rejectionReason && (
        <div className="rounded-card border border-pulse-red/40 bg-pulse-red/10 px-4 py-3 text-[12.5px]">
          <p className="font-medium text-pulse-red">Rejected by admin</p>
          <p className="mt-1 text-ink-2">{detail.rejectionReason}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-2.5">
          <div className="font-mono text-[9.5px] font-medium tracking-[.12em] text-ink-5">WHAT WAS SENT</div>
          <MessagePreview bodyText={detail.bodyText ?? ""} imageUrl={detail.imageUrl ?? ""} ctas={detail.ctas} />
          {detail.ctas.length > 0 && (
            <div className="mx-auto flex w-full max-w-[280px] flex-col gap-1.5">
              {detail.ctas.map((cta) => (
                <p key={cta.id} className="truncate font-mono text-[10.5px] text-ink-5">
                  {cta.label} → {cta.targetUrl}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <div className="font-mono text-[9.5px] font-medium tracking-[.12em] text-ink-5">RESULTS</div>
            {metrics ? (
              <div className="flex flex-col gap-3 rounded-card border border-white/[.08] bg-void/40 p-4">
                <div>
                  <div className="font-mono text-[26px] font-medium leading-none text-pulse-cyan">{metrics.delivered.ratePct}%</div>
                  <div className="mt-1.5 text-[12px] text-ink-4">
                    Delivered to {metrics.delivered.count.toLocaleString()} user{metrics.delivered.count === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="h-px bg-white/[.08]" />
                <div>
                  <div className="font-mono text-[26px] font-medium leading-none text-pulse-violet">{metrics.clicks.ratePct}%</div>
                  <div className="mt-1.5 text-[12px] text-ink-4">
                    {metrics.clicks.total.toLocaleString()} click{metrics.clicks.total === 1 ? "" : "s"} of delivered
                  </div>
                </div>
                {metrics.clicks.byCta.length > 1 && (
                  <div className="flex flex-col gap-1.5 border-t border-white/[.08] pt-3">
                    {metrics.clicks.byCta.map((c) => (
                      <div key={c.ctaId} className="flex items-center justify-between text-[11.5px]">
                        <span className="truncate text-ink-3">{c.label}</span>
                        <span className="shrink-0 font-mono text-ink-4">
                          {c.count} · {c.ratePct}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-card border border-white/[.08] bg-void/40 p-4 text-[12.5px] text-ink-4">
                {detail.status === "CANCELLED" ? "Cancelled before anything sent — no results." : "Nothing has sent yet — results appear once sending starts."}
              </div>
            )}
            <p className="font-mono text-[10.5px] leading-[1.5] text-ink-5">
              Delivered % and click % only — Telegram has no read receipts, so there&apos;s no &quot;read&quot; metric to show.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="font-mono text-[9.5px] font-medium tracking-[.12em] text-ink-5">SEND TIMELINE</div>
            <div className="flex flex-col gap-3 rounded-card border border-white/[.08] bg-void/40 p-4">
              <TimelinePoint label="CREATED" value={formatDateTime(detail.createdAt)} done />
              <TimelinePoint label="APPROVED" value={detail.approvedAt ? formatDateTime(detail.approvedAt) : null} done={!!detail.approvedAt} />
              <TimelinePoint
                label={detail.sentAt ? "SENT" : "SCHEDULED"}
                value={
                  detail.sentAt
                    ? formatDateTime(detail.sentAt)
                    : detail.scheduledSendAt
                      ? formatScheduledSendAt(detail.scheduledSendAt)
                      : detail.status === "CANCELLED"
                        ? "Never sent — cancelled"
                        : "Immediate on payment"
                }
                done={!!detail.sentAt}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
