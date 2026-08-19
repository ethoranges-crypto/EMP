import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config as applyDotenvFile } from "dotenv";

let loaded = false;

/**
 * Walks up from a starting directory looking for pnpm-workspace.yaml — the
 * one file that only ever exists at the monorepo root — so this finds the
 * right place regardless of which package/app called it, and regardless of
 * whether it's running from TS source or a compiled dist/ output (both sit
 * at the same depth under their package root either way).
 */
function findRepoRoot(startDir: string): string | undefined {
  let dir = startDir;
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * Loads the monorepo's single root `.env` into process.env — once per
 * process, and only filling in vars that aren't already set (so a real
 * hosting-provided or CI-injected env always wins over the file, and
 * calling this more than once is harmless). This is the one place every
 * app and package's config comes from: apps/bot, apps/worker, apps/web's
 * API routes, and packages/db's CLI scripts all end up reading the same
 * file instead of each needing its own copy of it.
 *
 * No-ops quietly if no root `.env` exists (e.g. in CI, where env vars are
 * injected directly) or if this isn't running inside the monorepo checkout
 * at all — dotenv's own `config()` doesn't throw on a missing file, so
 * there's nothing to guard here.
 */
export function loadRootEnvFile(): void {
  if (loaded) return;
  loaded = true;

  const root = findRepoRoot(dirname(fileURLToPath(import.meta.url)));
  if (!root) return;

  applyDotenvFile({ path: join(root, ".env") });
}

export function resetRootEnvLoadedForTests(): void {
  loaded = false;
}
