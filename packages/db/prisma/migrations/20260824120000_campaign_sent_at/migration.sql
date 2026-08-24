-- The analytics dashboard's "actual send time" (distinct from
-- scheduledSendAt, the protocol's intent) — purely additive: a nullable
-- column defaulting to NULL for every existing row, so this is safe against
-- a DB with campaigns already in every status, including ones already
-- COMPLETE/SENDING from before this column existed (they simply show no
-- sent time on the dashboard, same as any other pre-existing null field).
ALTER TABLE "campaigns" ADD COLUMN "sentAt" TIMESTAMP(3);
