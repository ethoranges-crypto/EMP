"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ApplicationPanel } from "./ApplicationPanel";
import { NewCampaignPanel } from "./NewCampaignPanel";
import { CampaignsPanel } from "./CampaignsPanel";
import { ComposePanel } from "./ComposePanel";
import { PaymentPanel } from "./PaymentPanel";
import { OnboardingGate } from "./gate/OnboardingGate";
import { useResetOnIdentityChange } from "@/lib/useResetOnIdentityChange";
import type { ProtocolCampaign, ProtocolMe } from "./types";

type MeStatus = "loading" | "signed-out" | "signed-in" | "error";

export default function ProtocolJourneyPage() {
  const { isConnected } = useAccount();
  const [me, setMe] = useState<ProtocolMe | null>(null);
  const [meStatus, setMeStatus] = useState<MeStatus>("loading");
  const [campaigns, setCampaigns] = useState<ProtocolCampaign[]>([]);
  const [composingCampaignId, setComposingCampaignId] = useState<string | null>(null);
  const [payingCampaignId, setPayingCampaignId] = useState<string | null>(null);
  const [justUpdated, setJustUpdated] = useState<{ campaignId: string; message: string } | null>(null);

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

  // Poll while any campaign is SENDING or SCHEDULED so it flips live —
  // otherwise nothing ever re-fetches this list once a campaign leaves
  // AWAITING_PAYMENT (the payment panel that was polling closes as soon as
  // SENDING/SCHEDULED first appears), and it would sit there looking stuck:
  // SENDING -> COMPLETE once the worker finishes, or SCHEDULED -> SENDING
  // once its send time arrives and the worker's due-scan picks it up.
  useEffect(() => {
    if (!campaigns.some((c) => c.status === "SENDING" || c.status === "SCHEDULED")) return;
    const id = setInterval(() => void fetchCampaigns(), 5000);
    return () => clearInterval(id);
  }, [campaigns, fetchCampaigns]);

  // Auto-clears the "Draft saved." / "Submitted for review." badge a
  // few seconds after ComposePanel collapses back into this list.
  useEffect(() => {
    if (!justUpdated) return;
    const id = setTimeout(() => setJustUpdated(null), 4000);
    return () => clearTimeout(id);
  }, [justUpdated]);

  function handlePanelSaved(campaignId: string, message: string) {
    setComposingCampaignId(null);
    setPayingCampaignId(null);
    setJustUpdated({ campaignId, message });
    void fetchCampaigns();
  }

  async function handleSignOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    setMe(null);
    setMeStatus("signed-out");
  }

  // Switching to a different wallet, or disconnecting, must never leave the
  // previous wallet's session (and its campaigns) on screen — see
  // useResetOnIdentityChange's own doc comment. Clears every piece of
  // per-identity state this page holds; meStatus goes to "signed-out"
  // rather than back to "loading" since there's nothing left to wait on —
  // the gate immediately shows the right connect/sign-in stage for
  // whatever's now connected (or not).
  const resetIdentity = useCallback(() => {
    setMe(null);
    setMeStatus("signed-out");
    setCampaigns([]);
    setComposingCampaignId(null);
    setPayingCampaignId(null);
    setJustUpdated(null);
  }, []);
  useResetOnIdentityChange(me?.wallet, resetIdentity);

  // The onboarding gate (SPEC §4.2, restyled in the "1b" language) owns
  // everything before a protocol has something else to do: not connected,
  // connected-but-not-signed-in, and signed-in-but-PENDING. REJECTED /
  // APPROVED / SUSPENDED keep the pre-existing layout below — their own
  // dedicated screens in this visual language (2b for REJECTED) come later.
  //
  // Deliberately keyed off meStatus/me.status, not isConnected: the session
  // cookie is the authoritative "are we signed in" signal once it resolves,
  // same as the pre-redesign version of this page — a wagmi reconnect flash
  // on page load (isConnected briefly false before the wallet reconnects)
  // must never bounce an already-signed-in APPROVED/REJECTED protocol back
  // into the gate.
  const showGate = meStatus !== "signed-in" || me?.status === "PENDING";

  if (showGate) {
    return <OnboardingGate meStatus={meStatus} me={me} onChange={() => void fetchMe()} />;
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

      {me && (
        <div className="flex flex-col gap-6">
          <ApplicationPanel me={me} onChange={() => void fetchMe()} />
          {me.status === "APPROVED" && (
            <>
              <NewCampaignPanel
                onCreated={(campaignId) => {
                  void fetchCampaigns();
                  setPayingCampaignId(null);
                  setComposingCampaignId(campaignId);
                }}
              />
              <Link
                href="/protocol/dashboard"
                className="self-center text-xs text-slate-500 underline underline-offset-4 hover:text-slate-300"
              >
                View campaign history &amp; analytics →
              </Link>
              <CampaignsPanel
                campaigns={campaigns}
                justUpdated={justUpdated}
                onCompose={(id) => {
                  setPayingCampaignId(null);
                  setComposingCampaignId(id);
                }}
                onPay={(id) => {
                  setComposingCampaignId(null);
                  setPayingCampaignId(id);
                }}
              />
              {composingCampaignId && (
                <ComposePanel
                  campaignId={composingCampaignId}
                  onClose={() => setComposingCampaignId(null)}
                  onSaved={(message) => handlePanelSaved(composingCampaignId, message)}
                />
              )}
              {payingCampaignId && (
                <PaymentPanel
                  campaignId={payingCampaignId}
                  onClose={() => setPayingCampaignId(null)}
                  onSaved={(message) => handlePanelSaved(payingCampaignId, message)}
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
