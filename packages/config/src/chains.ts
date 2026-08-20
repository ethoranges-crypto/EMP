import { z } from "zod";
import { loadRootEnvFile } from "./rootEnv.js";

export type TokenSymbol = "USDC" | "USDT" | "ETH";

export interface ChainConfig {
  /** Internal key, also used as the env-var prefix. */
  key: string;
  displayName: string;
  chainId: number;
  rpcUrl: string;
  /** Native asset (ETH) has no contract address — omitted from this map. */
  tokenAddresses: Partial<Record<Exclude<TokenSymbol, "ETH">, `0x${string}`>>;
}

export interface ChainDefinition {
  key: string;
  displayName: string;
  chainId: number;
}

/**
 * Adding an EVM chain is: one entry here + its *_RPC_URL / *_USDC_ADDRESS /
 * *_USDT_ADDRESS env vars, then (separately) an admin sets its treasury
 * address in the admin settings UI (DB-backed — see @emp/core's
 * getPayableChains). No other code changes (CLAUDE.md rule 5 — config-driven
 * chains).
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

/** Validated separately from env.ts's envSchema — see the comment there for why. */
const chainEnvSchema = z.object({
  rpcUrl: z.string().url().optional(),
  usdcAddress: z.string().optional(),
  usdtAddress: z.string().optional(),
});

let cached: ChainConfig[] | undefined;

/**
 * Returns only chains with an RPC URL configured (env). Treasury address is
 * NOT part of this — it's admin-configurable via the DB, see @emp/core's
 * getPayableChains, which is what actually decides which chains a protocol
 * can pay on (RPC here AND a treasury row there).
 *
 * A chain definition with no/invalid env vars (e.g. Robinhood pre-launch, or
 * a malformed RPC URL) is simply absent from the list rather than causing a
 * boot failure — a single bad chain's config must never take down every
 * route that calls this (see the *_RPC_URL malformed-value case that used to
 * throw here and surface as a bare 500 in /api/protocol/chains).
 */
export function getChains(env: NodeJS.ProcessEnv = process.env): ChainConfig[] {
  if (cached) return cached;
  if (env === process.env) loadRootEnvFile();

  cached = CHAIN_DEFINITIONS.flatMap((def): ChainConfig[] => {
    const result = chainEnvSchema.safeParse({
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

    return [
      {
        key: def.key,
        displayName: def.displayName,
        chainId: def.chainId,
        rpcUrl: parsed.rpcUrl,
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

export function resetChainsCacheForTests(): void {
  cached = undefined;
}
