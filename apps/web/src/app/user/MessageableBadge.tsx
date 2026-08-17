/**
 * Makes SPEC §7.5's invariant legible: audience membership only ever comes
 * from a currently-verified Telegram link, never from wallet connection or
 * interests alone. This badge reflects exactly the same `messageable`
 * boolean the protocol-facing audience count is built from.
 */
export function MessageableBadge({ messageable }: { messageable: boolean }) {
  return (
    <div
      className={
        "flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium " +
        (messageable
          ? "border-pulse-cyan/40 bg-pulse-cyan/10 text-pulse-cyan"
          : "border-white/10 bg-white/5 text-slate-400")
      }
    >
      <span className={"h-2 w-2 rounded-full " + (messageable ? "bg-pulse-cyan shadow-glow" : "bg-slate-600")} />
      Messageable: {messageable ? "Yes" : "No"}
    </div>
  );
}
