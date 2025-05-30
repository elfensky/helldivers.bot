/*
  Warnings:

  - Changed the type of `deaths` on the `h1_statistic` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `kills` on the `h1_statistic` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `accidentals` on the `h1_statistic` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `shots` on the `h1_statistic` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `hits` on the `h1_statistic` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "h1_statistic" DROP COLUMN "deaths",
ADD COLUMN     "deaths" INTEGER NOT NULL,
DROP COLUMN "kills",
ADD COLUMN     "kills" INTEGER NOT NULL,
DROP COLUMN "accidentals",
ADD COLUMN     "accidentals" INTEGER NOT NULL,
DROP COLUMN "shots",
ADD COLUMN     "shots" INTEGER NOT NULL,
DROP COLUMN "hits",
ADD COLUMN     "hits" INTEGER NOT NULL;
