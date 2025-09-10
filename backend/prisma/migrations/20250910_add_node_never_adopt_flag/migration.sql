-- Add 'neverAdopt' flag to nodes table to freeze memorial placeholders
ALTER TABLE "public"."nodes" ADD COLUMN IF NOT EXISTS "neverAdopt" BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS "idx_nodes_isPlaceholder_neverAdopt" ON "public"."nodes"("isPlaceholder", "neverAdopt");

