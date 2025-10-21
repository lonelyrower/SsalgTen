# Database Migration Guide

## Traffic Statistics Feature

This guide explains how to apply the database migration for the traffic statistics feature when your PostgreSQL database is running.

### Prerequisites

- PostgreSQL database must be running and accessible
- Database connection string configured in `.env` file

### Running the Migration

When your database is available, run the following commands:

```bash
cd backend
npx prisma migrate dev --name add_traffic_stats
```

This will create the `traffic_stats` table with the following structure:

- **id**: Unique identifier (CUID)
- **nodeId**: Foreign key to nodes table (unique, one-to-one relationship)
- **totalUpload**: BigInt - Cumulative upload bytes (permanent counter)
- **totalDownload**: BigInt - Cumulative download bytes (permanent counter)
- **periodUpload**: BigInt - Period upload bytes (resettable counter)
- **periodDownload**: BigInt - Period download bytes (resettable counter)
- **periodStart**: DateTime - When the current period started
- **lastRxBytes**: BigInt - Last recorded RX bytes (for delta calculation)
- **lastTxBytes**: BigInt - Last recorded TX bytes (for delta calculation)
- **createdAt**: DateTime - Record creation timestamp
- **updatedAt**: DateTime - Last update timestamp

### Features Enabled After Migration

1. **Persistent Traffic Data**: Network traffic statistics will persist across agent and server restarts
2. **Load Average Monitoring**: System load average (1min, 5min, 15min) will be displayed in the dashboard
3. **Traffic Rankings**: Top nodes by traffic usage will be displayed in the monitoring center
4. **Real-time Updates**: Traffic data updates with each heartbeat from agents

### Manual Migration (Alternative)

If you prefer to run the migration manually, you can execute the following SQL:

```sql
-- Create traffic_stats table
CREATE TABLE "traffic_stats" (
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

-- Create unique index on nodeId
CREATE UNIQUE INDEX "traffic_stats_nodeId_key" ON "traffic_stats"("nodeId");

-- Add foreign key constraint
ALTER TABLE "traffic_stats" ADD CONSTRAINT "traffic_stats_nodeId_fkey"
    FOREIGN KEY ("nodeId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### Verification

After running the migration, verify it was successful:

```bash
npx prisma db pull
npx prisma generate
```

The backend will automatically start tracking traffic statistics for all nodes with each heartbeat.

### Rollback (if needed)

To rollback the migration:

```bash
npx prisma migrate reset
```

**Warning**: This will delete all data in your database. Only use in development environments.

For a safer rollback, manually drop the table:

```sql
DROP TABLE "traffic_stats";
```

## Notes

- Traffic data is aggregated from all network interfaces except loopback (lo*)
- Counter resets (e.g., from server reboots) are handled gracefully
- Traffic statistics are updated with each agent heartbeat
- BigInt values are automatically converted to strings in API responses for JSON compatibility
