import { existsSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";

/**
 * Locates the repo-root .env.
 *
 * The monorepo keeps one .env at the root, but Next.js, tsx and the Prisma CLI
 * all resolve relative to their own working directory, so none of them find it
 * on their own. Importing this module first guarantees the variables exist
 * before anything reads them.
 *
 * Values already present in the environment always win. That ordering is what
 * makes production safe: on Vercel the variables come from the dashboard, and
 * a stray file on disk must never be able to override a real secret.
 */
let loaded = false;

export function loadRootEnv(): void {
  if (loaded) return;
  loaded = true;

  /*
   * Production gets its variables from the deployment platform. Reading files
   * here would also defeat bundler tracing: Turbopack cannot statically scope a
   * dynamic existsSync, so it would trace and ship the entire repository
   * including the public folder.
   */
  if (process.env.NODE_ENV === "production") return;

  const candidates = [
    path.resolve(process.cwd(), "../../.env.local"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(process.cwd(), "../.env.local"),
    path.resolve(process.cwd(), "../.env"),
  ];

  for (const candidate of candidates) {
    // turbopackIgnore: dev-only lookup, never traced into a deployment.
    if (!existsSync(/* turbopackIgnore: true */ candidate)) continue;
    // override: false, so the environment always takes precedence.
    loadEnv({ path: candidate, override: false, quiet: true });
  }
}
