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
