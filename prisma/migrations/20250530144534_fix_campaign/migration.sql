-- DropIndex
DROP INDEX "h1_campaign_season_key";

-- AlterTable
ALTER TABLE "App" ADD COLUMN     "active_season" INTEGER NOT NULL DEFAULT 0;
