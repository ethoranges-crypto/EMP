import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const sqlPath = fileURLToPath(
  new URL("../prisma/sql/partial_unique_indexes.sql", import.meta.url),
);

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const sql = readFileSync(sqlPath, "utf8");
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

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
