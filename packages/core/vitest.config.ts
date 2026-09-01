import { defineConfig } from "vitest/config";

// Fast, no-DB unit tests only. The Prisma-adapter integration test needs a
// real Postgres and runs separately via vitest.integration.config.ts / `pnpm
// test:integration` — see that file for why the split exists.
export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/*.integration.test.ts"],
  },
});
