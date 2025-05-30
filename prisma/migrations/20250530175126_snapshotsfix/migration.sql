/*
  Warnings:

  - A unique constraint covering the columns `[season,time]` on the table `h1_snapshot` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "h1_snapshot_season_time_idx" ON "h1_snapshot"("season", "time");

-- CreateIndex
CREATE UNIQUE INDEX "h1_snapshot_season_time_key" ON "h1_snapshot"("season", "time");
