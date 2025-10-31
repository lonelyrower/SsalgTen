-- CreateIndex
-- 访问统计优化索引
CREATE INDEX "idx_visitorLog_createdAt_country" ON "public"."visitor_logs"("createdAt", "country");
CREATE INDEX "idx_visitorLog_createdAt_asnName" ON "public"."visitor_logs"("createdAt", "asnName");
CREATE INDEX "idx_visitorLog_createdAt" ON "public"."visitor_logs"("createdAt");

-- 心跳日志索引优化
CREATE INDEX "idx_heartbeatLog_timestamp" ON "public"."heartbeat_logs"("timestamp");
CREATE INDEX "idx_heartbeatLog_timestamp_nodeId" ON "public"."heartbeat_logs"("timestamp", "nodeId");

-- 诊断记录索引优化
CREATE INDEX "idx_diagnosticRecord_timestamp" ON "public"."diagnostic_records"("timestamp");
CREATE INDEX "idx_diagnosticRecord_timestamp_success" ON "public"."diagnostic_records"("timestamp", "success");
CREATE INDEX "idx_diagnosticRecord_timestamp_nodeId" ON "public"."diagnostic_records"("timestamp", "nodeId");

-- 用户活跃度查询优化
CREATE INDEX "idx_user_lastLogin" ON "public"."users"("lastLogin");

-- 节点相关查询优化
CREATE INDEX "idx_node_status" ON "public"."nodes"("status");
CREATE INDEX "idx_node_country_provider" ON "public"."nodes"("country", "provider");