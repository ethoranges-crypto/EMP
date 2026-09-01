-- Nullable, no default needed — every existing row (from a campaign that
-- already sent, or is mid-send) simply reads as "not yet attempted" under
-- the new column, which is accurate for rows the worker hasn't touched
-- since this migration and harmless for rows it has (the worker sets this
-- on every attempt going forward, so already-SENDING campaigns pick it up
-- on their next processed job same as a fresh one). Purely additive: safe
-- against a DB with existing campaign_recipients rows.
ALTER TABLE "campaign_recipients" ADD COLUMN "attemptedAt" TIMESTAMP(3);
