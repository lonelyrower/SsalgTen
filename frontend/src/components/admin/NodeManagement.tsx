import React, { useState, useEffect } from "react";
import { logger } from "@/utils/logger";
import { apiService, type NodeData } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AgentDeployModal } from "./AgentDeployModal";
import { Server } from "lucide-react";

// 导入提取的组件
import { NodeManagementToolbar } from "./NodeManagementToolbar";
import { NodeTable } from "./NodeTable";
import { DeleteConfirmModal } from "./modals/DeleteConfirmModal";
import { RenameModal } from "./modals/RenameModal";
import { ImportVPSModal } from "./modals/ImportVPSModal";

interface NodeManagementProps {
  className?: string;
}

export const NodeManagement: React.FC<NodeManagementProps> = ({
  className = "",
}) => {
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showRenameModal, setShowRenameModal] = useState<string | null>(null);
  const [newNodeName, setNewNodeName] = useState("");
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [editingCost, setEditingCost] = useState<string | null>(null);
  const [costValue, setCostValue] = useState<string>("");

  useEffect(() => {
    loadNodes();
  }, []);

  const loadNodes = async () => {
    try {
      setLoading(true);
      const response = await apiService.getNodes();
      if (response.success && response.data) {
        // 规范化状态为小写
        const normalized = response.data.map((n: NodeData) => ({
          ...n,
          status: (typeof n.status === "string"
            ? n.status.toLowerCase()
            : n.status) as NodeData["status"],
        }));
        setNodes(normalized);
      } else {
        setError(response.error || "Failed to load nodes");
      }
    } catch {
      setError("Failed to load nodes");
    } finally {
      setLoading(false);
    }
  };

  const handleExportNodes = async (
    format: "json" | "csv" | "markdown" = "csv",
  ) => {
    try {
      setExporting(true);
      const result = await apiService.exportNodes(format);
      if (result.success && result.data) {
        const url = window.URL.createObjectURL(result.data);
        const link = document.createElement("a");
        link.href = url;
        const fallbackName = `ssalgten-nodes-${new Date().toISOString().replace(/[:.]/g, "-")}.${format}`;
        link.download = result.fileName || fallbackName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } else {
        window.alert(`节点导出失败：${result.error || "未知错误"}`);
      }
    } catch (error) {
      logger.error("Export nodes failed:", error);
      window.alert("节点导出失败，请稍后重试。");
    } finally {
      setExporting(false);
    }
  };

  const filteredNodes = nodes.filter((node) => {
    const matchesSearch =
      node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (node.ipv4 && node.ipv4.includes(searchTerm)) ||
      (node.ipv6 && node.ipv6.includes(searchTerm)) ||
      (node.asnNumber &&
        node.asnNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (node.asnName &&
        node.asnName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      filterStatus === "all" ||
      (node.status || "").toLowerCase() === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const handleDeleteNode = async (nodeId: string) => {
    try {
      const response = await apiService.deleteNode(nodeId);
      if (response.success) {
        setNodes(nodes.filter((n) => n.id !== nodeId));
        setShowDeleteConfirm(null);
      } else {
        setError(response.error || "Failed to delete node");
      }
    } catch {
      setError("Failed to delete node");
    }
  };

  const handleRenameNode = async (nodeId: string) => {
    if (!newNodeName.trim()) {
      setError("节点名称不能为空");
      return;
    }

    try {
      const response = await apiService.updateNode(nodeId, {
        name: newNodeName.trim(),
      });
      if (response.success && response.data) {
        setNodes(
          nodes.map((n) =>
            n.id === nodeId
              ? { ...n, name: response.data?.name || newNodeName.trim() }
              : n,
          ),
        );
        setShowRenameModal(null);
        setNewNodeName("");
        setError("");
      } else {
        setError(response.error || "Failed to rename node");
      }
    } catch {
      setError("Failed to rename node");
    }
  };

  const openRenameModal = (nodeId: string, currentName: string) => {
    setShowRenameModal(nodeId);
    setNewNodeName(currentName);
  };

  const handleCostEdit = (nodeId: string, currentCost: number | null | undefined) => {
    setEditingCost(nodeId);
    setCostValue(currentCost !== null && currentCost !== undefined ? currentCost.toString() : "");
  };

  const handleCostSave = async (nodeId: string) => {
    try {
      let cost: number | null = null;

      if (costValue.trim() !== "") {
        const parsedCost = parseFloat(costValue);

        if (isNaN(parsedCost)) {
          setError("请输入有效的数字");
          return;
        }

        if (parsedCost < 0) {
          setError("价格不能为负数");
          return;
        }

        cost = Math.round(parsedCost * 100) / 100;
      }

      const response = await apiService.updateNode(nodeId, { monthlyCost: cost });

      if (response.success && response.data) {
        setNodes(
          nodes.map((n) =>
            n.id === nodeId ? { ...n, monthlyCost: cost } : n
          )
        );
        setEditingCost(null);
        setCostValue("");
        setError("");
      } else {
        setError(response.error || "更新失败");
      }
    } catch (err) {
      logger.error("Cost update error:", err);
      setError(err instanceof Error ? err.message : "更新失败");
    }
  };

  const handleCostCancel = () => {
    setEditingCost(null);
    setCostValue("");
  };

  if (loading) {
    return (
      <div className={`${className} animate-pulse`}>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-6"></div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-16 bg-gray-200 dark:bg-gray-700 rounded"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* 工具栏 */}
      <NodeManagementToolbar
        totalNodes={filteredNodes.length}
        onlineNodes={filteredNodes.filter((n) => n.status === "online").length}
        searchTerm={searchTerm}
        filterStatus={filterStatus}
        exporting={exporting}
        showExportMenu={showExportMenu}
        onSearchChange={setSearchTerm}
        onFilterChange={setFilterStatus}
        onRefresh={loadNodes}
        onExportMenuToggle={() => setShowExportMenu(!showExportMenu)}
        onExport={handleExportNodes}
        onImportClick={() => setShowImportModal(true)}
        onDeployClick={() => setShowDeployModal(true)}
      />

      {/* 错误提示 */}
      {error && (
        <Card className="p-4 mb-6 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="flex items-center">
            <div className="text-red-500 mr-3">⚠️</div>
            <div>
              <p className="text-red-800 dark:text-red-200">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError("")}
                className="text-red-600 hover:text-red-700 mt-2"
              >
                关闭
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* 节点表格 */}
      <NodeTable
        nodes={filteredNodes}
        editingCost={editingCost}
        costValue={costValue}
        onCostEdit={handleCostEdit}
        onCostSave={handleCostSave}
        onCostCancel={handleCostCancel}
        onCostValueChange={setCostValue}
        onRename={openRenameModal}
        onDelete={setShowDeleteConfirm}
      />

      {/* 空状态 */}
      {filteredNodes.length === 0 && (
        <div className="text-center py-8">
          <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {searchTerm || filterStatus !== "all"
              ? "没有找到匹配的节点"
              : "还没有节点"}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {searchTerm || filterStatus !== "all"
              ? "请尝试调整搜索条件"
              : "部署第一个节点开始监控"}
          </p>
          {!searchTerm && filterStatus === "all" && (
            <Button variant="info" onClick={() => setShowDeployModal(true)}>
              部署节点
            </Button>
          )}
        </div>
      )}

      {/* Agent部署模态框 */}
      <AgentDeployModal
        isOpen={showDeployModal}
        onClose={() => setShowDeployModal(false)}
        onDeployed={() => {
          loadNodes();
          setError("");
        }}
      />

      {/* 导入VPS模态框 */}
      <ImportVPSModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={loadNodes}
        onError={setError}
      />

      {/* 删除确认对话框 */}
      <DeleteConfirmModal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        onConfirm={() => showDeleteConfirm && handleDeleteNode(showDeleteConfirm)}
      />

      {/* 重命名对话框 */}
      <RenameModal
        isOpen={!!showRenameModal}
        currentName={newNodeName}
        newName={newNodeName}
        onNameChange={setNewNodeName}
        onClose={() => {
          setShowRenameModal(null);
          setNewNodeName("");
        }}
        onConfirm={() => showRenameModal && handleRenameNode(showRenameModal)}
      />
    </div>
  );
};
