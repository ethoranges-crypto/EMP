"use client";

import { useState } from "react";
import { MessagePreview } from "../protocol/MessagePreview";
import type { InReviewCampaign } from "./types";

function CampaignReviewCard({ campaign, onChange }: { campaign: InReviewCampaign; onChange: () => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "APPROVED" | "REJECTED", notes?: string) {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/admin/campaigns/${campaign.id}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, reason: notes }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not save decision.");
      return;
    }
    onChange();
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-white/10 bg-void/40 p-4">
      <div className="flex flex-col gap-1">
        <p className="font-medium text-slate-100">{campaign.title}</p>
        <p className="text-xs text-slate-500">
          {campaign.protocolName} · {campaign.categoryNames.join(", ") || "—"} · {campaign.chain} · {campaign.token}
        </p>
        <p className="text-xs text-slate-600">Submitted {new Date(campaign.createdAt).toLocaleString()}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-3">
          {campaign.ctas.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs uppercase tracking-wide text-slate-500">CTAs</p>
              {campaign.ctas.map((cta) => (
                <p key={cta.id} className="break-all text-xs text-slate-400">
                  {cta.label} → {cta.targetUrl}
                </p>
              ))}
            </div>
          )}

          {!rejecting && (
            <div className="flex gap-2">
              <button
                onClick={() => void decide("APPROVED")}
                disabled={submitting}
                className="rounded-full bg-pulse-cyan px-4 py-1.5 text-sm font-medium text-void transition hover:shadow-glow disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => setRejecting(true)}
                disabled={submitting}
                className="rounded-full bg-white/10 px-4 py-1.5 text-sm text-slate-100 transition hover:bg-white/20 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          )}

          {rejecting && (
            <div className="flex flex-col gap-2">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (shown to the protocol)"
                rows={2}
                className="rounded-md border border-white/10 bg-void px-3 py-2 text-sm text-slate-100 outline-none focus:border-pulse-cyan/50"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => void decide("REJECTED", reason.trim() || undefined)}
                  disabled={submitting}
                  className="rounded-full bg-red-500/80 px-4 py-1.5 text-sm font-medium text-void transition hover:bg-red-500 disabled:opacity-50"
                >
                  Confirm reject
                </button>
                <button
                  onClick={() => {
                    setRejecting(false);
                    setReason("");
                  }}
                  disabled={submitting}
                  className="rounded-full bg-white/10 px-4 py-1.5 text-sm text-slate-100 transition hover:bg-white/20 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-center text-xs uppercase tracking-wide text-slate-500">
            What the recipient would see
          </p>
          <MessagePreview bodyText={campaign.bodyText ?? ""} imageUrl={campaign.imageUrl ?? ""} ctas={campaign.ctas} />
        </div>
      </div>
    </div>
  );
}

export function CampaignsModerationPanel({
  campaigns,
  onChange,
}: {
  campaigns: InReviewCampaign[];
  onChange: () => void;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-white/10 bg-surface p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Campaigns awaiting moderation</h2>
      {campaigns.length === 0 && <p className="text-sm text-slate-500">Nothing waiting on review.</p>}
      {campaigns.map((c) => (
        <CampaignReviewCard key={c.id} campaign={c} onChange={onChange} />
      ))}
    </section>
  );
}
