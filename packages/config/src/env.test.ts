import { describe, expect, it } from "vitest";
import { loadEnv, resetEnvCacheForTests } from "./env.js";

const VALID_ENV: NodeJS.ProcessEnv = {
  DATABASE_URL: "postgresql://emp:emp@localhost:5432/emp",
  REDIS_URL: "redis://localhost:6379",
  SESSION_SECRET: "0".repeat(32),
  TELEGRAM_BOT_TOKEN: "dummy-token",
  TELEGRAM_BOT_USERNAME: "EmpDevBot",
  REDIRECT_BASE_URL: "http://localhost:3000/r",
};

describe("loadEnv", () => {
  it("parses a fully-populated env", () => {
    resetEnvCacheForTests();
    const env = loadEnv(VALID_ENV);
    expect(env.TELEGRAM_BOT_TOKEN).toBe("dummy-token");
  });

  it("throws an actionable error naming the failing var, not a raw ZodError, when a required var is blank", () => {
    resetEnvCacheForTests();
    const { TELEGRAM_BOT_TOKEN: _drop, ...withoutToken } = VALID_ENV;
    const brokenEnv = { ...withoutToken, TELEGRAM_BOT_TOKEN: "" };

    expect(() => loadEnv(brokenEnv)).toThrow(/TELEGRAM_BOT_TOKEN/);
    expect(() => loadEnv(brokenEnv)).toThrow(/\.env\.example/);
  });

  it("throws for a missing (undefined) required var too, not just blank", () => {
    resetEnvCacheForTests();
    const { SESSION_SECRET: _drop, ...brokenEnv } = VALID_ENV;

    expect(() => loadEnv(brokenEnv)).toThrow(/SESSION_SECRET/);
  });

  it("defaults the payment-watch RPC tuning to free-tier-friendly values when unset", () => {
    resetEnvCacheForTests();
    const env = loadEnv(VALID_ENV);
    expect(env.PAYMENT_WATCH_POLL_SECONDS).toBe(90);
    expect(env.PAYMENT_WATCH_MAX_LOOKBACK_BLOCKS).toBe(300);
    expect(env.PAYMENT_WATCH_RPC_RETRY_COUNT).toBe(5);
    expect(env.PAYMENT_WATCH_RPC_RETRY_DELAY_MS).toBe(1000);
    expect(env.PAYMENT_WATCH_SCAN_NATIVE_TRANSFERS).toBe(false);
  });

  it("only the literal string 'true' turns on native-transfer scanning — not any other non-empty value", () => {
    resetEnvCacheForTests();
    expect(loadEnv({ ...VALID_ENV, PAYMENT_WATCH_SCAN_NATIVE_TRANSFERS: "true" }).PAYMENT_WATCH_SCAN_NATIVE_TRANSFERS).toBe(true);
    resetEnvCacheForTests();
    expect(loadEnv({ ...VALID_ENV, PAYMENT_WATCH_SCAN_NATIVE_TRANSFERS: "false" }).PAYMENT_WATCH_SCAN_NATIVE_TRANSFERS).toBe(false);
    resetEnvCacheForTests();
    expect(loadEnv({ ...VALID_ENV, PAYMENT_WATCH_SCAN_NATIVE_TRANSFERS: "yes" }).PAYMENT_WATCH_SCAN_NATIVE_TRANSFERS).toBe(false);
  });

  it("respects explicit payment-watch overrides", () => {
    resetEnvCacheForTests();
    const env = loadEnv({
      ...VALID_ENV,
      PAYMENT_WATCH_POLL_SECONDS: "45",
      PAYMENT_WATCH_MAX_LOOKBACK_BLOCKS: "150",
      PAYMENT_WATCH_RPC_RETRY_COUNT: "8",
      PAYMENT_WATCH_RPC_RETRY_DELAY_MS: "2000",
    });
    expect(env.PAYMENT_WATCH_POLL_SECONDS).toBe(45);
    expect(env.PAYMENT_WATCH_MAX_LOOKBACK_BLOCKS).toBe(150);
    expect(env.PAYMENT_WATCH_RPC_RETRY_COUNT).toBe(8);
    expect(env.PAYMENT_WATCH_RPC_RETRY_DELAY_MS).toBe(2000);
  });
});
