-- Self-service opt-out ("Signal paused"). A single-step add-with-default is
-- safe against a table that already has rows: Postgres backfills the
-- constant default for every existing row without a table rewrite, so every
-- pre-existing user starts unpaused (their current, correct state) with no
-- separate backfill step needed.
ALTER TABLE "users" ADD COLUMN "paused" BOOLEAN NOT NULL DEFAULT false;
