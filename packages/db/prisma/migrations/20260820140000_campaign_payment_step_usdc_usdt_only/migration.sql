-- Payment chain/token move to a post-approval "payment step" (SPEC §6):
-- no longer collected at campaign creation, so they must be nullable.
ALTER TABLE "campaigns" ALTER COLUMN "chain" DROP NOT NULL;
ALTER TABLE "campaigns" ALTER COLUMN "token" DROP NOT NULL;

-- Remove ETH from TokenSymbol — USDC/USDT only (SPEC §6): both are
-- USD-pegged 1:1, so a locked USD cost is directly the token amount owed.
-- Postgres has no "DROP VALUE" for enums, so this recreates the type.
BEGIN;
CREATE TYPE "TokenSymbol_new" AS ENUM ('USDC', 'USDT');
ALTER TABLE "campaigns" ALTER COLUMN "token" TYPE "TokenSymbol_new" USING ("token"::text::"TokenSymbol_new");
ALTER TABLE "payments" ALTER COLUMN "token" TYPE "TokenSymbol_new" USING ("token"::text::"TokenSymbol_new");
ALTER TABLE "platform_settings" ALTER COLUMN "acceptedTokens" TYPE "TokenSymbol_new"[] USING ("acceptedTokens"::text[]::"TokenSymbol_new"[]);
ALTER TYPE "TokenSymbol" RENAME TO "TokenSymbol_old";
ALTER TYPE "TokenSymbol_new" RENAME TO "TokenSymbol";
DROP TYPE "TokenSymbol_old";
COMMIT;
