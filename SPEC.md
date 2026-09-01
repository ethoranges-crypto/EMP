# SPEC.md — End-user Messaging Protocol (EMP)

Full build specification. Companion to `CLAUDE.md` (which holds the durable rules). Read this fully, then propose an architecture and file plan **before** scaffolding. Build the MVP end-to-end first; stub Phase-2 items behind clean interfaces.

## 1. What EMP is

EMP ("End-user Messaging Protocol") is a two-sided platform.

- **End users** link a wallet (or Gnosis Safe) to register for notifications, connect a Telegram bot, and choose what they want to hear about.
- **DeFi protocols** pay — in crypto — to send a promotional message to the slice of users matching chosen interest categories. They get results (delivered %, click %, audience size) but **never** see who the users are.

Value: protocols get a reliable way to reach DeFi users (notoriously hard); users get curated opportunities (yields, OTC deals, new products) and control over what they receive. The brand plays on EMP = *electromagnetic pulse* — a burst of signal sent to blockchain users.

## 2. Roles

1. **User** — wallet/Safe owner receiving messages via Telegram.
2. **Protocol** — paying advertiser, wallet-authenticated, manually approved.
3. **Admin (EMP operator)** — approves protocols, moderates messages, configures interest categories, oversees campaigns and treasury reconciliation.

## 3. Key technical constraints — READ FIRST

1. **Telegram bots can't DM a raw @handle.** A bot can only message a user who has already started a chat with it. So "link Telegram" = *connect via the EMP bot*: user opens the bot, a one-time code binds their Telegram `chat_id` to their wallet. Store the `chat_id`, not the handle, as the send target.
2. **Telegram has no read receipts.** The metric is **delivered** + **clicked** (CTA taps). "% read" is not available — the dashboard shows delivered % and click-through %. Do not fabricate a read metric.
3. **Telegram rate limits.** Bulk sends go through a **queue + worker** with throttling (~30 msg/s global, lower per-chat), retry/backoff. Batch sends are async jobs, not synchronous loops.
4. **Click tracking needs a redirect service.** CTA links are rewritten to an EMP redirect endpoint (`/r/:token`) that records the click, then 302s to the real URL. This is the only reliable engagement signal.
5. **Privacy boundary is a hard requirement.** Protocols see only aggregate numbers. No wallet addresses, no Telegram identifiers, no per-user rows — ever — in any protocol-facing surface or API response.

## 4. User journeys

### 4.1 User registration
- Connect wallet via WalletConnect/RainbowKit; authenticate with **Sign-In With Ethereum (SIWE)**.
  - EOA: the SIWE signature is the ownership proof.
  - Gnosis Safe: user connects an **owner** wallet, signs SIWE, and EMP verifies on-chain that the address is an owner of the named Safe (optionally support EIP-1271 Safe signing as a fallback). One signature, no multi-signer coordination.
- Choose interest categories (multi-select; see §7).
- Link Telegram: open the EMP bot → verify via one-time code → EMP stores `chat_id`. User is "messageable" only once verified.
- User can edit interests, re-link/unlink Telegram, or delete their data at any time.

### 4.2 Protocol onboarding
- Connect wallet + SIWE. Same account-type support as §4.1's user side:
  - EOA: the SIWE signature is the ownership proof.
  - Gnosis Safe: protocol connects an **owner** wallet, signs SIWE, and EMP verifies on-chain that the address is an owner of the named Safe (optionally support EIP-1271 Safe signing as a fallback). Protocols commonly operate/pay from a multisig treasury, so this isn't optional for them either — one signature, no multi-signer coordination.
- Submit an application. Manual approval gate to stop scams: protocol proves legitimacy out-of-band (e.g. a Twitter/X DM from their official account to EMP with a pre-worded confirmation of their wallet address). Admin approves/rejects. Un-approved protocols cannot create or send campaigns.

### 4.3 Campaign creation
1. Protocol selects target interest categories → UI shows the **messageable audience count** (users matching categories AND with a verified Telegram link). This count is the only audience data they see.
2. Protocol composes: text, optional image, one or more CTAs (label + URL). CTAs are auto-wrapped in tracking redirects.
3. Protocol submits for **moderation**.
4. **Admin moderates** (spam/scam) → approve or reject with reason.
5. On approval, the recipient set is **snapshotted** and cost is locked: `cost = flat_cost_per_user × snapshot_count`.
6. Protocol **pays** in crypto (see §6). Payment gates sending — nothing sends before on-chain verification.
7. On verified payment, the campaign is **queued** and the worker batch-sends to the snapshot's `chat_id`s.
8. Delivery + click events stream into the protocol's dashboard.

> Order matters: **moderate → pay → send.** Moderating before payment means rejected messages are never charged.

