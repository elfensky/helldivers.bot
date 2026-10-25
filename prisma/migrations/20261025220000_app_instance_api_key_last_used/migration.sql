-- Replica registry (#596): one row per running process, roles derived on read.
CREATE TABLE "app_instance" (
    "id" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "worker_enabled" BOOLEAN NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "last_seen" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_instance_pkey" PRIMARY KEY ("id")
);

-- API key last use (#596): stamped at most once a minute by validateApiKey.
ALTER TABLE "ApiKey" ADD COLUMN "lastUsedAt" TIMESTAMP(3);
