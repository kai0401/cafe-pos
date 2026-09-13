-- CreateTable
CREATE TABLE "ops_heartbeats" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'pi',
    "hostname" TEXT,
    "lan_ip" TEXT,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_heartbeats_pkey" PRIMARY KEY ("id")
);
