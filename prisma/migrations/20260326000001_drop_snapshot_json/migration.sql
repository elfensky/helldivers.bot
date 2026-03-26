-- Drop redundant json column from h1_snapshot (Phase 1 gap)
ALTER TABLE "h1_snapshot" DROP COLUMN IF EXISTS "json";

-- Drop redundant index (unique constraint already covers this)
DROP INDEX IF EXISTS "h1_snapshot_season_time_idx";
