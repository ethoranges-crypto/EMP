import { PrismaClient } from "@prisma/client";

/**
 * Singleton PrismaClient, cached on globalThis. In dev, Next.js hot-reload
 * would otherwise spawn a new client (and connection pool) per reload.
 * Cast rather than `declare global` module augmentation, since the latter
 * doesn't reliably apply when a consuming package's tsc pulls this file
 * into its own program via workspace source resolution.
 */
const globalForPrisma = globalThis as unknown as { __empPrisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.__empPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__empPrisma = prisma;
}

export * from "@prisma/client";
