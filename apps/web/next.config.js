const { existsSync } = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

// Next.js only auto-loads .env files from this app's own directory, but the
// monorepo's settings live in one file at the repo root (see
// packages/config/src/rootEnv.ts, which does the same thing for every
// server-side app/package). next.config.js runs before Next transpiles
// workspace TS packages, so it can't import that module directly — this is
// the one place the same root-finding logic is duplicated in plain JS.
// Populating process.env here, before Next's own build/dev pipeline starts,
// is what makes NEXT_PUBLIC_* vars from the root file reach the client
// bundle (Next inlines any NEXT_PUBLIC_-prefixed var already in process.env
// at build time).
function findRepoRoot(startDir) {
  let dir = startDir;
  for (;;) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

// Prefer cwd (where Next was actually invoked from right now) over
// __dirname, same reasoning as packages/config/src/rootEnv.ts — __dirname
// happens to be safe here too (this file isn't reached through any
// node_modules symlink/junction, it's part of the app itself), but trying
// cwd first keeps this consistent with that module and with how a repo
// move is diagnosed.
// override: true — see packages/config/src/rootEnv.ts's doc comment for
// why: dotenv's default silently leaves an already-present (even blank)
// process.env key untouched, which is exactly how a stray Windows
// user/system env var or leftover shell export can make this file's real
// value never take effect with no error at all.
const repoRoot = findRepoRoot(process.cwd()) ?? findRepoRoot(__dirname);
if (repoRoot) {
  const envPath = path.join(repoRoot, ".env");
  const result = dotenv.config({ path: envPath, override: true });
  if (result.error) {
    console.warn(`[next.config.js] Found repo root at ${repoRoot} but could not read ${envPath}:`, result.error);
  } else {
    console.log(`[next.config.js] Loaded ${Object.keys(result.parsed ?? {}).length} environment variable(s) from ${envPath}`);
  }
} else {
  console.warn(
    `[next.config.js] Could not find pnpm-workspace.yaml above cwd (${process.cwd()}) or ${__dirname} — no root .env loaded.`,
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@emp/config", "@emp/core", "@emp/db"],
  webpack: (config, { webpack }) => {
    // Workspace packages use explicit .js import extensions (Node ESM
    // convention, needed so tsx/vitest can run their TS source directly).
    // webpack's resolver doesn't map those to .ts files on its own.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    // RainbowKit's default wallet list pulls in wagmi's Coinbase
    // `baseAccount` connector, which imports @coinbase/cdp-sdk's x402
    // payment-protocol support — optional subpaths (@x402/evm, @x402/core,
    // ...) that aren't installed and aren't used by anything EMP does
    // (wallet connect + SIWE signing only). Ignoring them is an upstream
    // packaging gap in that dependency chain, not something in this repo.
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^@x402\// }));
    return config;
  },
};

module.exports = nextConfig;
