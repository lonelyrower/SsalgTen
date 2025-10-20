import React, { useState, useEffect } from "react";
import type { StreamingFilters as FilterType } from "@/types/streaming";
import { STREAMING_SERVICE_ORDER, STREAMING_SERVICES } from "@/types/streaming";
import { Card } from "../ui/card";
import { Search, Filter, X } from "lucide-react";

interface StreamingFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
  availableCountries?: string[];
}

export const StreamingFilters: React.FC<StreamingFiltersProps> = ({
  filters,
  onFiltersChange,
  availableCountries = [],
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
  const parsePlatform = (v: string | undefined) => {
    if (!v) return undefined;
    return (STREAMING_SERVICE_ORDER as Array<FilterType["platform"]>).includes(
      v as FilterType["platform"],
    )
      ? (v as FilterType["platform"])
      : undefined;
  };

  const parseStatus = (v: string | undefined) => {
    if (!v) return undefined;
    const allowed: Array<NonNullable<FilterType["status"]>> = [
      "yes",
      "no",
      "org",
      "pending",
      "failed",
      "unknown",
    ];
    return allowed.includes(v as NonNullable<FilterType["status"]>)
      ? (v as FilterType["status"])
      : undefined;
  };

  const clearFilters = () => {
    setLocalKeyword("");
    onFiltersChange({});
  };

  const hasActiveFilters = Object.keys(filters).some(
    (key) => key !== "showExpired" && filters[key as keyof FilterType],
  );

  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索节点名称..."
            value={localKeyword}
            onChange={(e) => setLocalKeyword(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 快速筛选 */}
        <div className="flex flex-wrap gap-2">
          {/* 平台筛选 */}
          <select
            value={filters.platform || ""}
            onChange={(e) =>
              handleFilterChange("platform", parsePlatform(e.target.value))
            }
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">全部平台</option>
            {STREAMING_SERVICE_ORDER.map((service) => (
              <option key={service} value={service}>
                {STREAMING_SERVICES[service].icon}{" "}
                {STREAMING_SERVICES[service].name}
              </option>
            ))}
          </select>

          {/* 状态筛选 */}
          <select
            value={filters.status || ""}
            onChange={(e) =>
              handleFilterChange("status", parseStatus(e.target.value))
            }
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">全部状态</option>
            <option value="yes">完全解锁</option>
            <option value="no">区域限制</option>
            <option value="org">仅自制剧</option>
            <option value="failed">检测失败</option>
            <option value="unknown">未测试</option>
          </select>

          {/* 地区筛选 */}
          {availableCountries.length > 0 && (
            <select
              value={filters.country || ""}
              onChange={(e) =>
                handleFilterChange("country", e.target.value || undefined)
              }
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">全部地区</option>
              {availableCountries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          )}

          {/* 高级筛选切换 */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5"
          >
            <Filter className="h-4 w-4" />
            <span>{showAdvanced ? "隐藏" : "高级"}筛选</span>
          </button>

          {/* 清除筛选 */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-1.5"
            >
              <X className="h-4 w-4" />
              <span>清除筛选</span>
            </button>
          )}
        </div>

        {/* 高级筛选选项 */}
        {showAdvanced && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
            {/* 解锁区域筛选 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                解锁区域
              </label>
              <input
                type="text"
                placeholder="如: US, JP, UK"
                value={filters.region || ""}
                onChange={(e) =>
                  handleFilterChange("region", e.target.value || undefined)
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* 显示过期数据 */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showExpired"
                checked={filters.showExpired !== false}
                onChange={(e) =>
                  handleFilterChange("showExpired", e.target.checked)
                }
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label
                htmlFor="showExpired"
                className="text-sm text-gray-700 dark:text-gray-300"
              >
                显示超过 24 小时未检测的节点
              </label>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
