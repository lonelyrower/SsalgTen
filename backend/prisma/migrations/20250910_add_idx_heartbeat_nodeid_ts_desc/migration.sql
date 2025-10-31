-- Optimize latest-heartbeat queries
-- This index matches SELECT DISTINCT ON ("nodeId") ... ORDER BY "nodeId", "timestamp" DESC
CREATE INDEX IF NOT EXISTS "idx_heartbeatLog_nodeId_timestamp_desc"
  ON "public"."heartbeat_logs"("nodeId", "timestamp" DESC);

