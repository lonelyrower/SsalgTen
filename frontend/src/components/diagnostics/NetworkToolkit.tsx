import React from "react";
import type { NodeData } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Activity, X, Globe } from "lucide-react";
import { LatencyTest } from "@/components/diagnostics/LatencyTest";

interface NetworkToolkitProps {
  selectedNode: NodeData;
  onClose: () => void;
}

// 轻量版本的网络工具箱，提供占位和基础延迟测试
export const NetworkToolkit: React.FC<NetworkToolkitProps> = ({
  selectedNode,
  onClose,
}) => {
  if (!selectedNode) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner text="加载中..." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-white dark:bg-gray-800">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="w-4 h-4 text-primary" />
            网络工具箱
            <span className="text-gray-500 dark:text-gray-400 font-normal">
              （{selectedNode.name}）
            </span>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="关闭">
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            提供常用网络诊断能力（延迟测试、Traceroute 等）。
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="w-4 h-4 text-primary" />
            客户端延迟测试
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* 未提供 agentEndpoint 时，LatencyTest 内部将提示配置缺失 */}
          <LatencyTest onTestComplete={() => {}} />
        </CardContent>
      </Card>
    </div>
  );
};

export default NetworkToolkit;
