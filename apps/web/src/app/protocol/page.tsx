"use client";
import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { SignInPanel } from "./SignInPanel";
import { ApplicationPanel } from "./ApplicationPanel";
import { NewCampaignPanel } from "./NewCampaignPanel";
import { CampaignsPanel } from "./CampaignsPanel";
import { ComposePanel } from "./ComposePanel";
import type { ProtocolCampaign, ProtocolMe } from "./types";

type MeStatus = "loading" | "signed-out" | "signed-in" | "error";

export default function ProtocolJourneyPage() {
  const { isConnected } = useAccount();
  const [me, setMe] = useState<ProtocolMe | null>(null);
  const [meStatus, setMeStatus] = useState<MeStatus>("loading");
  const [campaigns, setCampaigns] = useState<ProtocolCampaign[]>([]);
  const [composingCampaignId, setComposingCampaignId] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    const res = await fetch("/api/protocol/campaigns");
    if (!res.ok) return;
    const data = (await res.json()) as { campaigns: ProtocolCampaign[] };
    setCampaigns(data.campaigns);
  }, []);

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch("/api/protocol");
      if (res.status === 401) {
        setMe(null);
        setMeStatus("signed-out");
        return;
      }
      if (!res.ok) {
        setMeStatus("error");
        return;
      }
      setMe((await res.json()) as ProtocolMe);
      setMeStatus("signed-in");
    } catch {
      setMeStatus("error");
    }
  }, []);

  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  // Poll while an application is under review so it flips live once an
  // admin decides — same pattern as /user's Telegram-link polling.
  useEffect(() => {
    if (me?.status !== "PENDING" || me.name === "") return;
    const id = setInterval(() => void fetchMe(), 4000);
    return () => clearInterval(id);
  }, [me?.status, me?.name, fetchMe]);

  useEffect(() => {
    if (me?.status !== "APPROVED") return;
    void fetchCampaigns();
  }, [me?.status, fetchCampaigns]);

  async function handleSignOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    setMe(null);
    setMeStatus("signed-out");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="bg-gradient-to-r from-pulse-violet to-pulse-cyan bg-clip-text text-3xl font-bold text-transparent">
          Send the signal
        </h1>
        <p className="text-sm text-slate-400">
          Connect your protocol&apos;s wallet, apply for access, and once approved you&apos;ll be able to
          reach EMP&apos;s messageable users by interest — aggregate audience data only.
        </p>
      </header>

      <div className="flex justify-center">
        <ConnectButton />
      </div>

      {isConnected && meStatus === "loading" && (
        <p className="text-center text-sm text-slate-500">Checking session…</p>
      )}

      {isConnected && meStatus === "signed-out" && <SignInPanel onSignedIn={() => void fetchMe()} />}

      {meStatus === "error" && (
        <p className="text-center text-sm text-red-400">
          Something went wrong loading your application. Try refreshing the page.
        </p>
      )}

      {meStatus === "signed-in" && me && (
        <div className="flex flex-col gap-6">
          <ApplicationPanel me={me} onChange={() => void fetchMe()} />
          {me.status === "APPROVED" && (
            <>
              <NewCampaignPanel onCreated={() => void fetchCampaigns()} />
              <CampaignsPanel campaigns={campaigns} onCompose={(id) => setComposingCampaignId(id)} />
              {composingCampaignId && (
                <ComposePanel
                  campaignId={composingCampaignId}
                  onClose={() => setComposingCampaignId(null)}
                  onSaved={() => void fetchCampaigns()}
                />
              )}
            </>
          )}
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
