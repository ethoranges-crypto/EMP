/** wagmi's useAccount().status, narrowed to the four values this check cares about. */
export type WalletConnectionStatus = "connecting" | "reconnecting" | "connected" | "disconnected";

export interface IdentityCheckParams {
  walletStatus: WalletConnectionStatus;
  /** The wallet address wagmi currently reports as connected, if any. */
  connectedAddress: string | undefined;
  /** The wallet the *session* (me.wallet) is signed in as — undefined if there's no session. */
  sessionWallet: string | undefined;
}

/**
 * The pure decision behind useResetOnIdentityChange: does the wallet
 * actually connected in the browser right now match the wallet the EMP
 * session claims to be signed in as? If not, the session is stale and the
 * page (user or protocol side — this check is role-agnostic) must reset
 * rather than keep showing it.
 *
 * Comparing against the session's own wallet — not just "did wagmi's
 * address change since we started watching" — is what closes the full gap:
 * it also catches loading the page with an *already* stale session (the
 * wallet extension auto-connects to a different account than the one you
 * signed in as last time), not only switching mid-session.
 *
 * "connecting"/"reconnecting" are deliberately never a mismatch: wagmi's
 * address is unsettled while it restores a persisted connection on page
 * load, and treating that transient state as a mismatch would sign out
 * the very first render of every page load, valid session or not.
 * `sessionWallet === undefined` (no session yet, or already signed out)
 * is never a mismatch either — there's nothing to protect.
 */
export function hasIdentityMismatch({ walletStatus, connectedAddress, sessionWallet }: IdentityCheckParams): boolean {
  if (walletStatus === "connecting" || walletStatus === "reconnecting") return false;
  if (sessionWallet === undefined) return false;
  if (walletStatus === "disconnected") return true;
  // EVM addresses aren't case-sensitive identity (the checksum casing is a
  // typo-detection convention, not part of the address) — comparing
  // case-insensitively is what actually matches "same address" rather than
  // "same string."
  return connectedAddress?.toLowerCase() !== sessionWallet.toLowerCase();
}
