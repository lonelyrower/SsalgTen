-- CreateIndex
-- 访问统计优化索引
CREATE INDEX "idx_visitorLog_createdAt_country" ON "visitorLog"("createdAt", "country");
CREATE INDEX "idx_visitorLog_createdAt_asnName" ON "visitorLog"("createdAt", "asnName");
CREATE INDEX "idx_visitorLog_createdAt" ON "visitorLog"("createdAt");

-- 心跳日志索引优化
CREATE INDEX "idx_heartbeatLog_timestamp" ON "heartbeatLog"("timestamp");
CREATE INDEX "idx_heartbeatLog_timestamp_nodeId" ON "heartbeatLog"("timestamp", "nodeId");

-- 诊断记录索引优化
CREATE INDEX "idx_diagnosticRecord_timestamp" ON "diagnosticRecord"("timestamp");
CREATE INDEX "idx_diagnosticRecord_timestamp_success" ON "diagnosticRecord"("timestamp", "success");
CREATE INDEX "idx_diagnosticRecord_timestamp_nodeId" ON "diagnosticRecord"("timestamp", "nodeId");

-- 用户活跃度查询优化
CREATE INDEX "idx_user_lastLogin" ON "User"("lastLogin");

-- 节点相关查询优化
CREATE INDEX "idx_node_status" ON "Node"("status");
CREATE INDEX "idx_node_country_provider" ON "Node"("country", "provider");