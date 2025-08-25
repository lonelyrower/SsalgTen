// API服务 - 与后端通信的统一接口

// Window configuration interface
interface WindowConfig {
  APP_CONFIG?: {
    API_BASE_URL?: string;
  };
}

declare global {
  interface Window extends WindowConfig {}
}

// Get API base URL from runtime config or fallback to env var or default
const getApiBaseUrl = (): string => {
  // Check runtime config first
  if (typeof window !== 'undefined' && window.APP_CONFIG?.API_BASE_URL) {
    return window.APP_CONFIG.API_BASE_URL;
  }
  // Fallback to build-time env var or default
  return import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
};

const API_BASE_URL = getApiBaseUrl();

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
      const parts = token.split('.');
      if (parts.length !== 3) return true;
      const payloadPart = parts[1];
      // base64url -> base64
      const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
      const padLen = (4 - (base64.length % 4)) % 4;
      const padded = base64 + '='.repeat(padLen);
      const payload = JSON.parse(atob(padded));
      if (!payload || typeof payload.exp !== 'number') return true;
      return payload.exp * 1000 < Date.now();
    } catch {
      // 如果解析失败，保守起见认为已过期，避免使用无效token
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
  status: 'online' | 'offline' | 'warning' | 'unknown' | 'maintenance';
  provider: string;
  ipv4?: string;
  ipv6?: string;
  osType?: string;
  osVersion?: string;
  description?: string;
  apiKey?: string;
  port?: number;
  enabled?: boolean;
  // ASN信息
  asnNumber?: string;
  asnName?: string;
  asnOrg?: string;
  asnRoute?: string;
  asnType?: string;
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

// ASN信息接口
export interface ASNInfo {
  asn: string;
  name: string;
  org: string;
  route: string;
  type: string;
}

// 访问者信息接口
export interface VisitorInfo {
  ip: string;
  userAgent: string;
  hostname?: string;
  city?: string;
  region?: string;
  country?: string;
  loc?: string; // "latitude,longitude"
  timezone?: string;
  asn?: ASNInfo;
  company?: {
    name: string;
    domain?: string;
    type?: string;
  };
}

// IP详细信息接口
export interface IPInfo {
  ip: string;
  hostname?: string;
  city: string;
  region: string;
  country: string;
  loc: string; // "latitude,longitude"
  postal?: string;
  timezone: string;
  asn: ASNInfo;
  company?: {
    name: string;
    domain?: string;
    type?: string;
  };
}

// 访问者统计接口
export interface VisitorStats {
  totalVisitors: number;
  uniqueIPs: number;
  topCountries: Array<{ country: string; count: number }>;
  topASNs: Array<{ asn: string; count: number }>;
  recentVisitors: Array<{
    ip: string;
    country?: string;
    city?: string;
    asnName?: string;
    userAgent: string;
    createdAt: string;
  }>;
}

// API密钥管理接口
export interface ApiKeyInfo {
  id: string;
  key: string;
  description: string;
  isDefault: boolean;
  createdAt: string;
  lastUsed?: string;
  usageCount: number;
  security: {
    isSecure: boolean;
    warnings: string[];
    recommendations: string[];
  };
}

export interface InstallCommandData {
  masterUrl: string;
  apiKey: string;
  quickCommand: string;
  interactiveCommand: string;
  quickUninstallCommand: string;
  command: string; // 保持向后兼容
  uninstallCommand?: string;
  security: {
    isSecure: boolean;
    warnings: string[];
    recommendations: string[];
  };
}

class ApiService {
  private refreshPromise: Promise<LoginResponse | null> | null = null;
  
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
    return this.request<NodeData>('/admin/nodes', {
      method: 'POST',
      body: JSON.stringify(nodeData),
    }, true);
  }

  async updateNode(id: string, nodeData: Partial<NodeData>): Promise<ApiResponse<NodeData>> {
    return this.request<NodeData>(`/admin/nodes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(nodeData),
    }, true);
  }

  async deleteNode(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/admin/nodes/${id}`, {
      method: 'DELETE',
    }, true);
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

  // 获取节点详细心跳数据 API
  async getNodeHeartbeatData(nodeId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/nodes/${nodeId}/heartbeat`);
  }

  // 获取节点事件列表
  async getNodeEvents(nodeId: string, limit: number = 100): Promise<ApiResponse<Array<{ id: string; type: string; message?: string; details?: any; timestamp: string }>>> {
    const query = limit ? `?limit=${limit}` : '';
    return this.request(`/nodes/${nodeId}/events${query}`);
  }

  // 获取全局活动日志
  async getGlobalActivities(limit: number = 50): Promise<ApiResponse<Array<{ id: string; type: string; message?: string; details?: any; timestamp: string; node: { id: string; name: string; city: string; country: string; status: string } }>>> {
    const query = limit ? `?limit=${limit}` : '';
    return this.request(`/activities${query}`);
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
    // 如果已经有刷新请求在进行中，等待其完成
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // 创建新的刷新请求
    this.refreshPromise = this.performTokenRefresh();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      // 清除刷新请求引用
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<LoginResponse | null> {
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

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<void>> {
    // Backend expects PUT /auth/password with { currentPassword, newPassword }
    return this.request<void>('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
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
      const payloadPart = token.split('.')[1];
      const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
      const padLen = (4 - (base64.length % 4)) % 4;
      const padded = base64 + '='.repeat(padLen);
      const payload = JSON.parse(atob(padded));
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

  // 访问者信息API
  async getVisitorInfo(): Promise<ApiResponse<VisitorInfo>> {
    return this.request<VisitorInfo>('/visitor/info');
  }

  async getIPInfo(ip: string): Promise<ApiResponse<IPInfo>> {
    return this.request<IPInfo>(`/visitor/ip/${encodeURIComponent(ip)}`);
  }

  

  // 访问者统计API（管理员专用）
  async getVisitorStats(days: number = 7): Promise<ApiResponse<VisitorStats>> {
    return this.request<VisitorStats>(`/admin/visitors/stats?days=${days}`, {}, true);
  }

  async getVisitorCacheStats(): Promise<ApiResponse<{ size: number; ttl: number }>> {
    return this.request<{ size: number; ttl: number }>('/admin/visitors/cache', {}, true);
  }

  async clearVisitorCache(): Promise<ApiResponse<void>> {
    return this.request<void>('/admin/visitors/cache/clear', {
      method: 'POST'
    }, true);
  }

  // API密钥管理 API（管理员专用）
  async getApiKeyInfo(): Promise<ApiResponse<ApiKeyInfo>> {
    return this.request<ApiKeyInfo>('/admin/api-key/info', {}, true);
  }

  async regenerateApiKey(): Promise<ApiResponse<{ newApiKey: string }>> {
    return this.request<{ newApiKey: string }>('/admin/api-key/regenerate', {
      method: 'POST'
    }, true);
  }

  // 获取Agent安装命令（公开接口）
  async getInstallCommand(): Promise<ApiResponse<InstallCommandData>> {
    // 该接口需要管理员权限
    return this.request<InstallCommandData>('/agents/install-command', {}, true);
  }
}

export const apiService = new ApiService();
export { TokenManager };
export default apiService;
