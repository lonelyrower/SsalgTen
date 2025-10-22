import React, { useState } from "react";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/hooks/useAuth";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { ErrorState } from "@/components/ui/ErrorState";
import { ChangePasswordModal } from "@/components/admin/ChangePasswordModal";
import { NodeManagement } from "@/components/admin/NodeManagement";
import { SystemSettings } from "@/components/admin/SystemSettings";
import { SystemOverview } from "@/components/admin/SystemOverview";
import { ApiKeyManagement } from "@/components/admin/ApiKeyManagement";
import { UserManagement } from "@/components/admin/UserManagement";
import { Shield, Server, Settings, Users, Key } from "lucide-react";

export const AdminPage: React.FC = () => {
  const { hasRole } = useAuth();
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  // 系统更新相关状态已移至SystemOverview组件中管理

  // 定义标签页配置
  const adminTabs = [
    { id: "overview", label: "系统概览", icon: Shield },
    { id: "system", label: "系统配置", icon: Settings },
    { id: "nodes", label: "节点管理", icon: Server },
    { id: "users", label: "用户管理", icon: Users },
    { id: "keys", label: "API密钥", icon: Key },
  ];

  if (!hasRole("ADMIN")) {
    return (
      <div className="fixed inset-0 flex flex-col">
        <Header />
        <div className="flex-1 overflow-y-auto">
          <main className="max-w-7xl mx-auto px-4 py-6 w-full">
            <ErrorState
              type="access-denied"
              title="访问被拒绝"
              message="您需要管理员权限才能访问此页面"
              showHome={true}
              size="lg"
            />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col">
      <Header />

      <div className="flex-1 overflow-y-auto">
        <main className="max-w-7xl mx-auto px-4 py-6 w-full">
          {/* 标签页导航 */}
          <div className="flex justify-center mb-8">
            <AdminTabs
              tabs={adminTabs}
              value={activeTab}
              onChange={setActiveTab}
            />
          </div>

          {/* 标签页内容 */}
          {activeTab === "overview" && <SystemOverview />}

          {activeTab === "system" && <SystemSettings />}

          {activeTab === "nodes" && <NodeManagement />}

          {activeTab === "users" && <UserManagement />}

          {activeTab === "keys" && <ApiKeyManagement />}
        </main>
      </div>

      {/* 修改密码模态框 */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
      />
    </div>
  );
};
