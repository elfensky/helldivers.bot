/*
  Warnings:

  - You are about to drop the column `is_active` on the `h1_season` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "h1_season_is_active_idx";

-- DropIndex
DROP INDEX "h1_season_is_active_last_updated_idx";

-- AlterTable
ALTER TABLE "h1_season" DROP COLUMN "is_active";
