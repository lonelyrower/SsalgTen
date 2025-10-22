import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, RefreshCw, Calendar, AlertCircle, Info, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiService } from "@/services/api";
import type { NodeData } from "@/services/api";

interface NodeLogsPanelProps {
  node: NodeData;
  onClose: () => void;
}

interface NodeEvent {
  id: string;
  type: string;
  message?: string;
  details?: any;
  timestamp: string;
}

const getTypeColor = (type: string) => {
  const lowerType = type.toLowerCase();
  if (lowerType.includes("error") || lowerType.includes("fail")) {
    return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
  }
  if (lowerType.includes("warning") || lowerType.includes("warn")) {
    return "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800";
  }
  if (lowerType.includes("success") || lowerType.includes("complete")) {
    return "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
  }
  return "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800";
};

const getTypeIcon = (type: string) => {
  const lowerType = type.toLowerCase();
  if (lowerType.includes("error") || lowerType.includes("fail")) {
    return <AlertCircle className="h-4 w-4" />;
  }
  if (lowerType.includes("warning") || lowerType.includes("warn")) {
    return <AlertCircle className="h-4 w-4" />;
  }
  if (lowerType.includes("success") || lowerType.includes("complete")) {
    return <CheckCircle className="h-4 w-4" />;
  }
  return <Info className="h-4 w-4" />;
};

export const NodeLogsPanel: React.FC<NodeLogsPanelProps> = ({ node, onClose }) => {
  const [events, setEvents] = useState<NodeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getNodeEvents(node.id, 100);
      if (response.success && response.data) {
        setEvents(response.data as NodeEvent[]);
      } else {
        setError("Failed to load events");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [node.id]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] flex flex-col"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">节点日志</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{node.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchEvents}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              刷新
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && events.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <RefreshCw className="h-12 w-12 mx-auto mb-4 text-gray-400 animate-spin" />
                <p className="text-gray-600 dark:text-gray-400">加载日志中...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                <p className="text-red-600 dark:text-red-400">{error}</p>
                <Button variant="outline" size="sm" onClick={fetchEvents} className="mt-4">
                  重试
                </Button>
              </div>
            </div>
          ) : events.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Info className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 dark:text-gray-400">暂无日志记录</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event, index) => (
                <motion.div
                  key={event.id}
                  className={`p-4 rounded-lg border ${getTypeColor(event.type)}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02 }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getTypeIcon(event.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">
                          {event.type}
                        </span>
                      </div>
                      {event.message && <p className="text-sm mb-2">{event.message}</p>}
                      {event.details && Object.keys(event.details).length > 0 && (
                        <details className="text-xs opacity-70 mt-2">
                          <summary className="cursor-pointer hover:opacity-100">
                            详细信息
                          </summary>
                          <pre className="mt-2 p-2 bg-black/5 dark:bg-black/20 rounded overflow-x-auto">
                            {JSON.stringify(event.details, null, 2)}
                          </pre>
                        </details>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-xs opacity-70">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {new Date(event.timestamp).toLocaleString("zh-CN", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
