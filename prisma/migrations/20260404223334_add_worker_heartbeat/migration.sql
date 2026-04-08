-- CreateTable
CREATE TABLE "worker_heartbeat" (
    "worker_type" TEXT NOT NULL,
    "last_beat" TIMESTAMP(3) NOT NULL,
    "poll_duration_ms" INTEGER,
    "last_error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_heartbeat_pkey" PRIMARY KEY ("worker_type")
);
