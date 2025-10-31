-- CreateIndex
-- Add performance indexes for Node table to fix slow query issues with 400+ nodes
-- These indexes optimize queries that filter/sort by agentId, status, and lastSeen

CREATE INDEX IF NOT EXISTS "idx_nodes_agentid" ON "nodes"("agentId");
CREATE INDEX IF NOT EXISTS "idx_nodes_status" ON "nodes"("status");
CREATE INDEX IF NOT EXISTS "idx_nodes_lastseen" ON "nodes"("lastSeen" DESC);
CREATE INDEX IF NOT EXISTS "idx_nodes_status_lastseen" ON "nodes"("status", "lastSeen" DESC);
