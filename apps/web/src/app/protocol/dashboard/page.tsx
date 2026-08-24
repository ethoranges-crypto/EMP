"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SummaryStrip } from "./SummaryStrip";
import { CampaignHistoryList } from "./CampaignHistoryList";
import { CampaignDetailView } from "./CampaignDetailView";
import type { ProtocolCampaign, ProtocolMe, ProtocolSummary } from "../types";

type MeStatus = "loading" | "ready" | "redirecting";

/**
 * SPEC's dashboard requirement: the place a protocol reviews everything
 * it's run and how it performed — campaign history (any status) plus a
 * per-campaign detail view, with a cheap aggregate summary on top. A
 * separate route from /protocol (which is the "active work" flow — apply,
 * compose, pay) since this is a review destination, not a step in a flow.
 *
 * Guards the same way /protocol's own page does (fetch /api/protocol,
 * check status) rather than duplicating SIWE/wallet-connect UI here — an
 * unauthenticated or unapproved visitor is sent back to /protocol, which
 * already owns that flow.
 */
export default function ProtocolDashboardPage() {
  const router = useRouter();
  const [meStatus, setMeStatus] = useState<MeStatus>("loading");
  const [summary, setSummary] = useState<ProtocolSummary | null>(null);
  const [campaigns, setCampaigns] = useState<ProtocolCampaign[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    const [summaryRes, campaignsRes] = await Promise.all([
      fetch("/api/protocol/dashboard/summary"),
      fetch("/api/protocol/campaigns"),
    ]);
    if (summaryRes.ok) setSummary((await summaryRes.json()) as ProtocolSummary);
    if (campaignsRes.ok) {
      const data = (await campaignsRes.json()) as { campaigns: ProtocolCampaign[] };
      setCampaigns(data.campaigns);
    }
  }, []);

  useEffect(() => {
    fetch("/api/protocol")
      .then((res) => {
        if (!res.ok) {
          setMeStatus("redirecting");
          router.replace("/protocol");
          return null;
        }
        return res.json() as Promise<ProtocolMe>;
      })
      .then((me) => {
        if (!me) return;
        if (me.status !== "APPROVED") {
          setMeStatus("redirecting");
          router.replace("/protocol");
          return;
        }
        setMeStatus("ready");
        void fetchDashboard();
      });
  }, [router, fetchDashboard]);

  if (meStatus !== "ready") {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-16">
        <p className="text-sm text-slate-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-16">
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="bg-gradient-to-r from-pulse-violet to-pulse-cyan bg-clip-text text-3xl font-bold text-transparent">
          Campaign history & analytics
        </h1>
        <Link href="/protocol" className="text-xs text-slate-500 underline underline-offset-4 hover:text-slate-300">
          ← Back to campaigns
        </Link>
      </header>

      {summary && <SummaryStrip summary={summary} />}

      <CampaignHistoryList campaigns={campaigns} selectedId={selectedId} onSelect={setSelectedId} />

      {selectedId && <CampaignDetailView campaignId={selectedId} onClose={() => setSelectedId(null)} />}
    </main>
  );
}
