/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `campaigns` table. All the data in the column will be lost.
  - Added the required column `title` to the `campaigns` table.

  Made safe against a non-empty `campaigns` table (CLAUDE.md rule 9): title
  is added nullable, backfilled for any pre-existing rows, then tightened
  to NOT NULL — rather than adding it NOT NULL with no default, which only
  succeeds when the table starts empty.
*/
-- AlterTable
ALTER TABLE "campaigns" DROP COLUMN "imageUrl",
ADD COLUMN     "imageData" BYTEA,
ADD COLUMN     "imageMimeType" TEXT,
ADD COLUMN     "title" TEXT;

-- Backfill: a pre-existing campaign has no title yet (the column didn't
-- exist before this migration) — give it a placeholder rather than fail.
UPDATE "campaigns" SET "title" = 'Untitled campaign' WHERE "title" IS NULL;

ALTER TABLE "campaigns" ALTER COLUMN "title" SET NOT NULL;

-- AlterTable
ALTER TABLE "protocols" ADD COLUMN     "approvedBannerDismissed" BOOLEAN NOT NULL DEFAULT false;
