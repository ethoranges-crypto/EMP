"use client";

import { useEffect, useState } from "react";
import { MessagePreview } from "../MessagePreview";
import { formatDateTime, formatScheduledSendAt } from "../schedule";
import type { CampaignDetail, CampaignFullMetrics } from "../types";

const METRICS_VISIBLE_STATUSES = new Set(["SENDING", "COMPLETE"]);

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm text-slate-300">
      <span className="text-slate-500">{label}: </span>
      {value}
    </p>
  );
}

/**
 * The dashboard's per-campaign detail view — a completed (or in-progress, or
 * even never-sent) campaign's full record, per this feature's spec: what
 * was sent (rendered in the same MessagePreview compose uses, so it's
 * exactly what the recipient saw), timing, cost/payment, and results.
 * Results (GET .../metrics) only fetched once there's anything to show —
 * before SENDING, nothing has gone out yet.
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
      <section className="rounded-xl border border-white/10 bg-surface p-6">
        <p className="text-sm text-slate-500">Loading…</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-pulse-cyan/40 bg-surface p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{detail.title}</h2>
          <p className="text-xs text-slate-500">{detail.categoryNames.join(", ") || "—"}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-slate-400">{detail.status}</span>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-100">
            ✕
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 rounded-lg border border-white/10 bg-void/40 p-4">
            <Fact label="Created" value={formatDateTime(detail.createdAt)} />
            {detail.approvedAt && <Fact label="Approved" value={formatDateTime(detail.approvedAt)} />}
            <Fact
              label="Schedule"
              value={detail.scheduledSendAt ? formatScheduledSendAt(detail.scheduledSendAt) : "Immediate — sent as soon as payment cleared"}
            />
            <Fact label="Sent" value={detail.sentAt ? formatDateTime(detail.sentAt) : "Not sent yet"} />
          </div>

          <div className="flex flex-col gap-1 rounded-lg border border-white/10 bg-void/40 p-4">
            <Fact
              label="Audience"
              value={detail.snapshotCount !== null ? `${detail.snapshotCount} user${detail.snapshotCount === 1 ? "" : "s"}` : "Not locked yet"}
            />
            <Fact label="Cost" value={detail.costAmount !== null ? `$${Number(detail.costAmount).toFixed(2)}` : "Not locked yet"} />
            {detail.payment && (
              <>
                <Fact label="Paid" value={`${detail.payment.amount} ${detail.payment.token} on ${detail.payment.chain}`} />
                <Fact label="Payment status" value={detail.payment.status} />
              </>
            )}
          </div>

          {detail.status === "REJECTED" && detail.rejectionReason && (
            <div className="rounded-lg border border-red-500/30 bg-void/40 p-4">
              <Fact label="Rejected" value={detail.rejectionReason} />
            </div>
          )}

          {detail.ctas.length > 0 && (
            <div className="flex flex-col gap-1 rounded-lg border border-white/10 bg-void/40 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">CTAs</p>
              {detail.ctas.map((cta) => (
                <p key={cta.id} className="break-all text-xs text-slate-400">
                  {cta.label} → {cta.targetUrl}
                </p>
              ))}
            </div>
          )}

          {metrics && (
            <div className="flex flex-col gap-2 rounded-lg border border-pulse-cyan/30 bg-void/40 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Results</p>
              <p className="text-sm text-slate-100">
                Delivered to {metrics.delivered.count} user{metrics.delivered.count === 1 ? "" : "s"} ({metrics.delivered.ratePct}%)
              </p>
              <p className="text-sm text-slate-100">
                {metrics.clicks.total} click{metrics.clicks.total === 1 ? "" : "s"} ({metrics.clicks.ratePct}% of delivered)
              </p>
              {metrics.clicks.byCta.length > 1 &&
                metrics.clicks.byCta.map((c) => (
                  <p key={c.ctaId} className="pl-3 text-xs text-slate-400">
                    {c.label}: {c.count} ({c.ratePct}%)
                  </p>
                ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-center text-xs uppercase tracking-wide text-slate-500">What the recipient saw</p>
          <MessagePreview bodyText={detail.bodyText ?? ""} imageUrl={detail.imageUrl ?? ""} ctas={detail.ctas} />
        </div>
      </div>
    </section>
  );
}
