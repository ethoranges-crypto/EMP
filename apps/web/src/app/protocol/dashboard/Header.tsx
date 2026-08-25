"use client";

import Link from "next/link";
import { truncateAddress } from "./format";
import type { ProtocolMe } from "../types";

/**
 * The shell's top bar, shared shape across every "1b"-language screen:
 * wordmark, a divider, a title, a status chip, then right-aligned actions.
 * "Export aggregates" has no backing feature yet (no CSV export endpoint
 * exists) — shown per the design for layout fidelity but disabled rather
 * than wired to nothing, so it doesn't read as a working button that
 * silently does nothing. "New campaign" is real: it goes to /protocol,
 * today's actual compose entry point (a dedicated composer screen matching
 * this language is 1b in the design handoff — the next screen in this
 * series, not built yet).
 */
export function Header({ me }: { me: ProtocolMe }) {
  return (
    <header className="flex h-[57px] shrink-0 items-center gap-4 border-b border-white/[.07] px-[26px]">
      <div className="font-mono text-[13px] font-bold tracking-[.06em]">EMP</div>
      <div className="h-4 w-px bg-white/[.12]" />
      <div className="text-[13px] text-ink-2">{me.name || "Your protocol"}</div>
      <span className="rounded-chip bg-pulse-green/10 px-[9px] py-[4px] font-mono text-[10.5px] font-medium text-pulse-green">
        {me.status}
      </span>
      <div className="ml-auto flex items-center gap-2.5">
        <button
          disabled
          title="CSV export isn't built yet"
          className="cursor-not-allowed rounded-md border border-white/[.12] px-[13px] py-2 text-xs text-ink-2 opacity-40"
        >
          Export aggregates
        </button>
        <Link
          href="/protocol"
          className="rounded-md bg-pulse-cyan px-[15px] py-2 text-xs font-semibold text-onaccent-cyan transition hover:shadow-glow"
        >
          New campaign
        </Link>
        <div className="ml-1 flex items-center gap-2 rounded-full border border-white/10 px-2.5 py-1.5">
          <div className="h-4 w-4 rounded-full bg-gradient-to-br from-pulse-cyan to-pulse-violet" />
          <div className="font-mono text-[11px] text-ink-2">{truncateAddress(me.wallet)}</div>
        </div>
      </div>
    </header>
  );
}
