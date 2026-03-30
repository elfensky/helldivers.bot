-- CreateTable
CREATE TABLE "h1_event" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "event_id" INTEGER NOT NULL,
    "start_time" INTEGER NOT NULL,
    "end_time" INTEGER NOT NULL,
    "region" INTEGER NOT NULL,
    "enemy" INTEGER NOT NULL,
    "points_max" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "players_at_start" INTEGER,

    CONSTRAINT "h1_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "h1_event_event_id_key" ON "h1_event"("event_id");

-- CreateIndex
CREATE INDEX "h1_event_event_id_idx" ON "h1_event"("event_id");

-- AddForeignKey
ALTER TABLE "h1_event" ADD CONSTRAINT "h1_event_season_fkey" FOREIGN KEY ("season") REFERENCES "h1_season"("season") ON DELETE RESTRICT ON UPDATE CASCADE;
