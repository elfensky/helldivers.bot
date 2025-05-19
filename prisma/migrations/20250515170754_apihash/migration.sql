/*
  Warnings:

  - A unique constraint covering the columns `[hash]` on the table `ApiKey` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `hash` to the `ApiKey` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "hash" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_hash_key" ON "ApiKey"("hash");
