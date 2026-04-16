/*
  Warnings:

  - You are about to drop the `App` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Review` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Verification` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_authorId_fkey";

-- DropTable
DROP TABLE "App";

-- DropTable
DROP TABLE "Review";

-- DropTable
DROP TABLE "Verification";
