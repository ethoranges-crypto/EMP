import { describe, expect, it } from "vitest";
import { isLikelyDevTunnelUrl, isTelegramCompatibleUrl } from "./urlValidation.js";

describe("isTelegramCompatibleUrl", () => {
  it("accepts a public HTTPS URL", () => {
    expect(isTelegramCompatibleUrl("https://emp.example.com/r/abc123")).toBe(true);
  });

  it("rejects plain HTTP", () => {
    expect(isTelegramCompatibleUrl("http://emp.example.com/r/abc123")).toBe(false);
  });

  it("rejects localhost even over HTTPS", () => {
    expect(isTelegramCompatibleUrl("https://localhost:3000/r/abc123")).toBe(false);
  });

  it("rejects http://localhost — the exact failure this was built for", () => {
    expect(isTelegramCompatibleUrl("http://localhost:3000/r/abc123")).toBe(false);
  });

  it("rejects loopback IP addresses", () => {
    expect(isTelegramCompatibleUrl("https://127.0.0.1/r/abc123")).toBe(false);
    expect(isTelegramCompatibleUrl("https://[::1]/r/abc123")).toBe(false);
  });

  it("rejects a malformed URL", () => {
    expect(isTelegramCompatibleUrl("not-a-url")).toBe(false);
  });

  it("accepts an HTTPS tunnel hostname (ngrok/cloudflared style)", () => {
    expect(isTelegramCompatibleUrl("https://abcd-1-2-3-4.ngrok-free.app/r/abc123")).toBe(true);
  });
});

describe("isLikelyDevTunnelUrl", () => {
  it.each([
    "https://abcd-1-2-3-4.ngrok-free.app/r/abc",
    "https://abcd1234.ngrok.io/r/abc",
    "https://abcd1234.ngrok.app/r/abc",
    "https://random-words-here.trycloudflare.com/r/abc",
    "https://something.loca.lt/r/abc",
    "https://something.localtunnel.me/r/abc",
    "https://something.serveo.net/r/abc",
    "https://something.pagekite.me/r/abc",
  ])("flags %s as a dev tunnel", (url) => {
    expect(isLikelyDevTunnelUrl(url)).toBe(true);
  });

  it("does not flag a real branded domain", () => {
    expect(isLikelyDevTunnelUrl("https://emp.link/r/abc")).toBe(false);
    expect(isLikelyDevTunnelUrl("https://links.alchemix.fi/r/abc")).toBe(false);
  });

  it("does not flag a malformed URL (isTelegramCompatibleUrl already rejects those separately)", () => {
    expect(isLikelyDevTunnelUrl("not-a-url")).toBe(false);
  });
});
