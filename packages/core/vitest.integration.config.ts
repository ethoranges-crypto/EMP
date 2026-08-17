import { defineConfig } from "vitest/config";

// Runs only *.integration.test.ts, against a real Postgres pointed to by
// DATABASE_URL (docker-compose's `postgres` service locally; a `postgres`
// services: container in CI — see .github/workflows/ci.yml). Kept out of
// the default `pnpm test` lane so that one stays fast and DB-free.
export default defineConfig({
  test: {
    include: ["**/*.integration.test.ts"],
    exclude: ["**/node_modules/**"],
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