### 4.4 Protocol dashboard
- Campaign list with status (draft, in review, approved, awaiting payment, sending, complete).
- Per-campaign metrics: audience size, delivered count/%, click count/% (per CTA), spend. Aggregates only.

### 4.5 Admin
- Approve/reject protocols; moderate messages; CRUD interest categories; set the flat cost-per-user in USD (§6); view campaigns and payment reconciliation; suspend bad actors.

## 5. Chains & wallets

- **EVM only** for now. Launch chains: **Ethereum, Arbitrum, Optimism, Base**, plus **Robinhood** *(add via config once its RPC/chain-id are confirmed — treat as new/forthcoming)*.
- The **chain list is config-driven** so new EVM chains (and later non-EVM) drop in without code changes.
- Wallet stack: **wagmi + viem + RainbowKit** (or WalletConnect directly). **SIWE (EIP-4361)** for sessions.
- Safe support via owner-membership check (primary) and EIP-1271 (fallback).

## 6. Payments

- **Priced in USD.** Cost = flat cost per user (admin-configurable, in USD) × the snapshot count, shown to the protocol as a plain dollar figure (e.g. "$50 to reach 100 users") — not a token amount computed from some other unit.
- **Accepted tokens: USDC, USDT only.** Both are USD-pegged 1:1, so the locked USD cost *is* the token amount to pay — no price feed, no conversion buffer, no slippage handling. This is why ETH is deliberately not accepted: pricing a campaign in ETH would need a live price feed, a buffer for the price moving between quote and payment, and a story for what EMP does with volatile ETH it receives — none of which is built. ETH (or any non-pegged asset) could be added later behind the same payment interface, once that machinery exists; until then the whole verification path stays simple by construction.
- **Chain:** the protocol picks which supported EVM chain to pay on (wherever the stablecoin lives for them) — a payment-time choice, made after approval, not part of campaign content. If a campaign's audience spans multiple chains, the protocol still pays the full amount on **one chain of their choice**; if multi-chain payment logic proves complex, **default all payments to Ethereum**.
- **Receiving architecture (recommended):** a single **EMP treasury address per chain** — *not* per-campaign wallets (per-campaign keys are an operational/security burden and painful to sweep).
- **Verification (MVP):** protocol pays **from their authenticated wallet** to the treasury; EMP watches the chain (RPC/webhook/indexer) for the expected **token + amount from that known sender** within the payment window, then marks paid. Handle edge cases: wrong amount, wrong token, late payment, duplicate.
- **Phase-2 hardening (build the payment layer behind an interface):** a minimal `CampaignPayments` contract per chain with `pay(campaignId, token, amount)` emitting `PaymentReceived` — explicit on-chain campaign↔payment linkage, single `withdraw()` to treasury.

## 7. Interest categories

- **Admin-configured**, not hardcoded. Seed with: Yields, New features, New products, New protocols, New utility, Everything.
- Users multi-select ("Everything" implies all). Protocols target by the same taxonomy.

## 7.5 Sybil resistance / account uniqueness

Protocols pay to reach *distinct real humans*, so audience integrity is a core product guarantee. Wallets are free to generate, so the wallet is **not** the anti-sybil primitive — the **phone-verified Telegram account is**. Enforce a strict 1:1:1 mapping: one wallet ↔ one account ↔ one Telegram account.

Rules:
- `users.primary_wallet` is **unique** — one wallet, one account.
- `telegram_links.chat_id` is **globally unique** — a Telegram account binds to at most one EMP account, ever (across both EOA and Safe account types).
- At most **one verified** Telegram link per account.
- On link attempt, if the `chat_id` is already bound to another account → reject with a clear message.
- An account is **messageable** (and only then counts toward any audience or snapshot) *only* while it has a current verified Telegram link.
- **Re-linking:** moving a Telegram account to a different wallet requires explicit unlink first, then a **cooldown** (default 30 days, config-driven) before it can bind elsewhere. Every link/unlink is written to `telegram_link_history` for audit.

Effect: a spammer generating 1,000 wallets but controlling 5 Telegram accounts can make only 5 accounts messageable; the rest never enter an audience and never cost a protocol anything. Audience size therefore approximates distinct humans.

Phase-2 hardening (stub, not MVP): short-expiry one-time codes, rate-limited code requests, admin ban of a `chat_id` or wallet, and optional stronger proof-of-personhood if needed.

## 8. Telegram delivery

- One EMP bot (Bot API). Suggested lib: **grammY** or **telegraf**.
- Linking: `/start` → one-time code → bind `chat_id`. Store `chat_id`; never rely on `@handle`.
- Sending: async **queue + worker** (BullMQ + Redis) with per-second throttling, retries, backoff. Record a delivery event per recipient (sent/failed/blocked).
- Click tracking: rewrite CTAs to `/r/:token`, log click, redirect. Track per-CTA.
- Support text + one image + multiple CTA buttons per message.

