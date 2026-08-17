import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  SESSION_SECRET: z.string().min(32),
  SIWE_DOMAIN: z.string().min(1),
  SIWE_URI: z.string().url(),
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

  REDIRECT_BASE_URL: z.string().url(),
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
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(
      `Invalid or missing environment variables:\n${issues}\n\n` +
        `Copy .env.example to .env.local (or .env) and fill in every required value, then restart the dev server.`,
    );
  }
  cached = result.data;
  return cached;
}

export function resetEnvCacheForTests(): void {
  cached = undefined;
}
