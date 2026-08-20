/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `campaigns` table. All the data in the column will be lost.
  - Added the required column `title` to the `campaigns` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "campaigns" DROP COLUMN "imageUrl",
ADD COLUMN     "imageData" BYTEA,
ADD COLUMN     "imageMimeType" TEXT,
ADD COLUMN     "title" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "protocols" ADD COLUMN     "approvedBannerDismissed" BOOLEAN NOT NULL DEFAULT false;
