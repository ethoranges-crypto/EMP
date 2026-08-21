/**
 * A CTA button's visible text always reflects its *real* destination host —
 * never just whatever free-text label the protocol typed — so a recipient
 * sees where a tap actually leads without needing to long-press "Copy Link"
 * to check. The button's underlying URL still routes through /r/:token for
 * click tracking; only the visible text changes. This also keeps a protocol
 * from writing a label that doesn't match where the link actually goes.
 *
 * Deliberately host-only, not the full path — a path can carry a query
 * string (ref codes, utm_ params) that looks like clutter or, worse, like
 * exactly the kind of obfuscation a suspicious link uses. The host alone is
 * the trust-relevant fact ("this goes to alchemix.fi"); the exact page
 * doesn't need to be legible in a button label to make that case.
 */
export function buildTrustedButtonText(label: string, targetUrl: string): string {
  const hostname = safeHostname(targetUrl);
  const trimmedLabel = label.trim();
  if (!hostname) return trimmedLabel;
  if (!trimmedLabel) return hostname;
  return `${trimmedLabel} — ${hostname}`;
}

function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
