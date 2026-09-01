-- AlterTable
ALTER TABLE "protocols" ADD COLUMN     "accountType" "AccountType" NOT NULL DEFAULT 'EOA',
ADD COLUMN     "safeAddress" TEXT;
