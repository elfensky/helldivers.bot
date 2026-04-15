/*
  Warnings:

  - You are about to drop the column `attack_events` on the `h1_statistic` table. All the data in the column will be lost.
  - You are about to drop the column `defend_events` on the `h1_statistic` table. All the data in the column will be lost.
  - You are about to drop the column `season_duration` on the `h1_statistic` table. All the data in the column will be lost.
  - You are about to drop the column `successful_attack_events` on the `h1_statistic` table. All the data in the column will be lost.
  - You are about to drop the column `successful_defend_events` on the `h1_statistic` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "h1_season" ADD COLUMN     "season_duration" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "h1_statistic" DROP COLUMN "attack_events",
DROP COLUMN "defend_events",
DROP COLUMN "season_duration",
DROP COLUMN "successful_attack_events",
DROP COLUMN "successful_defend_events";
