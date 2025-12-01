import React, { useState, useEffect } from "react";
import type { ServiceFilters as FilterType } from "@/types/services";
import {
  SERVICE_TYPE_CONFIG,
  SERVICE_STATUS_CONFIG,
  DEPLOYMENT_TYPE_CONFIG,
  QUICK_FILTER_TEMPLATES,
} from "@/types/services";
import { Card } from "../ui/card";
import { Search, Filter, X, Zap } from "lucide-react";

interface ServicesFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
  availableNodes?: Array<{ id: string; name: string }>;
  availableTags?: string[];
}

export const ServicesFilters: React.FC<ServicesFiltersProps> = ({
  filters,
  onFiltersChange,
  availableNodes = [],
  availableTags = [],
}) => {
  const [localKeyword, setLocalKeyword] = useState(filters.keyword || "");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localKeyword !== filters.keyword) {
        onFiltersChange({ ...filters, keyword: localKeyword });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localKeyword, filters, onFiltersChange]);

  const handleFilterChange = <K extends keyof FilterType>(
    key: K,
    value: FilterType[K],
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  // Type-safe parsers for select values
  const parseServiceType = (v: string | undefined) => {
    if (!v) return undefined;
    const types = Object.keys(SERVICE_TYPE_CONFIG) as Array<
      NonNullable<FilterType["serviceType"]>
    >;
    return types.includes(v as NonNullable<FilterType["serviceType"]>)
      ? (v as FilterType["serviceType"])
      : undefined;
  };

  const parseStatus = (v: string | undefined) => {
    if (!v) return undefined;
    const statuses = Object.keys(SERVICE_STATUS_CONFIG) as Array<
      NonNullable<FilterType["status"]>
    >;
    return statuses.includes(v as NonNullable<FilterType["status"]>)
      ? (v as FilterType["status"])
      : undefined;
  };

  const parseDeploymentType = (v: string | undefined) => {
    if (!v) return undefined;
    const types = Object.keys(DEPLOYMENT_TYPE_CONFIG) as Array<
      NonNullable<FilterType["deploymentType"]>
    >;
    return types.includes(v as NonNullable<FilterType["deploymentType"]>)
      ? (v as FilterType["deploymentType"])
      : undefined;
  };

  const clearFilters = () => {
    setLocalKeyword("");
    onFiltersChange({});
  };

  const applyQuickFilter = (templateId: string) => {
    const template = QUICK_FILTER_TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      setLocalKeyword("");
      onFiltersChange(template.filters);
    }
  };

  const hasActiveFilters = Object.keys(filters).some(
    (key) => key !== "showExpired" && filters[key as keyof FilterType],
  );

  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* 快速筛选模板 */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Zap className="h-4 w-4" />
            <span>快速筛选:</span>
          </div>
          {QUICK_FILTER_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => applyQuickFilter(template.id)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                JSON.stringify(filters) === JSON.stringify(template.filters)
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              {template.name}
            </button>
          ))}
        </div>

        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索服务名称、域名、端口..."
            value={localKeyword}
            onChange={(e) => setLocalKeyword(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-[hsl(var(--border-muted))] dark:border-[hsl(var(--border-muted))] rounded-[var(--radius-lg)] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 基本筛选 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          {/* 节点筛选 */}
          {availableNodes.length > 0 && (
            <select
              value={filters.nodeId || ""}
              onChange={(e) =>
                handleFilterChange("nodeId", e.target.value || undefined)
              }
              className="px-3 py-2 border border-[hsl(var(--border-muted))] dark:border-[hsl(var(--border-muted))] rounded-[var(--radius-lg)] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">全部节点</option>
              {availableNodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name}
                </option>
              ))}
            </select>
          )}

          {/* 服务类型筛选 */}
          <select
            value={filters.serviceType || ""}
            onChange={(e) =>
              handleFilterChange(
                "serviceType",
                parseServiceType(e.target.value),
              )
            }
            className="px-3 py-2 border border-[hsl(var(--border-muted))] dark:border-[hsl(var(--border-muted))] rounded-[var(--radius-lg)] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">全部类型</option>
            {Object.entries(SERVICE_TYPE_CONFIG).map(([type, config]) => (
              <option key={type} value={type}>
                {config.icon} {config.name}
              </option>
            ))}
          </select>

          {/* 状态筛选 */}
          <select
            value={filters.status || ""}
            onChange={(e) =>
              handleFilterChange("status", parseStatus(e.target.value))
            }
            className="px-3 py-2 border border-[hsl(var(--border-muted))] dark:border-[hsl(var(--border-muted))] rounded-[var(--radius-lg)] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">全部状态</option>
            {Object.entries(SERVICE_STATUS_CONFIG).map(([status, config]) => (
              <option key={status} value={status}>
                {config.name}
              </option>
            ))}
          </select>

          {/* 部署方式筛选 */}
          <select
            value={filters.deploymentType || ""}
            onChange={(e) =>
              handleFilterChange(
                "deploymentType",
                parseDeploymentType(e.target.value),
              )
            }
            className="px-3 py-2 border border-[hsl(var(--border-muted))] dark:border-[hsl(var(--border-muted))] rounded-[var(--radius-lg)] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">全部部署方式</option>
            {Object.entries(DEPLOYMENT_TYPE_CONFIG).map(([type, config]) => (
              <option key={type} value={type}>
                {config.icon} {config.name}
              </option>
            ))}
          </select>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="px-3 py-1.5 border border-[hsl(var(--border-muted))] dark:border-[hsl(var(--border-muted))] rounded-[var(--radius-lg)] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5"
          >
            <Filter className="h-4 w-4" />
            <span>{showAdvanced ? "隐藏" : "显示"}高级筛选</span>
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 border border-[hsl(var(--border-muted))] dark:border-[hsl(var(--border-muted))] rounded-[var(--radius-lg)] bg-white dark:bg-gray-800 text-[hsl(var(--status-error-600))] dark:text-[hsl(var(--status-error-400))] text-sm hover:bg-[hsl(var(--status-error-50))] dark:hover:bg-[hsl(var(--status-error-900)/0.2)] transition-colors flex items-center gap-1.5"
            >
              <X className="h-4 w-4" />
              <span>清除筛选</span>
            </button>
          )}
        </div>

        {/* 高级筛选选项 */}
        {showAdvanced && (
          <div className="pt-4 border-t border-[hsl(var(--border-subtle))] dark:border-[hsl(var(--border-muted))] space-y-3">
            {/* 优先级筛选 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                优先级
              </label>
              <select
                value={filters.priority || ""}
                onChange={(e) =>
                  handleFilterChange(
                    "priority",
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
                className="w-full px-3 py-2 border border-[hsl(var(--border-muted))] dark:border-[hsl(var(--border-muted))] rounded-[var(--radius-lg)] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">全部优先级</option>
                <option value="5">P5 - 最高</option>
                <option value="4">P4 - 高</option>
                <option value="3">P3 - 中</option>
                <option value="2">P2 - 低</option>
                <option value="1">P1 - 最低</option>
              </select>
            </div>

            {/* 标签筛选 */}
            {availableTags.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  标签
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => {
                        const currentTags = filters.tags || [];
                        const newTags = currentTags.includes(tag)
                          ? currentTags.filter((t) => t !== tag)
                          : [...currentTags, tag];
                        handleFilterChange(
                          "tags",
                          newTags.length > 0 ? newTags : undefined,
                        );
                      }}
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        filters.tags?.includes(tag)
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 显示过期数据 */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showExpired"
                checked={filters.showExpired !== false}
                onChange={(e) =>
                  handleFilterChange("showExpired", e.target.checked)
                }
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-[hsl(var(--border-muted))] rounded-[var(--radius-sm)]"
              />
              <label
                htmlFor="showExpired"
                className="text-sm text-gray-700 dark:text-gray-300"
              >
                显示超过 2 天未更新的服务
              </label>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
