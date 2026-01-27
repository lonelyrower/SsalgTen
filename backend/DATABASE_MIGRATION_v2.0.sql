-- SsalgTen v2.0 数据库迁移SQL
-- 添加流媒体解锁和服务检测功能

-- ============================================
-- 1. 创建枚举类型
-- ============================================

-- 流媒体服务枚举
CREATE TYPE "StreamingService" AS ENUM (
  'NETFLIX',
  'YOUTUBE',
  'DISNEY_PLUS',
  'TIKTOK',
  'AMAZON_PRIME',
  'REDDIT',
  'CHATGPT'
);

-- 流媒体解锁状态枚举
CREATE TYPE "StreamingStatus" AS ENUM (
  'YES',       -- 完全解锁
  'NO',        -- 区域限制/封锁
  'ORG',       -- 仅自制剧（Netflix专用）
  'PENDING',   -- 待支持
  'FAILED',    -- 检测失败
  'UNKNOWN'    -- 未测试
);

-- 解锁类型枚举
CREATE TYPE "UnlockType" AS ENUM (
  'NATIVE',    -- 原生IP
  'DNS',       -- DNS解锁
  'IDC',       -- 机房IP
  'UNKNOWN'    -- 未知
);

-- 服务类型枚举
CREATE TYPE "ServiceType" AS ENUM (
  'PROXY',     -- 代理服务（Xray, V2Ray等）
  'WEB',       -- Web服务（Nginx, Apache等）
  'DATABASE',  -- 数据库（MySQL, PostgreSQL等）
  'CONTAINER', -- 容器（Docker等）
  'OTHER'      -- 其他
);

-- 服务状态枚举
CREATE TYPE "ServiceStatus" AS ENUM (
  'RUNNING',
  'STOPPED',
  'UNKNOWN'
);

-- ============================================
-- 2. 创建流媒体测试表
-- ============================================

CREATE TABLE "streaming_tests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nodeId" TEXT NOT NULL,
    "service" "StreamingService" NOT NULL,
    "status" "StreamingStatus" NOT NULL,
    "region" TEXT,
    "unlockType" "UnlockType",
    "details" JSONB,
    "errorMsg" TEXT,
    "testedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "streaming_tests_nodeId_fkey" FOREIGN KEY ("nodeId")
        REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 创建索引
CREATE INDEX "streaming_tests_nodeId_idx" ON "streaming_tests"("nodeId");
CREATE INDEX "streaming_tests_service_idx" ON "streaming_tests"("service");
CREATE INDEX "streaming_tests_status_idx" ON "streaming_tests"("status");
CREATE INDEX "streaming_tests_testedAt_idx" ON "streaming_tests"("testedAt" DESC);
CREATE INDEX "streaming_tests_nodeId_service_testedAt_idx" ON "streaming_tests"("nodeId", "service", "testedAt" DESC);

-- ============================================
-- 3. 创建检测服务表
-- ============================================

CREATE TABLE "detected_services" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nodeId" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "serviceName" TEXT NOT NULL,
    "version" TEXT,
    "status" "ServiceStatus" NOT NULL,
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

    CONSTRAINT "detected_services_nodeId_fkey" FOREIGN KEY ("nodeId")
        REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 创建索引
CREATE INDEX "detected_services_nodeId_idx" ON "detected_services"("nodeId");
CREATE INDEX "detected_services_serviceType_idx" ON "detected_services"("serviceType");
CREATE INDEX "detected_services_serviceName_idx" ON "detected_services"("serviceName");
CREATE INDEX "detected_services_status_idx" ON "detected_services"("status");
CREATE INDEX "detected_services_detectedAt_idx" ON "detected_services"("detectedAt" DESC);
CREATE UNIQUE INDEX "detected_services_nodeId_serviceName_port_key" ON "detected_services"("nodeId", "serviceName", "port");

-- ============================================
-- 4. 注释说明
-- ============================================

COMMENT ON TABLE "streaming_tests" IS '流媒体解锁测试记录';
COMMENT ON COLUMN "streaming_tests"."service" IS '流媒体服务类型';
COMMENT ON COLUMN "streaming_tests"."status" IS '解锁状态：yes=完全解锁, no=限制, org=仅自制剧';
COMMENT ON COLUMN "streaming_tests"."region" IS '解锁区域，如 US, JP, UK';
COMMENT ON COLUMN "streaming_tests"."unlockType" IS '解锁类型：native=原生IP, dns=DNS解锁, idc=机房IP';

COMMENT ON TABLE "detected_services" IS '节点上检测到的服务（Xray、Nginx等）';
COMMENT ON COLUMN "detected_services"."serviceType" IS '服务类型：proxy, web, database, container';
COMMENT ON COLUMN "detected_services"."serviceName" IS '服务名称，如 Xray, Nginx, MySQL';
COMMENT ON COLUMN "detected_services"."protocol" IS '协议类型，如 vmess, vless, trojan, http';
COMMENT ON COLUMN "detected_services"."domains" IS '关联的域名列表（JSON数组）';
COMMENT ON COLUMN "detected_services"."containerInfo" IS 'Docker容器详细信息（JSON）';

-- ============================================
-- 5. 示例数据（可选）
-- ============================================

-- 插入示例流媒体测试数据（注释掉，实际使用时由Agent自动生成）
/*
INSERT INTO "streaming_tests" ("id", "nodeId", "service", "status", "region", "unlockType", "testedAt")
VALUES
  (gen_random_uuid()::text, 'your-node-id', 'NETFLIX', 'YES', 'US', 'NATIVE', NOW()),
  (gen_random_uuid()::text, 'your-node-id', 'YOUTUBE', 'YES', 'Global', 'NATIVE', NOW()),
  (gen_random_uuid()::text, 'your-node-id', 'DISNEY_PLUS', 'NO', NULL, NULL, NOW());
*/

-- ============================================
-- 6. 回滚脚本（如需回滚）
-- ============================================

/*
-- 回滚步骤（按相反顺序执行）
DROP TABLE IF EXISTS "detected_services";
DROP TABLE IF EXISTS "streaming_tests";
DROP TYPE IF EXISTS "ServiceStatus";
DROP TYPE IF EXISTS "ServiceType";
DROP TYPE IF EXISTS "UnlockType";
DROP TYPE IF EXISTS "StreamingStatus";
DROP TYPE IF EXISTS "StreamingService";
*/

-- ============================================
-- 执行完成后运行 Prisma 同步
-- ============================================
-- npx prisma db pull
-- npx prisma generate
