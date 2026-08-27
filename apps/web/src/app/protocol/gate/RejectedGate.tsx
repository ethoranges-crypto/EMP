"use client";

import { useEffect, useState } from "react";
import { EVERYTHING_CATEGORY_NAME } from "@emp/config/categories";
import { Header } from "./Header";
import { StepRail, type Step } from "../StepRail";
import { LiveRail } from "./LiveRail";
import { ApplicationSummary } from "./ApplicationSummary";
import { ApplicationForm } from "../ApplicationForm";
import type { Category, ProtocolMe } from "../types";

function buildSteps(): Step[] {
  return [
    { n: 1, label: "Connect wallet", sub: "wallet connected", state: "done" },
    { n: 2, label: "Sign in (SIWE)", sub: "session active", state: "done" },
    { n: 3, label: "Application", sub: "rejected — resubmit below", state: "current" },
    { n: 4, label: "Admin review", sub: "manual gate", state: "future" },
  ];
}

/**
 * SPEC §4.2's rejected-application state, "2b" — same shell as the
 * onboarding gate (2a: Header/StepRail/LiveRail, same layout grammar),
 * just with the rail's current-step marker turned red instead of amber,
 * matching this codebase's rejection colour everywhere else (campaign
 * rejection banners, REJECTED status chips). Only rendered for
 * ProtocolStatus REJECTED — page.tsx routes PENDING to OnboardingGate and
 * APPROVED straight to the dashboard, so this never has to handle either.
 *
 * "Flagged fields called out inline" (flag, don't fake): the data model
 * has exactly one piece of admin feedback — Protocol.approvalNotes, a
 * free-text reason — there's no structured per-field flag list to
 * highlight individual fields as wrong. Quoting that reason verbatim next
 * to the actual submitted fields (reusing ApplicationSummary, same as the
 * pending stage) is the honest version of "called out inline" this data
 * actually supports.
 */
export function RejectedGate({ me, onChange }: { me: ProtocolMe; onChange: () => void }) {
  const [messageableCount, setMessageableCount] = useState<number | null>(null);
  const [flatCostPerUser, setFlatCostPerUser] = useState<number | null>(null);

  // Same fetches as OnboardingGate's own "pending" stage, and for the same
  // reason: audience-count 403s for any non-APPROVED protocol (real,
  // expected — the type-guard below just leaves messageableCount at "—"
  // rather than trusting an error body), but pricing has no status check
  // and genuinely resolves here, so it isn't held back to avoid faking one
  // and not the other.
  useEffect(() => {
    fetch("/api/protocol/categories")
      .then((r) => r.json())
      .then((data: { categories: Category[] }) => {
        const everything = data.categories.find((c) => c.name === EVERYTHING_CATEGORY_NAME);
        if (!everything) return null;
        return fetch("/api/protocol/audience-count", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryIds: [everything.id] }),
        }).then((res) => (res.ok ? res.json() : null));
      })
      .then((data?: { audienceCount: number } | null) => {
        if (data && typeof data.audienceCount === "number") setMessageableCount(data.audienceCount);
      })
      .catch(() => setMessageableCount(null));

    fetch("/api/protocol/pricing")
      .then((res) => (res.ok ? res.json() : null))
      .then((data?: { flatCostPerUser: string | null } | null) => {
        if (!data) return;
        setFlatCostPerUser(data.flatCostPerUser !== null ? Number(data.flatCostPerUser) : null);
      })
      .catch(() => setFlatCostPerUser(null));
  }, []);

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-void text-[13px] text-ink-1">
      <Header />
      <div className="grid min-h-0 flex-1 grid-cols-[210px_1fr_320px]">
        <StepRail
          steps={buildSteps()}
          footnote="Manual approval exists to keep scams off the network. It is not automatable."
          accent="red"
        />

        <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto px-[26px] py-[26px]">
          <span className="self-start rounded-chip bg-pulse-red/10 px-2.5 py-1 font-mono text-[10.5px] font-medium text-pulse-red">
            REJECTED
          </span>
          <div className="text-[22px] font-semibold leading-[1.15] tracking-[-.01em]">Your application needs changes</div>
          <div className="max-w-[520px] text-[12.5px] text-ink-4">
            &ldquo;{me.name}&rdquo; wasn&apos;t approved. Fix what&apos;s below and resubmit — it goes back into the
            same manual review queue.
          </div>

          <div className="max-w-[520px] rounded-card border border-pulse-red/40 bg-pulse-red/10 px-4 py-3">
            <p className="font-mono text-[9.5px] font-medium tracking-[.12em] text-pulse-red">REASON</p>
            <p className="mt-1.5 text-[12.5px] leading-[1.5] text-ink-2">
              {me.approvalNotes || "Your application was rejected."}
            </p>
          </div>

          <ApplicationSummary me={me} />

          <div className="max-w-[440px] rounded-card border border-white/[.1] bg-surface p-4">
            <ApplicationForm
              initialName={me.name}
              initialXHandle={me.xHandle ?? ""}
              submitLabel="Resubmit application"
              onSubmitted={onChange}
            />
          </div>

          <div className="mt-auto flex items-center gap-3 rounded-card border border-white/[.08] p-[13px_16px]">
            <div className="w-[96px] shrink-0 font-mono text-[9.5px] font-medium leading-[1.5] tracking-[.12em] text-ink-5">
              PRIVACY
              <br />
              BOUNDARY
            </div>
            <div className="text-[12.5px] text-ink-2">
              Approval grants you audience <em>counts</em> and delivery <em>rates</em> - never wallets, Telegram
              handles, or per-user rows.
            </div>
          </div>
        </div>

        <LiveRail pending={false} messageableCount={messageableCount} flatCostPerUser={flatCostPerUser} />
      </div>
    </main>
  );
}
