import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit2 } from "lucide-react";

interface RenameModalProps {
  isOpen: boolean;
  currentName: string;
  newName: string;
  onNameChange: (name: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  currentName,
  newName,
  onNameChange,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="bg-white dark:bg-gray-800 p-0  shadow-2xl max-w-md w-full border-0 ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
        <div className="p-6">
          <div className="flex items-start mb-6">
            <div className="flex-shrink-0 w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mr-4">
              <Edit2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                重命名节点
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                请输入新的节点名称
              </p>
              <input
                type="text"
                value={newName}
                onChange={(e) => onNameChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                placeholder="输入节点名称"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onConfirm();
                  } else if (e.key === "Escape") {
                    onClose();
                  }
                }}
              />
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
            <Button
              variant="info"
              onClick={onConfirm}
              disabled={!newName.trim()}
              className="min-w-[80px]"
            >
              确认
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
