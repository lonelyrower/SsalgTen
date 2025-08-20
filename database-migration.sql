-- SsalgTen 数据库迁移脚本 - ASN功能
-- 执行前请备份现有数据库
-- 适用于从旧版本升级到支持ASN功能的版本

-- =============================================================================
-- 步骤 1: 备份现有数据（在执行此脚本前运行）
-- =============================================================================
-- pg_dump -U your_username -h localhost ssalgten > backup_before_asn_$(date +%Y%m%d_%H%M%S).sql

-- =============================================================================
-- 步骤 2: 添加ASN相关字段到nodes表
-- =============================================================================

-- 为nodes表添加ASN相关字段
ALTER TABLE "nodes" ADD COLUMN IF NOT EXISTS "asnNumber" VARCHAR(20);
ALTER TABLE "nodes" ADD COLUMN IF NOT EXISTS "asnName" TEXT;  
ALTER TABLE "nodes" ADD COLUMN IF NOT EXISTS "asnOrg" TEXT;
ALTER TABLE "nodes" ADD COLUMN IF NOT EXISTS "asnRoute" VARCHAR(50);
ALTER TABLE "nodes" ADD COLUMN IF NOT EXISTS "asnType" VARCHAR(20);

-- 添加字段注释
COMMENT ON COLUMN "nodes"."asnNumber" IS 'ASN号码，如AS15169';
COMMENT ON COLUMN "nodes"."asnName" IS 'ASN组织名称';
COMMENT ON COLUMN "nodes"."asnOrg" IS 'ASN完整组织信息';
COMMENT ON COLUMN "nodes"."asnRoute" IS 'ASN路由信息';  
COMMENT ON COLUMN "nodes"."asnType" IS 'ASN类型';

-- =============================================================================
-- 步骤 3: 创建访问者日志表
-- =============================================================================

-- 创建访问者日志表
CREATE TABLE IF NOT EXISTS "visitor_logs" (
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

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS "visitor_logs_ip_idx" ON "visitor_logs"("ip");
CREATE INDEX IF NOT EXISTS "visitor_logs_createdAt_idx" ON "visitor_logs"("createdAt");
CREATE INDEX IF NOT EXISTS "visitor_logs_country_idx" ON "visitor_logs"("country");
CREATE INDEX IF NOT EXISTS "visitor_logs_asnNumber_idx" ON "visitor_logs"("asnNumber");

-- 添加表注释
COMMENT ON TABLE "visitor_logs" IS '访问者信息日志记录表';

-- =============================================================================
-- 步骤 4: 数据迁移和验证
-- =============================================================================

-- 验证数据结构
DO $$
BEGIN
    -- 检查nodes表的新字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'nodes' AND column_name = 'asnNumber'
    ) THEN
        RAISE EXCEPTION 'ASN字段添加失败';
    END IF;
    
    -- 检查visitor_logs表
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'visitor_logs'
    ) THEN
        RAISE EXCEPTION 'visitor_logs表创建失败';
    END IF;
    
    RAISE NOTICE '数据库迁移验证成功';
END $$;

-- =============================================================================
-- 步骤 5: 示例数据插入（可选）
-- =============================================================================

-- 插入一些示例ASN数据（如果需要）
-- UPDATE "nodes" SET 
--     "asnNumber" = 'AS15169',
--     "asnName" = 'Google LLC',
--     "asnOrg" = 'AS15169 Google LLC',
--     "asnRoute" = '8.8.8.0/24',
--     "asnType" = 'hosting'
-- WHERE "ipv4" = '8.8.8.8';

-- =============================================================================
-- 步骤 6: 权限设置
-- =============================================================================

-- 确保应用用户有正确的权限
-- GRANT SELECT, INSERT, UPDATE, DELETE ON "visitor_logs" TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON "nodes" TO your_app_user;

-- =============================================================================
-- 迁移完成确认
-- =============================================================================

-- 显示迁移完成信息
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'SsalgTen ASN功能数据库迁移完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '新增字段:';
    RAISE NOTICE '- nodes.asnNumber (ASN号码)';
    RAISE NOTICE '- nodes.asnName (ASN名称)'; 
    RAISE NOTICE '- nodes.asnOrg (ASN组织)';
    RAISE NOTICE '- nodes.asnRoute (ASN路由)';
    RAISE NOTICE '- nodes.asnType (ASN类型)';
    RAISE NOTICE '';
    RAISE NOTICE '新增表:';
    RAISE NOTICE '- visitor_logs (访问者日志)';
    RAISE NOTICE '';
    RAISE NOTICE '下一步: 重启应用服务以应用更改';
    RAISE NOTICE '========================================';
END $$;

-- 迁移脚本结束