/*
  Warnings:

  - You are about to drop the column `hash` on the `h1_statistics` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[season,enemy]` on the table `h1_statistics` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "h1_statistics_hash_idx";

-- DropIndex
DROP INDEX "h1_statistics_hash_key";

-- DropIndex
DROP INDEX "h1_statistics_season_idx";

-- DropIndex
DROP INDEX "h1_statistics_time_idx";

-- AlterTable
ALTER TABLE "h1_statistics" DROP COLUMN "hash";

-- CreateIndex
CREATE INDEX "h1_statistics_season_enemy_idx" ON "h1_statistics"("season", "enemy");

-- CreateIndex
CREATE UNIQUE INDEX "h1_statistics_season_enemy_key" ON "h1_statistics"("season", "enemy");
