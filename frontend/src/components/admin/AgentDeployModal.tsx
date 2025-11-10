import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AgentInstallCommands } from "@/components/agent/AgentInstallCommands";
import { X, Server, AlertCircle, ExternalLink, Terminal } from "lucide-react";

interface AgentDeployModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeployed: () => void;
}

export const AgentDeployModal: React.FC<AgentDeployModalProps> = ({
  isOpen,
  onClose,
  onDeployed,
}) => {
  const handleDeploymentComplete = () => {
    onDeployed();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <Card className="surface-elevated rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <Server className="h-6 w-6 text-[hsl(var(--info))]" />
            <h2 className="text-xl font-semibold text-foreground">
              部署网络监控探针
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* 内容区域 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Terminal className="h-12 w-12 text-[hsl(var(--info))] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                部署监控探针
              </h3>
              <p className="text-muted-foreground">
                使用下面的命令在您的VPS上快速部署监控节点
              </p>
            </div>

            {/* 系统要求 */}
            <Card className="p-4 bg-muted/50">
              <h4 className="font-medium text-foreground mb-3 flex items-center">
                <AlertCircle className="h-4 w-4 mr-2 text-[hsl(var(--warning))]" />
                系统要求
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                <div>
                  <strong>操作系统:</strong>
                  <br />
                  Ubuntu 18.04+
                  <br />
                  CentOS 7+
                  <br />
                  Debian 9+
                </div>
                <div>
                  <strong>硬件要求:</strong>
                  <br />
                  CPU: 1核心
                  <br />
                  内存: 512MB
                  <br />
                  磁盘: 1GB
                </div>
                <div>
                  <strong>网络要求:</strong>
                  <br />
                  公网IP地址
                  <br />
                  端口3002可访问
                  <br />
                  到主服务器连通
                </div>
              </div>
            </Card>

            {/* 使用共享的安装命令组件（完整模式：包含交互式安装与快速卸载命令） */}
            <AgentInstallCommands />

            {/* 安装说明 */}
            <Card className="p-4 bg-primary/10 border-primary/30">
              <h4 className="font-medium text-primary mb-2">安装说明</h4>
              <ol className="text-sm text-primary space-y-1 list-decimal list-inside">
                <li>确保您有VPS的root权限或sudo权限</li>
                <li>将上述命令复制到您的VPS终端中</li>
                <li>按回车键执行安装脚本</li>
                <li>等待安装完成，节点将自动注册到系统</li>
                <li>几分钟后即可在节点列表中看到新节点</li>
              </ol>
            </Card>

            <div className="flex justify-center space-x-4">
              <Button variant="outline" onClick={onClose}>
                关闭
              </Button>
              <Button onClick={handleDeploymentComplete}>
                完成，查看节点列表
              </Button>
            </div>
          </div>
        </div>

        {/* 底部帮助链接 */}
        <div className="px-6 py-4 border-t border-border bg-muted/50">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>需要帮助？</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                window.open(
                  "https://github.com/lonelyrower/SsalgTen#agent-deployment",
                  "_blank",
                )
              }
              className="flex items-center space-x-1 text-[hsl(var(--info))] hover:text-[hsl(var(--info))]/80"
            >
              <ExternalLink className="h-3 w-3" />
              <span>查看部署文档</span>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
