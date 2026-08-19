import type { TelegramLinkStatus } from "./types";

/**
 * Per-state next step — the whole point is that the non-messageable case
 * tells you what to do, not just that it's false. "linked" never actually
 * renders (messageable is true whenever telegramLinkStatus is "linked" —
 * see /api/user/me), it's here only so this stays a total function.
 */
const NEXT_STEP: Record<TelegramLinkStatus, string> = {
  not_configured: "Telegram isn't set up on this deployment yet",
  none: "Link Telegram to start receiving messages",
  pending: "Waiting for Telegram confirmation",
  rejected: "Telegram link failed — try again below",
  expired: "Telegram link expired — generate a new one below",
  linked: "Messageable — you're all set",
};

/**
 * Makes SPEC §7.5's invariant legible: audience membership only ever comes
 * from a currently-verified Telegram link, never from wallet connection or
 * interests alone. Only rendered once signed in (see page.tsx) — never
 * shown as a bare, unexplained "No": the copy always doubles as the next
 * step, since "not messageable" is only useful to a user paired with what
 * fixes it.
 */
export function MessageableBadge({
  messageable,
  telegramLinkStatus,
}: {
  messageable: boolean;
  telegramLinkStatus: TelegramLinkStatus;
}) {
  const label = NEXT_STEP[telegramLinkStatus];

  return (
    <div
      className={
        "flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-center text-sm font-medium " +
        (messageable
          ? "border-pulse-cyan/40 bg-pulse-cyan/10 text-pulse-cyan"
          : "border-white/10 bg-white/5 text-slate-400")
      }
    >
      <span className={"h-2 w-2 shrink-0 rounded-full " + (messageable ? "bg-pulse-cyan shadow-glow" : "bg-slate-600")} />
      {label}
    </div>
  );
}
