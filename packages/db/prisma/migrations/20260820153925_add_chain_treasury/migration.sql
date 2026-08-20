-- CreateTable
CREATE TABLE "chain_treasuries" (
    "id" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "treasuryAddress" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chain_treasuries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chain_treasuries_chain_key" ON "chain_treasuries"("chain");
