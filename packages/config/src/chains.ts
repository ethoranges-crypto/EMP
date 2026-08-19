import { z } from "zod";
import { loadRootEnvFile } from "./rootEnv.js";

export type TokenSymbol = "USDC" | "USDT" | "ETH";

export interface ChainConfig {
  /** Internal key, also used as the env-var prefix. */
  key: string;
  displayName: string;
  chainId: number;
  rpcUrl: string;
  treasuryAddress: `0x${string}`;
  /** Native asset (ETH) has no contract address — omitted from this map. */
  tokenAddresses: Partial<Record<Exclude<TokenSymbol, "ETH">, `0x${string}`>>;
}

interface ChainDefinition {
  key: string;
  displayName: string;
  chainId: number;
}

/**
 * Adding an EVM chain is: one entry here + its *_RPC_URL / *_TREASURY_ADDRESS
 * / *_USDC_ADDRESS / *_USDT_ADDRESS env vars. No other code changes
 * (CLAUDE.md rule 5 — config-driven chains).
 */
const CHAIN_DEFINITIONS: ChainDefinition[] = [
  { key: "ETHEREUM", displayName: "Ethereum", chainId: 1 },
  { key: "ARBITRUM", displayName: "Arbitrum", chainId: 42161 },
  { key: "OPTIMISM", displayName: "Optimism", chainId: 10 },
  { key: "BASE", displayName: "Base", chainId: 8453 },
  // Robinhood chain: forthcoming — chainId is a placeholder until confirmed.
  // A chain only activates once its RPC + treasury env vars are set, so
  // this entry is inert until then.
  { key: "ROBINHOOD", displayName: "Robinhood", chainId: 0 },
];

/** Validated separately from env.ts's envSchema — see the comment there for why. */
const chainEnvSchema = z.object({
  rpcUrl: z.string().url().optional(),
  treasuryAddress: z.string().optional(),
  usdcAddress: z.string().optional(),
  usdtAddress: z.string().optional(),
});

let cached: ChainConfig[] | undefined;

/**
 * Returns only chains with both an RPC URL and a treasury address configured.
 * A chain definition with no env vars set (e.g. Robinhood pre-launch) is
 * simply absent from the list rather than causing a boot failure.
 */
export function getChains(env: NodeJS.ProcessEnv = process.env): ChainConfig[] {
  if (cached) return cached;
  if (env === process.env) loadRootEnvFile();

  cached = CHAIN_DEFINITIONS.flatMap((def): ChainConfig[] => {
    const parsed = chainEnvSchema.parse({
      rpcUrl: env[`${def.key}_RPC_URL`],
      treasuryAddress: env[`${def.key}_TREASURY_ADDRESS`],
      usdcAddress: env[`${def.key}_USDC_ADDRESS`],
      usdtAddress: env[`${def.key}_USDT_ADDRESS`],
    });

    if (!parsed.rpcUrl || !parsed.treasuryAddress) return [];

    return [
      {
        key: def.key,
        displayName: def.displayName,
        chainId: def.chainId,
        rpcUrl: parsed.rpcUrl,
        treasuryAddress: parsed.treasuryAddress as `0x${string}`,
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
