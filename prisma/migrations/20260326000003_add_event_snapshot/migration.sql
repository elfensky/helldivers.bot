-- Create h1_event_snapshot table for event progress tracking
CREATE TABLE "h1_event_snapshot" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "event_id" INTEGER NOT NULL,
    "time" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "points_max" INTEGER NOT NULL,

    CONSTRAINT "h1_event_snapshot_pkey" PRIMARY KEY ("id")
);

-- Unique constraint (prevents duplicate snapshots for same event at same time)
CREATE UNIQUE INDEX "h1_event_snapshot_type_event_id_time_key" ON "h1_event_snapshot"("type", "event_id", "time");

-- Per-season time range queries (War History page)
CREATE INDEX "h1_event_snapshot_season_time_idx" ON "h1_event_snapshot"("season", "time");

-- Per-event time range queries (event detail charts)
CREATE INDEX "h1_event_snapshot_event_id_time_idx" ON "h1_event_snapshot"("event_id", "time");

-- Foreign key to h1_event
ALTER TABLE "h1_event_snapshot" ADD CONSTRAINT "h1_event_snapshot_type_event_id_fkey" FOREIGN KEY ("type", "event_id") REFERENCES "h1_event"("type", "event_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign key to h1_season
ALTER TABLE "h1_event_snapshot" ADD CONSTRAINT "h1_event_snapshot_season_fkey" FOREIGN KEY ("season") REFERENCES "h1_season"("season") ON DELETE RESTRICT ON UPDATE CASCADE;
