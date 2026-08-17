"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { SignInPanel } from "./SignInPanel";
import { InterestsPanel } from "./InterestsPanel";
import { TelegramPanel } from "./TelegramPanel";
import { MessageableBadge } from "./MessageableBadge";
import type { UserMe } from "./types";

type MeStatus = "loading" | "signed-out" | "signed-in" | "error";

export default function UserJourneyPage() {
  const { isConnected } = useAccount();
  const [me, setMe] = useState<UserMe | null>(null);
  const [meStatus, setMeStatus] = useState<MeStatus>("loading");

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

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="bg-gradient-to-r from-pulse-cyan to-pulse-violet bg-clip-text text-3xl font-bold text-transparent">
          Get on the signal
        </h1>
        <p className="text-sm text-slate-400">
          Connect a wallet, pick what you want to hear about, and link Telegram to start receiving
          curated DeFi opportunities.
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
          Something went wrong loading your account. Try refreshing the page.
        </p>
      )}

      {meStatus === "signed-in" && me && (
        <div className="flex flex-col gap-6">
          <MessageableBadge messageable={me.messageable} telegramLinkStatus={me.telegramLinkStatus} />
          <InterestsPanel />
          <TelegramPanel me={me} onChange={() => void fetchMe()} />
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
