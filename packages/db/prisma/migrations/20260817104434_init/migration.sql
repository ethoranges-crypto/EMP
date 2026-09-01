-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('EOA', 'SAFE');

-- CreateEnum
CREATE TYPE "TelegramLinkStatus" AS ENUM ('VERIFIED', 'UNLINKED');

-- CreateEnum
CREATE TYPE "LinkHistoryReason" AS ENUM ('USER_UNLINK', 'ADMIN_BAN', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ProtocolStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'AWAITING_PAYMENT', 'SENDING', 'COMPLETE');

-- CreateEnum
CREATE TYPE "TokenSymbol" AS ENUM ('USDC', 'USDT', 'ETH');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('AWAITING', 'VERIFIED', 'UNDERPAID', 'WRONG_TOKEN', 'LATE', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('SENT', 'FAILED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ModerationDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "primaryWallet" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL,
    "safeAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "link_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "link_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_interests" (
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "user_interests_pkey" PRIMARY KEY ("userId","categoryId")
);

-- CreateTable
CREATE TABLE "telegram_links" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "status" "TelegramLinkStatus" NOT NULL DEFAULT 'VERIFIED',
    "verifiedAt" TIMESTAMP(3),
    "unlinkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_link_history" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL,
    "unlinkedAt" TIMESTAMP(3),
    "reason" "LinkHistoryReason",

    CONSTRAINT "telegram_link_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protocols" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ProtocolStatus" NOT NULL DEFAULT 'PENDING',
    "approvalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "protocols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "chain" TEXT NOT NULL,
    "token" "TokenSymbol" NOT NULL,
    "bodyText" TEXT,
    "imageUrl" TEXT,
    "snapshotCount" INTEGER,
    "costAmount" DECIMAL(38,18),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_categories" (
    "campaignId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "campaign_categories_pkey" PRIMARY KEY ("campaignId","categoryId")
);

-- CreateTable
CREATE TABLE "campaign_recipients" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'SENT',

    CONSTRAINT "campaign_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "token" "TokenSymbol" NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "txHash" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'AWAITING',
    "windowExpiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ctas" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "redirectToken" TEXT NOT NULL,

    CONSTRAINT "ctas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "click_events" (
    "id" TEXT NOT NULL,
    "ctaId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "click_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_events" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "delivery_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_reviews" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "decision" "ModerationDecision" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "flatCostPerUser" DECIMAL(38,18) NOT NULL,
    "acceptedTokens" "TokenSymbol"[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_actions" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_primaryWallet_key" ON "users"("primaryWallet");

-- CreateIndex
CREATE UNIQUE INDEX "link_requests_code_key" ON "link_requests"("code");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE INDEX "telegram_links_chatId_idx" ON "telegram_links"("chatId");

-- CreateIndex
CREATE INDEX "telegram_links_userId_idx" ON "telegram_links"("userId");

-- CreateIndex
CREATE INDEX "telegram_link_history_chatId_idx" ON "telegram_link_history"("chatId");

-- CreateIndex
CREATE UNIQUE INDEX "protocols_wallet_key" ON "protocols"("wallet");

-- CreateIndex
CREATE INDEX "campaign_recipients_campaignId_idx" ON "campaign_recipients"("campaignId");

-- CreateIndex
CREATE INDEX "payments_campaignId_idx" ON "payments"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "ctas_redirectToken_key" ON "ctas"("redirectToken");

-- CreateIndex
CREATE INDEX "click_events_campaignId_idx" ON "click_events"("campaignId");

-- CreateIndex
CREATE INDEX "click_events_ctaId_idx" ON "click_events"("ctaId");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_events_campaignId_status_key" ON "delivery_events"("campaignId", "status");

-- AddForeignKey
ALTER TABLE "link_requests" ADD CONSTRAINT "link_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_links" ADD CONSTRAINT "telegram_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_link_history" ADD CONSTRAINT "telegram_link_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "protocols"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_categories" ADD CONSTRAINT "campaign_categories_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_categories" ADD CONSTRAINT "campaign_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctas" ADD CONSTRAINT "ctas_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_ctaId_fkey" FOREIGN KEY ("ctaId") REFERENCES "ctas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_reviews" ADD CONSTRAINT "moderation_reviews_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
