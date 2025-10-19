import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { NodeStreamingSummary } from '@/types/streaming';
import { STREAMING_DATA_EXPIRY_THRESHOLD } from '@/types/streaming';
import { Card } from '../ui/card';
import { CountryFlag } from '../ui/CountryFlag';
import { StreamingBadge } from './StreamingBadge';
import { Badge } from '../ui/badge';
import { Clock, AlertTriangle, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface StreamingNodeListProps {
  nodes: NodeStreamingSummary[];
  onNodeClick?: (nodeId: string) => void;
}

export const StreamingNodeList: React.FC<StreamingNodeListProps> = ({ nodes, onNodeClick }) => {
  const navigate = useNavigate();

  const handleNodeClick = (nodeId: string) => {
    if (onNodeClick) {
      onNodeClick(nodeId);
    } else {
      navigate(`/nodes?id=${nodeId}&tab=streaming`);
    }
  };

  return (
    <div className="space-y-3">
      {nodes.map((node) => (
        <NodeStreamingCard
          key={node.nodeId}
          node={node}
          onClick={() => handleNodeClick(node.nodeId)}
        />
      ))}
    </div>
  );
};

interface NodeStreamingCardProps {
  node: NodeStreamingSummary;
  onClick: () => void;
}

const NodeStreamingCard: React.FC<NodeStreamingCardProps> = ({ node, onClick }) => {
  const isExpired = useMemo(() => {
    if (!node.lastScanned) return true;
    const lastScannedTime = new Date(node.lastScanned).getTime();
    return Date.now() - lastScannedTime > STREAMING_DATA_EXPIRY_THRESHOLD;
  }, [node.lastScanned]);

  const timeAgo = useMemo(() => {
    if (!node.lastScanned) return '从未检测';
    try {
      return formatDistanceToNow(new Date(node.lastScanned), {
        addSuffix: true,
        locale: zhCN,
      });
    } catch {
      return '未知';
    }
  }, [node.lastScanned]);

  return (
    <Card
      className="p-4 hover:shadow-lg transition-all cursor-pointer border-l-4"
      style={{
        borderLeftColor: isExpired ? '#f59e0b' : node.unlockedCount > node.restrictedCount ? '#10b981' : '#ef4444'
      }}
      onClick={onClick}
    >
      <div className="space-y-3">
        {/* 节点信息 */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1">
            <CountryFlag country={node.country} size="lg" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {node.nodeName}
                </h3>
                <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {node.city ? `${node.city}, ${node.country}` : node.country}
              </p>
            </div>
          </div>

          {/* 快速统计 */}
          <div className="flex items-center gap-4 text-sm">
            <div className="text-center">
              <div className="text-green-600 dark:text-green-400 font-bold">{node.unlockedCount}</div>
              <div className="text-gray-500 dark:text-gray-400 text-xs">解锁</div>
            </div>
            <div className="text-center">
              <div className="text-red-600 dark:text-red-400 font-bold">{node.restrictedCount}</div>
              <div className="text-gray-500 dark:text-gray-400 text-xs">受限</div>
            </div>
          </div>
        </div>

        {/* 流媒体服务状态 */}
        <div className="flex flex-wrap gap-2">
          {node.services.map((service) => (
            <StreamingBadge
              key={service.service}
              service={service}
              size="md"
              showRegion
            />
          ))}
        </div>

        {/* 底部信息栏 */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Clock className="h-4 w-4" />
            <span>{timeAgo}</span>
          </div>

          {isExpired && (
            <Badge variant="warning" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              <span>数据过期</span>
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
};
