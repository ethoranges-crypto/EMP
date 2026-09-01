-- The admin queue's "Submitted" label was reading Protocol.createdAt, which
-- is set at first SIWE sign-in, not at application submission — the two can
-- be arbitrarily far apart (connect today, submit next week). This column
-- is set only when the application form is actually submitted
-- (POST /api/protocol), and reset on every resubmit.
--
-- Nullable, no NOT NULL: a protocol that has connected + signed in but
-- never submitted an application has no submission time to report.
ALTER TABLE "protocols" ADD COLUMN "submittedAt" TIMESTAMP(3);

-- Backfill for protocols that already submitted before this column existed
-- (name is set once an application has been submitted — see
-- POST /api/protocol). createdAt is the best approximation available for
-- this historical data — the same value the admin queue was already
-- displaying — and is superseded by an exact timestamp the moment any of
-- these protocols resubmits. Protocols that never got past "connect wallet"
-- (name still '') are left null, correctly, since they have no submission
-- to report a time for.
UPDATE "protocols" SET "submittedAt" = "createdAt" WHERE "name" <> '';
