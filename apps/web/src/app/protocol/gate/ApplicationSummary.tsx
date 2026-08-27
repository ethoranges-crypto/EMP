"use client";

import { truncateAddress } from "@/lib/address";
import type { ProtocolMe } from "../types";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-r border-white/[.05] p-[14px_16px] [&:nth-child(2n)]:border-r-0">
      <div className="mb-1.5 font-mono text-[10.5px] text-ink-5">{label}</div>
      <div className="text-[13px]">{value}</div>
    </div>
  );
}

/**
 * "YOUR APPLICATION" — real fields only. The design's mockup also shows
 * CATEGORY and SITE — neither exists on the Protocol model (schema.prisma
 * has wallet, accountType, safeAddress, name, xHandle, status only), so
 * they're left out rather than invented. X ACCOUNT, previously flagged
 * here as missing for the same reason, is now real (Protocol.xHandle) and
 * shown below. No submission timestamp either: Protocol.createdAt is set
 * at first SIWE sign-in, not at application-submit time, so labelling it
 * "Submitted" would be wrong.
 */
export function ApplicationSummary({ me }: { me: ProtocolMe }) {
  return (
    <div className="overflow-hidden rounded-card border border-white/[.08] bg-surface">
      <div className="border-b border-white/[.07] px-4 py-3 font-mono text-[9.5px] font-medium tracking-[.12em] text-ink-5">
        YOUR APPLICATION
      </div>
      <div className="grid grid-cols-2">
        <Field label="PROTOCOL" value={me.name} />
        {me.xHandle && <Field label="X ACCOUNT" value={me.xHandle} />}
        <Field label="ACCOUNT TYPE" value={me.accountType === "SAFE" ? "Gnosis Safe" : "EOA"} />
        <Field label="SIGNING WALLET" value={truncateAddress(me.wallet)} />
        {me.safeAddress && <Field label="SAFE ADDRESS" value={truncateAddress(me.safeAddress)} />}
      </div>
    </div>
  );
}
