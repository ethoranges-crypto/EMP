import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const sqlPath = fileURLToPath(
  new URL("../prisma/sql/partial_unique_indexes.sql", import.meta.url),
);

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const sql = readFileSync(sqlPath, "utf8");
  // Strip full-line comments BEFORE splitting on ";" — splitting first and
  // then checking `.startsWith("--")` on each chunk silently drops any
  // statement preceded by a comment on its own line within the same chunk,
  // since the chunk as a whole starts with "--" even though real SQL
  // follows later in it. That bug shipped once already: it silently
  // dropped the chatId partial unique index while keeping userId's.
  const withoutComments = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  const statements = withoutComments
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  await prisma.$disconnect();
  // eslint-disable-next-line no-console
  console.log(`Applied ${statements.length} partial unique index statement(s).`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
