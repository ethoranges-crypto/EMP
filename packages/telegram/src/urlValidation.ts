// URL's hostname getter keeps the brackets on an IPv6 literal (e.g. "[::1]"),
// not the bare address — https://developer.mozilla.org/docs/Web/API/URL/hostname
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);

/**
 * Telegram's Bot API rejects an inline keyboard button whose URL isn't a
 * publicly reachable HTTPS address — a plain `http://` URL, or one pointing
 * at localhost/a loopback address, comes back as a 400 ("Wrong HTTP URL")
 * at send time, one recipient at a time, with the reason buried in whatever
 * logs happen to capture it. Checking this before ever calling Telegram
 * catches the exact same case up front, for the whole campaign at once,
 * with a message that names what's actually wrong (REDIRECT_BASE_URL)
 * instead of parsing Telegram's own error text.
 */
export function isTelegramCompatibleUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (LOOPBACK_HOSTNAMES.has(parsed.hostname)) return false;
  return true;
}

// Suffixes of the free tunnel providers this repo's own README recommends
// for local Telegram-send testing (ngrok, cloudflared, and the other
// commonly-used ones) — technically valid public HTTPS hosts (they satisfy
// isTelegramCompatibleUrl fine), but a randomized subdomain of one of these
// reads as exactly the kind of unfamiliar link a wary recipient is right to
// distrust. Good for testing; not a link to actually send to real users.
const DEV_TUNNEL_HOST_SUFFIXES = [
  ".ngrok.io",
  ".ngrok-free.app",
  ".ngrok.app",
  ".trycloudflare.com",
  ".loca.lt",
  ".localtunnel.me",
  ".serveo.net",
  ".pagekite.me",
];

/**
 * Flags a REDIRECT_BASE_URL that's technically usable but reads as an
 * obviously temporary dev tunnel rather than a real, stable, branded
 * domain — see the CTA-link-trust discussion this exists to reinforce.
 * Not a validity check (isTelegramCompatibleUrl already covers that); this
 * is purely a "you probably don't want recipients to see this" nudge.
 */
export function isLikelyDevTunnelUrl(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }
  return DEV_TUNNEL_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

export type RedirectBaseUrlReachability = { reachable: true } | { reachable: false; reason: string };

/**
 * isTelegramCompatibleUrl only checks *shape* (https, not localhost) — a
 * syntactically fine REDIRECT_BASE_URL still fails hard at click time if
 * the domain was never actually purchased/pointed at anything (real-world
 * case this exists for: a "branded" domain set in .env before it's live —
 * DNS_PROBE_FINISHED_NXDOMAIN in the recipient's browser, discovered only
 * when someone taps the button). This makes an actual network request —
 * DNS resolution, TCP connect, and (for https) the TLS handshake all have
 * to succeed — so a dead domain is caught here, at startup, instead of by
 * a recipient's browser. Any HTTP response at all counts as reachable,
 * even a 404: the point is proving the domain resolves and answers, not
 * that this exact path is meaningful.
 */
export async function checkRedirectBaseUrlReachable(url: string, timeoutMs = 5000): Promise<RedirectBaseUrlReachability> {
  let origin: string;
  let hostname: string;
  try {
    const parsed = new URL(url);
    origin = parsed.origin;
    hostname = parsed.hostname;
  } catch {
    return { reachable: false, reason: `"${url}" isn't a valid URL.` };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(origin, { method: "HEAD", signal: controller.signal });
    return { reachable: true };
  } catch (err) {
    if (controller.signal.aborted) {
      return { reachable: false, reason: `Timed out after ${timeoutMs}ms connecting to ${hostname}.` };
    }
    const code = (err as { cause?: { code?: string } })?.cause?.code;
    if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
      return { reachable: false, reason: `"${hostname}" doesn't resolve (DNS lookup failed, ${code}) — is this domain actually registered and live?` };
    }
    if (code === "ECONNREFUSED") {
      return { reachable: false, reason: `Connection to "${hostname}" was refused — nothing is listening there.` };
    }
    if (code) {
      return { reachable: false, reason: `Could not reach "${hostname}": ${code}.` };
    }
    return { reachable: false, reason: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timeout);
  }
}
