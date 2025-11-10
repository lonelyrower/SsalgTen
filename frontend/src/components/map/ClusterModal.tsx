import React from "react";
import type { NodeData } from "@/services/api";

interface ClusterModalProps {
  isOpen: boolean;
  nodes: NodeData[];
  onClose: () => void;
  onNodeClick?: (node: NodeData) => void;
}

export const ClusterModal: React.FC<ClusterModalProps> = ({
  isOpen,
  nodes,
  onClose,
  onNodeClick,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800  shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              聚合节点详情 ({nodes.length} 个节点)
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="关闭聚合节点详情"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            该位置的所有节点（已达到最大缩放级别）
          </p>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {nodes.map((node) => (
              <div
                key={node.id}
                onClick={() => {
                  onNodeClick?.(node);
                  onClose();
                }}
                className="p-4 border border-gray-200 dark:border-gray-600  hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                    {node.name}
                  </h4>
                  <div
                    className={`w-3 h-3 rounded-full ${
                      node.status === "online"
                        ? "bg-green-500"
                        : node.status === "offline"
                          ? "bg-red-500"
                          : "bg-yellow-500"
                    }`}
                  ></div>
                </div>

                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <div>
                    状态:{" "}
                    <span
                      className={`font-medium ${
                        node.status === "online"
                          ? "text-green-600"
                          : node.status === "offline"
                            ? "text-red-600"
                            : "text-yellow-600"
                      }`}
                    >
                      {node.status.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    位置: {node.city}, {node.country}
                  </div>
                  <div>提供商: {node.provider}</div>
                  {node.ipv4 && (
                    <div className="font-mono text-primary">
                      {node.ipv4}
                    </div>
                  )}
                  {node.ipv6 && node.ipv6.includes(":") && (
                    <div className="font-mono text-indigo-500 dark:text-indigo-300 break-all">
                      {node.ipv6}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <span className="text-green-600">
                在线:{" "}
                {nodes.filter((n) => n.status === "online").length}
              </span>
              <span className="text-red-600">
                离线:{" "}
                {nodes.filter((n) => n.status === "offline").length}
              </span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
