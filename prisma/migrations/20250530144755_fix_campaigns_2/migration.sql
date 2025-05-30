/*
  Warnings:

  - A unique constraint covering the columns `[season,introduction_order]` on the table `h1_campaign` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "h1_campaign_season_introduction_order_key" ON "h1_campaign"("season", "introduction_order");
