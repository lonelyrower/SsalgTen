-- Rollback script for streaming tables
-- This removes the incorrectly created tables and enums

-- Drop foreign key constraints first
ALTER TABLE "streaming_tests" DROP CONSTRAINT IF EXISTS "streaming_tests_nodeId_fkey";
ALTER TABLE "detected_services" DROP CONSTRAINT IF EXISTS "detected_services_nodeId_fkey";

-- Drop indexes
DROP INDEX IF EXISTS "streaming_tests_nodeId_idx";
DROP INDEX IF EXISTS "streaming_tests_service_idx";
DROP INDEX IF EXISTS "streaming_tests_testedAt_idx";
DROP INDEX IF EXISTS "streaming_tests_nodeId_service_idx";
DROP INDEX IF EXISTS "detected_services_nodeId_idx";
DROP INDEX IF EXISTS "detected_services_serviceType_idx";
DROP INDEX IF EXISTS "detected_services_updatedAt_idx";

-- Drop tables
DROP TABLE IF EXISTS "streaming_tests";
DROP TABLE IF EXISTS "detected_services";

-- Drop enums
DROP TYPE IF EXISTS "StreamingService";
DROP TYPE IF EXISTS "StreamingStatus";
DROP TYPE IF EXISTS "UnlockType";
DROP TYPE IF EXISTS "ServiceType";
DROP TYPE IF EXISTS "ServiceStatus";
