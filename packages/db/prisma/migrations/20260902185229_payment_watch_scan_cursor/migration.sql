-- CreateTable
CREATE TABLE "chain_scan_cursors" (
    "chain" TEXT NOT NULL,
    "lastScannedBlock" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chain_scan_cursors_pkey" PRIMARY KEY ("chain")
);

-- CreateTable
CREATE TABLE "observed_transfers" (
    "id" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observed_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "observed_transfers_chain_occurredAt_idx" ON "observed_transfers"("chain", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "observed_transfers_chain_txHash_key" ON "observed_transfers"("chain", "txHash");
