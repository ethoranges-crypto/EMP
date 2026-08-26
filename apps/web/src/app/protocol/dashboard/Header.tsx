"use client";

import { truncateAddress } from "../address";
import type { ProtocolMe } from "../types";

/**
 * The shell's top bar, shared shape across every "1b"-language screen:
 * wordmark, a divider, a title, a status chip, then right-aligned actions.
 * No BackButton here — this is now the single home for an APPROVED
 * protocol (see page.tsx's own comment), so there's nowhere "back" to go;
 * /protocol immediately redirects an APPROVED protocol right back here.
 * "Export as CSV" and "New campaign" are both real, wired actions.
 */
export function Header({ me, onNewCampaign }: { me: ProtocolMe; onNewCampaign: () => void }) {
  return (
    <header className="flex h-[57px] shrink-0 items-center gap-4 border-b border-white/[.07] px-[26px]">
      <div className="font-mono text-[13px] font-bold tracking-[.06em]">EMP</div>
      <div className="h-4 w-px bg-white/[.12]" />
      <div className="text-[13px] text-ink-2">{me.name || "Your protocol"}</div>
      <span className="rounded-chip bg-pulse-green/10 px-[9px] py-[4px] font-mono text-[10.5px] font-medium text-pulse-green">
        {me.status}
      </span>
      <div className="ml-auto flex items-center gap-2.5">
        <a
          href="/api/protocol/campaigns/export"
          className="rounded-md border border-white/[.12] px-[13px] py-2 text-xs text-ink-2 transition hover:border-white/25"
        >
          Export as CSV
        </a>
        <button
          onClick={onNewCampaign}
          className="rounded-md bg-pulse-cyan px-[15px] py-2 text-xs font-semibold text-onaccent-cyan transition hover:shadow-glow"
        >
          New campaign
        </button>
        <div className="ml-1 flex items-center gap-2 rounded-full border border-white/10 px-2.5 py-1.5">
          <div className="h-4 w-4 rounded-full bg-gradient-to-br from-pulse-cyan to-pulse-violet" />
          <div className="font-mono text-[11px] text-ink-2">{truncateAddress(me.wallet)}</div>
        </div>
      </div>
    </header>
  );
}
