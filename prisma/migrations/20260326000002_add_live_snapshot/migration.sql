-- Create h1_live_snapshot table for time-series statistics
CREATE TABLE "h1_live_snapshot" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "time" INTEGER NOT NULL,
    "enemy" INTEGER NOT NULL,
    "season_duration" INTEGER NOT NULL,
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

    CONSTRAINT "h1_live_snapshot_pkey" PRIMARY KEY ("id")
);

-- Unique constraint (also serves as the primary lookup index)
CREATE UNIQUE INDEX "h1_live_snapshot_season_enemy_time_key" ON "h1_live_snapshot"("season", "enemy", "time");

-- Cross-faction time range queries
CREATE INDEX "h1_live_snapshot_season_time_idx" ON "h1_live_snapshot"("season", "time");

-- Foreign key to h1_season
ALTER TABLE "h1_live_snapshot" ADD CONSTRAINT "h1_live_snapshot_season_fkey" FOREIGN KEY ("season") REFERENCES "h1_season"("season") ON DELETE RESTRICT ON UPDATE CASCADE;
