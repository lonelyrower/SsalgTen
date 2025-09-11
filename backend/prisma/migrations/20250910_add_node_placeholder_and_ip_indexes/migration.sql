-- Add isPlaceholder column to nodes table and helpful indexes
ALTER TABLE "public"."nodes" ADD COLUMN IF NOT EXISTS "isPlaceholder" BOOLEAN NOT NULL DEFAULT FALSE;

-- Indexes to speed up placeholder lookups and IP matching
CREATE INDEX IF NOT EXISTS "idx_nodes_isPlaceholder" ON "public"."nodes"("isPlaceholder");
CREATE INDEX IF NOT EXISTS "idx_nodes_ipv4" ON "public"."nodes"("ipv4");
CREATE INDEX IF NOT EXISTS "idx_nodes_ipv6" ON "public"."nodes"("ipv6");

-- Composite index for queries filtering by placeholder and adoption status
CREATE INDEX IF NOT EXISTS "idx_nodes_isPlaceholder_neverAdopt" ON "public"."nodes"("isPlaceholder", "neverAdopt");
