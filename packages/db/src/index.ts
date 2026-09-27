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
  return new PrismaNeon({ connectionString });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: createAdapter(),
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
