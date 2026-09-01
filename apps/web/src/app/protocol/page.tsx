"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingGate } from "./gate/OnboardingGate";
import { RejectedGate } from "./gate/RejectedGate";
import { useResetOnIdentityChange } from "@/lib/useResetOnIdentityChange";
import type { ProtocolMe } from "./types";

type MeStatus = "loading" | "signed-out" | "signed-in" | "error";

/**
 * The onboarding gate (SPEC §4.2) — connect, sign in, apply, wait on admin
 * review. Once APPROVED, this page's whole job is done: it redirects
 * straight to /protocol/dashboard, the single home for an APPROVED
 * protocol (campaign list, "New campaign", stats — previously duplicated
 * here, now consolidated there). REJECTED renders its own dedicated
 * screen (2b, RejectedGate). SUSPENDED has no admin action anywhere that
 * produces it yet — a defined-but-currently-unreachable enum value — so
 * it keeps a minimal plain fallback rather than a dedicated screen built
 * for a state nothing can actually reach.
 */
export default function ProtocolJourneyPage() {
  const router = useRouter();
  const [me, setMe] = useState<ProtocolMe | null>(null);
  const [meStatus, setMeStatus] = useState<MeStatus>("loading");

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

  // The moment an admin approves, bounce straight to the dashboard — this
  // page never renders campaign management itself.
  useEffect(() => {
    if (me?.status === "APPROVED") router.replace("/protocol/dashboard");
  }, [me?.status, router]);

  // Switching to a different wallet, or disconnecting, must never leave the
  // previous wallet's session on screen — see useResetOnIdentityChange's
  // own doc comment. meStatus goes to "signed-out" rather than back to
  // "loading" since there's nothing left to wait on — the gate immediately
  // shows the right connect/sign-in stage for whatever's now connected (or
  // not).
  const resetIdentity = useCallback(() => {
    setMe(null);
    setMeStatus("signed-out");
  }, []);
  useResetOnIdentityChange(me?.wallet, resetIdentity);

  // The onboarding gate (SPEC §4.2, restyled in the "1b" language) owns
  // everything before a protocol has something else to do: not connected,
  // connected-but-not-signed-in, and signed-in-but-PENDING. REJECTED gets
  // its own dedicated screen (2b) below; APPROVED redirects away (handled
  // above); SUSPENDED falls through to the plain fallback at the bottom.
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

  // Redirect is in flight (see the effect above) — a loading state here
  // keeps the fallback below from flashing on screen for an
  // already-approved protocol before the bounce completes.
  if (me?.status === "APPROVED") {
    return (
      <main className="flex h-screen items-center justify-center bg-void">
        <p className="text-sm text-ink-4">Loading…</p>
      </main>
    );
  }

  if (me?.status === "REJECTED") {
    return <RejectedGate me={me} onChange={() => void fetchMe()} />;
  }

  // SUSPENDED — see this file's own doc comment: no admin action produces
  // it yet, so it's a plain, minimal fallback rather than a dedicated
  // screen built for a state nothing can currently reach.
  return (
    <main className="flex h-screen items-center justify-center bg-void px-6 text-center">
      <p role="alert" className="text-[13px] text-pulse-red">
        This protocol has been suspended. Contact EMP for details.
      </p>
    </main>
  );
}
