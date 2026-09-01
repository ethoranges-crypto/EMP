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
      ctas: [{ label: "Go", targetUrl: "https://alchemix.fi/vaults", redirectUrl: "http://localhost:3000/r/abc" }],
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
      ctas: [{ label: "Go", targetUrl: "https://alchemix.fi/vaults", redirectUrl: "https://emp.example.com/r/abc" }],
    });

    expect(sendMessage).toHaveBeenCalledOnce();
    expect(result).toEqual({ status: "SENT" });
  });

  it("builds the button so its visible text shows the real destination, not just the protocol's label", async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const bot = fakeBot(sendMessage);

    await sendCampaignMessage(bot, {
      chatId: "1",
      text: "hi",
      ctas: [
        { label: "View Vaults", targetUrl: "https://alchemix.fi/vaults?ref=x", redirectUrl: "https://emp.example.com/r/abc" },
      ],
    });

    const [, , options] = sendMessage.mock.calls[0] as [unknown, unknown, { reply_markup: { inline_keyboard: Array<Array<{ text: string; url: string }>> } }];
    const button = options.reply_markup.inline_keyboard[0]![0]!;
    expect(button.text).toBe("View Vaults — alchemix.fi");
    expect(button.url).toBe("https://emp.example.com/r/abc"); // still the tracked redirect, not the real destination
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
