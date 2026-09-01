-- Partial unique indexes for SPEC §7.5 account uniqueness.
-- Prisma's schema DSL cannot express a WHERE clause on @@unique, so these
-- are applied as raw SQL after `prisma migrate dev` (see
-- packages/db/src/applyPartialIndexes.ts, run by `pnpm db:migrate`).
--
-- Together these guarantee: a chat_id can be VERIFIED on at most one
-- telegram_links row at a time, and a user can have at most one VERIFIED
-- telegram_links row at a time. This is the database-level backstop for the
-- invariant packages/core/src/identity/telegramLinking.ts also checks in
-- application code before writing.

-- Prisma preserves schema field names as-is when no @map is set, so the
-- actual columns are camelCase and must be double-quoted here — bare
-- lowercase identifiers (chat_id) silently fail to match ("chatId" != chat_id
-- under Postgres's default identifier folding), which is exactly the bug an
-- integration test against a real database caught (see
-- prismaAdapter.integration.test.ts).
CREATE UNIQUE INDEX IF NOT EXISTS telegram_links_chat_id_verified_unique
  ON telegram_links ("chatId")
  WHERE status = 'VERIFIED';

CREATE UNIQUE INDEX IF NOT EXISTS telegram_links_user_id_verified_unique
  ON telegram_links ("userId")
  WHERE status = 'VERIFIED';
