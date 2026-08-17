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
