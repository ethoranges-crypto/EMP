import { describe, expect, it } from "vitest";
import { isValidTelegramBotUsername } from "./telegram.js";

describe("isValidTelegramBotUsername", () => {
  it("accepts real-shaped bot usernames", () => {
    expect(isValidTelegramBotUsername("EmpDevBot")).toBe(true);
    expect(isValidTelegramBotUsername("my_real_bot")).toBe(true);
    expect(isValidTelegramBotUsername("a1234bot")).toBe(true);
  });

  it("rejects the empty string", () => {
    expect(isValidTelegramBotUsername("")).toBe(false);
  });

  it("rejects an obvious leftover placeholder", () => {
    expect(isValidTelegramBotUsername("placeholder")).toBe(false);
    expect(isValidTelegramBotUsername("your_bot_username")).toBe(false);
  });

  it("rejects a username that doesn't end in bot", () => {
    expect(isValidTelegramBotUsername("EmpNotify")).toBe(false);
  });

  it("rejects one starting with a digit or underscore", () => {
    expect(isValidTelegramBotUsername("1EmpBot")).toBe(false);
    expect(isValidTelegramBotUsername("_EmpBot")).toBe(false);
  });

  it("rejects out-of-range lengths", () => {
    expect(isValidTelegramBotUsername("abot")).toBe(false); // 4 chars, below Telegram's 5 minimum
    expect(isValidTelegramBotUsername(`a${"b".repeat(30)}bot`)).toBe(false); // 34 chars, above the 32 max
  });
});
