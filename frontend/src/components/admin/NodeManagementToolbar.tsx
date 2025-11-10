import React from "react";
import { Button } from "@/components/ui/button";
import {
  Search,
  Plus,
  RefreshCw,
  Settings,
  ExternalLink,
  Download,
} from "lucide-react";

interface NodeManagementToolbarProps {
  totalNodes: number;
  onlineNodes: number;
  searchTerm: string;
  filterStatus: string;
  exporting: boolean;
  showExportMenu: boolean;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: string) => void;
  onRefresh: () => void;
  onExportMenuToggle: () => void;
  onExport: (format: "json" | "csv" | "markdown") => void;
  onImportClick: () => void;
  onDeployClick: () => void;
}

export const NodeManagementToolbar: React.FC<NodeManagementToolbarProps> = ({
  totalNodes,
  onlineNodes,
  searchTerm,
  filterStatus,
  exporting,
  showExportMenu,
  onSearchChange,
  onFilterChange,
  onRefresh,
  onExportMenuToggle,
  onExport,
  onImportClick,
  onDeployClick,
}) => {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <Settings className="h-6 w-6 mr-3 text-blue-600" />
            节点管理
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
            重命名、删除节点和部署新节点
          </p>
          <div className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            共 {totalNodes} 个节点 • {onlineNodes} 在线 •
            <a
              href="/nodes"
              className="text-primary hover:opacity-80 ml-1 inline-flex items-center"
            >
              查看详细监控 <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            刷新
          </Button>
          <div className="relative hidden sm:block">
            <Button
              variant="outline"
              size="sm"
              disabled={exporting}
              onClick={onExportMenuToggle}
              onBlur={() => setTimeout(() => onExportMenuToggle(), 150)}
              title="导出节点列表"
            >
              {exporting ? (
                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              导出节点
            </Button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-[var(--shadow-lg)] z-10">
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onExport("json")}
                  className="w-full px-4 py-2 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-lg"
                >
                  JSON
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onExport("csv")}
                  className="w-full px-4 py-2 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  CSV
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onExport("markdown")}
                  className="w-full px-4 py-2 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 last:rounded-b-lg"
                >
                  Markdown
                </button>
              </div>
            )}
          </div>
          <Button
            variant="success"
            size="sm"
            onClick={onImportClick}
            title="导入过期/未安装Agent的 VPS（作为离线节点）"
          >
            <Plus className="h-4 w-4 mr-1" />
            导入过期VPS
          </Button>
          <Button variant="info" size="sm" onClick={onDeployClick}>
            <Plus className="h-4 w-4 mr-1" />
            部署节点
          </Button>
        </div>
      </div>

      {/* 搜索区域 */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索节点名称、国家、服务商或ASN..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <label htmlFor="node-status-filter" className="sr-only">
          筛选节点状态
        </label>
        <select
          id="node-status-filter"
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={filterStatus}
          onChange={(e) => onFilterChange(e.target.value)}
        >
          <option value="all">全部</option>
          <option value="online">在线</option>
          <option value="offline">离线</option>
        </select>
      </div>
    </div>
  );
};
