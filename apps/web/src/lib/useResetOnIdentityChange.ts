"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import { hasIdentityMismatch } from "./identityChange.js";

/**
 * Keeps a protocol-facing page's local state honest about which wallet is
 * actually connected. The EMP session cookie is independent of wagmi's
 * client-side wallet connection — it persists across a wallet switch or a
 * disconnect until something explicitly signs it out — so without this, a
 * page that fetched data once on mount just keeps showing it: switching to
 * a different wallet still shows the previous wallet's campaigns, and
 * disconnecting doesn't return to a clean state either.
 *
 * Pass the session's own wallet (`me?.wallet`, undefined if there's no
 * session) — on every render where wagmi's settled connection state no
 * longer matches it (see identityChange.ts's hasIdentityMismatch for
 * exactly what counts, and why the ordinary reconnect-on-page-load
 * sequence doesn't), this fires `onMismatch` synchronously — before the
 * network round-trip, so the UI clears immediately — plus a best-effort
 * server-side signout. A failed signout call can't leak anything: a fresh
 * SIWE sign-in overwrites the session unconditionally regardless.
 *
 * `onMismatch` must be stable (wrap it in useCallback with an empty
 * dependency array).
 */
export function useResetOnIdentityChange(sessionWallet: string | undefined, onMismatch: () => void): void {
  const { address, status } = useAccount();

  useEffect(() => {
    if (hasIdentityMismatch({ walletStatus: status, connectedAddress: address, sessionWallet })) {
      onMismatch();
      void fetch("/api/auth/signout", { method: "POST" }).catch(() => {});
    }
  }, [address, status, sessionWallet, onMismatch]);
}
