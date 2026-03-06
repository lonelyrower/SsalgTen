import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiService, type InstallCommandData } from "@/services/api";
import {
  Copy,
  Check,
  Terminal,
  Server,
  Key,
  Shield,
  RefreshCw,
  CheckCircle,
  ShieldAlert,
  AlertCircle,
} from "lucide-react";

interface AgentInstallCommandsProps {
  compact?: boolean;
}

export const AgentInstallCommands: React.FC<AgentInstallCommandsProps> = ({
  compact = false,
}) => {
  const [installData, setInstallData] = useState<InstallCommandData | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchInstallCommand();
  }, []);

  const copyButtonClasses = (isCopied: boolean) =>
    cn(
      "absolute top-3 right-3 z-10 h-9 w-9 min-h-0 min-w-0 p-0 rounded-[var(--radius-md)] shadow-sm transition-colors",
      "border bg-white/95 text-primary hover:bg-primary/10 dark:bg-slate-900/80 dark:text-primary",
      isCopied
        ? "border-emerald-300 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
        : "border-primary/40 dark:border-primary/40",
    );

  const fetchInstallCommand = async () => {
    const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("timeout")), ms);
        p.then((v) => {
          clearTimeout(timer);
          resolve(v);
        }).catch((e) => {
          clearTimeout(timer);
          reject(e);
        });
      });
    };

    try {
      setLoading(true);

      const installResponse = await withTimeout(
        apiService.getInstallCommand(),
        3000,
      );
      if (!installResponse.success || !installResponse.data) {
        throw new Error(installResponse.error || "获取安装令牌失败");
      }

      let sshEnabled = false;
      let sshWindow = 10;
      let sshThreshold = 10;

      try {
        const cfgRes = await apiService.getSystemConfigs();
        if (cfgRes.success && Array.isArray(cfgRes.data)) {
          const cfgs = cfgRes.data;
          const getVal = (k: string) => cfgs.find((c) => c.key === k)?.value;
          sshEnabled =
            String(getVal("security.ssh_monitor_default_enabled")) === "true";
          sshWindow =
            parseInt(
              String(getVal("security.ssh_monitor_default_window_min") ?? "10"),
              10,
            ) || 10;
          sshThreshold =
            parseInt(
              String(getVal("security.ssh_monitor_default_threshold") ?? "10"),
              10,
            ) || 10;
        }
      } catch (configError) {
        console.warn(
          "Failed to load system configs for install template:",
          configError,
        );
      }

      const tpl = sshEnabled
        ? `\n# 可选：启用 SSH 暴力破解监控（读取 /var/log）\n# SSH_MONITOR_ENABLED=true\n# SSH_MONITOR_WINDOW_MIN=${sshWindow}\n# SSH_MONITOR_THRESHOLD=${sshThreshold}\n`
        : "";

      const data = installResponse.data;
      setInstallData({
        ...data,
        quickCommand: data.quickCommand + tpl,
        command: data.command + tpl,
        interactiveCommand: data.interactiveCommand + tpl,
      });
    } catch (error) {
      console.error("Failed to build install command:", error);
      setInstallData(null);
    } finally {
      setLoading(false);
    }
  };
  const copyToClipboard = async (text: string, type: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }

      setCopied(type);
      setTimeout(() => setCopied(null), 3000);
    } catch (error) {
      console.error("Failed to copy:", error);
      alert("复制失败，请手动选择并复制命令");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            正在获取安装命令...
          </p>
        </div>
      </div>
    );
  }

  if (!installData) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400">获取安装命令失败</p>
        <Button onClick={fetchInstallCommand} className="mt-4" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          重试
        </Button>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-4">
        {/* 安全警告 (紧凑模式) */}
        {!installData.security.isSecure && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-[var(--radius-lg)] p-3">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                部署安全提示 - 建议通过 HTTPS 分发安装令牌
              </span>
            </div>
          </div>
        )}

        {/* 快速安装命令 (紧凑版) */}
        <div className="bg-white dark:bg-gray-800 rounded-[var(--radius-lg)] border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              快速安装命令
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(installData.quickCommand, "quick")}
              className={copied === "quick" ? "text-green-600" : ""}
              aria-label={
                copied === "quick"
                  ? "安装命令已复制到剪贴板"
                  : "复制安装命令到剪贴板"
              }
            >
              {copied === "quick" ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1" />
                  复制
                </>
              )}
            </Button>
          </div>
          <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono overflow-x-auto">
            <code>{installData.quickCommand}</code>
          </pre>
        </div>
      </div>
    );
  }

  // 完整版本
  return (
    <div className="space-y-6">
      {/* 服务器信息 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-[var(--radius-lg)]">
          <div className="flex items-center space-x-3">
            <Server className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                主服务器地址
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                {installData.masterUrl}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => copyToClipboard(installData.masterUrl, "masterUrl")}
          >
            {copied === "masterUrl" ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-[var(--radius-lg)]">
          <div className="flex items-center space-x-3">
            <Key
              className={`h-5 w-5 ${installData.security.isSecure ? "text-green-600" : "text-yellow-600"}`}
            />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                安装令牌
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                {installData.installToken.substring(0, 8)}...
                {installData.installToken.slice(-4)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                有效期至 {new Date(installData.tokenExpiresAt).toLocaleString()}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => copyToClipboard(installData.installToken, "installToken")}
          >
            {copied === "installToken" ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* 安全警告 */}
      {!installData.security.isSecure && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-[var(--radius-lg)] p-4">
          <div className="flex items-start space-x-3">
            <ShieldAlert className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                部署安全警告
              </h3>
              <div className="space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                {installData.security.warnings.map((warning, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <AlertCircle className="h-3 w-3" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                  建议操作：
                </h4>
                <div className="space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                  {installData.security.recommendations.map((rec, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <CheckCircle className="h-3 w-3" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 安全确认 */}
      {installData.security.isSecure && (
        <div className="bg-[hsl(var(--status-success-50))] dark:bg-[hsl(var(--status-success-900)/0.2)] border border-[hsl(var(--status-success-200))] dark:border-[hsl(var(--status-success-800))] rounded-[var(--radius-lg)] p-4">
          <div className="flex items-center space-x-3">
            <Shield className="h-5 w-5 text-[hsl(var(--status-success-600))]" />
            <div>
              <h3 className="text-sm font-medium text-[hsl(var(--status-success-800))] dark:text-[hsl(var(--status-success-200))]">
                部署安全检查通过
              </h3>
              <p className="text-sm text-[hsl(var(--status-success-700))] dark:text-[hsl(var(--status-success-300))]">
                当前安装流程使用短期令牌下发运行凭据。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 快速安装命令 */}
      <div className="bg-white dark:bg-gray-800 rounded-[var(--radius-lg)] shadow-[var(--shadow-md)] p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Terminal className="h-6 w-6 text-[hsl(var(--status-success-600))]" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            快速安装（推荐）
          </h2>
        </div>

        <p className="text-gray-600 dark:text-gray-400 mb-4">
          在目标服务器上以root用户执行以下命令，自动完成节点安装和配置：
        </p>

        <div className="relative group">
          <pre className="bg-gray-900 text-green-400 p-4 rounded-[var(--radius-lg)] overflow-x-auto text-sm font-mono pr-14">
            <code>{installData.quickCommand}</code>
          </pre>
          <Button
            variant="outline"
            size="icon"
            className={copyButtonClasses(copied === "quick")}
            onClick={() => copyToClipboard(installData.quickCommand, "quick")}
            aria-label={
              copied === "quick"
                ? "安装命令已复制到剪贴板"
                : "复制安装命令到剪贴板"
            }
            title={copied === "quick" ? "已复制！" : "复制命令"}
          >
            {copied === "quick" ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="mt-4 p-4 bg-primary/10 rounded-[var(--radius-lg)]">
          <h4 className="font-medium text-primary mb-2">安装完成后：</h4>
          <ul className="text-sm text-primary space-y-1">
            <li>• 节点将自动注册到当前主服务器</li>
            <li>• 自动检测服务器地理位置和网络信息</li>
            <li>• 配置为系统服务，开机自启动</li>
            <li>• 几分钟后即可在监控界面看到新节点</li>
          </ul>
        </div>
      </div>

      {/* 交互式安装命令 */}
      {installData.interactiveCommand && (
        <div className="bg-white dark:bg-gray-800 rounded-[var(--radius-lg)] shadow-[var(--shadow-md)] p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Terminal className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              交互式安装
            </h2>
          </div>

          <p className="text-gray-600 dark:text-gray-400 mb-4">
            适用于需要自定义配置的场景，运行后选择菜单选项"1"即可快速安装：
          </p>

          <div className="relative group">
            <pre className="bg-gray-900 text-green-400 p-4 rounded-[var(--radius-lg)] overflow-x-auto text-sm font-mono pr-14">
              <code>{installData.interactiveCommand}</code>
            </pre>
            <Button
              variant="outline"
              size="icon"
              className={copyButtonClasses(copied === "interactive")}
              onClick={() =>
                copyToClipboard(installData.interactiveCommand, "interactive")
              }
              aria-label={
                copied === "interactive"
                  ? "交互式安装命令已复制到剪贴板"
                  : "复制交互式安装命令到剪贴板"
              }
              title={copied === "interactive" ? "已复制！" : "复制命令"}
            >
              {copied === "interactive" ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="mt-4 p-4 bg-primary/10 rounded-[var(--radius-lg)]">
            <h4 className="font-medium text-primary mb-2">使用说明：</h4>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>• 运行命令后将显示安装选项菜单</li>
              <li>• 选择"1"使用预置参数快速安装</li>
              <li>• 选择"2"进行完全自定义配置</li>
              <li>• 地理位置信息将自动检测</li>
            </ul>
          </div>
        </div>
      )}

      {/* 卸载命令 */}
      {installData.quickUninstallCommand && (
        <div className="bg-white dark:bg-gray-800 rounded-[var(--radius-lg)] shadow-[var(--shadow-md)] p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Terminal className="h-6 w-6 text-[hsl(var(--status-error-600))]" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              快速卸载
            </h2>
          </div>

          <p className="text-gray-600 dark:text-gray-400 mb-4">
            如需完全卸载监控探针，请在目标服务器上以root用户执行：
          </p>

          <div className="relative group">
            <pre className="bg-gray-900 text-[hsl(var(--status-error-400))] p-4 rounded-[var(--radius-lg)] overflow-x-auto text-sm font-mono pr-14">
              <code>{installData.quickUninstallCommand}</code>
            </pre>
            <Button
              variant="outline"
              size="icon"
              className={copyButtonClasses(copied === "uninstall")}
              onClick={() =>
                copyToClipboard(installData.quickUninstallCommand, "uninstall")
              }
              aria-label={
                copied === "uninstall"
                  ? "卸载命令已复制到剪贴板"
                  : "复制卸载命令到剪贴板"
              }
              title={copied === "uninstall" ? "已复制！" : "复制命令"}
            >
              {copied === "uninstall" ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="mt-4 p-4 bg-[hsl(var(--status-error-50))] dark:bg-[hsl(var(--status-error-900)/0.2)] rounded-[var(--radius-lg)]">
            <h4 className="font-medium text-[hsl(var(--status-error-900))] dark:text-[hsl(var(--status-error-100))] mb-2 flex items-center">
              <AlertCircle className="h-4 w-4 mr-2" />
              卸载注意事项：
            </h4>
            <ul className="text-sm text-[hsl(var(--status-error-800))] dark:text-[hsl(var(--status-error-200))] space-y-1">
              <li>• 卸载将停止监控服务并删除所有相关文件</li>
              <li>• 节点将从监控界面中自动移除</li>
              <li>• 历史监控数据将保留在主服务器上</li>
              <li>• 如需重新部署，请使用上方安装命令</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};


