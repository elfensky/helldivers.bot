-- Seed state (#599): one row, the hash of the seed inputs from the last successful seed.
CREATE TABLE "seed_state" (
    "id" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "applied_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seed_state_pkey" PRIMARY KEY ("id")
);
