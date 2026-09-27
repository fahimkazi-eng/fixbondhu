-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "searchSkeleton" TEXT;

-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "searchSkeleton" TEXT;

-- AlterTable
ALTER TABLE "provider_profiles" ADD COLUMN     "searchSkeleton" TEXT;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "searchSkeleton" TEXT;

-- CreateIndex
CREATE INDEX "categories_search_skel_idx" ON "categories" USING GIN ("searchSkeleton" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "locations_search_skel_idx" ON "locations" USING GIN ("searchSkeleton" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "provider_profiles_search_skel_idx" ON "provider_profiles" USING GIN ("searchSkeleton" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "services_search_skel_idx" ON "services" USING GIN ("searchSkeleton" gin_trgm_ops);
