"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { UserHeader } from "./UserHeader";
import { StepRow } from "./StepRow";
import { OnboardingFooter } from "./OnboardingFooter";
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

/**
 * State 3 — link Telegram. The mockup only shows the "pending, waiting"
 * sub-state; this also covers the other real telegramLinkStatus values that
 * reach here (none/expired/rejected/not_configured) on the same two-column
 * shell, since all of them are real states this screen must show, not just
 * the happy path.
 *
 * The actual binding mechanism is the deep link (t.me/<bot>?start=<code>) —
 * apps/bot's /start handler (registerStartHandler) only ever reads the code
 * from the /start command's payload, never from a plain-text message, so
 * "paste the code as a message" (an earlier version of this screen) can
 * never bind anything. The deep-link button is the one real action; the
 * code itself is never shown — it's carried automatically in the button's
 * href, so there's nothing for the user to copy or paste.
 *
 * Flagged deviation: "t.me/emp_signal_bot" in the mockup — derived from the
 * real deepLink/TELEGRAM_BOT_USERNAME, not hardcoded.
 */
export function TelegramState({ me, onChange }: { me: UserMe; onChange: () => void }) {
  const { address } = useAccount();
  const [requesting, setRequesting] = useState(false);
  const countdown = useCountdown(me.telegramLinkStatus === "pending" ? me.codeExpiresAt : undefined);

  async function requestLink() {
    setRequesting(true);
    await fetch("/api/user/telegram-link-request", { method: "POST" });
    setRequesting(false);
    onChange();
  }

  const botHandle = me.deepLink ? new URL(me.deepLink).pathname.replace(/^\//, "") : null;

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-void text-[13px] text-ink-1">
      <UserHeader connected wallet={address} />
      <StepRow current="telegram" />

      <div className="grid flex-1 grid-cols-2 overflow-y-auto">
        <div className="flex flex-col px-10 pt-14">
          <h2 className="text-[38px] font-medium leading-none tracking-[-.025em]">Link your Telegram</h2>
          <p className="mt-3.5 max-w-[400px] text-[15px] leading-[1.6] text-ink-3">
            Receive protocol messages via our EMP:ProtocolOpportunity bot. None of your information is ever
            shared with any third party.
          </p>

          {me.telegramLinkStatus !== "not_configured" && (
            <div className="mt-9 flex flex-col gap-5">
              <div className="flex items-start gap-4">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-pulse-cyan/40 font-mono text-[10px] text-pulse-cyan">
                  1
                </span>
                <div className="flex flex-col gap-1">
                  <span className="text-[15px]">Click the button to link your Telegram</span>
                  <span className="font-mono text-[12.5px] text-pulse-cyan">{botHandle ? `t.me/${botHandle}` : "—"}</span>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-pulse-cyan/40 font-mono text-[10px] text-pulse-cyan">
                  2
                </span>
                <div className="flex flex-col gap-1">
                  <span className="text-[15px]">Click the Open Telegram button</span>
                  <span className="text-[12.5px] text-ink-3">Your code is already attached — it binds immediately.</span>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/[.1] font-mono text-[10px] text-ink-5">
                  3
                </span>
                <div className="flex flex-col gap-1">
                  <span className="text-[15px] text-ink-3">This page confirms automatically</span>
                  <span className="text-[12.5px] text-ink-5">No refresh needed.</span>
                </div>
              </div>
            </div>
          )}

          <div className="mb-11 mt-auto max-w-[420px] border-l-2 border-pulse-amber/60 bg-pulse-amber/5 px-4 py-3.5">
            <span className="text-[12.5px] leading-[1.5] text-pulse-amber/90">
              One Telegram account can be linked to one wallet only. Moving it later needs an unlink plus a
              30-day cooldown.
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-0 border-l border-white/[.06] px-10">
          {me.telegramLinkStatus === "not_configured" && (
            <p className="max-w-[360px] text-center text-[13px] text-ink-4">
              Telegram isn&apos;t set up on this deployment yet — there&apos;s no bot to link to. Nothing to
              do here until an operator configures one.
            </p>
          )}

          {me.telegramLinkStatus === "none" && (
            <>
              <p className="mb-6 max-w-[320px] text-center text-[13px] text-ink-3">
                Click below to link your Telegram.
              </p>
              <button
                onClick={() => void requestLink()}
                disabled={requesting}
                className="rounded-md bg-pulse-cyan px-6 py-3 text-[13.5px] font-semibold text-onaccent-cyan transition hover:shadow-glow disabled:opacity-50"
              >
                {requesting ? "Generating…" : "Link my Telegram"}
              </button>
            </>
          )}

          {(me.telegramLinkStatus === "expired" || me.telegramLinkStatus === "rejected") && (
            <>
              {me.telegramLinkStatus === "expired" ? (
                <p className="mb-6 text-[13px] text-pulse-amber">Your link code expired before it was used.</p>
              ) : (
                <p role="alert" className="mb-6 max-w-[320px] text-center text-[13px] text-pulse-red">
                  {me.rejectionReason}
                </p>
              )}
              <button
                onClick={() => void requestLink()}
                disabled={requesting}
                className="rounded-md border border-white/[.14] px-6 py-3 text-[13.5px] text-ink-2 transition hover:border-white/25 disabled:opacity-50"
              >
                {requesting ? "Generating…" : "Generate a new link"}
              </button>
            </>
          )}

          {me.telegramLinkStatus === "pending" && me.deepLink && (
            <>
              <span className="mb-5 font-mono text-[10px] tracking-[.22em] text-ink-5">YOUR LINK IS READY</span>
              <a
                href={me.deepLink}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-pulse-cyan px-8 py-4 text-center text-[15px] font-semibold text-onaccent-cyan transition hover:shadow-glow"
                style={{ boxShadow: "0 0 40px rgba(53,230,242,.28)" }}
              >
                Open Telegram
              </a>
              {countdown && (
                <span className="mt-3 font-mono text-[11px] text-pulse-amber">expires in {countdown}</span>
              )}
              <div className="mt-12 flex items-center gap-3 rounded-md border border-white/[.08] bg-surface px-5 py-3.5">
                <div className="flex gap-1.5">
                  <span className="motion-safe:animate-empBreathe h-1.5 w-1.5 rounded-full bg-pulse-cyan" />
                  <span
                    className="motion-safe:animate-empBreathe h-1.5 w-1.5 rounded-full bg-pulse-cyan"
                    style={{ animationDelay: ".3s" }}
                  />
                  <span
                    className="motion-safe:animate-empBreathe h-1.5 w-1.5 rounded-full bg-pulse-cyan"
                    style={{ animationDelay: ".6s" }}
                  />
                </div>
                <span className="font-mono text-[11.5px] tracking-[.08em] text-ink-3">waiting for confirmation…</span>
              </div>
              <button
                onClick={() => void requestLink()}
                disabled={requesting}
                className="mt-6 text-[12.5px] text-ink-5 transition hover:text-ink-3"
              >
                Code not working? <span className="text-pulse-cyan">Generate a new one</span>
              </button>
            </>
          )}
        </div>
      </div>

      <OnboardingFooter left="step 3 of 3" right="we store a chat id · never your @handle" />
    </main>
  );
}
