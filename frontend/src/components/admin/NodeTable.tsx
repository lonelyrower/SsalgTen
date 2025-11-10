import React from "react";
import type { NodeData } from "@/services/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  AlertCircle,
  Clock,
  Activity,
  Edit2,
  Trash2,
} from "lucide-react";
import CountryFlagSvg from "@/components/ui/CountryFlagSvg";

interface NodeTableProps {
  nodes: NodeData[];
  editingCost: string | null;
  costValue: string;
  onCostEdit: (nodeId: string, currentCost: number | null | undefined) => void;
  onCostSave: (nodeId: string) => void;
  onCostCancel: () => void;
  onCostValueChange: (value: string) => void;
  onRename: (nodeId: string, currentName: string) => void;
  onDelete: (nodeId: string) => void;
}

const getStatusIcon = (status: string) => {
  const normalizedStatus = status.toLowerCase();
  switch (normalizedStatus) {
    case "online":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "offline":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case "warning":
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case "maintenance":
      return <Clock className="h-4 w-4 text-blue-500" />;
    default:
      return <Activity className="h-4 w-4 text-gray-500" />;
  }
};

const getStatusBadgeClass = (status: string) => {
  const normalizedStatus = status.toLowerCase();
  switch (normalizedStatus) {
    case "online":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "offline":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    case "warning":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    case "maintenance":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }
};

const getStatusText = (status: string) => {
  const normalizedStatus = status.toLowerCase();
  switch (normalizedStatus) {
    case "online":
      return "在线";
    case "offline":
      return "离线";
    case "maintenance":
      return "维护";
    default:
      return "离线";
  }
};

export const NodeTable: React.FC<NodeTableProps> = ({
  nodes,
  editingCost,
  costValue,
  onCostEdit,
  onCostSave,
  onCostCancel,
  onCostValueChange,
  onRename,
  onDelete,
}) => {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="w-8 px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {/* 状态指示 */}
              </th>
              <th className="w-64 px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                节点信息
              </th>
              <th className="w-56 px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                位置
              </th>
              <th className="w-20 px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                状态
              </th>
              <th className="w-32 px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                最后在线
              </th>
              <th className="w-28 px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                月度成本
              </th>
              <th className="w-28 px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {nodes.map((node) => (
              <tr key={node.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="w-8 px-3 py-4 text-center">
                  {getStatusIcon(node.status)}
                </td>
                <td className="w-64 px-3 py-4">
                  <div className="flex flex-col items-center">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs">
                      {node.name}
                    </div>
                    {node.ipv4 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                        IPv4: {node.ipv4}
                      </div>
                    )}
                    {node.ipv6 && node.ipv6.includes(":") && (
                      <div
                        className="text-xs text-purple-600 dark:text-purple-400 font-mono truncate max-w-xs"
                        title={node.ipv6}
                      >
                        IPv6: {node.ipv6}
                      </div>
                    )}
                  </div>
                </td>
                <td className="w-56 px-3 py-4">
                  <div className="flex flex-col items-center">
                    <div className="text-sm text-gray-900 dark:text-white inline-flex items-center gap-1.5">
                      <CountryFlagSvg country={node.country} />
                      <span className="truncate">
                        {node.city}, {node.country}
                      </span>
                    </div>
                    <div
                      className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs text-center"
                      title={node.provider}
                    >
                      {node.provider}
                    </div>
                    {node.asnNumber && (
                      <div className="text-xs text-blue-600 dark:text-blue-400 font-mono mt-0.5">
                        {node.asnNumber}
                      </div>
                    )}
                  </div>
                </td>
                <td className="w-20 px-2 py-4 text-center">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${getStatusBadgeClass(node.status)}`}
                  >
                    {getStatusText(node.status)}
                  </span>
                </td>
                <td className="w-32 px-2 py-4 text-xs text-center text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {node.lastSeen
                    ? new Date(node.lastSeen).toLocaleDateString("zh-CN")
                    : "未知"}
                </td>
                <td className="w-28 px-2 py-4 text-center">
                  {editingCost === node.id ? (
                    <div className="flex items-center justify-center gap-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={costValue}
                        onChange={(e) => onCostValueChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            onCostSave(node.id);
                          } else if (e.key === "Escape") {
                            onCostCancel();
                          }
                        }}
                        className="w-20 px-2 py-1 text-sm border border-blue-500 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        placeholder="USD"
                        autoFocus
                      />
                      <button
                        onClick={() => onCostSave(node.id)}
                        className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                        title="保存"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                      <button
                        onClick={onCostCancel}
                        className="p-1 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
                        title="取消"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onCostEdit(node.id, node.monthlyCost)}
                      className="text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      title="点击编辑"
                    >
                      {node.monthlyCost !== null && node.monthlyCost !== undefined ? (
                        `$${Number(node.monthlyCost).toFixed(2)}`
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">点击设置</span>
                      )}
                    </button>
                  )}
                </td>
                <td className="w-28 px-2 py-4 text-center text-sm font-medium">
                  <div className="inline-flex items-center justify-center space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRename(node.id, node.name)}
                      className="text-gray-400 hover:text-blue-600 p-1.5"
                      title="重命名节点"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(node.id)}
                      className="text-gray-400 hover:text-red-600 p-1.5"
                      title="删除节点"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
