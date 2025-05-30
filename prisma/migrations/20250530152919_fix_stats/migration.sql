-- CreateIndex
CREATE INDEX "h1_campaign_season_introduction_order_idx" ON "h1_campaign"("season", "introduction_order");

-- CreateIndex
CREATE INDEX "h1_statistic_season_idx" ON "h1_statistic"("season");
