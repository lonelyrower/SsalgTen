import React, { useState, useEffect } from "react";
import { apiService, type SystemConfig } from "@/services/api";
import { Button } from "@/components/ui/button";
import { GlassCard } from '@/components/ui/GlassCard';
import {
  Settings,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  RotateCcw,
} from "lucide-react";

interface SystemSettingsProps {
  className?: string;
}

export const SystemSettings: React.FC<SystemSettingsProps> = ({
  className = "",
}) => {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [changedConfigs, setChangedConfigs] = useState<Map<string, string>>(
    new Map(),
  );

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const response = await apiService.getSystemConfigs();
      if (response.success && response.data) {
        // 只显示当前版本定义的配置项
        const validKeys = ["system.name", "map.api_key", "cesium.ion_token"];
        const filteredConfigs = response.data.filter((config) =>
          validKeys.includes(config.key),
        );
        setConfigs(filteredConfigs);
        setChangedConfigs(new Map());
      } else {
        setError(response.error || "Failed to load configurations");
      }
    } catch {
      setError("Failed to load configurations");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    const newChanges = new Map(changedConfigs);
    newChanges.set(key, value);
    setChangedConfigs(newChanges);
  };

  const handleSave = async () => {
    if (changedConfigs.size === 0) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const configsToUpdate = Array.from(changedConfigs.entries()).map(
        ([key, value]) => ({
          key,
          value,
        }),
      );

      const response = await apiService.batchUpdateConfigs(configsToUpdate);

      if (response.success) {
        setSuccess(`成功更新了 ${configsToUpdate.length} 个配置项`);
        setChangedConfigs(new Map());
        await loadConfigs();

        // 如果修改了站点名称，刷新页面标题
        const hasNameChange = configsToUpdate.some(
          (c) => c.key === "system.name",
        );
        if (hasNameChange) {
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          setTimeout(() => setSuccess(""), 3000);
        }
      } else {
        setError(response.error || "保存配置失败");
      }
    } catch {
      setError("保存配置失败");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("确定要将所有配置重置为默认值吗？此操作不可恢复。")) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await apiService.resetConfigsToDefaults();

      if (response.success) {
        setSuccess("所有配置已重置为默认值");
        setChangedConfigs(new Map());
        await loadConfigs();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(response.error || "重置配置失败");
      }
    } catch {
      setError("重置配置失败");
    } finally {
      setSaving(false);
    }
  };

  const getConfigInfo = (key: string) => {
    const configInfo: Record<
      string,
      { name: string; desc: string; placeholder?: string }
    > = {
      "system.name": {
        name: "站点名称",
        desc: "在页面标题和导航栏中显示的系统名称",
        placeholder: "SsalgTen Network Monitor",
      },
      "map.api_key": {
        name: "Mapbox API 密钥",
        desc: "可选配置。如果要使用 Mapbox 地图样式，需要在 Mapbox 官网免费注册并填写密钥",
        placeholder: "pk.ey...",
      },
      "cesium.ion_token": {
        name: "Cesium Ion API Token",
        desc: "可选配置。用于访问 Cesium Ion 的高质量 3D 地形和影像数据。在 cesium.com/ion 免费注册获取（每月 5万次免费加载）",
        placeholder: "eyJhbGciOiJ...",
      },
    };
    return configInfo[key] || { name: key, desc: "" };
  };

  const renderInput = (config: SystemConfig) => {
    let currentValue = changedConfigs.get(config.key) ?? config.value;
    // 去除值两端的双引号（如果存在）
    if (
      typeof currentValue === "string" &&
      currentValue.startsWith('"') &&
      currentValue.endsWith('"')
    ) {
      currentValue = currentValue.slice(1, -1);
    }
    const info = getConfigInfo(config.key);
    const inputType = config.inputType || "text";

    if (inputType === "number") {
      return (
        <input
          type="number"
          value={currentValue}
          onChange={(e) => handleChange(config.key, e.target.value)}
          placeholder={info.placeholder}
          className="w-full px-4 py-2 border border-border rounded-lg surface-base text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
        />
      );
    }

    return (
      <input
        type="text"
        value={currentValue}
        onChange={(e) => handleChange(config.key, e.target.value)}
        placeholder={info.placeholder}
        className="w-full px-4 py-2 border border-border rounded-lg surface-base text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
      />
    );
  };

  if (loading) {
    return (
      <div className={`${className} animate-pulse`}>
        <div className="h-8 bg-muted rounded mb-6"></div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 bg-muted rounded"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* 头部 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center">
              <Settings className="h-8 w-8 mr-3 text-primary" />
              系统配置
            </h1>
            <p className="text-muted-foreground mt-2">
              管理系统基本设置
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={loadConfigs}
              disabled={saving}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={saving}
              className="text-[hsl(var(--warning))] hover:text-[hsl(var(--warning))]/80"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              恢复默认
            </Button>
          </div>
        </div>
      </div>

      {/* 状态消息 */}
      {error && (
        <GlassCard variant="danger" hover={false} className="mb-6 p-4">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-[hsl(var(--error))] mr-3 mt-0.5" />
            <div className="flex-1">
              <p className="text-[hsl(var(--error))]">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError("")}
                className="text-[hsl(var(--error))] hover:text-[hsl(var(--error))]/80 mt-2 h-auto p-0"
              >
                关闭
              </Button>
            </div>
          </div>
        </GlassCard>
      )}

      {success && (
        <GlassCard variant="success" hover={false} className="mb-6 p-4">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-[hsl(var(--success))] mr-3" />
            <p className="text-[hsl(var(--success))]">{success}</p>
          </div>
        </GlassCard>
      )}

      {/* 配置项列表 - 3列布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {configs.map((config) => {
          const info = getConfigInfo(config.key);
          const hasChanged = changedConfigs.has(config.key);

          // 根据配置类型设置图标和颜色
          const configStyle = {
            "system.name": {
              icon: "🏷️",
              color: "from-blue-500 to-cyan-500",
              bg: "bg-gradient-to-br from-[hsl(var(--info))]/10 to-[hsl(var(--info))]/5",
            },
            "map.api_key": {
              icon: "🗺️",
              color: "from-green-500 to-emerald-500",
              bg: "bg-gradient-to-br from-[hsl(var(--success))]/10 to-[hsl(var(--success))]/5",
            },
            "cesium.ion_token": {
              icon: "🌍",
              color: "from-orange-500 to-amber-500",
              bg: "bg-gradient-to-br from-[hsl(var(--warning))]/10 to-[hsl(var(--warning))]/5",
            },
          }[config.key] || {
            icon: "⚙️",
            color: "from-gray-500 to-slate-500",
            bg: "bg-muted/50",
          };

          return (
            <GlassCard
              key={config.id}
              variant="default"
              className={`overflow-hidden ${
                hasChanged
                  ? "ring-2 ring-[hsl(var(--info))]"
                  : ""
              }`}
            >
              <div
                className={`h-2 bg-gradient-to-r ${configStyle.color} -mt-6 -mx-6 mb-4`}
              ></div>
              <div>
                <div className="flex items-start gap-4">
                  <div
                    className={`flex-shrink-0 w-12 h-12  ${configStyle.bg} flex items-center justify-center text-2xl`}
                  >
                    {configStyle.icon}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="block text-lg font-semibold text-foreground mb-1">
                        {info.name}
                      </label>
                      <p className="text-sm text-muted-foreground">
                        {info.desc}
                      </p>
                    </div>
                    {renderInput(config)}
                    {config.unit && (
                      <p className="text-xs text-muted-foreground">
                        单位：{config.unit}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {configs.length === 0 && (
        <GlassCard hover={false} className="text-center p-12">
          <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">暂无系统配置</p>
        </GlassCard>
      )}

      {/* 保存按钮 */}
      {changedConfigs.size > 0 && (
        <div className="mt-8 flex items-center justify-between p-4 bg-[hsl(var(--info))]/10 border border-[hsl(var(--info))]/30 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-[hsl(var(--info))] mr-3" />
            <span className="text-sm text-[hsl(var(--info))]">
              您有 {changedConfigs.size} 项未保存的更改
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm("确定要放弃所有未保存的更改吗？")) {
                  setChangedConfigs(new Map());
                }
              }}
              disabled={saving}
            >
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  保存中...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  保存更改
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
