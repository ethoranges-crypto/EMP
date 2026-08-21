import { describe, expect, it, vi } from "vitest";
import { sendCampaignMessage } from "./sendMessage.js";

function fakeBot(sendMessageImpl: (...args: unknown[]) => unknown) {
  return { api: { sendMessage: sendMessageImpl, sendPhoto: sendMessageImpl } } as never;
}

describe("sendCampaignMessage", () => {
  it("fails fast, without calling Telegram, when a CTA URL isn't Telegram-compatible", async () => {
    const sendMessage = vi.fn();
    const bot = fakeBot(sendMessage);

    const result = await sendCampaignMessage(bot, {
      chatId: "1",
      text: "hi",
      ctas: [{ label: "Go", redirectUrl: "http://localhost:3000/r/abc" }],
    });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: "FAILED",
      retryable: false,
      error: expect.stringContaining("localhost"),
    });
  });

  it("sends normally when every CTA URL is Telegram-compatible", async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const bot = fakeBot(sendMessage);

    const result = await sendCampaignMessage(bot, {
      chatId: "1",
      text: "hi",
      ctas: [{ label: "Go", redirectUrl: "https://emp.example.com/r/abc" }],
    });

    expect(sendMessage).toHaveBeenCalledOnce();
    expect(result).toEqual({ status: "SENT" });
  });

  it("sends fine with no CTAs at all regardless of REDIRECT_BASE_URL", async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const bot = fakeBot(sendMessage);

    const result = await sendCampaignMessage(bot, { chatId: "1", text: "hi", ctas: [] });

    expect(result).toEqual({ status: "SENT" });
  });

  it("marks a Telegram 400 (non-429) as not retryable", async () => {
    const sendMessage = vi.fn().mockRejectedValue({ error_code: 400, description: "Bad Request: message text is empty" });
    const bot = fakeBot(sendMessage);

    const result = await sendCampaignMessage(bot, { chatId: "1", text: "hi", ctas: [] });

    expect(result).toEqual({ status: "FAILED", retryable: false, error: expect.any(String) });
  });

  it("marks a Telegram 429 (rate limited) as retryable", async () => {
    const sendMessage = vi.fn().mockRejectedValue({ error_code: 429, description: "Too Many Requests" });
    const bot = fakeBot(sendMessage);

    const result = await sendCampaignMessage(bot, { chatId: "1", text: "hi", ctas: [] });

    expect(result).toEqual({ status: "FAILED", retryable: true, error: expect.any(String) });
  });

  it("marks a Telegram 5xx as retryable", async () => {
    const sendMessage = vi.fn().mockRejectedValue({ error_code: 502, description: "Bad Gateway" });
    const bot = fakeBot(sendMessage);

    const result = await sendCampaignMessage(bot, { chatId: "1", text: "hi", ctas: [] });

    expect(result).toEqual({ status: "FAILED", retryable: true, error: expect.any(String) });
  });

  it("marks an unknown-shaped error (e.g. a network failure) as retryable", async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error("fetch failed"));
    const bot = fakeBot(sendMessage);

    const result = await sendCampaignMessage(bot, { chatId: "1", text: "hi", ctas: [] });

    expect(result).toEqual({ status: "FAILED", retryable: true, error: "fetch failed" });
  });

  it("still detects a blocked-by-user error ahead of retryable classification", async () => {
    const sendMessage = vi.fn().mockRejectedValue({ description: "Forbidden: bot was blocked by the user" });
    const bot = fakeBot(sendMessage);

    const result = await sendCampaignMessage(bot, { chatId: "1", text: "hi", ctas: [] });

    expect(result).toEqual({ status: "BLOCKED" });
  });
});
