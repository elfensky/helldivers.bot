/*
  Warnings:

  - Added the required column `visible` to the `ApiKey` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "visible" TEXT NOT NULL;
