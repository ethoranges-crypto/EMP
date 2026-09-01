import { expect } from "vitest";

/** Banned substrings for anything reachable from a protocol-facing response. */
export const FORBIDDEN_KEY_PATTERN = /wallet|chat_?id|address|handle|safeaddress/i;

/**
 * Recursively asserts no key at any depth of `value` matches
 * FORBIDDEN_KEY_PATTERN. This is a structural check — it catches a field
 * *named* like an identifier regardless of what's in it, which is what
 * catches a future adapter method that starts returning a row with chatId
 * on it, even before that field is ever populated with real data.
 *
 * Shared between the unit test (fake port, synthetic data) and the
 * integration test (real Prisma adapter, real seeded data) so both exercise
 * the exact same rule.
 */
export function assertNoForbiddenKeys(value: unknown, path = "$"): void {
  if (value === null || typeof value !== "object") return;
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    expect(
      FORBIDDEN_KEY_PATTERN.test(key),
      `forbidden key "${key}" found at ${path}.${key} — protocol-facing responses must be aggregate-only`,
    ).toBe(false);
    assertNoForbiddenKeys(val, `${path}.${key}`);
  }
}

/**
 * Recursively asserts none of `secrets` (real seeded values — a wallet
 * address, a chat_id, a payer address) appear anywhere in `value`, under
 * ANY key name. This is what the key-name scan above can't catch: a leak
 * that spreads a raw row into an innocuously-named field. It's also the
 * check that makes seeding real (non-null) secret values in the
 * integration test matter — a scan over null/undefined columns can't leak
 * anything, so it would pass whether or not the protection actually works.
 */
export function assertNoLeakedValues(value: unknown, secrets: readonly string[], path = "$"): void {
  const lowerSecrets = secrets.filter((s) => s.length > 0).map((s) => s.toLowerCase());
  if (lowerSecrets.length === 0) {
    throw new Error("assertNoLeakedValues called with no non-empty secrets — this check would pass vacuously");
  }
  walk(value, path);

  function walk(node: unknown, nodePath: string): void {
    if (node === null || node === undefined) return;
    if (typeof node === "string") {
      const lower = node.toLowerCase();
      for (const secret of lowerSecrets) {
        expect(
          lower.includes(secret),
          `leaked secret value found at ${nodePath} (contains a seeded wallet/chat_id/fromAddress) — protocol-facing responses must be aggregate-only`,
        ).toBe(false);
      }
      return;
    }
    if (typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${nodePath}[${i}]`));
      return;
    }
    for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
      walk(val, `${nodePath}.${key}`);
    }
  }
}
