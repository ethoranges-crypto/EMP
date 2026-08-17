# CLAUDE.md — EMP project rules

Standing context for Claude Code. Read this on every session. Full detail lives in `SPEC.md` — read it before scaffolding, then propose an architecture and file plan **before** writing code.

## What we're building
EMP ("End-user Messaging Protocol") — a two-sided platform. Users link a wallet + Telegram to register for notifications and pick interests. DeFi protocols pay in crypto to message the slice of users matching chosen interest categories. Protocols get aggregate results only; they never see who the users are.

## Non-negotiable rules
1. **Privacy boundary is absolute.** No protocol-facing endpoint, response, log, or export may ever expose wallet addresses, Telegram `chat_id`s, handles, or per-user rows. Protocols see aggregate counts/rates only. Enforce this at the **query layer**, not just the UI.
2. **Flow ordering: moderate → pay → send.** A campaign is admin-moderated first; payment gates sending; nothing is sent before on-chain payment is verified.
3. **Snapshot at approval.** When a campaign is approved, snapshot the recipient set and lock cost = `flat_cost_per_user × snapshot_count`. Send to the snapshot.
4. **No hardcoded secrets.** Bot token, RPC keys, treasury addresses, DB creds → env/secret store only.
5. **Config-driven chains.** Supported chains come from config so new EVM chains (and later non-EVM) add without code changes. Never hardcode a single chain assumption.
6. **MVP first.** Build the full core loop end-to-end (see SPEC §12). Stub Phase-2 items behind clean interfaces; do not implement them.
7. **Test the two things that must not break:** payment verification and the privacy boundary.

## Telegram realities (don't design around wishes)
- A bot **cannot** DM a raw @handle. Linking = user opens the EMP bot → one-time code binds their `chat_id`. Store `chat_id`, never the handle.
- **No read receipts exist.** Metrics are **delivered %** and **CTA click %** only. Never invent a "read" metric.
- Bulk sends go through a **queue + worker** with throttling, retries, and backoff — never a synchronous loop.
- Click tracking = rewrite CTAs to an EMP redirect (`/r/:token`) that logs the click then 302s.

## Auth
- **SIWE (EIP-4361)** for all sessions.
- EOA: the SIWE signature is the ownership proof.
- Gnosis Safe: user connects an **owner** wallet, signs SIWE, and we verify on-chain that the address is a Safe owner (EIP-1271 as fallback). One signature, no multi-signer coordination.

## Payments
- Tokens: USDC, USDT, ETH. Flat cost per user (admin-configurable).
- **One EMP treasury address per chain** — never per-campaign wallets.
- MVP verification: watch the chain for expected token + amount from the protocol's authenticated wallet within the payment window.
- Phase 2: `CampaignPayments` contract per chain. Build the payment layer behind an interface so it can slot in later.

## Working style
- Propose plan → confirm → build. Ask before destructive operations.
- Justify major stack/architecture choices briefly in the README.
- Keep this file lean; put detail in SPEC.md.
