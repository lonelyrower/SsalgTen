-- CreateEnum
CREATE TYPE "public"."NodeStatus" AS ENUM ('ONLINE', 'OFFLINE', 'UNKNOWN', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "public"."DiagnosticType" AS ENUM ('PING', 'TRACEROUTE', 'MTR', 'SPEEDTEST');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'OPERATOR', 'VIEWER');

-- CreateTable
CREATE TABLE "public"."nodes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hostname" TEXT,
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "ipv4" TEXT,
    "ipv6" TEXT,
    "asnNumber" TEXT,
    "asnName" TEXT,
    "asnOrg" TEXT,
    "asnRoute" TEXT,
    "asnType" TEXT,
    "provider" TEXT NOT NULL,
    "datacenter" TEXT,
    "agentId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "status" "public"."NodeStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lastSeen" TIMESTAMP(3),
    "tags" TEXT,
    "description" TEXT,
    "osType" TEXT,
    "osVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."diagnostic_records" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "type" "public"."DiagnosticType" NOT NULL,
    "target" TEXT,
    "success" BOOLEAN NOT NULL,
    "result" TEXT NOT NULL,
    "error" TEXT,
    "duration" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnostic_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."heartbeat_logs" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "uptime" DOUBLE PRECISION,
    "cpuUsage" DOUBLE PRECISION,
    "memoryUsage" DOUBLE PRECISION,
    "diskUsage" DOUBLE PRECISION,
    "connectivity" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "heartbeat_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "role" "public"."UserRole" NOT NULL DEFAULT 'ADMIN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLogin" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."visitor_logs" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "timezone" TEXT,
    "asnNumber" TEXT,
    "asnName" TEXT,
    "asnOrg" TEXT,
    "company" TEXT,
    "endpoint" TEXT,
    "method" TEXT,
    "referer" TEXT,
    "nodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visitor_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nodes_agentId_key" ON "public"."nodes"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "public"."settings"("key");

-- CreateIndex
CREATE INDEX "visitor_logs_ip_idx" ON "public"."visitor_logs"("ip");

-- CreateIndex
CREATE INDEX "visitor_logs_createdAt_idx" ON "public"."visitor_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."diagnostic_records" ADD CONSTRAINT "diagnostic_records_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "public"."nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."heartbeat_logs" ADD CONSTRAINT "heartbeat_logs_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "public"."nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
