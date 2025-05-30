/*
  Warnings:

  - You are about to drop the `h1_attack_events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `h1_defend_events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `h1_statistics` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "h1_attack_events" DROP CONSTRAINT "h1_attack_events_season_fkey";

-- DropForeignKey
ALTER TABLE "h1_defend_events" DROP CONSTRAINT "h1_defend_events_season_fkey";

-- DropForeignKey
ALTER TABLE "h1_statistics" DROP CONSTRAINT "h1_statistics_season_fkey";

-- DropTable
DROP TABLE "h1_attack_events";

-- DropTable
DROP TABLE "h1_defend_events";

-- DropTable
DROP TABLE "h1_statistics";

-- CreateTable
CREATE TABLE "h1_defend_event" (
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

    CONSTRAINT "h1_defend_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "h1_attack_event" (
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

    CONSTRAINT "h1_attack_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "h1_statistic" (
    "id" TEXT NOT NULL,
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

    CONSTRAINT "h1_statistic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "h1_defend_event_event_id_key" ON "h1_defend_event"("event_id");

-- CreateIndex
CREATE INDEX "h1_defend_event_event_id_idx" ON "h1_defend_event"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "h1_attack_event_event_id_key" ON "h1_attack_event"("event_id");

-- CreateIndex
CREATE INDEX "h1_attack_event_event_id_idx" ON "h1_attack_event"("event_id");

-- CreateIndex
CREATE INDEX "h1_statistic_season_enemy_idx" ON "h1_statistic"("season", "enemy");

-- CreateIndex
CREATE UNIQUE INDEX "h1_statistic_season_enemy_key" ON "h1_statistic"("season", "enemy");

-- AddForeignKey
ALTER TABLE "h1_defend_event" ADD CONSTRAINT "h1_defend_event_season_fkey" FOREIGN KEY ("season") REFERENCES "h1_season"("season") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "h1_attack_event" ADD CONSTRAINT "h1_attack_event_season_fkey" FOREIGN KEY ("season") REFERENCES "h1_season"("season") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "h1_statistic" ADD CONSTRAINT "h1_statistic_season_fkey" FOREIGN KEY ("season") REFERENCES "h1_season"("season") ON DELETE RESTRICT ON UPDATE CASCADE;
