-- Poller lease (#517): who polls, until when, and the state a successor inherits.
ALTER TABLE "worker_heartbeat"
    ADD COLUMN "holder_id" TEXT,
    ADD COLUMN "lease_until" TIMESTAMP(3),
    ADD COLUMN "prev_events" JSONB,
    ADD COLUMN "last_season_observed" INTEGER;
