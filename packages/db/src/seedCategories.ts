import { PrismaClient } from "@prisma/client";
import { SEED_CATEGORIES, loadRootEnvFile } from "@emp/config";

// Run directly via `tsx` (not through loadEnv()), so nothing else has
// populated process.env yet — same reasoning as applyPartialIndexes.ts.
loadRootEnvFile();

/**
 * Seeds the initial interest taxonomy (SPEC §7) from packages/config's
 * SEED_CATEGORIES. Idempotent — upserts by name, so re-running after some
 * categories already exist (or after an admin has renamed/deactivated one
 * via the admin panel) only fills in what's missing rather than resetting
 * anything. Categories are otherwise admin-CRUD'd at runtime, not
 * hardcoded — this just gets a fresh database off the ground.
 */
async function main(): Promise<void> {
  const prisma = new PrismaClient();
  for (const name of SEED_CATEGORIES) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name, active: true } });
  }
  // eslint-disable-next-line no-console
  console.log(`Seeded ${SEED_CATEGORIES.length} categories: ${SEED_CATEGORIES.join(", ")}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
