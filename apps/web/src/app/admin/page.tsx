"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { SignInPanel } from "./SignInPanel";
import { ProtocolsPanel } from "./ProtocolsPanel";
import { CategoriesPanel } from "./CategoriesPanel";
import { CampaignsModerationPanel } from "./CampaignsModerationPanel";
import { PlatformSettingsPanel } from "./PlatformSettingsPanel";
import type { AdminCategory, InReviewCampaign, PendingProtocol, PlatformSettings } from "./types";

type ListStatus = "loading" | "signed-out" | "loaded" | "error";

/**
 * Minimum viable admin (SPEC §4.2's approval gate + SPEC §7's category
 * taxonomy) — not the full admin panel yet. GET /api/admin/protocols
 * doubles as both the pending-queue fetch and the "am I signed in as
 * admin" check (a 401 means either), same shape as /user and /protocol.
 */
export default function AdminPage() {
  const { isConnected } = useAccount();
  const [protocols, setProtocols] = useState<PendingProtocol[]>([]);
  const [listStatus, setListStatus] = useState<ListStatus>("loading");
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [inReviewCampaigns, setInReviewCampaigns] = useState<InReviewCampaign[]>([]);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>({ flatCostPerUser: null });

  const fetchProtocols = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/protocols");
      if (res.status === 401) {
        setListStatus("signed-out");
        return;
      }
      if (!res.ok) {
        setListStatus("error");
        return;
      }
      const data = (await res.json()) as { protocols: PendingProtocol[] };
      setProtocols(data.protocols);
      setListStatus("loaded");
    } catch {
      setListStatus("error");
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    const res = await fetch("/api/admin/categories");
    if (!res.ok) return;
    const data = (await res.json()) as { categories: AdminCategory[] };
    setCategories(data.categories);
  }, []);

  const fetchInReviewCampaigns = useCallback(async () => {
    const res = await fetch("/api/admin/campaigns");
    if (!res.ok) return;
    const data = (await res.json()) as { campaigns: InReviewCampaign[] };
    setInReviewCampaigns(data.campaigns);
  }, []);

  const fetchPlatformSettings = useCallback(async () => {
    const res = await fetch("/api/admin/settings");
    if (!res.ok) return;
    setPlatformSettings((await res.json()) as PlatformSettings);
  }, []);

  useEffect(() => {
    void fetchProtocols();
  }, [fetchProtocols]);

  useEffect(() => {
    if (listStatus !== "loaded") return;
    void fetchCategories();
    void fetchInReviewCampaigns();
    void fetchPlatformSettings();
  }, [listStatus, fetchCategories, fetchInReviewCampaigns, fetchPlatformSettings]);

  async function handleSignOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    setProtocols([]);
    setListStatus("signed-out");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-bold text-pulse-cyan">EMP Admin</h1>
        <p className="text-sm text-slate-400">Protocol approvals. Access is restricted to ADMIN_WALLETS.</p>
      </header>

      <div className="flex justify-center">
        <ConnectButton />
      </div>

      {isConnected && listStatus === "loading" && (
        <p className="text-center text-sm text-slate-500">Checking session…</p>
      )}

      {isConnected && listStatus === "signed-out" && <SignInPanel onSignedIn={() => void fetchProtocols()} />}

      {listStatus === "error" && (
        <p className="text-center text-sm text-red-400">
          Something went wrong loading pending protocols. Try refreshing the page.
        </p>
      )}

      {listStatus === "loaded" && (
        <div className="flex flex-col gap-6">
          <ProtocolsPanel protocols={protocols} onChange={() => void fetchProtocols()} />
          <CampaignsModerationPanel campaigns={inReviewCampaigns} onChange={() => void fetchInReviewCampaigns()} />
          <PlatformSettingsPanel settings={platformSettings} onChange={() => void fetchPlatformSettings()} />
          <CategoriesPanel categories={categories} onChange={() => void fetchCategories()} />
          <button
            onClick={handleSignOut}
            className="self-center text-xs text-slate-500 underline underline-offset-4 hover:text-slate-300"
          >
            Sign out
          </button>
        </div>
      )}
    </main>
  );
}
