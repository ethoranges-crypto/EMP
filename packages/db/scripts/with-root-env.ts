import { spawnSync } from "node:child_process";
import { loadRootEnvFile } from "@emp/config";

/**
 * The `prisma` CLI has its own env-file discovery (it looks next to
 * schema.prisma), which is exactly the "each package reads its own env
 * file" problem — this wrapper loads the repo-root .env into this
 * process's env first, then execs the given command so it inherits those
 * vars instead of prisma finding (or not finding) anything on its own.
 */
loadRootEnvFile();

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) throw new Error("Usage: tsx scripts/with-root-env.ts <command> [args...]");
const result = spawnSync(cmd, args, {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
