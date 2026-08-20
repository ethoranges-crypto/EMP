-- Payment chain/token move to a post-approval "payment step" (SPEC §6):
-- no longer collected at campaign creation, so they must be nullable.
-- Widening an existing column to nullable is always safe regardless of
-- row count — no backfill needed.
ALTER TABLE "campaigns" ALTER COLUMN "chain" DROP NOT NULL;
ALTER TABLE "campaigns" ALTER COLUMN "token" DROP NOT NULL;

-- Remove ETH from TokenSymbol — USDC/USDT only (SPEC §6). Postgres has no
-- "DROP VALUE" for enums, so this recreates the type — which requires
-- every existing value in every column using it to already be valid under
-- the new type. A pre-existing 'ETH' row must be remapped *before* the
-- swap (CLAUDE.md rule 9), not just assumed not to exist:
--   - campaigns.token is nullable as of the statements above in this same
--     migration — null it out, matching "payment method not chosen yet".
--     ETH was never a value worth carrying forward once it's removed.
--   - payments.token is NOT NULL (a payment record always needs a
--     concrete token) — remap to USDC rather than drop the row. No
--     payment-verification code path has ever run against a real payment
--     (packages/payments isn't wired to any live route yet as of this
--     migration), so no settled payment can genuinely exist with
--     token = 'ETH'; this remap is a safety net, not a real business
--     decision — if that ever changes before this migration ships
--     anywhere with real payment rows, replace it with one.
--   - platform_settings.acceptedTokens is an array column — just drop the
--     element instead of touching the whole row.
UPDATE "campaigns" SET "token" = NULL WHERE "token" = 'ETH';
UPDATE "payments" SET "token" = 'USDC' WHERE "token" = 'ETH';
UPDATE "platform_settings" SET "acceptedTokens" = array_remove("acceptedTokens", 'ETH');

BEGIN;
CREATE TYPE "TokenSymbol_new" AS ENUM ('USDC', 'USDT');
ALTER TABLE "campaigns" ALTER COLUMN "token" TYPE "TokenSymbol_new" USING ("token"::text::"TokenSymbol_new");
ALTER TABLE "payments" ALTER COLUMN "token" TYPE "TokenSymbol_new" USING ("token"::text::"TokenSymbol_new");
ALTER TABLE "platform_settings" ALTER COLUMN "acceptedTokens" TYPE "TokenSymbol_new"[] USING ("acceptedTokens"::text[]::"TokenSymbol_new"[]);
ALTER TYPE "TokenSymbol" RENAME TO "TokenSymbol_old";
ALTER TYPE "TokenSymbol_new" RENAME TO "TokenSymbol";
DROP TYPE "TokenSymbol_old";
COMMIT;
