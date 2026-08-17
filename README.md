# EMP — End-user Messaging Protocol

A two-sided platform: users link a wallet + Telegram to register for notifications and pick
interests; DeFi protocols pay in crypto to message the slice of users matching chosen categories.
Protocols get aggregate results only — they never see who the users are.

Full spec: [`SPEC.md`](./SPEC.md). Durable project rules: [`CLAUDE.md`](./CLAUDE.md).

## Architecture

pnpm workspace + Turborepo monorepo, TypeScript throughout.

```
apps/
  web/      Next.js — user/protocol/admin UI, most API routes, /r/:token click redirect
  bot/      grammY Telegram bot — /start <code> one-time-code linking
  worker/   BullMQ workers — throttled batch send, on-chain payment watcher
packages/
  db/         Prisma schema + client (single source of truth for the data model)
  config/     Chain list, env schema, category seed — all config-driven
  core/       Domain logic: account-uniqueness invariant, privacy-boundary query
              layer, campaign snapshot/moderation state machine, Safe ownership check
  payments/   PaymentVerifier interface + MVP viem-based treasury watcher
  telegram/   Bot client, rate limiter, send logic (shared by bot + worker)
```

### Why three apps, not one Next.js app

Next.js API routes are request/response — they can't host a rate-limited send loop or a
continuously-polling chain watcher. `apps/bot` and `apps/worker` are separate long-running
processes for exactly the two things SPEC §3 calls out as un-fake-able: Telegram's rate limits
(queue + worker, never a synchronous loop) and payment verification (a persistent chain watch).
`apps/web` hosts everything that *is* naturally request/response, including the click-redirect
route — a 302 at MVP's user scale doesn't need its own process.

### The privacy boundary (CLAUDE.md rule 1)

Enforced at the query layer, not the UI: `packages/core/src/protocolQueries/` is the *only*
module allowed to read anything derived from `User`, `TelegramLink`, or `CampaignRecipient`
tables on a protocol-facing code path, and its two exported functions
(`getAudienceCount`, `getCampaignMetrics`) return counts and rates — never a row. Every
protocol-facing API route (`/api/protocol/*`) imports only from there; the Prisma adapter behind
it uses `count`/`groupBy`-shaped queries exclusively, so there's no `findMany` call anywhere on
that path that could return an identifying field even by accident. A regression test
(`protocolQueries/index.test.ts`) recursively scans the response shape for wallet/chat_id/address
-like keys.

### Account uniqueness (SPEC §7.5)

Wallets are free to generate, so the anti-sybil primitive is the phone-verified Telegram account,
not the wallet. `packages/core/src/identity/telegramLinking.ts` is the single chokepoint that
enforces the 1:1:1 mapping (one wallet ↔ one account ↔ one verified Telegram link) before any
write — duplicate chat_id, duplicate account link, and the 30-day re-link cooldown are all
rejected there with typed errors. The same invariant is backstopped at the database level by two
partial unique indexes (`prisma/sql/partial_unique_indexes.sql`) that Prisma's schema DSL can't
express natively.

### Payments (SPEC §6)

`packages/payments` defines a `PaymentVerifier` interface with one MVP implementation,
`EvmTreasuryWatcher`: polls each configured chain's RPC for ERC-20 transfers and native ETH sent
to the EMP treasury from the protocol's authenticated wallet, within the payment window. RPC
polling was chosen over a webhook indexer (e.g. Alchemy) to avoid a vendor dependency — it works
against any RPC URL declared in `packages/config`. The matching decision itself
(`matchPayment.ts`) is a pure function, isolated from the RPC I/O, so the underpaid/wrong-token
/late/duplicate edge cases are unit-tested without touching a chain or a database.
`CampaignPaymentsContractVerifier` is the Phase-2 slot behind the same interface — stubbed, not
implemented, per CLAUDE.md rule 6.

### Config-driven chains

`packages/config/src/chains.ts` builds its chain list from environment variables at boot; a chain
with no RPC/treasury vars set (e.g. Robinhood pre-launch) is simply absent rather than crashing
startup. Adding a chain is one `CHAIN_DEFINITIONS` entry plus its env vars — no code changes
anywhere else.

## Stack

| Concern | Choice | Why |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | Fast, simple task graph; no need for Nx's extra machinery at this size |
| Frontend | Next.js (App Router) + TypeScript + Tailwind | One codebase for marketing site, three dashboards, and most API routes |
| Wallets | wagmi + viem + RainbowKit | De facto standard; viem also does the server-side chain reads (Safe ownership, payment watching) |
| Auth | SIWE (`siwe`) + iron-session | Stateless-cookie sessions, no separate password/user-management system — consistent with a wallet-first product |
| DB | Postgres + Prisma | Relational fits the data model (uniqueness constraints, aggregation queries) better than a document store; Prisma's migration story is the fastest path to the two partial-unique-index-backed invariants this app can't get wrong |
| Async | Redis + BullMQ | Queue + worker is a hard requirement for Telegram sends (SPEC §8), not a nice-to-have; BullMQ's per-queue rate limiter directly implements the ~30 msg/s throttle |
| Telegram | grammY | Modern TS-first Bot API client |
| Chain reads | viem, direct RPC polling | No vendor indexer dependency for MVP; swappable later behind `PaymentVerifier` |

## Local development

```bash
cp .env.example .env   # fill in RPC URLs, bot token, session secret, etc.
docker compose up -d   # Postgres + Redis
pnpm install
pnpm db:migrate         # prisma migrate dev + partial unique indexes
pnpm dev                 # turbo run dev across web/bot/worker
pnpm test                 # payment verification, privacy boundary, account uniqueness
```

## What's scaffolded vs. what's left

Implemented: the full data model, the privacy-boundary query layer, the account-uniqueness
invariant, the moderate→pay→send state machine, the MVP payment watcher, the Telegram
linking/sending path, and the API routes wiring all of that together — with test coverage on the
three things CLAUDE.md rule 8 says must never break (payment verification, the privacy boundary,
account uniqueness).

Not yet built: the actual React UI for the user/protocol/admin journeys (routes exist as
placeholders pointing at the API endpoints they'll call), campaign compose/CTA-authoring UI, and
category CRUD UI. The backend surface for all of it already exists.
