"use client";

import { useEffect, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { EVERYTHING_CATEGORY_NAME } from "@emp/config/categories";
import { Header } from "./Header";
import { StepRail, type GateStep } from "./StepRail";
import { LiveRail } from "./LiveRail";
import { ApplicationSummary } from "./ApplicationSummary";
import { SignInPanel } from "../SignInPanel";
import { ApplicationForm } from "../ApplicationPanel";
import type { Category, ProtocolMe } from "../types";

type MeStatus = "loading" | "signed-out" | "signed-in" | "error";
type Stage = "connect" | "signin" | "apply" | "pending";

// meStatus (the session cookie) is the authoritative signal once it
// resolves — checked before isConnected (wagmi's client-side wallet
// state) so a transient wagmi disconnect/reconnect flash on page load
// never mislabels an already-signed-in protocol as needing to connect
// again. isConnected only decides between "connect" and "signin" for the
// case where there's no session yet. The caller (page.tsx's showGate)
// only renders this component once me.status is PENDING or unresolved,
// so "pending"/"apply" here never has to re-check status itself.
function stageFor(isConnected: boolean, meStatus: MeStatus, me: ProtocolMe | null): Stage {
  if (meStatus === "signed-in" && me) {
    return me.name === "" ? "apply" : "pending";
  }
  if (!isConnected) return "connect";
  return "signin";
}

function buildSteps(stage: Stage, me: ProtocolMe | null): GateStep[] {
  const walletDone = stage !== "connect";
  const signinDone = stage === "apply" || stage === "pending";
  const applyDone = stage === "pending";

  return [
    {
      n: 1,
      label: "Connect wallet",
      sub: me ? (me.accountType === "SAFE" ? "Gnosis Safe" : "EOA") : stage === "connect" ? "not connected yet" : "wallet connected",
      state: walletDone ? "done" : "current",
    },
    {
      n: 2,
      label: "Sign in (SIWE)",
      sub: signinDone ? "session active" : stage === "signin" ? "awaiting signature" : "not started",
      state: signinDone ? "done" : stage === "signin" ? "current" : "future",
    },
    {
      n: 3,
      label: "Application",
      sub: applyDone ? "submitted" : stage === "apply" ? "not submitted" : "not started",
      state: applyDone ? "done" : stage === "apply" ? "current" : "future",
    },
    {
      n: 4,
      label: "Admin review",
      sub: "manual gate",
      state: stage === "pending" ? "current" : "future",
    },
  ];
}

/**
 * SPEC §4.2 protocol onboarding, in the "1b" visual language: one frame
 * carries connect -> sign in -> apply -> pending review, collapsing the
 * step rail as each completes rather than being separate pages — matching
 * how this app already worked (a single /protocol route re-rendering by
 * state), just restyled. REJECTED/APPROVED/SUSPENDED still render via the
 * pre-existing ApplicationPanel-based layout in page.tsx (their own
 * dedicated screens in this visual language come later).
 */
export function OnboardingGate({
  meStatus,
  me,
  onChange,
}: {
  meStatus: MeStatus;
  me: ProtocolMe | null;
  onChange: () => void;
}) {
  const { isConnected } = useAccount();
  const stage = stageFor(isConnected, meStatus, me);
  const steps = buildSteps(stage, me);

  const [messageableCount, setMessageableCount] = useState<number | null>(null);
  const [flatCostPerUser, setFlatCostPerUser] = useState<number | null>(null);

  useEffect(() => {
    if (meStatus !== "signed-in") return;
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

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-void text-[13px] text-ink-1">
      <Header />
      <div className="grid min-h-0 flex-1 grid-cols-[210px_1fr_320px]">
        <StepRail
          steps={steps}
          footnote="Manual approval exists to keep scams off the network. It is not automatable."
        />

        <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto px-[26px] py-[26px]">
          {stage === "connect" && (
            <div className="flex flex-col gap-2">
              <div className="text-[22px] font-semibold leading-[1.15] tracking-[-.01em]">Connect your wallet to begin</div>
              <div className="max-w-[520px] text-[12.5px] text-ink-4">
                EMP uses Sign-In with Ethereum — no email, no password. Connect the wallet you&apos;ll sign in
                and pay with.
              </div>
              <div className="mt-2">
                <ConnectButton />
              </div>
            </div>
          )}

          {stage === "signin" && (
            <div className="flex flex-col gap-3">
              <div className="text-[22px] font-semibold leading-[1.15] tracking-[-.01em]">Sign in with Ethereum</div>
              <div className="max-w-[520px] text-[12.5px] text-ink-4">
                One signature proves you control this wallet — EOA or a Gnosis Safe owner.
              </div>
              {meStatus === "loading" && <p className="text-[12.5px] text-ink-4">Checking session…</p>}
              {meStatus !== "loading" && <SignInPanel onSignedIn={onChange} />}
            </div>
          )}

          {stage === "apply" && (
            <div className="flex flex-col gap-3">
              <span className="self-start rounded-chip bg-pulse-cyan/10 px-2.5 py-1 font-mono text-[10.5px] font-medium text-pulse-cyan">
                SIGNED IN
              </span>
              <div className="text-[22px] font-semibold leading-[1.15] tracking-[-.01em]">One form before you&apos;re in the queue</div>
              <div className="max-w-[520px] text-[12.5px] text-ink-4">
                Tell us who you are — an EMP admin reviews every application by hand before it can send anything.
              </div>
              <div className="max-w-[440px] rounded-card border border-white/[.1] bg-surface p-4">
                <ApplicationForm initialName="" submitLabel="Submit application" onSubmitted={onChange} />
              </div>
            </div>
          )}

          {stage === "pending" && me && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="self-start rounded-chip bg-pulse-amber/10 px-2.5 py-1 font-mono text-[10.5px] font-medium text-pulse-amber">
                  PENDING APPROVAL
                </span>
                <div className="text-[22px] font-semibold leading-[1.15] tracking-[-.01em]">Your application is with an EMP admin</div>
                <div className="max-w-[520px] text-[12.5px] text-ink-4">
                  &ldquo;{me.name}&rdquo; is waiting on an EMP admin to verify and approve it. This page updates
                  on its own once that happens.
                </div>
              </div>

              <div className="flex flex-col gap-2.5 rounded-card border border-pulse-amber/30 bg-pulse-amber/5 p-4">
                <div className="font-mono text-[9.5px] font-medium tracking-[.12em] text-[#8b8069]">HOW WE VERIFY YOU</div>
                <div className="text-[12.5px] leading-[1.6] text-[#e0d3b6]">
                  We verify protocols out-of-band — have your official account confirm this wallet address to
                  EMP (e.g. via a DM on X). An admin cross-references that against this application; there&apos;s
                  no automated check here.
                </div>
              </div>

              <ApplicationSummary me={me} />
            </div>
          )}

          {meStatus === "error" && stage !== "connect" && (
            <p className="text-[12.5px] text-pulse-red">Something went wrong loading your application. Try refreshing the page.</p>
          )}

          <div className="mt-auto flex items-center gap-3 rounded-card border border-white/[.08] p-[13px_16px]">
            <div className="w-[96px] shrink-0 font-mono text-[9.5px] font-medium leading-[1.5] tracking-[.12em] text-ink-5">
              PRIVACY
              <br />
              BOUNDARY
            </div>
            <div className="text-[12.5px] text-ink-2">
              Approval grants you audience <em>counts</em> and delivery <em>rates</em> — never wallets, Telegram
              handles, or per-user rows. Enforced at the query layer.
            </div>
          </div>
        </div>

        <LiveRail pending={stage === "pending"} messageableCount={messageableCount} flatCostPerUser={flatCostPerUser} />
      </div>
    </main>
  );
}
