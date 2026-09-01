-- Scheduled sending: a protocol may choose a future send time at compose
-- time instead of "send as soon as payment clears". Both changes here are
-- purely additive — a new enum value, and a nullable column defaulting to
-- NULL (= immediate, the only behaviour that existed before this) — so this
-- is safe against a DB with existing campaigns in every other status and
-- existing rows never needing a backfill.

-- SCHEDULED: payment verified, but the campaign is holding until
-- scheduledSendAt arrives (see moderation.ts's AWAITING_PAYMENT -> SCHEDULED
-- -> SENDING transitions). No existing row can already be using it.
ALTER TYPE "CampaignStatus" ADD VALUE 'SCHEDULED';

-- NULL = send immediately once payment verifies (existing/default
-- behaviour, unchanged for every pre-existing campaign). A non-null value is
-- the protocol's chosen send time, stored/compared in UTC — set at compose
-- time (updateCompose.ts), read at payment-verification time
-- (watchPayments.ts), and editable directly while the campaign is SCHEDULED
-- (rescheduleCampaign.ts) without needing a new payment.
ALTER TABLE "campaigns" ADD COLUMN "scheduledSendAt" TIMESTAMP(3);
