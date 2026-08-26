"use client";

import { useCallback, useEffect, useState } from "react";
import { useResetOnIdentityChange } from "@/lib/useResetOnIdentityChange";
import { ConnectState } from "./ConnectState";
import { InterestsState } from "./InterestsState";
import { TelegramState } from "./TelegramState";
import { HomeState } from "./HomeState";
import type { UserMe } from "./types";

type MeStatus = "loading" | "signed-out" | "signed-in" | "error";

/**
 * The Claude Design handoff's /user flow, in the shared 1b tokens — a
 * sequential onboarding (connect -> interests -> telegram) followed by a
 * "home" state (messageable, or paused if opted out), matching the design's
 * five states. Stage is derived fresh from real data on every render (same
 * approach as protocol's OnboardingGate), not a separate "onboarding
 * complete" flag: a returning, fully-linked user always lands on home
 * directly, and a user who unlinks Telegram naturally falls back to the
 * telegram step next time hasVerifiedLink is false.
 *
 * `editingInterests` is the one bit of state not derived from the API — set
 * only by HomeState's "edit" link, so a fully onboarded user can revisit
 * the interests step without it looking like they're back in onboarding
 * (no step row, "Save" instead of "Continue", returns to home instead of
 * advancing to Telegram).
 */
export default function UserJourneyPage() {
  const [me, setMe] = useState<UserMe | null>(null);
  const [meStatus, setMeStatus] = useState<MeStatus>("loading");
  const [editingInterests, setEditingInterests] = useState(false);

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch("/api/user/me");
      if (res.status === 401) {
        setMe(null);
        setMeStatus("signed-out");
        return;
      }
      if (!res.ok) {
        setMeStatus("error");
        return;
      }
      setMe((await res.json()) as UserMe);
      setMeStatus("signed-in");
    } catch {
      setMeStatus("error");
    }
  }, []);

  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  // Poll while a link attempt is outstanding so "messageable" flips live
  // once apps/bot confirms (or rejects) it — no websocket needed at this scale.
  useEffect(() => {
    if (me?.telegramLinkStatus !== "pending") return;
    const id = setInterval(() => void fetchMe(), 4000);
    return () => clearInterval(id);
  }, [me?.telegramLinkStatus, fetchMe]);

  async function handleSignOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    setMe(null);
    setMeStatus("signed-out");
  }

  // Switching to a different wallet, or disconnecting, must never leave the
  // previous wallet's interests/Telegram-link/messageable/paused state on
  // screen — same fix as /protocol.
  const resetIdentity = useCallback(() => {
    setMe(null);
    setMeStatus("signed-out");
    setEditingInterests(false);
  }, []);
  useResetOnIdentityChange(me?.wallet, resetIdentity);

  if (meStatus === "loading") {
    return (
      <main className="flex h-screen items-center justify-center bg-void">
        <p className="text-[13px] text-ink-4">Loading…</p>
      </main>
    );
  }

  if (meStatus === "signed-out" || !me) {
    return <ConnectState onSignedIn={() => void fetchMe()} />;
  }

  if (meStatus === "error") {
    return (
      <main className="flex h-screen items-center justify-center bg-void px-6 text-center">
        <p className="text-[13px] text-pulse-red">Something went wrong loading your account. Try refreshing the page.</p>
      </main>
    );
  }

  if (editingInterests) {
    return <InterestsState mode="edit" onDone={() => { setEditingInterests(false); void fetchMe(); }} />;
  }

  if (me.telegramLinkStatus === "linked") {
    return <HomeState me={me} onChange={() => void fetchMe()} onEditInterests={() => setEditingInterests(true)} onSignOut={() => void handleSignOut()} />;
  }

  if (me.interestCategoryIds.length === 0) {
    return <InterestsState mode="onboarding" onDone={() => void fetchMe()} />;
  }

  return <TelegramState me={me} onChange={() => void fetchMe()} />;
}
