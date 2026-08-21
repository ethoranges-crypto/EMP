import { describe, expect, it } from "vitest";
import { buildTrustedButtonText } from "./trustLabel.js";

describe("buildTrustedButtonText", () => {
  it("appends the real destination host to the protocol's label", () => {
    expect(buildTrustedButtonText("View Vaults", "https://alchemix.fi/vaults?ref=campaign1")).toBe(
      "View Vaults — alchemix.fi",
    );
  });

  it("strips a www. prefix for a cleaner display", () => {
    expect(buildTrustedButtonText("Docs", "https://www.alchemix.fi/docs")).toBe("Docs — alchemix.fi");
  });

  it("never shows the path or query string — just the host", () => {
    const text = buildTrustedButtonText("Claim", "https://alchemix.fi/claim?token=secret&utm_source=telegram");
    expect(text).toBe("Claim — alchemix.fi");
  });

  it("falls back to the bare label if the target URL can't be parsed", () => {
    expect(buildTrustedButtonText("View Vaults", "not-a-url")).toBe("View Vaults");
  });

  it("falls back to the bare hostname if the label is blank", () => {
    expect(buildTrustedButtonText("   ", "https://alchemix.fi/vaults")).toBe("alchemix.fi");
  });

  it("trims whitespace around the label", () => {
    expect(buildTrustedButtonText("  View Vaults  ", "https://alchemix.fi/vaults")).toBe("View Vaults — alchemix.fi");
  });
});
