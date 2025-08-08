// API服务 - 与后端通信的统一接口

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// JWT 令牌管理
class TokenManager {
  private static readonly TOKEN_KEY = 'ssalgten_auth_token';
  private static readonly REFRESH_TOKEN_KEY = 'ssalgten_refresh_token';

  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  static getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  static setRefreshToken(token: string): void {
    localStorage.setItem(this.REFRESH_TOKEN_KEY, token);
  }

  static removeTokens(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
  }

  static isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }
}

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

// 用户接口
export interface User {
  id: string;
  username: string;
  email: string;
  name?: string;
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

// 登录响应接口
export interface LoginResponse {
  token: string;
  refreshToken?: string;
  user: User;
  expiresIn: number;
}

// 登录请求接口
export interface LoginRequest {
  username: string;
  password: string;
}

// 系统配置接口
export interface SystemConfig {
  id: string;
  key: string;
  value: string;
  category?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

class ApiService {
  
  // 通用请求方法
  private async request<T>(endpoint: string, options: RequestInit = {}, requireAuth: boolean = false): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // 添加认证头
    if (requireAuth) {
      const token = TokenManager.getToken();
      if (token && !TokenManager.isTokenExpired(token)) {
        headers.Authorization = `Bearer ${token}`;
      } else if (token) {
        // Token 过期，尝试刷新
        const refreshed = await this.refreshToken();
        if (refreshed && refreshed.token) {
          headers.Authorization = `Bearer ${refreshed.token}`;
        } else {
          // 刷新失败，清除令牌
          TokenManager.removeTokens();
          throw new Error('Authentication required');
        }
      } else {
        throw new Error('Authentication required');
      }
    }
    
    try {
      const response = await fetch(url, {
        headers,
        ...options,
      });

      if (response.status === 401) {
        TokenManager.removeTokens();
        throw new Error('Authentication failed');
      }

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

  // 认证相关 API
  async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    const response = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (response.success && response.data) {
      TokenManager.setToken(response.data.token);
      if (response.data.refreshToken) {
        TokenManager.setRefreshToken(response.data.refreshToken);
      }
    }

    return response;
  }

  async logout(): Promise<void> {
    TokenManager.removeTokens();
    // 可以调用后端的logout接口
    try {
      await this.request('/auth/logout', { method: 'POST' }, true);
    } catch (error) {
      // 忽略logout错误，因为令牌已经被清除
    }
  }

  async refreshToken(): Promise<LoginResponse | null> {
    const refreshToken = TokenManager.getRefreshToken();
    if (!refreshToken) {
      return null;
    }

    try {
      const response = await this.request<LoginResponse>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });

      if (response.success && response.data) {
        TokenManager.setToken(response.data.token);
        if (response.data.refreshToken) {
          TokenManager.setRefreshToken(response.data.refreshToken);
        }
        return response.data;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }

    return null;
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.request<User>('/auth/profile', {}, true);
  }

  // 用户管理 API
  async getUsers(): Promise<ApiResponse<User[]>> {
    return this.request<User[]>('/admin/users', {}, true);
  }

  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'lastLogin'> & { password: string }): Promise<ApiResponse<User>> {
    return this.request<User>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    }, true);
  }

  async updateUser(id: string, userData: Partial<User>): Promise<ApiResponse<User>> {
    return this.request<User>(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    }, true);
  }

  async deleteUser(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/admin/users/${id}`, {
      method: 'DELETE',
    }, true);
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<ApiResponse<void>> {
    return this.request<void>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    }, true);
  }

  // 检查是否已登录
  isLoggedIn(): boolean {
    const token = TokenManager.getToken();
    return token !== null && !TokenManager.isTokenExpired(token);
  }

  // 获取当前用户角色
  getCurrentUserRole(): string | null {
    const token = TokenManager.getToken();
    if (!token || TokenManager.isTokenExpired(token)) {
      return null;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.role || null;
    } catch {
      return null;
    }
  }

  // 系统配置管理 API
  async getSystemConfigs(): Promise<ApiResponse<SystemConfig[]>> {
    return this.request<SystemConfig[]>('/admin/configs', {}, true);
  }

  async getConfigCategories(): Promise<ApiResponse<string[]>> {
    return this.request<string[]>('/admin/configs/categories', {}, true);
  }

  async getSystemConfig(key: string): Promise<ApiResponse<SystemConfig>> {
    return this.request<SystemConfig>(`/admin/configs/${key}`, {}, true);
  }

  async updateSystemConfig(key: string, value: string): Promise<ApiResponse<SystemConfig>> {
    return this.request<SystemConfig>(`/admin/configs/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }, true);
  }

  async batchUpdateConfigs(configs: Array<{ key: string; value: string }>): Promise<ApiResponse<SystemConfig[]>> {
    return this.request<SystemConfig[]>('/admin/configs/batch', {
      method: 'POST',
      body: JSON.stringify({ configs }),
    }, true);
  }

  async resetConfigsToDefaults(): Promise<ApiResponse<SystemConfig[]>> {
    return this.request<SystemConfig[]>('/admin/configs/reset', {
      method: 'POST',
    }, true);
  }

  async deleteSystemConfig(key: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/admin/configs/${key}`, {
      method: 'DELETE',
    }, true);
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
export { TokenManager };
export default apiService;