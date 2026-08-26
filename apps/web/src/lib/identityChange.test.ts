import { describe, expect, it } from "vitest";
import { hasIdentityMismatch, type WalletConnectionStatus } from "./identityChange.js";

const CONNECTING: WalletConnectionStatus[] = ["connecting", "reconnecting"];

describe("hasIdentityMismatch — the bug: switching/disconnecting wallets left the previous session's data on screen", () => {
  it("never a mismatch while wagmi is still settling the connection, even with an active session", () => {
    for (const walletStatus of CONNECTING) {
      expect(hasIdentityMismatch({ walletStatus, connectedAddress: undefined, sessionWallet: "0xabc" })).toBe(false);
      expect(hasIdentityMismatch({ walletStatus, connectedAddress: "0xdef", sessionWallet: "0xabc" })).toBe(false);
    }
  });

  it("never a mismatch when there's no session to protect", () => {
    expect(hasIdentityMismatch({ walletStatus: "connected", connectedAddress: "0xabc", sessionWallet: undefined })).toBe(false);
    expect(hasIdentityMismatch({ walletStatus: "disconnected", connectedAddress: undefined, sessionWallet: undefined })).toBe(false);
  });

  it("not a mismatch once settled and connected to the same wallet the session is for", () => {
    expect(hasIdentityMismatch({ walletStatus: "connected", connectedAddress: "0xabc", sessionWallet: "0xabc" })).toBe(false);
  });

  it("matches case-insensitively — checksum casing isn't part of address identity", () => {
    expect(hasIdentityMismatch({ walletStatus: "connected", connectedAddress: "0xAbC", sessionWallet: "0xabc" })).toBe(false);
  });

  it("IS a mismatch when connected to a different wallet than the session — the exact bug reported", () => {
    expect(hasIdentityMismatch({ walletStatus: "connected", connectedAddress: "0xdef", sessionWallet: "0xabc" })).toBe(true);
  });

  it("IS a mismatch once settled disconnected while a session is still active — the second half of the bug report", () => {
    expect(hasIdentityMismatch({ walletStatus: "disconnected", connectedAddress: undefined, sessionWallet: "0xabc" })).toBe(true);
  });

  it("IS a mismatch for a session that was already stale by the time the page loaded — the wallet extension auto-connects to a different account than the one last signed in with", () => {
    // Not just "did the address change since we started watching" — this
    // catches the case where the mismatch existed from the very first
    // settled render, which a naive "previous vs next" diff would miss.
    expect(hasIdentityMismatch({ walletStatus: "connected", connectedAddress: "0xnewwallet", sessionWallet: "0xoldwallet" })).toBe(true);
  });

  it("IS a mismatch on /user too, including after a hard refresh — connecting a new wallet must never keep showing the previous wallet's interests/Telegram-link status", () => {
    // /user/page.tsx wires useResetOnIdentityChange the same way the
    // protocol side does; this is the exact scenario from that bug report —
    // a hard refresh re-mounts the page and re-fetches /api/user/me with
    // whatever session cookie still exists, but that's still "already
    // stale at first settled render" from this check's point of view, and
    // must be caught the same way regardless of which side's page it is.
    expect(hasIdentityMismatch({ walletStatus: "connected", connectedAddress: "0xnewuserwallet", sessionWallet: "0xolduserwallet" })).toBe(true);
  });
});
