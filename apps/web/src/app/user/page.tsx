"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { SignInPanel } from "./SignInPanel";
import { InterestsPanel } from "./InterestsPanel";
import { TelegramPanel } from "./TelegramPanel";
import { MessageableBadge } from "./MessageableBadge";
import { useResetOnIdentityChange } from "@/lib/useResetOnIdentityChange";
import type { TelegramLinkStatus, UserMe } from "./types";

type MeStatus = "loading" | "signed-out" | "signed-in" | "error";

export default function UserJourneyPage() {
  const { isConnected } = useAccount();
  const [me, setMe] = useState<UserMe | null>(null);
  const [meStatus, setMeStatus] = useState<MeStatus>("loading");
  // True only for the poll that catches pending -> linked live (apps/bot
  // confirmed the code while this tab was open) — not for a returning
  // visit that's already linked. That's what makes the big TelegramPanel
  // success state a "you just did this" confirmation rather than noise
  // shown on every page load.
  const [justLinked, setJustLinked] = useState(false);
  const prevTelegramLinkStatus = useRef<TelegramLinkStatus | undefined>(undefined);

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

  useEffect(() => {
    if (!me) return;
    if (prevTelegramLinkStatus.current === "pending" && me.telegramLinkStatus === "linked") {
      setJustLinked(true);
    }
    prevTelegramLinkStatus.current = me.telegramLinkStatus;
  }, [me]);

  async function handleSignOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    setMe(null);
    setMeStatus("signed-out");
  }

  // Switching to a different wallet, or disconnecting, must never leave the
  // previous wallet's interests/Telegram-link/messageable state on screen —
  // see useResetOnIdentityChange's own doc comment (the same fix already
  // applied on the protocol side). meStatus going to "signed-out" unmounts
  // the whole signed-in block below, including InterestsPanel, which owns
  // its own fetch-on-mount state — so a fresh sign-in with the new wallet
  // remounts it and fetches that wallet's own interests fresh, never the
  // previous wallet's.
  const resetIdentity = useCallback(() => {
    setMe(null);
    setMeStatus("signed-out");
    setJustLinked(false);
    prevTelegramLinkStatus.current = undefined;
  }, []);
  useResetOnIdentityChange(me?.wallet, resetIdentity);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col items-center gap-2 text-center">
        <div className="font-mono text-[13px] font-bold tracking-[.06em] text-ink-4">EMP</div>
        <h1 className="bg-gradient-to-r from-pulse-cyan to-pulse-violet bg-clip-text text-[28px] font-semibold leading-[1.15] tracking-[-.01em] text-transparent">
          Get on the signal
        </h1>
        <p className="max-w-[420px] text-[13px] text-ink-4">
          Connect a wallet, pick what you want to hear about, and link Telegram to start receiving
          curated DeFi opportunities.
        </p>
      </header>

      <div className="flex justify-center">
        <ConnectButton />
      </div>

      {isConnected && meStatus === "loading" && (
        <p className="text-center text-[12.5px] text-ink-4">Checking session…</p>
      )}

      {isConnected && meStatus === "signed-out" && <SignInPanel onSignedIn={() => void fetchMe()} />}

      {meStatus === "error" && (
        <p className="text-center text-[12.5px] text-pulse-red">
          Something went wrong loading your account. Try refreshing the page.
        </p>
      )}

      {meStatus === "signed-in" && me && (
        <div className="flex flex-col gap-6">
          <MessageableBadge messageable={me.messageable} telegramLinkStatus={me.telegramLinkStatus} />
          <InterestsPanel />
          <TelegramPanel me={me} onChange={() => void fetchMe()} justLinked={justLinked} />
          <button
            onClick={handleSignOut}
            className="self-center text-[11.5px] text-ink-5 underline underline-offset-4 transition hover:text-ink-3"
          >
            Sign out
          </button>
        </div>
      )}
    </main>
  );
}
