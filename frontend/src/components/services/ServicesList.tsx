import React, { useState } from 'react';
import type { NodeService } from '@/types/services';
import { SERVICE_TYPE_CONFIG, SERVICE_STATUS_CONFIG, DEPLOYMENT_TYPE_CONFIG, SERVICE_DATA_EXPIRY_THRESHOLD } from '@/types/services';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { ExternalLink, Edit, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface ServicesListProps {
  services: NodeService[];
  onServiceClick?: (service: NodeService) => void;
  onEditService?: (service: NodeService) => void;
  onDeleteService?: (serviceId: string) => void;
}

export const ServicesList: React.FC<ServicesListProps> = ({
  services,
  onServiceClick,
  onEditService,
  onDeleteService,
}) => {
  return (
    <div className="space-y-3">
      {services.map((service) => (
        <ServiceCard
          key={service.id}
          service={service}
          onClick={() => onServiceClick?.(service)}
          onEdit={() => onEditService?.(service)}
          onDelete={() => onDeleteService?.(service.id)}
        />
      ))}
    </div>
  );
};

interface ServiceCardProps {
  service: NodeService;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ service, onEdit, onDelete }) => {
  const [expanded, setExpanded] = useState(false);

  const typeConfig = SERVICE_TYPE_CONFIG[service.type];
  const statusConfig = SERVICE_STATUS_CONFIG[service.status];
  const deploymentConfig = DEPLOYMENT_TYPE_CONFIG[service.deploymentType];

  const isExpired = Date.now() - new Date(service.lastUpdated).getTime() > SERVICE_DATA_EXPIRY_THRESHOLD;

  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(service.lastUpdated), {
        addSuffix: true,
        locale: zhCN,
      });
    } catch {
      return '未知';
    }
  })();

  return (
    <Card className={`p-4 hover:shadow-lg transition-all ${isExpired ? 'border-l-4 border-l-yellow-500' : ''}`}>
      <div className="space-y-3">
        {/* 服务基本信息 */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{typeConfig.icon}</span>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                {service.name}
              </h3>
              {service.version && (
                <Badge variant="outline" className="text-xs">
                  v{service.version}
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              {/* 节点信息 */}
              <span className="text-gray-600 dark:text-gray-400">
                节点: {service.nodeName || service.nodeId}
              </span>

              {/* 服务类型 */}
              <Badge variant="outline" className="text-xs">
                {typeConfig.name}
              </Badge>

              {/* 部署方式 */}
              <Badge variant="outline" className="text-xs">
                {deploymentConfig.icon} {deploymentConfig.name}
              </Badge>

              {/* 状态 */}
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig.className}`}>
                {statusConfig.name}
              </span>

              {/* 优先级 */}
              {service.priority && service.priority > 0 && (
                <Badge
                  variant={service.priority >= 4 ? 'destructive' : service.priority >= 3 ? 'warning' : 'default'}
                  className="text-xs"
                >
                  P{service.priority}
                </Badge>
              )}

              {isExpired && (
                <Badge variant="warning" className="text-xs">
                  数据过期
                </Badge>
              )}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-1 ml-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title={expanded ? '收起' : '展开'}
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
              title="编辑"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
              title="删除"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 访问信息 */}
        {service.access && (
          <div className="flex flex-wrap gap-3 text-sm text-gray-600 dark:text-gray-400">
            {service.access.domain && (
              <div className="flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />
                <a
                  href={`${service.access.protocol || 'http'}://${service.access.domain}${service.access.path || ''}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {service.access.domain}
                </a>
              </div>
            )}
            {service.access.port && (
              <span>端口: {service.access.port}</span>
            )}
            {service.access.containerName && (
              <span>容器: {service.access.containerName}</span>
            )}
          </div>
        )}

        {/* 标签 */}
        {service.tags && service.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {service.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* 展开的详细信息 */}
        {expanded && (
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2 text-sm">
            {/* 资源占用 */}
            {service.resources && (
              <div className="grid grid-cols-3 gap-4">
                {service.resources.cpuPercent !== undefined && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">CPU:</span>
                    <span className="ml-2 font-medium">{service.resources.cpuPercent.toFixed(1)}%</span>
                  </div>
                )}
                {service.resources.memoryMB !== undefined && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">内存:</span>
                    <span className="ml-2 font-medium">{service.resources.memoryMB.toFixed(0)} MB</span>
                  </div>
                )}
                {service.resources.diskMB !== undefined && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">磁盘:</span>
                    <span className="ml-2 font-medium">{service.resources.diskMB.toFixed(0)} MB</span>
                  </div>
                )}
              </div>
            )}

            {/* 备注 */}
            {service.notes && (
              <div>
                <span className="text-gray-600 dark:text-gray-400">备注:</span>
                <p className="mt-1 text-gray-900 dark:text-gray-100">{service.notes}</p>
              </div>
            )}

            {/* 创建时间 */}
            {service.createdAt && (
              <div>
                <span className="text-gray-600 dark:text-gray-400">创建时间:</span>
                <span className="ml-2 text-gray-900 dark:text-gray-100">
                  {new Date(service.createdAt).toLocaleString('zh-CN')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* 底部时间戳 */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
          最后更新: {timeAgo}
        </div>
      </div>
    </Card>
  );
};
