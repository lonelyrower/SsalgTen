import React from "react";
import { RefreshCw, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  STREAMING_SERVICES,
  STREAMING_SERVICE_ORDER,
  STATUS_TEXT,
  STATUS_COLORS,
} from "@/types/streaming";
import type { StreamingServiceResult } from "@/types/streaming";

interface StreamingUnlockTabProps {
  nodeId: string;
  nodeName: string;
}

/**
 * 节点详情 - 流媒体解锁 Tab
 * 显示节点对各流媒体平台的解锁状态
 */
export const StreamingUnlockTab: React.FC<StreamingUnlockTabProps> = () => {
  const [loading, setLoading] = React.useState(false);
  const [lastTested, setLastTested] = React.useState<string | null>(null);

  // TODO: 从后端API获取流媒体数据
  // 临时模拟数据
  const streamingData: StreamingServiceResult[] = STREAMING_SERVICE_ORDER.map(
    (service) => {
      return {
        service,
        name: STREAMING_SERVICES[service].name,
        icon: STREAMING_SERVICES[service].icon,
        status: "unknown", // 默认未测试
        lastTested: undefined,
      };
    },
  );

  const handleRetest = async () => {
    setLoading(true);
    // TODO: 调用后端API触发重新检测
    setTimeout(() => {
      setLoading(false);
      setLastTested(new Date().toISOString());
    }, 2000);
  };

  const formatLastTested = (timestamp: string | null) => {
    if (!timestamp) return "从未测试";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diffMinutes < 1) return "刚刚";
    if (diffMinutes < 60) return `${diffMinutes}分钟前`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}小时前`;
    return date.toLocaleDateString("zh-CN");
  };

  return (
    <div className="space-y-6">
      {/* 头部信息 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            流媒体解锁状态
          </h3>
          <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mt-1">
            <Clock className="h-4 w-4" />
            <span>最后检测: {formatLastTested(lastTested)}</span>
          </div>
        </div>
        <Button
          onClick={handleRetest}
          disabled={loading}
          size="sm"
          variant="outline"
        >
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              检测中...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              重新检测
            </>
          )}
        </Button>
      </div>

      {/* 提示信息 */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 dark:text-blue-100">
            <p className="font-medium mb-1">提示</p>
            <p className="text-blue-700 dark:text-blue-200">
              流媒体解锁检测功能正在开发中，当前显示的是模拟数据。
              后端实现后将自动显示真实的解锁状态。
            </p>
          </div>
        </div>
      </div>

      {/* 流媒体服务列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {streamingData.map((service) => (
          <ServiceCard key={service.service} service={service} />
        ))}
      </div>
    </div>
  );
};

// 单个流媒体服务卡片
const ServiceCard: React.FC<{ service: StreamingServiceResult }> = ({
  service,
}) => {
  const getStatusBg = () => {
    switch (service.status) {
      case "yes":
        return "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800";
      case "no":
        return "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800";
      case "org":
      case "pending":
        return "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800";
      default:
        return "bg-gray-50 dark:bg-gray-900/10 border-gray-200 dark:border-gray-700";
    }
  };

  const getUnlockTypeBadge = (unlockType?: string) => {
    if (!unlockType) return null;

    const badges = {
      native: {
        text: "Native 原生IP",
        color:
          "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      },
      dns: {
        text: "DNS 解锁",
        color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      },
    };

    const badge = badges[unlockType as keyof typeof badges];
    if (!badge) return null;

    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  return (
    <div className={`border rounded-lg p-4 ${getStatusBg()}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">{service.icon}</span>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">
              {service.name}
            </h4>
            <p className={`text-sm ${STATUS_COLORS[service.status]}`}>
              {STATUS_TEXT[service.status]}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {service.region && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">解锁区域:</span>
            <span className="font-mono font-medium text-gray-900 dark:text-white">
              {service.region}
            </span>
          </div>
        )}
        {service.unlockType && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">类型:</span>
            {getUnlockTypeBadge(service.unlockType)}
          </div>
        )}
      </div>
    </div>
  );
};
