/*
  Warnings:

  - Changed the type of `time` on the `h1_snapshot` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "h1_snapshot" DROP COLUMN "time",
ADD COLUMN     "time" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "h1_snapshot_season_time_idx" ON "h1_snapshot"("season", "time");

-- CreateIndex
CREATE UNIQUE INDEX "h1_snapshot_season_time_key" ON "h1_snapshot"("season", "time");
