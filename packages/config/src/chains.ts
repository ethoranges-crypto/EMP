import { z } from "zod";
import { loadRootEnvFile } from "./rootEnv.js";

export type TokenSymbol = "USDC" | "USDT" | "ETH";

export interface ChainConfig {
  /** Internal key, also used as the env-var prefix. */
  key: string;
  displayName: string;
  chainId: number;
  rpcUrl: string;
  /**
   * Where protocols pay EMP on this chain — env-only (`{KEY}_TREASURY_ADDRESS`),
   * deliberately NOT admin/DB-configurable: it's the highest-value config in
   * the system (redirect it and every protocol payment reroutes), so changing
   * it requires server/deploy access, not just an admin session. Undefined
   * until set, or if set to something that isn't a well-formed address (see
   * getChains's own handling) — either way the chain just isn't payable yet,
   * see getPayableChains.
   */
  treasuryAddress?: `0x${string}`;
  /** Native asset (ETH) has no contract address — omitted from this map. */
  tokenAddresses: Partial<Record<Exclude<TokenSymbol, "ETH">, `0x${string}`>>;
}

export interface PayableChainConfig extends ChainConfig {
  treasuryAddress: `0x${string}`;
}

export interface ChainDefinition {
  key: string;
  displayName: string;
  chainId: number;
}

/**
 * Adding an EVM chain is: one entry here + its *_RPC_URL / *_USDC_ADDRESS /
 * *_USDT_ADDRESS / *_TREASURY_ADDRESS env vars. No other code changes
 * (CLAUDE.md rule 5 — config-driven chains).
 */
const CHAIN_DEFINITIONS: ChainDefinition[] = [
  { key: "ETHEREUM", displayName: "Ethereum", chainId: 1 },
  { key: "ARBITRUM", displayName: "Arbitrum", chainId: 42161 },
  { key: "OPTIMISM", displayName: "Optimism", chainId: 10 },
  { key: "BASE", displayName: "Base", chainId: 8453 },
  // Robinhood chain: forthcoming — chainId is a placeholder until confirmed.
  // A chain only activates once its RPC env var is set, so this entry is
  // inert until then.
  { key: "ROBINHOOD", displayName: "Robinhood", chainId: 0 },
];

/** All known chains (key/displayName only, no secrets) — for admin UI, independent of which are currently env-configured. */
export function listChainDefinitions(): ChainDefinition[] {
  return CHAIN_DEFINITIONS.map((d) => ({ ...d }));
}

// An explicitly-blank env var (`KEY=` with nothing after the `=`) means the
// same thing as the key being entirely absent — dotenv/most hosting
// providers don't distinguish "unset" from "set to empty string", and
// .env.example ships every chain's vars blank by default. Without this,
// z.string().url().optional() rejects "" (it's a defined string, just not a
// valid URL), so every chain the operator hasn't configured yet logs a scary
// "invalid env config" error instead of being silently skipped like an
// actually-unset var.
const blankToUndefined = (v: unknown): unknown => (v === "" ? undefined : v);

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/** Validated separately from env.ts's envSchema — see the comment there for why. */
const chainConnectionSchema = z.object({
  rpcUrl: z.preprocess(blankToUndefined, z.string().url().optional()),
  usdcAddress: z.preprocess(blankToUndefined, z.string().optional()),
  usdtAddress: z.preprocess(blankToUndefined, z.string().optional()),
});

const treasuryAddressSchema = z.preprocess(
  blankToUndefined,
  z.string().regex(EVM_ADDRESS_RE, "must be a 0x-prefixed 40-hex-character address").optional(),
);

let cached: ChainConfig[] | undefined;

/**
 * Returns chains with an RPC URL configured (env) — this is what makes a
 * chain exist at all for anything that needs to talk to it (SIWE's Safe
 * ownership check, the payment watcher). A chain is additionally *payable*
 * only once it also has a treasury address (see getPayableChains) — both
 * come from env, but a malformed/missing treasury never takes down the
 * chain's RPC availability, only its payability.
 *
 * A chain definition with no/invalid RPC env (e.g. Robinhood pre-launch, or
 * a malformed URL) is simply absent from the list rather than causing a
 * boot failure — a single bad chain's config must never take down every
 * route that calls this (see the *_RPC_URL malformed-value case that used to
 * throw here and surface as a bare 500 in /api/protocol/chains). Likewise, a
 * malformed *_TREASURY_ADDRESS logs its own warning and is dropped on its
 * own — it doesn't invalidate the chain's rpcUrl/token addresses.
 */
export function getChains(env: NodeJS.ProcessEnv = process.env): ChainConfig[] {
  if (cached) return cached;
  if (env === process.env) loadRootEnvFile();

  cached = CHAIN_DEFINITIONS.flatMap((def): ChainConfig[] => {
    const result = chainConnectionSchema.safeParse({
      rpcUrl: env[`${def.key}_RPC_URL`],
      usdcAddress: env[`${def.key}_USDC_ADDRESS`],
      usdtAddress: env[`${def.key}_USDT_ADDRESS`],
    });

    if (!result.success) {
      console.error(`[@emp/config] Ignoring chain "${def.key}" — invalid env config:`, result.error.issues);
      return [];
    }

    const parsed = result.data;
    if (!parsed.rpcUrl) return [];

    const treasuryResult = treasuryAddressSchema.safeParse(env[`${def.key}_TREASURY_ADDRESS`]);
    if (!treasuryResult.success) {
      console.error(
        `[@emp/config] Ignoring "${def.key}" treasury address — invalid env config:`,
        treasuryResult.error.issues,
      );
    }
    const treasuryAddress = treasuryResult.success ? (treasuryResult.data as `0x${string}` | undefined) : undefined;

    return [
      {
        key: def.key,
        displayName: def.displayName,
        chainId: def.chainId,
        rpcUrl: parsed.rpcUrl,
        treasuryAddress,
        tokenAddresses: {
          ...(parsed.usdcAddress ? { USDC: parsed.usdcAddress as `0x${string}` } : {}),
          ...(parsed.usdtAddress ? { USDT: parsed.usdtAddress as `0x${string}` } : {}),
        },
      },
    ];
  });

  return cached;
}

export function getChain(key: string, env?: NodeJS.ProcessEnv): ChainConfig | undefined {
  return getChains(env).find((c) => c.key === key);
}

/**
 * Chains EMP can actually receive payment on right now: RPC-configured AND
 * treasury-configured, both from env (see ChainConfig's treasuryAddress doc
 * comment for why treasury is env-only, not admin/DB-configurable). This is
 * the single source of truth both the payment-watching worker and the
 * protocol-facing Pay panel read from — no separate DB copy that can drift.
 */
export function getPayableChains(env?: NodeJS.ProcessEnv): PayableChainConfig[] {
  return getChains(env).flatMap((chain): PayableChainConfig[] =>
    chain.treasuryAddress ? [{ ...chain, treasuryAddress: chain.treasuryAddress }] : [],
  );
}

export function resetChainsCacheForTests(): void {
  cached = undefined;
}
