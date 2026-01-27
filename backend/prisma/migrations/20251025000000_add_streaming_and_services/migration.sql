-- CreateEnum
DO $$ BEGIN
 CREATE TYPE "StreamingService" AS ENUM ('NETFLIX', 'YOUTUBE', 'DISNEY_PLUS', 'TIKTOK', 'AMAZON_PRIME', 'REDDIT', 'CHATGPT');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
 CREATE TYPE "StreamingStatus" AS ENUM ('YES', 'NO', 'ORG', 'PENDING', 'FAILED', 'UNKNOWN');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
 CREATE TYPE "UnlockType" AS ENUM ('NATIVE', 'DNS', 'IDC', 'UNKNOWN');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
 CREATE TYPE "ServiceType" AS ENUM ('PROXY', 'WEB', 'DATABASE', 'CONTAINER', 'OTHER');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
 CREATE TYPE "ServiceStatus" AS ENUM ('RUNNING', 'STOPPED', 'UNKNOWN');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "streaming_tests" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "service" "StreamingService" NOT NULL,
    "status" "StreamingStatus" NOT NULL,
    "region" TEXT,
    "unlockType" "UnlockType",
    "details" JSONB,
    "errorMsg" TEXT,
    "testedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "streaming_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "detected_services" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "serviceName" TEXT NOT NULL,
    "version" TEXT,
    "status" "ServiceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "port" INTEGER,
    "protocol" TEXT,
    "configPath" TEXT,
    "configHash" TEXT,
    "domains" JSONB,
    "sslEnabled" BOOLEAN,
    "containerInfo" JSONB,
    "details" JSONB,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "detected_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "streaming_tests_nodeId_idx" ON "streaming_tests"("nodeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "streaming_tests_service_idx" ON "streaming_tests"("service");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "streaming_tests_status_idx" ON "streaming_tests"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "streaming_tests_testedAt_idx" ON "streaming_tests"("testedAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "streaming_tests_nodeId_service_testedAt_idx" ON "streaming_tests"("nodeId", "service", "testedAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "detected_services_nodeId_idx" ON "detected_services"("nodeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "detected_services_serviceType_idx" ON "detected_services"("serviceType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "detected_services_serviceName_idx" ON "detected_services"("serviceName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "detected_services_status_idx" ON "detected_services"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "detected_services_detectedAt_idx" ON "detected_services"("detectedAt" DESC);

-- CreateUniqueIndex
CREATE UNIQUE INDEX IF NOT EXISTS "detected_services_nodeId_serviceName_port_key" ON "detected_services"("nodeId", "serviceName", "port");

-- AddForeignKey
DO $$ BEGIN
 ALTER TABLE "streaming_tests" ADD CONSTRAINT "streaming_tests_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
 ALTER TABLE "detected_services" ADD CONSTRAINT "detected_services_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
