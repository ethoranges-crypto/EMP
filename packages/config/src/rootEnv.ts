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
 * process — and calling this more than once is harmless. This is the one
 * place every app and package's config comes from: apps/bot, apps/worker,
 * apps/web's API routes, and packages/db's CLI scripts all end up reading
 * the same file instead of each needing its own copy of it.
 *
 * Root-finding tries `process.cwd()` first, then this module's own
 * on-disk location as a fallback. cwd reflects wherever the shell actually
 * invoked the process *right now* — pnpm's workspace linking uses NTFS
 * junctions on Windows, and a junction always bakes in an absolute target
 * path at creation time, not a relative one. Move the whole repo tree
 * without reinstalling and every junction under node_modules still points
 * at the *old* location; resolving purely from this file's own
 * import.meta.url (which Node/tsx follow through that junction) walks up
 * from the stale target and can find a leftover pnpm-workspace.yaml (and
 * .env) sitting at the pre-move path instead of silently failing — which
 * looks exactly like "loadRootEnvFile() runs but finds nothing new," since
 * every var it reads is real, just from the wrong copy. cwd never goes
 * through that indirection at all.
 *
 * No-ops (after warning) if neither starting point finds a
 * pnpm-workspace.yaml above it (e.g. in CI, where env vars are injected
 * directly, or this genuinely isn't running inside a monorepo checkout) —
 * dotenv's own `config()` doesn't throw on a missing file, so there's
 * nothing to guard for that case specifically.
 *
 * Passes `override: true` to dotenv — deliberately, and not the default.
 * dotenv's default only fills in a key if it's *entirely absent* from
 * process.env; a key that's already present with an empty string (a stray
 * Windows user/system environment variable set once and forgotten, a
 * leftover from a previous terminal session, a shell profile that exports
 * blank placeholders) counts as "already present" and silently blocks the
 * file's real value forever — with no error, and dotenv's own returned
 * `.parsed` object still lists the key as if it had been applied, since
 * `.parsed` reflects what the *file* contained, not what actually reached
 * process.env. That combination is exactly what makes this failure mode so
 * hard to spot: the file is read correctly, logging based on `.parsed`
 * says success, and the values still never take effect. override:true
 * makes the file authoritative for local dev, which is this loader's
 * entire purpose — a real hosting/CI-injected environment doesn't usually
 * ship a `.env` file alongside it at all (it's git-ignored), so there's
 * nothing for override to clobber in that case.
 */
export function loadRootEnvFile(): void {
  if (loaded) return;
  loaded = true;

  const root = findRepoRoot(process.cwd()) ?? findRepoRoot(dirname(fileURLToPath(import.meta.url)));
  if (!root) {
    console.warn(
      "[@emp/config] Could not find pnpm-workspace.yaml above either the current working directory " +
        `(${process.cwd()}) or this package's own location — no root .env loaded. If you moved or ` +
        "cloned the repo somewhere new, this is harmless as long as real env vars are already set " +
        "(hosting/CI-injected); otherwise every chain and required var will read as unset.",
    );
    return;
  }

  const envPath = join(root, ".env");
  const result = applyDotenvFile({ path: envPath, override: true });
  if (result.error) {
    console.warn(`[@emp/config] Found repo root at ${root} but could not read ${envPath}:`, result.error);
    return;
  }

  const keyCount = Object.keys(result.parsed ?? {}).length;
  console.log(`[@emp/config] Loaded ${keyCount} environment variable(s) from ${envPath}`);
}

export function resetRootEnvLoadedForTests(): void {
  loaded = false;
}
