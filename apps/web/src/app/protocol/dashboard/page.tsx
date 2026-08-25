"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EVERYTHING_CATEGORY_NAME } from "@emp/config/categories";
import { Header } from "./Header";
import { NavRail, type HistoryFilter } from "./NavRail";
import { StatCards } from "./StatCards";
import { HistoryList } from "./HistoryList";
import { LiveRail } from "./LiveRail";
import { CampaignDetailView } from "./CampaignDetailView";
import { needsAction } from "./statusStyle";
import { useResetOnIdentityChange } from "@/lib/useResetOnIdentityChange";
import type { Category, ProtocolCampaign, ProtocolMe, ProtocolSummary } from "../types";

type MeStatus = "loading" | "ready" | "redirecting";

/**
 * The protocol home, in the "1b" design language: left rail is navigation
 * + filters, the middle column is the campaign history (any status), the
 * right column is live truth — network state and the one thing needing
 * action. A separate route from /protocol (the "active work" flow — apply,
 * compose, pay) since this is a review destination, not a step in a flow;
 * clicking a row opens the existing inline detail view below rather than
 * navigating to a dedicated detail screen, since that screen (the design's
 * "2d") hasn't been rebuilt in this visual language yet — see this file's
 * git history for the plain-list version this replaced.
 */
export default function ProtocolDashboardPage() {
  const router = useRouter();
  const [meStatus, setMeStatus] = useState<MeStatus>("loading");
  const [me, setMe] = useState<ProtocolMe | null>(null);
  const [summary, setSummary] = useState<ProtocolSummary | null>(null);
  const [campaigns, setCampaigns] = useState<ProtocolCampaign[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<HistoryFilter>("ALL");
  const [messageableCount, setMessageableCount] = useState<number | null>(null);
  const [flatCostPerUser, setFlatCostPerUser] = useState<number | null>(null);

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
      .then((data) => {
        if (!data) return;
        if (data.status !== "APPROVED") {
          setMeStatus("redirecting");
          router.replace("/protocol");
          return;
        }
        setMe(data);
        setMeStatus("ready");
        void fetchDashboard();
      });
  }, [router, fetchDashboard]);

  // Right rail's pulse circle: the *true* total messageable audience, not a
  // category-filtered estimate — achieved by passing the "Everything"
  // meta-category to the same audience-count endpoint compose already uses
  // (includeAll semantics), rather than a new endpoint.
  useEffect(() => {
    if (meStatus !== "ready") return;
    fetch("/api/protocol/categories")
      .then((r) => r.json())
      .then((data: { categories: Category[] }) => {
        const everything = data.categories.find((c) => c.name === EVERYTHING_CATEGORY_NAME);
        if (!everything) return;
        return fetch("/api/protocol/audience-count", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryIds: [everything.id] }),
        });
      })
      .then((res) => res?.json())
      .then((data?: { audienceCount: number }) => {
        if (data) setMessageableCount(data.audienceCount);
      })
      .catch(() => setMessageableCount(null));

    fetch("/api/protocol/pricing")
      .then((r) => r.json())
      .then((data: { flatCostPerUser: string | null }) => setFlatCostPerUser(data.flatCostPerUser !== null ? Number(data.flatCostPerUser) : null))
      .catch(() => setFlatCostPerUser(null));
  }, [meStatus]);

  // Poll while anything is SENDING or SCHEDULED so the history/stat cards
  // stay live without a manual refresh — same reasoning as /protocol's own
  // polling effect.
  useEffect(() => {
    if (!campaigns.some((c) => c.status === "SENDING" || c.status === "SCHEDULED")) return;
    const id = setInterval(() => void fetchDashboard(), 5000);
    return () => clearInterval(id);
  }, [campaigns, fetchDashboard]);

  // Switching wallets or disconnecting must never leave the previous
  // wallet's dashboard on screen — see useResetOnIdentityChange's own doc
  // comment. Clears every piece of per-identity state this page holds and
  // sends them back to /protocol, which owns re-authenticating for
  // whatever's now connected (or not) — same reasoning as the "not
  // APPROVED" redirect already below.
  const resetIdentity = useCallback(() => {
    setMeStatus("loading");
    setMe(null);
    setSummary(null);
    setCampaigns([]);
    setSelectedId(null);
    setMessageableCount(null);
    setFlatCostPerUser(null);
    router.replace("/protocol");
  }, [router]);
  useResetOnIdentityChange(me?.wallet, resetIdentity);

  const needsActionCampaign = useMemo(() => campaigns.find((c) => needsAction(c.status)) ?? null, [campaigns]);

  const bestCampaign = useMemo(() => {
    let best: { title: string; ratePct: number } | null = null;
    for (const c of campaigns) {
      if (!c.metrics) continue;
      if (!best || c.metrics.clicks.ratePct > best.ratePct) best = { title: c.title, ratePct: c.metrics.clicks.ratePct };
    }
    return best;
  }, [campaigns]);

  if (meStatus !== "ready" || !me) {
    return (
      <main className="flex h-screen items-center justify-center bg-void">
        <p className="text-sm text-ink-4">Loading…</p>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-void text-[13px] text-ink-1">
      <Header me={me} />
      <div className="grid min-h-0 flex-1 grid-cols-[210px_1fr_320px]">
        <NavRail campaigns={campaigns} filter={filter} onFilterChange={setFilter} />

        <div className="flex min-h-0 min-w-0 flex-col gap-3.5 overflow-y-auto px-[26px] py-[22px]">
          {summary && <StatCards summary={summary} bestCampaign={bestCampaign} />}

          <div className="flex items-center gap-3">
            <div className="font-mono text-[9.5px] font-medium tracking-[.14em] text-ink-5">HISTORY</div>
            <div className="h-px flex-1 bg-white/[.08]" />
            <div className="flex gap-3.5 font-mono text-[10.5px] text-ink-5">
              <span className="text-pulse-cyan">● DELIVERED</span>
              <span className="text-pulse-violet">● CLICKS</span>
            </div>
          </div>

          <HistoryList campaigns={campaigns} filter={filter} onSelect={setSelectedId} />

          {selectedId && <CampaignDetailView campaignId={selectedId} onClose={() => setSelectedId(null)} />}
        </div>

        <LiveRail
          messageableCount={messageableCount}
          flatCostPerUser={flatCostPerUser}
          needsActionCampaign={needsActionCampaign}
          bestCampaign={bestCampaign}
        />
      </div>
    </main>
  );
}