## 9. Privacy & security (hard requirements)

- Protocol-facing APIs return **aggregates only**. No endpoint, response, log, or export exposes wallet addresses, `chat_id`s, or per-user rows to protocols.
- Enforce the boundary at the **query layer** (protocol queries can only ever return counts/rates), not just the UI.
- SIWE sessions with nonce + expiry; CSRF protection; rate limiting on auth and payment endpoints.
- Message moderation before every send.
- Secrets (bot token, RPC keys, treasury config) in env/secret store, never in code.
- User-facing data deletion (right to unlink/erase).

## 10. Data model (sketch — refine as needed)

- **users** (id, primary_wallet **[UNIQUE]**, account_type [eoa|safe], safe_address?, created_at)
- **user_interests** (user_id, category_id)
- **telegram_links** (user_id, chat_id **[UNIQUE]**, verified_at, one_time_code, status) — at most one *verified* link per user; a `chat_id` binds to only one account, ever
- **telegram_link_history** (chat_id, user_id, linked_at, unlinked_at, reason) — audit trail; supports the re-link cooldown
- **categories** (id, name, active)
- **protocols** (id, wallet, name, status [pending|approved|rejected|suspended], approval_notes)
- **campaigns** (id, protocol_id, status, target_category_ids, chain, token, snapshot_count, cost, created_at)
- **campaign_recipients** (campaign_id, chat_id, delivery_status) — internal only, never protocol-exposed
- **payments** (id, campaign_id, chain, token, amount, from_address, tx_hash, status, verified_at)
- **ctas** (id, campaign_id, label, target_url, redirect_token)
- **click_events** (cta_id, campaign_id, timestamp)
- **delivery_events** (campaign_id, status, count) — per-recipient internally, aggregated for protocols
- **moderation_reviews** (campaign_id, admin_id, decision, reason, timestamp)
- **admin_actions** (audit log)

## 11. Suggested stack (finalize and justify in README)

- **Frontend:** Next.js + TypeScript + Tailwind; wagmi/viem + RainbowKit; SIWE.
- **Backend:** Next.js API routes or a separate Node/TS service; **Postgres + Prisma**.
- **Async:** Redis + BullMQ worker for sends and on-chain payment watching.
- **Chain reads:** viem clients per chain + an indexer/webhook (e.g. Alchemy) for payment detection.
- **Telegram:** grammY/telegraf bot service.
- **Redirect service** for click tracking.
- Pick an optimal, well-documented structure (monorepo is fine).

## 12. Scope

**MVP (build fully):**
- User: SIWE login (EOA + Safe), interests, Telegram link/verify.
- Protocol: SIWE login, application + manual approval, campaign create → audience count → compose → submit.
- Admin: approve protocols, moderate messages, manage categories, set cost/tokens.
- Payments: single-chain, treasury-watch verification, flat cost per user.
- Sending: queued batch send + delivery tracking + click redirect.
- Protocol dashboard: campaigns + delivered % + click %.
- Privacy boundary enforced and tested.

**Phase 2 (stub/extend later):**
- `CampaignPayments` contract for on-chain campaign↔payment linkage.
- Multi-chain payment splitting; more chains; non-EVM.
- Advanced analytics (per-CTA, scheduling, A/B), automated protocol vetting, multiple bot tokens for throughput.

Scale target: thousands of registered users = success. Design for that, don't paint into a corner.

## 13. Brand & design direction

- Concept: **EMP as an electromagnetic pulse** firing signal to blockchain users.
- Dark UI, high contrast, **electric neon accents** (e.g. cyan/violet on near-black), pulse/waveform/lightning motifs, subtle glow. Techy, precise, mono or geometric-sans type. Keep it clean and fast — no gimmick.

## 14. Assumptions to confirm before building

1. Telegram linking = open bot → one-time code → `chat_id`. ✅ confirmed
2. Metrics = delivered % + click %, not read %. ✅ confirmed
3. Moderation happens **before** payment; payment gates send. *(assumed — confirm)*
4. Recipient set + cost are snapshotted at approval. *(assumed — confirm)*
5. Protocol pays from its authenticated login wallet (enables sender-based verification). *(assumed — confirm; else add a "declare paying address" step)*
6. Single treasury address per chain; per-campaign contract deferred to Phase 2. ✅ recommended
7. Strict 1:1:1 wallet ↔ account ↔ Telegram uniqueness; audiences drawn only from verified links; 30-day re-link cooldown. ✅ confirmed (see §7.5)
