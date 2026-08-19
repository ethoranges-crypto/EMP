"use client";

import { useEffect, useState } from "react";
import type { UserMe } from "./types";

function useCountdown(expiresAt: string | undefined): string | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (!expiresAt) return null;
  const remainingMs = new Date(expiresAt).getTime() - now;
  if (remainingMs <= 0) return "expiring…";
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function TelegramPanel({
  me,
  onChange,
  justLinked = false,
}: {
  me: UserMe;
  onChange: () => void;
  /**
   * Set only for the poll that catches the pending -> linked transition
   * live — renders a big, unmissable confirmation instead of the quiet
   * status line, since a user coming back from Telegram (especially on
   * mobile, where the bot's reply was their only cue to switch back) needs
   * something more obvious than a small badge change to know it worked.
   */
  justLinked?: boolean;
}) {
  const [requesting, setRequesting] = useState(false);
  const countdown = useCountdown(me.telegramLinkStatus === "pending" ? me.codeExpiresAt : undefined);

  async function requestLink() {
    setRequesting(true);
    await fetch("/api/user/telegram-link-request", { method: "POST" });
    setRequesting(false);
    onChange();
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-white/10 bg-surface p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Telegram</h2>

      {me.telegramLinkStatus === "linked" && justLinked && (
        <div
          role="status"
          className="flex flex-col items-center gap-2 rounded-lg border border-pulse-cyan/50 bg-pulse-cyan/10 px-6 py-8 text-center shadow-glow"
        >
          <span className="text-3xl" aria-hidden>
            📡
          </span>
          <p className="text-lg font-semibold text-pulse-cyan">You&apos;re linked and all set</p>
          <p className="text-sm text-slate-300">
            Telegram is connected. You&apos;ll get messages here based on the interests you pick below.
          </p>
        </div>
      )}

      {me.telegramLinkStatus === "linked" && !justLinked && (
        <p className="text-sm text-pulse-cyan">✓ Linked — you&apos;ll get messages here based on your interests.</p>
      )}

      {me.telegramLinkStatus === "not_configured" && (
        <p className="text-sm text-slate-500">
          Telegram isn&apos;t set up on this deployment yet — there&apos;s no bot to link to. Nothing to do here
          until an operator configures one.
        </p>
      )}

      {me.telegramLinkStatus === "none" && (
        <>
          <p className="text-sm text-slate-400">
            A bot can&apos;t message a raw handle — it can only message someone who&apos;s opened a chat with
            it. Generate a link to connect via the EMP bot.
          </p>
          <button
            onClick={requestLink}
            disabled={requesting}
            className="self-start rounded-full bg-pulse-cyan px-5 py-1.5 text-sm font-medium text-void transition hover:shadow-glow disabled:opacity-50"
          >
            {requesting ? "Generating…" : "Link Telegram"}
          </button>
        </>
      )}

      {me.telegramLinkStatus === "pending" && me.deepLink && (
        <>
          <p className="text-sm text-slate-400">
            Open the EMP bot and tap Start. This page updates on its own once it&apos;s confirmed.
          </p>
          <a
            href={me.deepLink}
            target="_blank"
            rel="noreferrer"
            className="self-start rounded-full bg-pulse-cyan px-5 py-1.5 text-sm font-medium text-void transition hover:shadow-glow"
          >
            Open Telegram
          </a>
          {countdown && <p className="text-xs text-slate-500">Code expires in {countdown}</p>}
        </>
      )}

      {me.telegramLinkStatus === "expired" && (
        <>
          <p className="text-sm text-amber-400">Your link code expired before it was used.</p>
          <button
            onClick={requestLink}
            disabled={requesting}
            className="self-start rounded-full bg-white/10 px-5 py-1.5 text-sm text-slate-100 transition hover:bg-white/20 disabled:opacity-50"
          >
            {requesting ? "Generating…" : "Generate a new link"}
          </button>
        </>
      )}

      {me.telegramLinkStatus === "rejected" && (
        <>
          {/* SPEC §7.5 rejection — surfaced verbatim from telegramLinking.ts's typed errors via the bot. */}
          <p role="alert" className="text-sm text-red-400">
            {me.rejectionReason}
          </p>
          <button
            onClick={requestLink}
            disabled={requesting}
            className="self-start rounded-full bg-white/10 px-5 py-1.5 text-sm text-slate-100 transition hover:bg-white/20 disabled:opacity-50"
          >
            {requesting ? "Generating…" : "Try again"}
          </button>
        </>
      )}
    </section>
  );
}
