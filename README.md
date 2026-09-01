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

That unit test only exercises the aggregation logic against a fake port, though — it never touches
the Prisma adapter that runs in production, so it can't catch a leak introduced there (e.g. an
adapter method that starts `select`-ing a `chatId` or `fromAddress` column). That gap is closed by
`prismaAdapter.integration.test.ts`, which runs the real adapter against a real seeded database —
see "Test lanes" below.

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
pnpm test                 # fast, no-DB: payment verification, privacy boundary (fake port), account uniqueness
DATABASE_URL=postgresql://emp:emp@localhost:5432/emp pnpm test:integration   # real Postgres: privacy boundary via the actual Prisma adapter
```

### Getting started on Windows

The commands above assume a Unix-like shell (macOS/Linux). On Windows, the simplest path is
**WSL2** (Windows Subsystem for Linux) — it gives you a real Linux environment inside Windows, so
every command in this README works exactly as written, with no extra translation.

1. **Install WSL2 with Ubuntu.** Open PowerShell **as Administrator** and run:
   ```powershell
   wsl --install
   ```
   Restart your PC when prompted, then finish the Ubuntu setup (pick a username/password).

2. **Install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)** —
   during setup it offers WSL2 integration; accept it, then in Docker Desktop's
   Settings → Resources → WSL Integration, make sure your Ubuntu distro is enabled.

3. **Open the "Ubuntu" app** (search for it in the Start menu) — not PowerShell or Command
   Prompt. This is your terminal for every step from here on.

4. **Install Node.js 20+ and pnpm** inside Ubuntu:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   corepack enable
   ```

5. **Clone the repo inside the Linux filesystem** (your home directory, `~`, not `/mnt/c/...`) —
   this matters for pnpm and Next.js's file watching to work reliably and stay fast:
   ```bash
   cd ~
   git clone https://github.com/ethoranges-crypto/EMP.git
   cd EMP
   ```

6. **Follow the "Local development" steps above**, in this same Ubuntu terminal —
   `cp .env.example .env`, `docker compose up -d`, `pnpm install`, and so on.

If you use VS Code, install the **WSL** extension, then run `code .` from inside the Ubuntu
terminal — it opens VS Code connected straight to this Linux environment, so its integrated
terminal, debugger, etc. all just work too.

### Test lanes

Two lanes, deliberately kept separate (`packages/core/vitest.config.ts` excludes
`*.integration.test.ts`; `vitest.integration.config.ts` runs only those):

- **`pnpm test`** — fast, no database. Exercises the pure decision logic (account-uniqueness
  state machine, payment matching, aggregation math) against in-memory fakes.
- **`pnpm test:integration`** — needs `DATABASE_URL` pointing at a real Postgres (docker-compose's
  `postgres` service, or any local instance). Currently one suite,
  `prismaAdapter.integration.test.ts`, which seeds a real user with a real wallet, a real verified
  Telegram link, and a real payment `fromAddress`, then runs every `ProtocolQueryPort` method
  against them and asserts two things per method: no forbidden-shaped key anywhere in the
  response (`assertNoForbiddenKeys`), and none of the seeded secret *values* appear anywhere in it
  either (`assertNoLeakedValues`, in `packages/core/src/testUtils/privacyAssertions.ts` —
  shared with the unit test). The second check is what makes seeding real data matter: a scan
  over null columns would pass whether or not the protection actually works. A
  `Record<keyof ProtocolQueryPort, true>` completeness map makes the suite fail to compile if a
  future method on that interface isn't added here too. A second suite,
  `dbUniquenessBackstop.integration.test.ts`, tests the partial unique indexes themselves rather
  than application code: it asserts both indexes physically exist (via `pg_indexes`, matched
  against the real camelCase column names) and that Postgres itself rejects a duplicate
  `chatId`/`userId` write performed directly through the Prisma client — deliberately bypassing
  `telegramLinking.ts` — so the DB-level backstop is proven independent of the app-layer check it
  backs up. Both suites share one live database and vitest parallelizes across test files by
  default, so `fileParallelism: false` is set in `vitest.integration.config.ts` — without it, one
  file's cleanup races another file's fixtures.
- CI (`.github/workflows/ci.yml`) runs both lanes against a `postgres:16-alpine` service
  container, applying migrations via `prisma migrate deploy` first — no interactive
  `migrate dev`.

This split exists because the unit-level privacy test alone has a real blind spot: it never
touches the Prisma adapter that runs in production. Building the integration test against a live
database caught two real bugs immediately (not hypothetical — both found while wiring this up,
before any mutation testing): `partial_unique_indexes.sql` referenced `chat_id`/`user_id`, but
Prisma leaves field names as camelCase (`"chatId"`/`"userId"`) unless a schema `@map` says
otherwise, so neither index was being created against the real column names; and
`applyPartialIndexes.ts`'s statement splitter discarded any SQL statement preceded by a
same-chunk comment line, so even after fixing the column names, only one of the two indexes was
actually applied. Both are fixed now, but neither would have surfaced without running migrations
against a real database.

