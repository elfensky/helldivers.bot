-- CreateTable
CREATE TABLE "api_rate_limit" (
    "key" TEXT NOT NULL,
    "route_group" TEXT NOT NULL,
    "window_start" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "api_rate_limit_pkey" PRIMARY KEY ("key", "route_group", "window_start")
);

-- CreateIndex
CREATE INDEX "api_rate_limit_window_start_idx" ON "api_rate_limit"("window_start");
