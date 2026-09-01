import type { ProtocolCampaign } from "@/app/protocol/types";

const HEADERS = [
  "Title",
  "Categories",
  "Status",
  "Created",
  "Sent",
  "Audience Size",
  "Cost (USD)",
  "Delivered Count",
  "Delivered %",
  "Click Count",
  "Click %",
] as const;

function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/**
 * Pure — takes exactly the same aggregate-only shape the dashboard already
 * renders (ProtocolCampaign[], from getProtocolCampaignsList's chokepoint-
 * respecting query) and turns it into CSV text. Deliberately serializes
 * only these 11 named fields rather than spreading/serializing a campaign
 * object wholesale — that's what keeps a future field added upstream
 * (however unlikely, given the type) from silently riding along into the
 * export. See campaignsCsv.test.ts for the regression test that pins this.
 */
export function buildCampaignsCsv(campaigns: ProtocolCampaign[]): string {
  const rows = campaigns.map((c) => [
    c.title,
    c.categoryNames.join("; "),
    c.status,
    c.createdAt,
    c.sentAt ?? "",
    c.snapshotCount !== null ? String(c.snapshotCount) : "",
    c.costAmount ?? "",
    c.metrics ? String(c.metrics.delivered.count) : "",
    c.metrics ? String(c.metrics.delivered.ratePct) : "",
    c.metrics ? String(c.metrics.clicks.total) : "",
    c.metrics ? String(c.metrics.clicks.ratePct) : "",
  ]);
  return [HEADERS as unknown as string[], ...rows].map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
}
