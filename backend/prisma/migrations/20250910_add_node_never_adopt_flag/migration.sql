-- Add 'neverAdopt' flag to nodes table to freeze memorial placeholders
ALTER TABLE "public"."nodes" ADD COLUMN IF NOT EXISTS "neverAdopt" BOOLEAN NOT NULL DEFAULT FALSE;

-- Note: The composite index with isPlaceholder is created in
-- 20250910_add_node_placeholder_and_ip_indexes to ensure the column exists.
