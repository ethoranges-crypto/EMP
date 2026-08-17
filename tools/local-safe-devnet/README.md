# @emp/local-safe-devnet

Deploys a real Gnosis Safe (official v1.4.1 bytecode) to a local Hardhat EVM,
so `apps/web`'s Safe-owner SIWE path (`packages/core/src/safe/verifyOwner.ts`)
has something real to run its on-chain `getOwners()` read against.

Not a mock: this is genuine EVM execution against real, unmodified Safe
contract bytecode (pulled straight from the `@safe-global/safe-contracts`
npm package's precompiled artifacts — nothing here compiles Solidity). It's
just a local chain instead of a public testnet.

## Usage

```bash
# terminal 1 — leave running
pnpm --filter @emp/local-safe-devnet run devnet

# terminal 2
pnpm --filter @emp/local-safe-devnet run deploy
```

The deploy script prints the values to drop into `apps/web/.env.local`:

```
ETHEREUM_RPC_URL=http://127.0.0.1:8545
ETHEREUM_TREASURY_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

...plus the deployed Safe's address and a test-only owner private key. To
sign in as that Safe's owner through the real browser UI (not just via a
script), import that private key into any wallet extension pointed at
`http://127.0.0.1:8545` (chain ID `31337`).

## Why deterministic keys, not generated ones

The deployer (`Hardhat account #0`) and the test owner are both fixed,
publicly-known test keys — never anything holding real funds. That's
deliberate: it means the same commands, run again after any change to
`verifyOwner.ts` or the SIWE verify route, exercise the same owner address
every time, without you having to copy a freshly-generated key out of a log
each run. The deployed Safe's own address will still vary run-to-run unless
the devnet is freshly restarted first (it depends on the deployer's nonce
sequence) — the script always prints the current one.

## Re-running after a restart

`hardhat node` resets all state on restart, so re-run `deploy` after
restarting `devnet` — the old Safe address stops existing on the new chain.
