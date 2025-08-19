-- AlterTable: Add detailed system info fields to heartbeat_logs
ALTER TABLE "public"."heartbeat_logs" ADD COLUMN "cpuInfo" JSONB;
ALTER TABLE "public"."heartbeat_logs" ADD COLUMN "memoryInfo" JSONB;
ALTER TABLE "public"."heartbeat_logs" ADD COLUMN "diskInfo" JSONB;
ALTER TABLE "public"."heartbeat_logs" ADD COLUMN "networkInfo" JSONB;
ALTER TABLE "public"."heartbeat_logs" ADD COLUMN "processInfo" JSONB;
ALTER TABLE "public"."heartbeat_logs" ADD COLUMN "virtualization" JSONB;
ALTER TABLE "public"."heartbeat_logs" ADD COLUMN "services" JSONB;
ALTER TABLE "public"."heartbeat_logs" ADD COLUMN "loadAverage" JSONB;