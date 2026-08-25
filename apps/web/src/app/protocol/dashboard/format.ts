/** Groups an ISO array key ("August 2026") for the history list's month headers, in the viewer's local calendar. */
export function monthYearLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" }).toUpperCase();
}

/** Short date for a history row's meta line ("24 Aug"). */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Compact date+time for a narrow column ("25 Aug · 16:46") — formatScheduledSendAt's local-time+tz version is too wide for a history row's result column. */
export function shortDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}
