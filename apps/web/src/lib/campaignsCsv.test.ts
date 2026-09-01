import { describe, expect, it } from "vitest";
import { assertNoForbiddenKeys, assertNoLeakedValues } from "@emp/core/src/testUtils/privacyAssertions.js";
import { buildCampaignsCsv } from "./campaignsCsv.js";
import type { ProtocolCampaign } from "@/app/protocol/types";

function campaign(overrides: Partial<ProtocolCampaign> = {}): ProtocolCampaign {
  return {
    id: "camp-1",
    title: "Perps v3 launch",
    status: "COMPLETE",
    chain: "Arbitrum",
    token: "USDC",
    categoryNames: ["Yields", "New features"],
    hasComposeContent: true,
    ctaCount: 2,
    snapshotCount: 4182,
    costAmount: "4182.00",
    rejectionReason: null,
    createdAt: "2026-08-01T12:00:00.000Z",
    scheduledSendAt: null,
    sentAt: "2026-08-02T09:00:00.000Z",
    metrics: { delivered: { count: 4100, ratePct: 98.1 }, clicks: { total: 512, ratePct: 12.5 } },
    ...overrides,
  };
}

describe("buildCampaignsCsv — CSV export privacy boundary (SPEC/CLAUDE.md rule 1: aggregate-only)", () => {
  it("emits exactly the 11 aggregate columns, no forbidden key names in the header row", () => {
    const csv = buildCampaignsCsv([campaign()]);
    const header = csv.split("\r\n")[0]!.split(",");
    assertNoForbiddenKeys(Object.fromEntries(header.map((h) => [h, true])));
    expect(header).toEqual([
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
    ]);
  });

  it("renders real aggregate data correctly for a completed campaign", () => {
    const csv = buildCampaignsCsv([campaign()]);
    const dataRow = csv.split("\r\n")[1];
    expect(dataRow).toBe(
      "Perps v3 launch,Yields; New features,COMPLETE,2026-08-01T12:00:00.000Z,2026-08-02T09:00:00.000Z,4182,4182.00,4100,98.1,512,12.5",
    );
  });

  it("leaves delivered/click columns blank for a campaign that hasn't sent yet", () => {
    const csv = buildCampaignsCsv([campaign({ status: "DRAFT", sentAt: null, snapshotCount: null, costAmount: null, metrics: null })]);
    const dataRow = csv.split("\r\n")[1];
    expect(dataRow).toBe("Perps v3 launch,Yields; New features,DRAFT,2026-08-01T12:00:00.000Z,,,,,,,");
  });

  it("quotes a title containing a comma", () => {
    const csv = buildCampaignsCsv([campaign({ title: "Launch, part two" })]);
    expect(csv.split("\r\n")[1]).toMatch(/^"Launch, part two",/);
  });

  it("never leaks a wallet/chat_id value smuggled onto a campaign row by a future upstream bug — proves the builder serializes only its 11 named fields, not the object wholesale", () => {
    const SECRET_WALLET = "0xdeadbeef00000000000000000000000000cafe";
    const SECRET_CHAT_ID = "chat-id-987654321";
    // Simulates a hypothetical future regression where ProtocolCampaign
    // gained extra fields upstream — `as any` bypasses the type system on
    // purpose, since the whole point is checking behavior if that type
    // guarantee is ever weakened.
    const poisoned = { ...campaign(), wallet: SECRET_WALLET, chatId: SECRET_CHAT_ID } as unknown as ProtocolCampaign;
    const csv = buildCampaignsCsv([poisoned]);
    assertNoLeakedValues(csv, [SECRET_WALLET, SECRET_CHAT_ID]);
  });
});
