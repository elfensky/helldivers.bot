/*
  Warnings:

  - You are about to drop the column `settings` on the `App` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[season]` on the table `rebroadcast_status` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `season` to the `rebroadcast_status` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "App" DROP COLUMN "settings",
ADD COLUMN     "active_season" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "rebroadcast_status" ADD COLUMN     "season" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "rebroadcast_status_season_key" ON "rebroadcast_status"("season");
