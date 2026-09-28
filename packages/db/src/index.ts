import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "./generated/prisma/client";

export * from "./generated/prisma/client";
export * as Enums from "./generated/prisma/enums";

// Neon is the target host, but nothing above this file knows that. The adapter
// is the only place that decides how bytes reach Postgres, so swapping to plain
// `pg` later is a one-file change.
function createAdapter() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill in your Postgres connection string.",
    );
  }

  // Opt-in host assertion, free at runtime: a substring check, no query.
  //
  // This exists because of a real incident. The verification scripts run against
  // the demo branch, but application code reaches the database through the
  // shared client below, which reads DATABASE_URL. A script that built its own
  // client pointed at the demo branch while the code under test used the shared
  // one pointed at production, so the two silently talked to different
  // databases. Nothing errored; the assertions just quietly failed.
  //
  // Setting PRISMA_EXPECT_HOST makes that mistake impossible to miss. It is
  // opt-in so a production cold start pays nothing.
  const expectHost = process.env.PRISMA_EXPECT_HOST;
  if (expectHost && !connectionString.includes(expectHost)) {
    throw new Error(
      `Refusing to connect: DATABASE_URL does not contain "${expectHost}".\n` +
        "This process was told to talk to a specific database and is pointed " +
        "somewhere else. Set DATABASE_URL before importing anything that " +
        "touches the database, or unset PRISMA_EXPECT_HOST to remove the check.",
    );
  }

  return new PrismaNeon({ connectionString });
}

let client: PrismaClient | null = null;

/**
 * Construction is deferred to first use, not done at import time.
 *
 * ES modules evaluate every import before any statement in the importing file
 * runs, so a client built at module scope is created before the caller has had
 * any chance to load its .env. That produced a confusing "DATABASE_URL is not
 * set" error even though the variable was present on disk. It also breaks
 * `next build`, which imports modules without runtime env.
 */
export function getPrisma(): PrismaClient {
  if (client) return client;

  client = new PrismaClient({
    adapter: createAdapter(),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  // In development the dev server reloads modules on save; without this each
  // reload would open a fresh connection pool until Postgres refuses new ones.
  if (process.env.NODE_ENV !== "production") {
    const store = globalThis as unknown as { __fixbondhuPrisma?: PrismaClient };
    if (store.__fixbondhuPrisma) {
      client = store.__fixbondhuPrisma;
    } else {
      store.__fixbondhuPrisma = client;
    }
  }

  return client;
}

/**
 * Proxy so existing call sites keep the ergonomic `prisma.user.findMany()`
 * shape while construction stays lazy.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const instance = getPrisma();
    const value = Reflect.get(instance, property, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
