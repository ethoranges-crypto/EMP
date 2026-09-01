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
    // Every integration file shares one live Postgres database. Vitest
    // parallelizes across test *files* by default (separate workers), which
    // races one file's cleanup against another file's seeded fixtures —
    // exactly the failure this comment is here because of. Force strictly
    // sequential file execution so each suite's data is stable for its own
    // duration.
    fileParallelism: false,
  },
});
