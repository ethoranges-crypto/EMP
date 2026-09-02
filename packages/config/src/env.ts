import { z } from "zod";
import { loadRootEnvFile } from "./rootEnv.js";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  SESSION_SECRET: z.string().min(32),
  ADMIN_WALLETS: z
    .string()
    .default("")
    .transform((v) =>
      v
        .split(",")
        .map((a) => a.trim().toLowerCase())
        .filter(Boolean),
    ),

  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_BOT_USERNAME: z.string().min(1),

  RELINK_COOLDOWN_DAYS: z.coerce.number().int().positive().default(30),

  PAYMENT_WINDOW_MINUTES: z.coerce.number().int().positive().default(60),

  // --- Payment-watch RPC tuning (free-tier-friendly by default) ---
  // How often the worker polls each payable chain. Detection lands within
  // one tick of the payment actually clearing, so this directly trades
  // detection latency for RPC call volume — 90s keeps that under ~2 minutes
  // while comfortably clearing Infura's free tier (see
  // evmTreasuryWatcher.ts's per-tick call-volume doc comment).
  PAYMENT_WATCH_POLL_SECONDS: z.coerce.number().int().positive().default(90),
  // Caps two different things with one number: (1) the scan window on a
  // chain's very first tick, before any ChainScanCursor row exists, and (2)
  // the worst-case catch-up window after the worker's been down a while —
  // without this cap, a long outage would try to eth_getLogs the entire gap
  // in one call. 300 blocks is ~1hr on Ethereum mainnet (comfortably inside
  // Infura's per-call log-range limits); every tick after the first only
  // ever scans the small delta since the last tick, never this whole window.
  PAYMENT_WATCH_MAX_LOOKBACK_BLOCKS: z.coerce.number().int().positive().default(300),
  // Retry tuning for the RPC transport's built-in 429/5xx backoff (viem's
  // http() retries these automatically — see evmTreasuryWatcher.ts). The
  // defaults here are deliberately more patient than viem's own library
  // defaults (retryCount 3 / retryDelay 150ms): a burst of 429s from a
  // free-tier provider often needs several seconds to clear, not
  // milliseconds.
  PAYMENT_WATCH_RPC_RETRY_COUNT: z.coerce.number().int().nonnegative().default(5),
  PAYMENT_WATCH_RPC_RETRY_DELAY_MS: z.coerce.number().int().positive().default(1000),
  // Off by default: scanning for native-asset (ETH) transfers to the
  // treasury means fetching every block body in range with its full
  // transaction list (eth_getBlockByNumber with `true`) — by far the
  // heaviest call this watcher can make, and ETH isn't even an accepted
  // payment token (SPEC §6). Its only purpose is a WRONG_TOKEN diagnostic
  // if a protocol sends ETH by mistake; flip this on only if that
  // diagnostic is worth the extra RPC volume on your plan.
  PAYMENT_WATCH_SCAN_NATIVE_TRANSFERS: z
    .string()
    .optional()
    .default("false")
    .transform((v) => v === "true"),

  REDIRECT_BASE_URL: z.string().url(),

  // Optional — not REDIRECT_BASE_URL (that's specifically the /r/:token
  // click-redirect prefix). Lets apps/bot's link-confirmation message
  // include a tappable link back to the site; if unset, the bot just says
  // "head back to the EMP site" without a link rather than failing to
  // start. See apps/bot/src/handlers/start.ts.
  WEB_BASE_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Parses and validates process.env once per process. Throws on missing/malformed
 * required vars — fail fast at boot rather than surfacing a secrets bug at runtime.
 *
 * Deliberately does NOT include the per-chain vars (*_RPC_URL etc.) — those
 * are read and validated separately in chains.ts. Folding a dynamically-keyed
 * chain shape into this schema via `.extend()` would give the whole object
 * an implicit index signature, which silently widens every field here
 * (including required ones like TELEGRAM_BOT_TOKEN) to `T | undefined`.
 *
 * Every route that touches this app's own data calls loadEnv() — not just
 * the routes that use a given field — so a single blank var (e.g.
 * TELEGRAM_BOT_TOKEN in a fresh .env.local) breaks unrelated pages too. The
 * error thrown here is deliberately actionable (names every failing var and
 * points at .env.example), not a raw ZodError, since letting that surface
 * as an unhandled 500 leaves no clue it's a config problem at all.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  // Only when reading the real process env (not a test's explicit fixture
  // object) — see rootEnv.ts for why this is the one place every
  // app/package's config comes from.
  if (source === process.env) loadRootEnvFile();
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(
      `Invalid or missing environment variables:\n${issues}\n\n` +
        `Copy .env.example to .env at the repo root and fill in every required value, then restart.`,
    );
  }
  cached = result.data;
  return cached;
}

export function resetEnvCacheForTests(): void {
  cached = undefined;
}
