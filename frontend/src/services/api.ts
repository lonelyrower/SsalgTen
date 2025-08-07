// API服务 - 与后端通信的统一接口

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 节点数据接口
export interface NodeData {
  id: string;
  name: string;
  country: string;
  city: string;
  latitude: number;
  longitude: number;
  status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN' | 'MAINTENANCE';
  provider: string;
  ipv4?: string;
  ipv6?: string;
  agentId: string;
  lastSeen?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    diagnosticRecords: number;
    heartbeatLogs: number;
  };
  lastHeartbeat?: {
    timestamp: string;
    status: string;
    uptime: number | null;
  };
}

// 节点统计信息接口
export interface NodeStats {
  totalNodes: number;
  onlineNodes: number;
  offlineNodes: number;
  unknownNodes: number;
  totalCountries: number;
  totalProviders: number;
}

// 诊断记录接口
export interface DiagnosticRecord {
  id: string;
  type: 'PING' | 'TRACEROUTE' | 'MTR' | 'SPEEDTEST';
  target?: string;
  success: boolean;
  result: string;
  error?: string;
  duration?: number;
  timestamp: string;
}

class ApiService {
  
  // 通用请求方法
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // 节点管理 API
  async getNodes(): Promise<ApiResponse<NodeData[]>> {
    return this.request<NodeData[]>('/nodes');
  }

  async getNodeById(id: string): Promise<ApiResponse<NodeData>> {
    return this.request<NodeData>(`/nodes/${id}`);
  }

  async createNode(nodeData: Omit<NodeData, 'id' | 'agentId' | 'status' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<NodeData>> {
    return this.request<NodeData>('/nodes', {
      method: 'POST',
      body: JSON.stringify(nodeData),
    });
  }

  async updateNode(id: string, nodeData: Partial<NodeData>): Promise<ApiResponse<NodeData>> {
    return this.request<NodeData>(`/nodes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(nodeData),
    });
  }

  async deleteNode(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/nodes/${id}`, {
      method: 'DELETE',
    });
  }

  // 统计信息 API
  async getStats(): Promise<ApiResponse<NodeStats>> {
    return this.request<NodeStats>('/stats');
  }

  // 诊断记录 API
  async getNodeDiagnostics(nodeId: string, type?: string, limit?: number): Promise<ApiResponse<DiagnosticRecord[]>> {
    const queryParams = new URLSearchParams();
    if (type) queryParams.append('type', type);
    if (limit) queryParams.append('limit', limit.toString());
    
    const query = queryParams.toString();
    const endpoint = `/nodes/${nodeId}/diagnostics${query ? `?${query}` : ''}`;
    
    return this.request<DiagnosticRecord[]>(endpoint);
  }

  // Agent 诊断请求 API (直接调用Agent)
  async callAgentDiagnostic(agentUrl: string, type: string, target?: string): Promise<any> {
    const endpoint = target ? `${type}/${target}` : type;
    const url = `${agentUrl}/api/${endpoint}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Agent request failed: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Agent diagnostic request failed:', error);
      throw error;
    }
  }

  // 健康检查
  async healthCheck(): Promise<ApiResponse<any>> {
    return this.request<any>('/health');
  }

  // API信息
  async getApiInfo(): Promise<ApiResponse<any>> {
    return this.request<any>('/info');
  }
}

export const apiService = new ApiService();
export default apiService;