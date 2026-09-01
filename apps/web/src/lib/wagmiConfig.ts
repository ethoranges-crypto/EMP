import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { arbitrum, base, mainnet, optimism } from "wagmi/chains";

/**
 * Client-side chain list for wallet connect/signing only — no RPC secrets
 * here (those live server-side in @emp/config, sourced from env). Public
 * default RPCs are fine for a wallet's own connectivity; EMP's own reads
 * (Safe ownership, payment watching) always go through the server.
 */
export const wagmiConfig: ReturnType<typeof getDefaultConfig> = getDefaultConfig({
  appName: "EMP",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "emp-dev-placeholder",
  chains: [mainnet, arbitrum, optimism, base],
  ssr: true,
});

/** Matches packages/config's CHAIN_DEFINITIONS keys — used for the Safe "which chain" selector. */
export const SAFE_CHAIN_OPTIONS = [
  { key: "ETHEREUM", label: "Ethereum" },
  { key: "ARBITRUM", label: "Arbitrum" },
  { key: "OPTIMISM", label: "Optimism" },
  { key: "BASE", label: "Base" },
] as const;

const CHAIN_ID_TO_KEY: Record<number, (typeof SAFE_CHAIN_OPTIONS)[number]["key"]> = {
  [mainnet.id]: "ETHEREUM",
  [arbitrum.id]: "ARBITRUM",
  [optimism.id]: "OPTIMISM",
  [base.id]: "BASE",
};

/**
 * Maps the wallet's actually-connected chain to a Safe-chain-selector
 * default, so the dropdown doesn't silently default to Ethereum regardless
 * of what network the wallet is on. Falls back to Ethereum only when the
 * connected chain isn't one we support a Safe check for at all.
 */
export function chainKeyForChainId(chainId: number | undefined): (typeof SAFE_CHAIN_OPTIONS)[number]["key"] {
  return (chainId !== undefined && CHAIN_ID_TO_KEY[chainId]) || SAFE_CHAIN_OPTIONS[0].key;
}
