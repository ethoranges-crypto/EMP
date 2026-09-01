"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { truncateAddress } from "@/lib/address";

/**
 * Same top-bar shape as the dashboard's header, minus the actions a
 * not-yet-approved protocol can't use yet — just the wordmark, a title,
 * and a wallet chip. Built on RainbowKit's ConnectButton.Custom render
 * prop rather than a static div, so it stays a real control: clicking it
 * opens RainbowKit's own account modal (disconnect, switch wallet), the
 * same capability the plain `<ConnectButton />` gave every other page —
 * only the chip's visual chrome is custom, not the wiring.
 */
export function Header() {
  return (
    <header className="flex h-[57px] shrink-0 items-center gap-4 border-b border-white/[.07] px-[26px]">
      <div className="font-mono text-[13px] font-bold tracking-[.06em]">EMP</div>
      <div className="h-4 w-px bg-white/[.12]" />
      <div className="text-[13px] text-ink-2">Protocol access</div>
      <div className="ml-auto">
        <ConnectButton.Custom>
          {({ account, mounted, openAccountModal, openConnectModal }) => {
            const ready = mounted;
            const connected = ready && account;
            if (!ready) return <div className="h-8 w-24" />;
            if (!connected) {
              return (
                <button
                  onClick={openConnectModal}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-[12.5px] text-ink-2 transition hover:border-white/20"
                >
                  Connect wallet
                </button>
              );
            }
            return (
              <button
                onClick={openAccountModal}
                className="flex items-center gap-2 rounded-full border border-white/10 px-2.5 py-1.5 transition hover:border-white/20"
              >
                <div className="h-4 w-4 rounded-full bg-gradient-to-br from-pulse-cyan to-pulse-violet" />
                <div className="font-mono text-[11px] text-ink-2">{truncateAddress(account.address)}</div>
              </button>
            );
          }}
        </ConnectButton.Custom>
      </div>
    </header>
  );
}
