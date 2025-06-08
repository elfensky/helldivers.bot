-- AlterTable
ALTER TABLE "h1_season" ALTER COLUMN "last_updated" DROP NOT NULL,
ALTER COLUMN "last_updated" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "h1_season_is_active_idx" ON "h1_season"("is_active");

-- CreateIndex
CREATE INDEX "h1_season_last_updated_idx" ON "h1_season"("last_updated");

-- CreateIndex
CREATE INDEX "h1_season_is_active_last_updated_idx" ON "h1_season"("is_active", "last_updated");
