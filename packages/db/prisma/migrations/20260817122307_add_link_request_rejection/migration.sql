-- AlterTable
ALTER TABLE "link_requests" ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedReason" TEXT;
