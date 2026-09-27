-- pg_trgm powers the fuzzy matching that lets "fan thik korte hobe" reach the
-- Fan Repair service. Prisma cannot express CREATE EXTENSION, so it is declared
-- here to keep this migration self-contained and reproducible on a fresh
-- database. IF NOT EXISTS makes it safe to re-run.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "searchText" TEXT;

-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "searchText" TEXT;

-- AlterTable
ALTER TABLE "provider_profiles" ADD COLUMN     "searchText" TEXT;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "searchText" TEXT;

-- CreateIndex
CREATE INDEX "categories_search_trgm_idx" ON "categories" USING GIN ("searchText" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "locations_search_trgm_idx" ON "locations" USING GIN ("searchText" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "provider_profiles_search_trgm_idx" ON "provider_profiles" USING GIN ("searchText" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "services_search_trgm_idx" ON "services" USING GIN ("searchText" gin_trgm_ops);
