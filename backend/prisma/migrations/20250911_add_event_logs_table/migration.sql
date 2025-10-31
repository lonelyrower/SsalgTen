-- Create event_logs table to store node events and activities
CREATE TABLE IF NOT EXISTS "public"."event_logs" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "details" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_logs_pkey" PRIMARY KEY ("id")
);

-- Foreign key to nodes (using DO block for IF NOT EXISTS logic)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'event_logs_nodeId_fkey'
  ) THEN
    ALTER TABLE "public"."event_logs"
      ADD CONSTRAINT "event_logs_nodeId_fkey"
      FOREIGN KEY ("nodeId") REFERENCES "public"."nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Helpful index for queries by node and time
CREATE INDEX IF NOT EXISTS "event_logs_nodeId_timestamp_idx" ON "public"."event_logs"("nodeId", "timestamp");

