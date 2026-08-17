/**
 * Seed data only. Categories are admin-CRUD'd at runtime via the `categories`
 * table (SPEC §7) — this list seeds a fresh database, it is not read at
 * request time.
 */
export const SEED_CATEGORIES = [
  "Yields",
  "New features",
  "New products",
  "New protocols",
  "New utility",
  "Everything",
] as const;

export type SeedCategoryName = (typeof SEED_CATEGORIES)[number];

/** "Everything" is a meta-category: selecting it implies all others. */
export const EVERYTHING_CATEGORY_NAME: SeedCategoryName = "Everything";
