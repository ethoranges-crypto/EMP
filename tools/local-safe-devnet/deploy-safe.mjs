#!/usr/bin/env node
/**
 * Deploys a real Gnosis Safe (official v1.4.1 bytecode, straight from the
 * @safe-global/safe-contracts npm package's precompiled artifacts — no
 * compilation happens here) to a local Hardhat devnet, owned by a
 * well-known test private key. Prints a ready-to-paste .env.local block.
 *
 * Exists because this tool's normal dev/CI environment can't reach any
 * public chain RPC (egress policy), so the Safe-owner SIWE path
 * (packages/core/src/safe/verifyOwner.ts, exercised via
 * POST /api/auth/siwe/verify) has nothing to run a real on-chain
 * getOwners() read against unless one is deployed somewhere reachable.
 * A local devnet is real EVM execution and real contract storage — just
 * not a public testnet.
 *
 * Usage:
 *   pnpm --filter @emp/local-safe-devnet run devnet   # separate terminal, leave running
 *   pnpm --filter @emp/local-safe-devnet run deploy
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http, decodeEventLog, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const require = createRequire(import.meta.url);

const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";

// Hardhat's account #0 — a well-known, publicly-documented test key that
// ships with every `hardhat node`. Never holds anything but devnet ETH.
const DEPLOYER_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// Fixed test-only owner key for this tool specifically, so the same
// address shows up in this file, the README, and anyone's .env.local —
// never use this key for anything real, its private key is public in git history.
export const TEST_OWNER_PRIVATE_KEY = "0x7c4b1adf97d44497324234c0a303c5b3743e62431935773330e93cea8fe2062d";

async function main() {
  const safeArtifact = JSON.parse(
    readFileSync(require.resolve("@safe-global/safe-contracts/build/artifacts/contracts/Safe.sol/Safe.json"), "utf8"),
  );
  const factoryArtifact = JSON.parse(
    readFileSync(
      require.resolve("@safe-global/safe-contracts/build/artifacts/contracts/proxies/SafeProxyFactory.sol/SafeProxyFactory.json"),
      "utf8",
    ),
  );

  const deployer = privateKeyToAccount(DEPLOYER_PK);
  const owner = privateKeyToAccount(TEST_OWNER_PRIVATE_KEY);
  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account: deployer, transport: http(RPC_URL) });

  console.log(`RPC: ${RPC_URL}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Test owner: ${owner.address}\n`);

  const singletonHash = await walletClient.deployContract({ abi: safeArtifact.abi, bytecode: safeArtifact.bytecode });
  const singletonReceipt = await publicClient.waitForTransactionReceipt({ hash: singletonHash });
  const singletonAddress = singletonReceipt.contractAddress;
  console.log(`Safe singleton (v1.4.1):  ${singletonAddress}`);

  const factoryHash = await walletClient.deployContract({ abi: factoryArtifact.abi, bytecode: factoryArtifact.bytecode });
  const factoryReceipt = await publicClient.waitForTransactionReceipt({ hash: factoryHash });
  const factoryAddress = factoryReceipt.contractAddress;
  console.log(`SafeProxyFactory:         ${factoryAddress}`);

  const setupData = encodeFunctionData({
    abi: safeArtifact.abi,
    functionName: "setup",
    args: [
      [owner.address], // owners
      1n, // threshold
      "0x0000000000000000000000000000000000000000", // to
      "0x", // data
      "0x0000000000000000000000000000000000000000", // fallbackHandler
      "0x0000000000000000000000000000000000000000", // paymentToken
      0n, // payment
      "0x0000000000000000000000000000000000000000", // paymentReceiver
    ],
  });

  const createHash = await walletClient.writeContract({
    address: factoryAddress,
    abi: factoryArtifact.abi,
    functionName: "createProxyWithNonce",
    args: [singletonAddress, setupData, 0n],
  });
  const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });

  let safeAddress;
  for (const log of createReceipt.logs) {
    try {
      const decoded = decodeEventLog({ abi: factoryArtifact.abi, data: log.data, topics: log.topics });
      if (decoded.eventName === "ProxyCreation") {
        safeAddress = decoded.args.proxy;
        break;
      }
    } catch {
      // not the ProxyCreation log, ignore
    }
  }
  if (!safeAddress) throw new Error("ProxyCreation event not found in the createProxyWithNonce receipt");
  console.log(`Safe proxy:               ${safeAddress}`);

  // Real on-chain read — the exact call packages/core's isSafeOwner() makes.
  const owners = await publicClient.readContract({ address: safeAddress, abi: safeArtifact.abi, functionName: "getOwners" });
  console.log(`\nOn-chain getOwners():     [${owners.join(", ")}]`);
  if (owners.length !== 1 || owners[0].toLowerCase() !== owner.address.toLowerCase()) {
    throw new Error("Deployed Safe's on-chain owners don't match the expected test owner — deployment is broken");
  }

  console.log("\n--- paste into apps/web/.env.local ---");
  console.log(`ETHEREUM_RPC_URL=${RPC_URL}`);
  console.log(`ETHEREUM_TREASURY_ADDRESS=${deployer.address}`);
  console.log("---------------------------------------\n");
  console.log(`Safe address to sign in with: ${safeAddress}`);
  console.log(`Owner private key (test-only, import into any wallet pointed at ${RPC_URL}): ${TEST_OWNER_PRIVATE_KEY}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
