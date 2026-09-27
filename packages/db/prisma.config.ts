import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

// `.env` lives at the repo root, but the Prisma CLI is invoked from
// packages/db. dotenv's default single-path lookup would not find it, so
// resolve it explicitly.
const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(here, "../../.env"), quiet: true });
loadEnv({ path: path.resolve(here, "../../.env.local"), override: true, quiet: true });

// Migrations need a direct (non-pooled) connection. Neon exposes this as the
// non-`-pooler` host. Falling back to DATABASE_URL keeps local Postgres
// working, where both are the same string.
const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || "";

export default defineConfig({
  schema: path.join(here, "prisma", "schema.prisma"),
  migrations: {
    path: path.join(here, "prisma", "migrations"),
    seed: "tsx src/seed.ts",
  },
  // Intentionally not `env()`: `prisma generate` also loads this file and must
  // not hard-fail when no database is configured yet (CI typecheck stage).
  datasource: {
    url: directUrl,
  },
});