## What's scaffolded vs. what's left

Implemented: the full data model, the privacy-boundary query layer, the account-uniqueness
invariant, the moderate→pay→send state machine, the MVP payment watcher, the Telegram
linking/sending path, and the API routes wiring all of that together — with test coverage on the
three things CLAUDE.md rule 8 says must never break (payment verification, the privacy boundary,
account uniqueness).

The **user journey** (`apps/web/src/app/user/`) is built end-to-end against real API routes: SIWE
connect (EOA + Safe-owner) → interests → Telegram one-time-code linking → a live "Messageable:
Yes/No" status. `/protocol` and `/admin` remain placeholders pointing at the API endpoints they'll
call — campaign compose/CTA-authoring UI and category CRUD UI aren't built yet.

### User journey UI

`GET /api/user/me` is the single state endpoint the page polls: wallet identity, saved interests,
and `telegramLinkStatus` (`none | pending | rejected | expired | linked`) plus `messageable` — the
one boolean that actually matters, since SPEC §7.5 only counts a *currently verified* Telegram
link, not "has a wallet" or "picked interests." `MessageableBadge` never renders a bare "No" —
when not messageable, its copy is always the next step for that specific `telegramLinkStatus`
("Link Telegram to start receiving messages", "Waiting for Telegram confirmation", "Telegram link
expired — generate a new one below", etc.), so the status doubles as the fix.

Linking happens through the Telegram bot, not a web API call — so a rejection (SPEC §7.5: chat_id
already bound elsewhere) happens inside the Telegram chat, invisible to the browser tab the user
still has open. `LinkRequest` gained `rejectedReason`/`rejectedAt` columns so apps/bot's `/start`
handler can record what it told the user in-chat; `/api/user/me` surfaces the same message, and
`TelegramPanel` renders it verbatim rather than a generic "linking failed."

**LinkRequest codes are single-use AND time-bound**, not just time-bound — treated as a §7.5-adjacent
security property, not UI polish: a pile of simultaneously-valid one-time codes for one account is
an attack surface (an old code sitting in browser history or a log stays redeemable indefinitely
otherwise). `packages/core/src/identity/linkRequest.ts`'s `createLinkRequest` invalidates any prior
un-redeemed code for that account before issuing a new one; `redeemLinkRequest` is the single point
that decides redeemability (expired and superseded codes both resolve to `null`, no separate
"which reason" branching needed by callers). Covered by both a fake-port unit test
(`linkRequest.test.ts`) and a real-Postgres integration test (`linkRequest.integration.test.ts`)
asserting: an expired code is rejected, a superseded code is rejected even before expiry, and only
the latest of several issued-in-a-row codes redeems.

**The Safe-owner chain selector defaults to the wallet's actually-connected chain** (via wagmi's
`useAccount().chainId`, mapped through `chainKeyForChainId`), not a hardcoded default — and stops
auto-following once the user picks a chain manually. A non-owner (or wrong-chain) attempt gets a
specific message — `"This address isn't an owner of a Safe on {chain} — switch chain or check the
address."` — instead of a bare 403.

Verified live against the real stack (Postgres running, dev server up), not just typechecked:
- A full SIWE sign-in through the actual browser components (`ConnectButton` → `SignInPanel` →
  `useSiwe.ts`) — a mock EIP-1193 provider was injected via the real
  `eip6963:announceProvider` discovery event wagmi listens for (not `window.ethereum` alone,
  which RainbowKit's MetaMask tile bypasses in favor of `@metamask/sdk`'s own deep-link flow), with
  `personal_sign` routed back through Playwright's `exposeFunction` to a real viem
  `account.signMessage()` — a genuine secp256k1 signature the server verified.
