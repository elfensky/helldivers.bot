-- Phase 1: Backend & Database Restructure
-- Backfill h1_event from old tables, then drop them

-- Step 1: Update h1_event unique constraint
ALTER TABLE "h1_event" DROP CONSTRAINT IF EXISTS "h1_event_event_id_key";

-- Step 2: Backfill h1_event from h1_defend_event
INSERT INTO "h1_event" (id, season, type, event_id, start_time, end_time, region, enemy, points_max, points, status, players_at_start)
SELECT id, season, 'defend', event_id, start_time, end_time, region, enemy, points_max, points, status, players_at_start
FROM "h1_defend_event"
ON CONFLICT DO NOTHING;

-- Step 3: Backfill h1_event from h1_attack_event
INSERT INTO "h1_event" (id, season, type, event_id, start_time, end_time, region, enemy, points_max, points, status, players_at_start)
SELECT id, season, 'attack', event_id, start_time, end_time, 11, enemy, points_max, points, status, players_at_start
FROM "h1_attack_event"
ON CONFLICT DO NOTHING;

-- Step 4: Add new unique constraint on h1_event
CREATE UNIQUE INDEX "h1_event_type_event_id_key" ON "h1_event"("type", "event_id");

-- Step 5: Add composite indexes on h1_event
CREATE INDEX "h1_event_season_type_idx" ON "h1_event"("season", "type");
CREATE INDEX "h1_event_season_status_idx" ON "h1_event"("season", "status");
CREATE INDEX "h1_event_season_enemy_idx" ON "h1_event"("season", "enemy");

-- Step 6: Remove old event_id index
DROP INDEX IF EXISTS "h1_event_event_id_idx";

-- Step 7: Drop old event tables
DROP TABLE IF EXISTS "h1_defend_event";
DROP TABLE IF EXISTS "h1_attack_event";

-- Step 8: Drop redundant json fields
ALTER TABLE "h1_introduction_order" DROP COLUMN IF EXISTS "json";
ALTER TABLE "h1_points_max" DROP COLUMN IF EXISTS "json";

-- Step 9: Drop old campaign/statistic tables
DROP TABLE IF EXISTS "h1_campaign";
DROP TABLE IF EXISTS "h1_statistic";

-- Step 10: Remove map from App
ALTER TABLE "App" DROP COLUMN IF EXISTS "map";

-- Step 11: Create h1_live table
CREATE TABLE "h1_live" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "enemy" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "points_taken" INTEGER NOT NULL,
    "points_max" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "introduction_order" INTEGER NOT NULL,
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
    "map" JSONB,

    CONSTRAINT "h1_live_pkey" PRIMARY KEY ("id")
);

-- Step 12: Add h1_live indexes
CREATE UNIQUE INDEX "h1_live_season_enemy_key" ON "h1_live"("season", "enemy");
CREATE INDEX "h1_live_season_enemy_idx" ON "h1_live"("season", "enemy");
CREATE INDEX "h1_live_season_idx" ON "h1_live"("season");

-- Step 13: Add h1_live foreign key
ALTER TABLE "h1_live" ADD CONSTRAINT "h1_live_season_fkey" FOREIGN KEY ("season") REFERENCES "h1_season"("season") ON DELETE RESTRICT ON UPDATE CASCADE;
