-- 简单版本：直接在数据库中执行此 SQL 来创建缺失的表
-- 使用方法：
--   docker exec -i ssalgten-database psql -U ssalgten -d ssalgten < fix-streaming-tables-simple.sql

-- 1. 创建枚举类型
DO $$ BEGIN
    CREATE TYPE "StreamingService" AS ENUM ('NETFLIX', 'YOUTUBE', 'DISNEY_PLUS', 'HULU', 'HBO_MAX', 'PRIME_VIDEO', 'APPLE_TV');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "StreamingStatus" AS ENUM ('YES', 'NO', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "UnlockType" AS ENUM ('NATIVE', 'CDN', 'DNS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ServiceType" AS ENUM ('WEB_SERVER', 'DATABASE', 'PROXY', 'VPN', 'CONTAINER', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ServiceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'UNKNOWN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. 创建 streaming_tests 表
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

-- 3. 创建 detected_services 表
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
    "domains" TEXT[],
    "sslEnabled" BOOLEAN,
    "containerInfo" JSONB,
    "details" JSONB,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "detected_services_pkey" PRIMARY KEY ("id")
);

-- 4. 创建索引
CREATE INDEX IF NOT EXISTS "streaming_tests_nodeId_idx" ON "streaming_tests"("nodeId");
CREATE INDEX IF NOT EXISTS "streaming_tests_service_idx" ON "streaming_tests"("service");
CREATE INDEX IF NOT EXISTS "streaming_tests_testedAt_idx" ON "streaming_tests"("testedAt" DESC);
CREATE INDEX IF NOT EXISTS "streaming_tests_nodeId_service_idx" ON "streaming_tests"("nodeId", "service");

CREATE INDEX IF NOT EXISTS "detected_services_nodeId_idx" ON "detected_services"("nodeId");
CREATE INDEX IF NOT EXISTS "detected_services_serviceType_idx" ON "detected_services"("serviceType");
CREATE INDEX IF NOT EXISTS "detected_services_updatedAt_idx" ON "detected_services"("updatedAt" DESC);

-- 5. 添加外键约束
DO $$ BEGIN
    ALTER TABLE "streaming_tests" ADD CONSTRAINT "streaming_tests_nodeId_fkey"
        FOREIGN KEY ("nodeId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "detected_services" ADD CONSTRAINT "detected_services_nodeId_fkey"
        FOREIGN KEY ("nodeId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 完成
\echo '✓ 表创建完成！'
\echo '下一步：重启 Backend 和 Agent 服务'
