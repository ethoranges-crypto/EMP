import { getChains, type ChainConfig } from "@emp/config";

/** A chain with an admin-set treasury address (DB), keyed by chain key. */
export interface TreasuryConfigPort {
  listTreasuryAddresses(): Promise<Record<string, string>>;
  setTreasuryAddress(chainKey: string, treasuryAddress: string): Promise<void>;
}

export interface PayableChain extends ChainConfig {
  treasuryAddress: `0x${string}`;
}

export class InvalidTreasuryChainError extends Error {
  constructor(chain: string) {
    super(`"${chain}" isn't a chain EMP knows about.`);
    this.name = "InvalidTreasuryChainError";
  }
}

export class InvalidTreasuryAddressError extends Error {
  constructor(address: string) {
    super(`"${address}" isn't a valid EVM address.`);
    this.name = "InvalidTreasuryAddressError";
  }
}

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/**
 * SPEC §6 / CLAUDE.md Payments: "one EMP treasury address per chain",
 * admin-configurable (not env — contrast with rpcUrl, which stays env-only
 * since it can embed a provider secret). Chains EMP can actually receive
 * payment on are RPC-configured (env, @emp/config's getChains) AND
 * treasury-configured (DB, this module) — both, not either.
 */
export async function getPayableChains(port: TreasuryConfigPort): Promise<PayableChain[]> {
  const treasuries = await port.listTreasuryAddresses();
  return getChains().flatMap((chain): PayableChain[] => {
    const treasuryAddress = treasuries[chain.key];
    if (!treasuryAddress) return [];
    return [{ ...chain, treasuryAddress: treasuryAddress as `0x${string}` }];
  });
}

export interface SetChainTreasuryAddressParams {
  chainKey: string;
  treasuryAddress: string;
  /** Every chain key EMP knows about (@emp/config's listChainDefinitions), independent of whether its RPC is currently configured. */
  validChainKeys: string[];
}

export async function setChainTreasuryAddress(
  port: TreasuryConfigPort,
  params: SetChainTreasuryAddressParams,
): Promise<void> {
  if (!params.validChainKeys.includes(params.chainKey)) throw new InvalidTreasuryChainError(params.chainKey);
  if (!EVM_ADDRESS_RE.test(params.treasuryAddress)) throw new InvalidTreasuryAddressError(params.treasuryAddress);
  await port.setTreasuryAddress(params.chainKey, params.treasuryAddress);
}
