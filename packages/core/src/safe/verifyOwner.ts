import { createPublicClient, getAddress, http, type Hex } from "viem";

/** Minimal Gnosis Safe ABI — just the two reads/verifications MVP auth needs. */
const SAFE_ABI = [
  {
    type: "function",
    name: "getOwners",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }],
  },
  {
    type: "function",
    name: "isValidSignature",
    stateMutability: "view",
    inputs: [
      { name: "_dataHash", type: "bytes32" },
      { name: "_signature", type: "bytes" },
    ],
    outputs: [{ type: "bytes4" }],
  },
] as const;

/** EIP-1271 magic value returned by a valid isValidSignature call. */
const EIP1271_MAGIC_VALUE = "0x1626ba7e";

export interface VerifySafeOwnerParams {
  safeAddress: string;
  ownerAddress: string;
  rpcUrl: string;
}

/**
 * Primary Safe verification path (CLAUDE.md Auth): after the owner signs
 * SIWE, confirm on-chain that ownerAddress is actually a member of the
 * named Safe's owner set.
 */
export async function isSafeOwner(params: VerifySafeOwnerParams): Promise<boolean> {
  const client = createPublicClient({ transport: http(params.rpcUrl) });
  const owners = await client.readContract({
    address: params.safeAddress as `0x${string}`,
    abi: SAFE_ABI,
    functionName: "getOwners",
  });
  const target = getAddress(params.ownerAddress);
  return owners.some((owner) => getAddress(owner) === target);
}

export interface VerifyEip1271SignatureParams {
  safeAddress: string;
  rpcUrl: string;
  messageHash: Hex;
  signature: Hex;
}

/** Fallback path when owner-membership isn't sufficient on its own (e.g. Safe uses a signing module). */
export async function isValidEip1271Signature(params: VerifyEip1271SignatureParams): Promise<boolean> {
  const client = createPublicClient({ transport: http(params.rpcUrl) });
  const result = await client.readContract({
    address: params.safeAddress as `0x${string}`,
    abi: SAFE_ABI,
    functionName: "isValidSignature",
    args: [params.messageHash, params.signature],
  });
  return result === EIP1271_MAGIC_VALUE;
}
