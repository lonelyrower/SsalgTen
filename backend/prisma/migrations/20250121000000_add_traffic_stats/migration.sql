-- CreateTable
CREATE TABLE IF NOT EXISTS "traffic_stats" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "totalUpload" BIGINT NOT NULL DEFAULT 0,
    "totalDownload" BIGINT NOT NULL DEFAULT 0,
    "periodUpload" BIGINT NOT NULL DEFAULT 0,
    "periodDownload" BIGINT NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRxBytes" BIGINT,
    "lastTxBytes" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "traffic_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "traffic_stats_nodeId_key" ON "traffic_stats"("nodeId");

-- AddForeignKey
ALTER TABLE "traffic_stats" ADD CONSTRAINT "traffic_stats_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
