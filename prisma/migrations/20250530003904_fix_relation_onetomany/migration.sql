/*
  Warnings:

  - You are about to drop the column `is_db_initialized` on the `App` table. All the data in the column will be lost.
  - You are about to drop the `h1_status` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "h1_status" DROP CONSTRAINT "h1_status_season_fkey";

-- AlterTable
ALTER TABLE "App" DROP COLUMN "is_db_initialized";

-- DropTable
DROP TABLE "h1_status";

-- CreateTable
CREATE TABLE "h1_campaign" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "points_taken" INTEGER NOT NULL,
    "points_max" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "introduction_order" INTEGER NOT NULL,

    CONSTRAINT "h1_campaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "h1_campaign_season_key" ON "h1_campaign"("season");

-- CreateIndex
CREATE INDEX "h1_campaign_season_idx" ON "h1_campaign"("season");

-- AddForeignKey
ALTER TABLE "h1_campaign" ADD CONSTRAINT "h1_campaign_season_fkey" FOREIGN KEY ("season") REFERENCES "h1_season"("season") ON DELETE RESTRICT ON UPDATE CASCADE;
