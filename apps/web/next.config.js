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

// Prisma's query engine binary (libquery_engine-<platform>.so.node) is
// loaded via a path Prisma's own runtime constructs by string-concatenating
// the detected platform at RUNTIME (confirmed by inspecting the actual
// compiled output: the bundled Prisma runtime code lists every possible
// libquery_engine-*.so.node filename as a plain string literal, never a
// single static `require(...)` call). Next's file-tracer (@vercel/nft, what
// Vercel's own packaging reads to decide what ships in each serverless
// function) only follows static require/import graphs — it can never
// correctly infer which one of ~15 possible binary filenames a given route
// needs, so by default it traces none of them. Confirmed empirically: with
// this stanza absent, `.next/server/app/api/auth/siwe/verify/route.js.nft.json`
// lists zero files under node_modules/.prisma or node_modules/.pnpm/*prisma*
// — the engine simply never gets into the deployed bundle, and Vercel throws
// "could not locate the Query Engine for runtime rhel-openssl-3.0.x" the
// moment that route's first query runs. outputFileTracingIncludes forces the
// engine's whole directory into the routes that actually touch the
// database, regardless of what nft's static analysis concludes.
//
// Two things this deliberately avoids, both of which OOM'd a real build
// attempt here before landing on this shape:
//  1. Keying on "/**" (every route) instead of just the DB-touching ones.
//     Confirmed by grep that no page component imports @emp/db directly —
//     only route.ts handlers under app/api/** and app/r/[token] do — so
//     every other route gets nothing to trace here, at zero correctness
//     cost.
//  2. A "**" in the MIDDLE of the glob (.pnpm/**/.../.prisma/client) forces
//     nft to walk every directory in the whole pnpm virtual store — which,
//     with wagmi/viem/rainbowkit's dependency tree, is thousands of
//     directories, once per matching route. Anchoring the wildcard to a
//     single path segment right after .pnpm/ (@prisma+client@*) matches the
//     same directory without that walk.
//
// Paths are computed relative to this app's own directory (where this file
// lives) rather than hardcoded ("../../...") so this keeps working if the
// monorepo's nesting depth ever changes; repoRoot is the same
// pnpm-workspace.yaml-anchored value already computed above for .env
// loading, so there's no second root-finding mechanism to keep in sync.
const repoRootRelative = repoRoot ? path.relative(__dirname, repoRoot).split(path.sep).join("/") || "." : undefined;
const prismaEngineTraceGlobs = repoRootRelative
  ? [
      `${repoRootRelative}/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/**`,
      `${repoRootRelative}/node_modules/.prisma/client/**`,
    ]
  : undefined;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@emp/config", "@emp/core", "@emp/db"],
  // Also anchors Next's own trace root at the monorepo root (matches
  // repoRoot above) rather than letting it infer one — standard guidance for
  // a pnpm/turbo monorepo deployed to Vercel, and avoids Next's own
  // "inferred workspace root" warning. Doesn't by itself fix the engine
  // binary issue above (confirmed: even with tracing correctly reaching
  // hoisted packages under node_modules/.pnpm, the engine still wasn't
  // traced — the dynamic-path problem is separate from where the trace
  // root sits), but it's correct monorepo hygiene regardless.
  ...(repoRoot ? { outputFileTracingRoot: repoRoot } : {}),
  ...(prismaEngineTraceGlobs
    ? {
        experimental: {
          outputFileTracingIncludes: {
            "/api/**": prismaEngineTraceGlobs,
            "/r/**": prismaEngineTraceGlobs,
          },
        },
      }
    : {}),
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
