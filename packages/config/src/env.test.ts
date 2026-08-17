import { describe, expect, it } from "vitest";
import { loadEnv, resetEnvCacheForTests } from "./env.js";

const VALID_ENV: NodeJS.ProcessEnv = {
  DATABASE_URL: "postgresql://emp:emp@localhost:5432/emp",
  REDIS_URL: "redis://localhost:6379",
  SESSION_SECRET: "0".repeat(32),
  SIWE_DOMAIN: "localhost:3000",
  SIWE_URI: "http://localhost:3000",
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
});
