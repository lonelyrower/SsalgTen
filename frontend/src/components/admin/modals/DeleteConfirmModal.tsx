import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="bg-white dark:bg-gray-800 p-0  shadow-2xl max-w-md w-full border-0 ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
        <div className="p-6">
          <div className="flex items-start mb-6">
            <div className="flex-shrink-0 w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mr-4">
              <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                删除节点
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                确定要删除这个监控节点吗？删除后将无法恢复该节点的所有历史数据和配置信息。
              </p>
            </div>
          </div>
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="min-w-[80px] hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              取消
            </Button>
            <Button variant="destructive" onClick={onConfirm} className="min-w-[80px]">
              删除
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