- The full happy path (sign in → save interests → request a Telegram link → the exact
  `attemptLink()` call apps/bot's handler makes, binding a chat_id) flips `messageable` from
  `false` to `true`, live.
- A second account attempting to bind that same chat_id gets rejected with SPEC §7.5's exact
  message, and `TelegramPanel` renders it in the `rejected` state — same code path, no separate UI
  logic to keep in sync.
- A wallet connected to Arbitrum defaults the Safe chain dropdown to Arbitrum, not Ethereum.
- Sign-in as the real owner of a real locally-deployed Safe succeeds; a non-owner against that same
  Safe gets the chain-specific 403 message above.

### Testing the Safe-owner path locally

There's no public testnet reachable from this repo's usual dev/CI environment, so
`tools/local-safe-devnet` deploys a real Gnosis Safe (official v1.4.1 bytecode, not a mock) to a
local Hardhat EVM instead — real contract execution and real on-chain storage, just not a public
chain. See `tools/local-safe-devnet/README.md` for the two-command setup; the deploy script prints
the `ETHEREUM_RPC_URL`/`ETHEREUM_TREASURY_ADDRESS` pair to drop into the repo-root `.env` plus the
deployed Safe's address and a test-only owner key. Re-run it whenever `verifyOwner.ts` or the SIWE
verify route changes, not as a one-off.

### Testing a real Telegram send locally

Telegram's Bot API rejects an inline keyboard button whose URL isn't a public HTTPS address (400
"Wrong HTTP URL") — so a campaign with CTAs can't actually be delivered while `REDIRECT_BASE_URL`
points at `localhost`, even though everything else about local dev works fine. A campaign with no
CTAs sends fine locally regardless; this only matters once you want to see the CTA buttons for real.

The fix is a public HTTPS tunnel back to your own machine, so `REDIRECT_BASE_URL` becomes a real
HTTPS host while `/r/:token` still resolves to your local dev server — no separate deployment needed:

1. Start `apps/web` locally as usual (`pnpm --filter @emp/web dev`, default port 3000).
2. Start a tunnel pointed at that port — either works the same way here:
   - `ngrok http 3000` (needs a free ngrok account + `ngrok config add-authtoken ...` once)
   - `cloudflared tunnel --url http://localhost:3000` (no account needed)
3. Copy the `https://...` URL the tunnel prints and set it in the root `.env`:
   ```
   REDIRECT_BASE_URL=https://<the-printed-subdomain>/r
   ```
4. Restart `apps/worker` (env is only read at boot — see `packages/config/src/rootEnv.ts`). It logs
   a warning at startup if `REDIRECT_BASE_URL` still isn't a public HTTPS address, so you don't have
   to wait for a send to find out.

That's the whole change — nothing about `/r/:token`'s own code path is different. A click on the
CTA button hits the tunnel's public URL, which forwards straight through to your local dev server's
`/r/:token` redirect handler, which logs the click and 302s to the real target exactly as it would
in production. The tunnel URL changes every time you restart it (unless you're on a paid ngrok plan
with a reserved domain), so re-run step 3 each session.

If you don't need to see real Telegram messages land — just want to confirm a campaign reaches
`SENDING` and delivery counts tick up — there's no simpler local option than the tunnel for anything
with CTAs; skipping CTAs entirely (an empty `ctas` array at compose) is the only way to avoid it.

**`REDIRECT_BASE_URL` is a deploy-time value, never hardcoded** — it's read fresh from env in every
environment (`getEnv().REDIRECT_BASE_URL`, see `packages/config/src/env.ts`), so "which domain" is
purely a config choice, not a code change:

| Environment | `REDIRECT_BASE_URL` |
| --- | --- |
| Local dev, no CTAs | `http://localhost:3000/r` (default) — fine, nothing sends via Telegram |
| Local dev, testing real Telegram sends | your tunnel's printed URL (step 3 above) |
| Production | your own purchased, DNS-configured domain |

A "branded" domain (e.g. `emp.link`) typed into `.env` before it's actually purchased and pointed at
anything is syntactically valid HTTPS and will pass Telegram's own rule fine — then fail as
`DNS_PROBE_FINISHED_NXDOMAIN` the moment a real recipient's browser tries to resolve it, discovered
only when someone taps a CTA. `apps/worker` now makes an actual network request to
`REDIRECT_BASE_URL` at startup (`checkRedirectBaseUrlReachable`, `@emp/telegram`) — DNS resolution,
TCP connect, and the TLS handshake all have to succeed — and warns immediately if it doesn't, instead
of leaving that to be discovered at click time. It also separately warns if the domain resolves but
looks like a temporary dev tunnel (`isLikelyDevTunnelUrl`) — reachable, but not something to actually
send to real users (see the CTA-link-trust discussion — a random tunnel subdomain is itself an
unfamiliar-link problem, even once it works).

**Going to production with a real branded domain is a one-time setup step**, separate from local
testing and independent of any code change:

1. Buy the domain (e.g. `emp.link`).
2. Point its DNS at wherever `apps/web` is actually deployed (an A/CNAME record to your hosting
   provider — the exact record depends on where you deploy, same as pointing any custom domain at a
   Next.js app).
3. Set `REDIRECT_BASE_URL=https://emp.link/r` in that environment's `.env`/secret store.
4. Restart `apps/worker` and confirm its startup log shows no `REDIRECT_BASE_URL` warning at all —
   that's the same reachability check above confirming the real domain is live before you send
   anything to real users.

### Known gap — flagged, not yet closed

**Telegram code redemption has still only been exercised via substitution, never a live Telegram
round-trip.** This repo's sandbox can't reach `api.telegram.org` (egress policy), so every pass so
far — including the live-stack verification above — redeems a code by calling
`attemptLink()`/`redeemLinkRequest()` directly, the same code apps/bot's `/start` handler calls,
just not arrived at via an actual Telegram message. That's a reasonable stand-in for the
*application* logic, but it has never proven that a real deep link (`t.me/<bot>?start=<code>`)
actually reaches a running bot process and that `ctx.match` parses the code correctly from a real
Telegram update. That needs a real bot token and a live Telegram round-trip from a network-unrestricted
environment — hold it for the testnet dry-run.
