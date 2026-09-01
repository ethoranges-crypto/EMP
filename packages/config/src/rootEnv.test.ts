import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadRootEnvFile, resetRootEnvLoadedForTests } from "./rootEnv.js";

describe("loadRootEnvFile", () => {
  let fakeRepoDir: string;
  const testKey = "EMP_ROOT_ENV_TEST_VAR";

  beforeEach(() => {
    resetRootEnvLoadedForTests();
    fakeRepoDir = mkdtempSync(join(tmpdir(), "emp-rootenv-test-"));
    writeFileSync(join(fakeRepoDir, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
    delete process.env[testKey];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env[testKey];
    rmSync(fakeRepoDir, { recursive: true, force: true });
  });

  it("finds the repo root from process.cwd() and loads its .env", () => {
    writeFileSync(join(fakeRepoDir, ".env"), `${testKey}=from-file\n`);
    vi.spyOn(process, "cwd").mockReturnValue(join(fakeRepoDir, "apps", "worker"));

    loadRootEnvFile();

    expect(process.env[testKey]).toBe("from-file");
  });

  it("overrides an already-present blank value — the stray-env-var footgun this exists to fix", () => {
    // Simulates a stray Windows user/system env var (or leftover shell
    // export) that's present but blank *before* the file is ever read —
    // dotenv's default behavior would leave this alone forever.
    process.env[testKey] = "";
    writeFileSync(join(fakeRepoDir, ".env"), `${testKey}=from-file\n`);
    vi.spyOn(process, "cwd").mockReturnValue(fakeRepoDir);

    loadRootEnvFile();

    expect(process.env[testKey]).toBe("from-file");
  });

  it("only loads once per process — a second call is a no-op even for a different cwd", () => {
    writeFileSync(join(fakeRepoDir, ".env"), `${testKey}=first\n`);
    vi.spyOn(process, "cwd").mockReturnValue(fakeRepoDir);
    loadRootEnvFile();
    expect(process.env[testKey]).toBe("first");

    const secondDir = mkdtempSync(join(tmpdir(), "emp-rootenv-test-2-"));
    try {
      writeFileSync(join(secondDir, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
      writeFileSync(join(secondDir, ".env"), `${testKey}=second\n`);
      vi.spyOn(process, "cwd").mockReturnValue(secondDir);

      loadRootEnvFile();

      expect(process.env[testKey]).toBe("first");
    } finally {
      rmSync(secondDir, { recursive: true, force: true });
    }
  });

  it("does not throw when no pnpm-workspace.yaml is found above cwd", () => {
    // cwd is outside any repo, so this falls back to import.meta.url's own
    // location — which, running inside this monorepo's real checkout, DOES
    // find the real root and load the real .env as a side effect. That's
    // fine and expected (see the doc comment: cwd first, then that
    // fallback); the point of this test is just that a genuinely
    // unresolvable case never throws, matching "no-ops after warning".
    const outsideDir = mkdtempSync(join(tmpdir(), "emp-rootenv-outside-"));
    try {
      vi.spyOn(process, "cwd").mockReturnValue(outsideDir);
      expect(() => loadRootEnvFile()).not.toThrow();
    } finally {
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });
});
