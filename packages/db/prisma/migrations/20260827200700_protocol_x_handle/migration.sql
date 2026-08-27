-- Nullable, no default: existing protocols (created before this field
-- existed) simply have no X handle until they resubmit their application —
-- there's no value to backfill them with. Safe against a table that already
-- has rows (CLAUDE.md rule 9): adding a nullable column is a no-op for
-- existing rows, no table rewrite, no NOT NULL to violate.
ALTER TABLE "protocols" ADD COLUMN "xHandle" TEXT;
