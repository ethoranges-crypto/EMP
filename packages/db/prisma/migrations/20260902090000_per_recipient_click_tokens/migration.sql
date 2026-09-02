-- Click tracking moves from one shared redirect token per CTA (every
-- recipient of a campaign got the identical /r/:token link) to one token
-- per (recipient, cta) pair, minted at send time — see apps/worker's
-- sendCampaignNow. Without this, a click only ever proved "someone
-- clicked this CTA", never who, making a correct unique-clicker CTR
-- impossible (the previous metric counted every click, so one person
-- clicking 3 times read as 300%).

-- Cta.redirectToken is superseded entirely by click_tokens below — nothing
-- reads it anymore (the redirect route now resolves through click_tokens,
-- and the worker builds each recipient's CTA URL from their own token).
-- A plain DROP COLUMN is safe against a populated table regardless of
-- existing data (no NOT NULL to violate, no enum to remap).
DROP INDEX IF EXISTS "ctas_redirectToken_key";
ALTER TABLE "ctas" DROP COLUMN "redirectToken";

-- One row per (recipient, cta) pair. Only ever read by the redirect route
-- to resolve a click back to (cta, recipient) — never exposed to
-- protocol-facing code.
CREATE TABLE "click_tokens" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "ctaId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "click_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "click_tokens_token_key" ON "click_tokens"("token");
CREATE UNIQUE INDEX "click_tokens_ctaId_recipientId_key" ON "click_tokens"("ctaId", "recipientId");
CREATE INDEX "click_tokens_campaignId_idx" ON "click_tokens"("campaignId");

ALTER TABLE "click_tokens" ADD CONSTRAINT "click_tokens_ctaId_fkey"
  FOREIGN KEY ("ctaId") REFERENCES "ctas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "click_tokens" ADD CONSTRAINT "click_tokens_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "campaign_recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Nullable, no backfill: a click_events row from before this migration was
-- recorded against a token shared by every recipient of that CTA, so there
-- is no way to know who actually clicked it — null is the honest value for
-- those rows, not a guess. Every click recorded after this migration
-- always has one, since /r/:token now always resolves through a
-- per-recipient click_tokens row.
ALTER TABLE "click_events" ADD COLUMN "recipientId" TEXT;
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "campaign_recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
