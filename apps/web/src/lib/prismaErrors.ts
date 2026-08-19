/**
 * `instanceof Prisma.PrismaClientKnownRequestError` doesn't reliably match
 * inside a Next.js API route — its webpack bundling can give the route
 * handler a different module instance of `@prisma/client`'s runtime than
 * the one that actually threw (confirmed live: a real duplicate-category
 * POST fell straight through an `instanceof` check into an unhandled 500).
 * Prisma's error `code` is a stable string field, so check that
 * structurally instead of relying on the class identity.
 */
export function prismaErrorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null || !("code" in err)) return undefined;
  const code = (err as { code: unknown }).code;
  return typeof code === "string" ? code : undefined;
}
