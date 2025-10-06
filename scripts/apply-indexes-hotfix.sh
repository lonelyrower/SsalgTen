#!/bin/bash
# Hot-fix script to apply critical database indexes
# This fixes the slow query issue causing connection pool exhaustion

set -e

echo "🔧 Applying critical database indexes for Node table..."
echo "⚠️  This will create indexes to fix slow query issues"
echo ""

# Apply the migration directly to the database
docker exec -i ssalgten-database psql -U ssalgten -d ssalgten <<'EOF'
-- Add performance indexes for Node table
CREATE INDEX IF NOT EXISTS "idx_nodes_agentid" ON "nodes"("agentId");
CREATE INDEX IF NOT EXISTS "idx_nodes_status" ON "nodes"("status");
CREATE INDEX IF NOT EXISTS "idx_nodes_lastseen" ON "nodes"("lastSeen" DESC);
CREATE INDEX IF NOT EXISTS "idx_nodes_status_lastseen" ON "nodes"("status", "lastSeen" DESC);

-- Verify indexes were created
\di idx_nodes_*

-- Show table statistics
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE tablename = 'nodes'
  AND attname IN ('agentId', 'status', 'lastSeen')
ORDER BY attname;

EOF

echo ""
echo "✅ Indexes applied successfully!"
echo ""
echo "Next steps:"
echo "1. Monitor database connections: docker exec ssalgten-database psql -U ssalgten -d ssalgten -c \"SELECT count(*) FROM pg_stat_activity WHERE datname='ssalgten';\""
echo "2. Check query performance: docker logs ssalgten-backend --tail 50"
echo "3. Verify node list loads in frontend"
