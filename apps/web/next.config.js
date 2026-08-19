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

const repoRoot = findRepoRoot(__dirname);
if (repoRoot) {
  dotenv.config({ path: path.join(repoRoot, ".env") });
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
