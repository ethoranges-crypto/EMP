-- CANCELLED is a new CampaignStatus value (a campaign the protocol gave up
-- on after a payment attempt didn't pan out — see paymentWindowRecovery.ts).
-- Purely additive: no existing row can already be using it, and no other
-- column/constraint changes, so this is safe against a DB with existing
-- campaigns in every other status.
ALTER TYPE "CampaignStatus" ADD VALUE 'CANCELLED';
