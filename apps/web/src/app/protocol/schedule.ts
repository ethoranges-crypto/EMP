/**
 * Scheduled sending is stored/compared in UTC everywhere server-side
 * (Campaign.scheduledSendAt) — these helpers are the one place the browser's
 * local timezone enters the picture, so a protocol always sees the time it
 * picked in ITS OWN clock, unambiguously labelled, while the wire format
 * stays a plain UTC ISO string in both directions.
 */

/** The viewer's IANA timezone name (e.g. "America/New_York"), for unambiguous display next to any local time shown. */
export function localTimeZoneName(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** A UTC ISO string -> the value a `<input type="datetime-local">` expects, in the viewer's local time. */
export function isoToLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A `<input type="datetime-local">` value (interpreted as the viewer's local time, per the input's own contract) -> a UTC ISO string. */
export function localInputValueToIso(value: string): string {
  return new Date(value).toISOString();
}

/** Human-readable local time + explicit timezone, for showing a chosen/locked-in schedule without ambiguity. */
export function formatScheduledSendAt(iso: string): string {
  const formatted = new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return `${formatted} (${localTimeZoneName()})`;
}

/** Human-readable local time for a historical record (created/approved/sent) — no tz suffix needed since it's a fact about the past, not something to act on. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** "H:MM:SS" (or "0:00:00" once past) — a live countdown to a future instant, e.g. a payment window's expiry. */
export function formatCountdown(msRemaining: number): string {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h}:${pad(m)}:${pad(s)}`;
}
