import React, { useMemo, useEffect, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Globe, MapPin, Award } from "lucide-react";
import CountryFlagSvg from "@/components/ui/CountryFlagSvg";
import type { NodeData } from "@/services/api";

interface GeographicDistributionProps {
  nodes: NodeData[];
  className?: string;
  compact?: boolean;
}

const LegendItem: React.FC<{
  color?: string;
  name?: string;
  value?: number;
}> = ({ color, name, value }) => {
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!textRef.current || !color) return;
    textRef.current.style.color = color;
  }, [color]);

  return (
    <p ref={textRef} className="text-sm">
      {name}: {value}
    </p>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-violet-100/70 dark:border-violet-900/40 bg-white/95 dark:bg-slate-900/95 px-4 py-3 shadow-lg backdrop-blur-sm">
        <p className="font-medium text-slate-900 dark:text-white">{label}</p>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {payload.map((entry: any, index: number) => (
          <LegendItem
            key={index}
            color={entry.color}
            name={entry.name}
            value={entry.value}
          />
        ))}
      </div>
    );
  }
  return null;
};

export const GeographicDistribution: React.FC<GeographicDistributionProps> = ({
  nodes,
  className = "",
  compact = false,
}) => {
  const CHART_LIMIT = compact ? 8 : 12;
  const LIST_LIMIT = compact ? 8 : 12;

  // 计算国家分布数据
  const { countryStats, totalCountries } = useMemo(() => {
    const countryMap = new Map<
      string,
      { online: number; offline: number; total: number }
    >();

    nodes.forEach((node) => {
      const country = node.country;
      const current = countryMap.get(country) || {
        online: 0,
        offline: 0,
        total: 0,
      };

      if (node.status.toLowerCase() === "online") {
        current.online++;
      } else {
        current.offline++;
      }
      current.total++;

      countryMap.set(country, current);
    });

    const allCountryStats = Array.from(countryMap.entries())
      .map(([country, stats]) => ({
        country,
        online: stats.online,
        offline: stats.offline,
        total: stats.total,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      countryStats: allCountryStats,
      totalCountries: allCountryStats.length, // 实际覆盖的国家总数
    };
  }, [nodes]);

  return (
    <div
      className={`group relative h-full overflow-hidden rounded-[var(--radius-2xl)] border-2 border-violet-200/60 dark:border-violet-700/60 bg-gradient-to-br from-violet-50 via-white to-indigo-50 dark:from-slate-800 dark:via-violet-950/60 dark:to-indigo-950/60 shadow-[var(--shadow-lg)] transition-all duration-[var(--duration-normal)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-xl)] p-6 flex flex-col ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-[var(--duration-normal)] group-hover:opacity-100 bg-gradient-to-br from-indigo-400/15 via-transparent to-violet-500/15" />
      <div className="absolute -top-12 -right-14 h-28 w-28 rounded-full bg-indigo-400/15 blur-3xl" />
      <div className="relative flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200">
            <Globe className="h-5 w-5" />
          </span>
          国家/地区分布
        </h3>
        <div className="text-sm text-slate-500 dark:text-slate-300">
          覆盖 {totalCountries} 个国家/地区
        </div>
      </div>

      {countryStats.length > 0 ? (
        <>
          {/* 柱状图 */}
          <div className={compact ? "h-48 mb-4 flex-shrink-0" : "h-64 mb-4 flex-shrink-0"}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={countryStats.slice(0, CHART_LIMIT)}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="country"
                  fontSize={12}
                  tick={{ fill: "currentColor" }}
                />
                <YAxis fontSize={12} tick={{ fill: "currentColor" }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="online" stackId="a" fill="#22c55e" name="在线" />
                <Bar dataKey="offline" stackId="a" fill="#ef4444" name="离线" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 国家列表 */}
          <div className="grid grid-cols-2 gap-3">
            {countryStats.slice(0, LIST_LIMIT).map((item, index) => (
              <div
                key={item.country}
                className="flex items-center justify-between rounded-xl border border-violet-100/60 dark:border-violet-900/40 bg-white/80 dark:bg-white/10 px-3 py-2.5 backdrop-blur-sm transition-colors hover:border-violet-200 dark:hover:border-violet-400/40"
              >
                <div className="flex items-center space-x-2">
                  {index < 3 ? (
                    <Award
                      className={`h-4 w-4 ${
                        index === 0
                          ? "text-yellow-500"
                          : index === 1
                            ? "text-gray-400"
                            : "text-orange-600"
                      }`}
                    />
                  ) : (
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400 w-4">
                      #{index + 1}
                    </span>
                  )}
                  <CountryFlagSvg country={item.country} />
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {item.country}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-[hsl(var(--status-success-600))]">
                    {item.online}
                  </span>
                  <span className="text-xs text-slate-400">/</span>
                  <span className="text-xs font-semibold text-rose-500">
                    {item.offline}
                  </span>
                </div>
              </div>
            ))}
            {totalCountries > LIST_LIMIT && (
              <div className="col-span-2 text-xs text-slate-500 dark:text-slate-300 text-right">
                还有 {totalCountries - LIST_LIMIT} 个国家/地区未显示
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="relative flex items-center justify-center h-32 text-slate-500 dark:text-slate-300">
          <div className="text-center">
            <MapPin className="h-8 w-8 mx-auto mb-2 text-indigo-400/70 dark:text-indigo-300/60" />
            <p className="text-sm">暂无地理分布数据</p>
          </div>
        </div>
      )}
    </div>
  );
};
