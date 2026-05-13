-- AlterTable
ALTER TABLE "h1_season" ADD COLUMN     "intro_order_array" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "points_max_array" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- CreateTable
CREATE TABLE "h1_status" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "enemy" INTEGER NOT NULL,
    "bucket" INTEGER NOT NULL,
    "time" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "points_taken" INTEGER NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "h1_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "h1_statistic" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "enemy" INTEGER NOT NULL,
    "bucket" INTEGER NOT NULL,
    "time" INTEGER NOT NULL,
    "players" INTEGER NOT NULL,
    "total_unique_players" INTEGER NOT NULL,
    "kills" BIGINT NOT NULL,
    "deaths" BIGINT NOT NULL,

    CONSTRAINT "h1_statistic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "h1_event_progress" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "event_id" INTEGER NOT NULL,
    "bucket" INTEGER NOT NULL,
    "time" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,

    CONSTRAINT "h1_event_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "h1_status_season_bucket_idx" ON "h1_status"("season", "bucket");

-- CreateIndex
CREATE INDEX "h1_status_season_idx" ON "h1_status"("season");

-- CreateIndex
CREATE UNIQUE INDEX "h1_status_season_enemy_bucket_key" ON "h1_status"("season", "enemy", "bucket");

-- CreateIndex
CREATE INDEX "h1_statistic_season_bucket_idx" ON "h1_statistic"("season", "bucket");

-- CreateIndex
CREATE INDEX "h1_statistic_season_idx" ON "h1_statistic"("season");

-- CreateIndex
CREATE UNIQUE INDEX "h1_statistic_season_enemy_bucket_key" ON "h1_statistic"("season", "enemy", "bucket");

-- CreateIndex
CREATE INDEX "h1_event_progress_type_event_id_bucket_idx" ON "h1_event_progress"("type", "event_id", "bucket");

-- CreateIndex
CREATE UNIQUE INDEX "h1_event_progress_type_event_id_bucket_key" ON "h1_event_progress"("type", "event_id", "bucket");

-- AddForeignKey
ALTER TABLE "h1_status" ADD CONSTRAINT "h1_status_season_fkey" FOREIGN KEY ("season") REFERENCES "h1_season"("season") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "h1_statistic" ADD CONSTRAINT "h1_statistic_season_fkey" FOREIGN KEY ("season") REFERENCES "h1_season"("season") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "h1_event_progress" ADD CONSTRAINT "h1_event_progress_type_event_id_fkey" FOREIGN KEY ("type", "event_id") REFERENCES "h1_event"("type", "event_id") ON DELETE RESTRICT ON UPDATE CASCADE;
