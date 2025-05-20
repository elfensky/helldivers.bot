/*
  Warnings:

  - You are about to drop the column `attack_events` on the `h1_status` table. All the data in the column will be lost.
  - You are about to drop the column `campaign_status` on the `h1_status` table. All the data in the column will be lost.
  - You are about to drop the column `defend_event` on the `h1_status` table. All the data in the column will be lost.
  - You are about to drop the column `statistics` on the `h1_status` table. All the data in the column will be lost.
  - You are about to drop the column `time` on the `h1_status` table. All the data in the column will be lost.
  - Added the required column `introduction_order` to the `h1_status` table without a default value. This is not possible if the table is not empty.
  - Added the required column `points` to the `h1_status` table without a default value. This is not possible if the table is not empty.
  - Added the required column `points_max` to the `h1_status` table without a default value. This is not possible if the table is not empty.
  - Added the required column `points_taken` to the `h1_status` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `h1_status` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "h1_status_time_key";

-- AlterTable
ALTER TABLE "h1_status" DROP COLUMN "attack_events",
DROP COLUMN "campaign_status",
DROP COLUMN "defend_event",
DROP COLUMN "statistics",
DROP COLUMN "time",
ADD COLUMN     "introduction_order" INTEGER NOT NULL,
ADD COLUMN     "points" INTEGER NOT NULL,
ADD COLUMN     "points_max" INTEGER NOT NULL,
ADD COLUMN     "points_taken" INTEGER NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "rebroadcast_status" (
    "id" TEXT NOT NULL,
    "json" JSONB NOT NULL,

    CONSTRAINT "rebroadcast_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rebroadcast_snapshot" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "json" JSONB NOT NULL,

    CONSTRAINT "rebroadcast_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "h1_season" (
    "id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "season" INTEGER NOT NULL,

    CONSTRAINT "h1_season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "h1_introduction_order" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "order" INTEGER[],
    "json" JSONB NOT NULL,

    CONSTRAINT "h1_introduction_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "h1_points_max" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "points" INTEGER[],
    "json" JSONB NOT NULL,

    CONSTRAINT "h1_points_max_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "h1_snapshot" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,
    "json" JSONB NOT NULL,

    CONSTRAINT "h1_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "h1_defend_events" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "event_id" INTEGER NOT NULL,
    "start_time" INTEGER NOT NULL,
    "end_time" INTEGER NOT NULL,
    "region" INTEGER NOT NULL,
    "enemy" INTEGER NOT NULL,
    "points_max" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "players_at_start" INTEGER,

    CONSTRAINT "h1_defend_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "h1_attack_events" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "event_id" INTEGER NOT NULL,
    "start_time" INTEGER NOT NULL,
    "end_time" INTEGER NOT NULL,
    "enemy" INTEGER NOT NULL,
    "points_max" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "players_at_start" INTEGER,

    CONSTRAINT "h1_attack_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "h1_statistics" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "time" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "season_duration" INTEGER NOT NULL,
    "enemy" INTEGER NOT NULL,
    "players" INTEGER NOT NULL,
    "total_unique_players" INTEGER NOT NULL,
    "missions" INTEGER NOT NULL,
    "successful_missions" INTEGER NOT NULL,
    "total_mission_difficulty" INTEGER NOT NULL,
    "completed_planets" INTEGER NOT NULL,
    "defend_events" INTEGER NOT NULL,
    "successful_defend_events" INTEGER NOT NULL,
    "attack_events" INTEGER NOT NULL,
    "successful_attack_events" INTEGER NOT NULL,
    "deaths" BIGINT NOT NULL,
    "kills" BIGINT NOT NULL,
    "accidentals" BIGINT NOT NULL,
    "shots" BIGINT NOT NULL,
    "hits" BIGINT NOT NULL,

    CONSTRAINT "h1_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rebroadcast_snapshot_season_key" ON "rebroadcast_snapshot"("season");

-- CreateIndex
CREATE UNIQUE INDEX "h1_season_season_key" ON "h1_season"("season");

-- CreateIndex
CREATE INDEX "h1_season_season_idx" ON "h1_season"("season");

-- CreateIndex
CREATE UNIQUE INDEX "h1_introduction_order_season_key" ON "h1_introduction_order"("season");

-- CreateIndex
CREATE INDEX "h1_introduction_order_season_idx" ON "h1_introduction_order"("season");

-- CreateIndex
CREATE UNIQUE INDEX "h1_points_max_season_key" ON "h1_points_max"("season");

-- CreateIndex
CREATE INDEX "h1_points_max_season_idx" ON "h1_points_max"("season");

-- CreateIndex
CREATE INDEX "h1_snapshot_season_idx" ON "h1_snapshot"("season");

-- CreateIndex
CREATE UNIQUE INDEX "h1_defend_events_event_id_key" ON "h1_defend_events"("event_id");

-- CreateIndex
CREATE INDEX "h1_defend_events_event_id_idx" ON "h1_defend_events"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "h1_attack_events_event_id_key" ON "h1_attack_events"("event_id");

-- CreateIndex
CREATE INDEX "h1_attack_events_event_id_idx" ON "h1_attack_events"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "h1_statistics_hash_key" ON "h1_statistics"("hash");

-- CreateIndex
CREATE INDEX "h1_statistics_hash_idx" ON "h1_statistics"("hash");

-- CreateIndex
CREATE INDEX "h1_statistics_time_idx" ON "h1_statistics"("time");

-- CreateIndex
CREATE INDEX "h1_statistics_season_idx" ON "h1_statistics"("season");

-- CreateIndex
CREATE INDEX "h1_status_season_idx" ON "h1_status"("season");

-- AddForeignKey
ALTER TABLE "h1_introduction_order" ADD CONSTRAINT "h1_introduction_order_season_fkey" FOREIGN KEY ("season") REFERENCES "h1_season"("season") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "h1_points_max" ADD CONSTRAINT "h1_points_max_season_fkey" FOREIGN KEY ("season") REFERENCES "h1_season"("season") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "h1_snapshot" ADD CONSTRAINT "h1_snapshot_season_fkey" FOREIGN KEY ("season") REFERENCES "h1_season"("season") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "h1_defend_events" ADD CONSTRAINT "h1_defend_events_season_fkey" FOREIGN KEY ("season") REFERENCES "h1_season"("season") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "h1_attack_events" ADD CONSTRAINT "h1_attack_events_season_fkey" FOREIGN KEY ("season") REFERENCES "h1_season"("season") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "h1_statistics" ADD CONSTRAINT "h1_statistics_season_fkey" FOREIGN KEY ("season") REFERENCES "h1_season"("season") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "h1_status" ADD CONSTRAINT "h1_status_season_fkey" FOREIGN KEY ("season") REFERENCES "h1_season"("season") ON DELETE RESTRICT ON UPDATE CASCADE;
