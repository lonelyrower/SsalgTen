// API服务 - 与后端通信的统一接口

declare global {
  interface Window {
    APP_CONFIG?: {
      API_BASE_URL?: string;
      MAP_PROVIDER?: string;
      MAP_API_KEY?: string;
    };
  }
}

// Get API base URL from runtime config or fallback to env var or current origin
const getApiBaseUrl = (): string => {
  const isLocalHost = (u: string) =>
    /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[?::1\]?)/i.test(u);

  // 1) Runtime config takes highest priority
  if (typeof window !== "undefined" && window.APP_CONFIG?.API_BASE_URL) {
    const v = window.APP_CONFIG.API_BASE_URL;
    // If runtime config points to localhost but we are not on localhost, prefer relative /api
    if (
      typeof window !== "undefined" &&
      v &&
      v.startsWith("http") &&
      isLocalHost(v) &&
      !isLocalHost(window.location.origin)
    ) {
      return "/api";
    }
    // Support relative value like "/api" to stick to current origin
    return v && !v.startsWith("http") ? v || "/api" : v || "/api";
  }
  // 2) Build-time env vars
  const envUrl =
    import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    // If points to localhost but app is not running on localhost, use relative /api for safety
    if (
      typeof window !== "undefined" &&
      envUrl.startsWith("http") &&
      isLocalHost(envUrl) &&
      !isLocalHost(window.location.origin)
    ) {
      return "/api";
    }
    return envUrl.startsWith("http") ? envUrl : envUrl || "/api";
  }
  // 3) Fallback to current origin (production safe)
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/api`;
  }
  // 4) Last resort: relative path
  return "/api";
};

const API_BASE_URL = getApiBaseUrl();

// JWT 令牌管理
class TokenManager {
  private static readonly TOKEN_KEY = "ssalgten_auth_token";

  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  static removeTokens(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  static isTokenExpired(token: string): boolean {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return true;
      const payloadPart = parts[1];
      // base64url -> base64
      const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
      const padLen = (4 - (base64.length % 4)) % 4;
      const padded = base64 + "=".repeat(padLen);
      const payload = JSON.parse(atob(padded));
      if (!payload || typeof payload.exp !== "number") return true;
      return payload.exp * 1000 < Date.now();
    } catch {
      // 如果解析失败，保守起见认为已过期，避免使用无效token
      return true;
    }
  }
}

export interface ApiResponse<T = unknown> {
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
  status: "online" | "offline" | "maintenance";
  provider: string;
  ipv4?: string;
  ipv6?: string;
  osType?: string;
  osVersion?: string;
  description?: string;
  apiKey?: string;
  port?: number;
  enabled?: boolean;
  // Optional runtime metrics (may be provided by realtime channel)
  cpuUsage?: number | null;
  memoryUsage?: number | null;
  diskUsage?: number | null;
  uptime?: number | null;
  loadAverage?: number[] | null; // [1min, 5min, 15min]
  // Traffic statistics
  totalUpload?: bigint | number | null;
  totalDownload?: bigint | number | null;
  periodUpload?: bigint | number | null;
  periodDownload?: bigint | number | null;
  // ASN信息
  asnNumber?: string;
  asnName?: string;
  asnOrg?: string;
  asnRoute?: string;
  asnType?: string;
  // 成本信息
  monthlyCost?: number | null; // 月度成本（美元）
  agentId: string;
  nameCustomized?: boolean;
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
  securityEvents?: Array<{
    id: string;
    type: string;
    severity: string;
    description: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }>;
}

// 节点统计信息接口
export interface NodeStats {
  totalNodes: number;
  onlineNodes: number;
  offlineNodes: number;
  totalCountries: number;
  totalProviders: number;
  totalTraffic?: {
    upload: number;
    download: number;
    total: number;
  };
}

// 诊断记录接口
export interface DiagnosticRecord {
  id: string;
  type: "PING" | "TRACEROUTE" | "MTR" | "SPEEDTEST";
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
  role: "ADMIN" | "OPERATOR" | "VIEWER";
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
  // 元数据字段
  displayName?: string;
  inputType?: "text" | "number" | "boolean" | "select" | "textarea";
  options?: string[];
  optionLabels?: Record<string, string>; // 选项的显示标签
  unit?: string;
  min?: number;
  max?: number;
}

// 地图配置接口
export interface MapConfig {
  provider: string;
  apiKey: string;
}

// 系统概览数据接口
export interface SystemOverviewData {
  nodes: NodeStats;
  heartbeats: {
    total: number;
    last24h: number;
    avgPerHour: number;
  };
  resources: {
    memoryUsedMB: number;
    memoryTotalMB: number;
    memoryPercent: number;
    cpuPercent: number;
  };
  system: {
    uptime: number;
    dbUptime?: number;
    version: string;
    environment: string;
  };
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

// 客户端延迟测试接口
export interface ClientLatencyData {
  nodeId: string;
  nodeName: string;
  location: string;
  country: string;
  city: string;
  ipv4?: string;
  latency: number | null;
  status: "testing" | "success" | "failed" | "timeout";
  lastTested: string;
  error?: string;
}

export interface LatencyStats {
  average: number;
  min: number;
  max: number;
  tested: number;
  total: number;
  distribution: { range: string; count: number }[];
  bestNodes: ClientLatencyData[];
}

export interface LatencyTestStart {
  clientIP: string;
  nodeCount: number;
  testId: string;
  estimatedDuration: string;
}

export interface LatencyTestResults {
  clientIP: string;
  results: ClientLatencyData[];
  stats: LatencyStats;
  timestamp: string;
}

// 流媒体解锁接口
export interface StreamingServiceResult {
  service:
    | "netflix"
    | "youtube"
    | "disney_plus"
    | "tiktok"
    | "amazon_prime"
    | "reddit"
    | "chatgpt";
  name: string;
  icon: string;
  status: "yes" | "no" | "org" | "noprem" | "pending" | "failed" | "unknown";
  region?: string;
  unlockType?: "native" | "dns" | "unknown";
  lastTested?: string;
}

export interface NodeStreamingData {
  nodeId: string;
  services: StreamingServiceResult[];
  lastScanned: string | null;
}

export interface StreamingStats {
  totalTests: number;
  servicesAvailable: number;
  byService: Record<
    string,
    {
      total: number;
      yes: number;
      no: number;
      org: number;
    }
  >;
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
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth: boolean = false,
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;

    // Build headers, only set Content-Type automatically when sending a body
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };
    if (!("Content-Type" in headers) && options.body) {
      headers["Content-Type"] = "application/json";
    }

    // 添加认证头（不抛异常，统一返回结构化错误，避免被上层当作网络错误处理）
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
          TokenManager.removeTokens();
          return { success: false, error: "Authentication required" };
        }
      } else {
        return { success: false, error: "Authentication required" };
      }
    }

    try {
      // 为大数据查询添加超时控制（60秒）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(url, {
        ...options,
        headers,
        credentials: options.credentials ?? 'include',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 401) {
        TokenManager.removeTokens();
        // 统一返回而非抛异常，便于上层展示更友好的提示
        return { success: false, error: "Authentication failed" };
      }

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP error! status: ${response.status}`,
        } as ApiResponse<T>;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("API request failed:", error);
      if (error instanceof Error && error.name === "AbortError") {
        return {
          success: false,
          error: "请求超时，请刷新页面重试",
        };
      }
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  // 节点管理 API
  private async download(
    endpoint: string,
    options: RequestInit = {},
    requireAuth: boolean = false,
  ): Promise<{
    success: boolean;
    data?: Blob;
    fileName?: string;
    error?: string;
  }> {
    const url = API_BASE_URL + endpoint;
    const headers = new Headers(options.headers as HeadersInit | undefined);

    if (!headers.has("Accept")) {
      headers.set("Accept", "application/octet-stream");
    }

    if (requireAuth) {
      const token = TokenManager.getToken();
      if (!token || TokenManager.isTokenExpired(token)) {
        return { success: false, error: "Authentication required" };
      }
      headers.set("Authorization", "Bearer " + token);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: options.credentials ?? "include",
      });

      if (!response.ok) {
        const errorText = await response
          .text()
          .catch(() => response.statusText);
        return {
          success: false,
          error: errorText || "HTTP error! status: " + response.status,
        };
      }

      const blob = await response.blob();
      const disposition =
        response.headers.get("content-disposition") ||
        response.headers.get("Content-Disposition");
      let fileName: string | undefined;
      if (disposition) {
        const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
        const quotedMatch = disposition.match(/filename="?([^";]+)"?/i);
        const rawName =
          (utf8Match && utf8Match[1]) || (quotedMatch && quotedMatch[1]);
        if (rawName) {
          try {
            fileName = decodeURIComponent(rawName.trim());
          } catch {
            fileName = rawName.trim();
          }
        }
      }

      return { success: true, data: blob, fileName };
    } catch (error) {
      console.error("API download failed:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  async getNodes(): Promise<ApiResponse<NodeData[]>> {
    return this.request<NodeData[]>("/nodes");
  }

  async getNodeById(id: string): Promise<ApiResponse<NodeData>> {
    return this.request<NodeData>(`/nodes/${id}`);
  }

  async createNode(
    nodeData: Omit<
      NodeData,
      "id" | "agentId" | "status" | "createdAt" | "updatedAt"
    >,
  ): Promise<ApiResponse<NodeData>> {
    return this.request<NodeData>(
      "/admin/nodes",
      {
        method: "POST",
        body: JSON.stringify(nodeData),
      },
      true,
    );
  }

  async updateNode(
    id: string,
    nodeData: Partial<NodeData>,
  ): Promise<ApiResponse<NodeData>> {
    return this.request<NodeData>(
      `/admin/nodes/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(nodeData),
      },
      true,
    );
  }

  async deleteNode(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(
      `/admin/nodes/${id}`,
      {
        method: "DELETE",
      },
      true,
    );
  }

  async exportNodes(
    format: "json" | "csv" | "markdown" = "csv",
  ): Promise<{
    success: boolean;
    data?: Blob;
    fileName?: string;
    error?: string;
  }> {
    return this.download("/admin/nodes/export?format=" + format, {}, true);
  }

  // 统计信息 API
  async getStats(): Promise<ApiResponse<NodeStats>> {
    return this.request<NodeStats>("/stats");
  }

  // 诊断记录 API
  async getNodeDiagnostics(
    nodeId: string,
    type?: string,
    limit?: number,
  ): Promise<ApiResponse<DiagnosticRecord[]>> {
    const queryParams = new URLSearchParams();
    if (type) queryParams.append("type", type);
    if (limit) queryParams.append("limit", limit.toString());

    const query = queryParams.toString();
    const endpoint = `/nodes/${nodeId}/diagnostics${query ? `?${query}` : ""}`;

    return this.request<DiagnosticRecord[]>(endpoint);
  }

  // 获取节点详细心跳数据 API
  async getNodeHeartbeatData(nodeId: string): Promise<ApiResponse<unknown>> {
    return this.request<unknown>(`/nodes/${nodeId}/heartbeat`);
  }

  // 获取节点事件列表
  async getNodeEvents(
    nodeId: string,
    limit: number = 100,
  ): Promise<
    ApiResponse<
      Array<{
        id: string;
        type: string;
        message?: string;
        details?: unknown;
        timestamp: string;
      }>
    >
  > {
    const query = limit ? `?limit=${limit}` : "";
    return this.request(`/nodes/${nodeId}/events${query}`);
  }

  // Agent 诊断请求 API (直接调用Agent)
  async callAgentDiagnostic(
    agentUrl: string,
    type: string,
    target?: string,
  ): Promise<unknown> {
    const endpoint = target ? `${type}/${target}` : type;
    const url = `${agentUrl}/api/${endpoint}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Agent request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Agent diagnostic request failed:", error);
      throw error;
    }
  }

  // 通过后端代理的诊断工具 API
  async runPing(
    nodeId: string,
    target: string,
    count?: number,
  ): Promise<ApiResponse<unknown>> {
    const params = new URLSearchParams({ target });
    if (typeof count === "number") {
      params.set("count", String(count));
    }
    return this.request(
      `/diagnostics/${nodeId}/ping?${params.toString()}`,
      {},
      true,
    );
  }

  async runTraceroute(
    nodeId: string,
    target: string,
    maxHops?: number,
  ): Promise<ApiResponse<unknown>> {
    const params = new URLSearchParams({ target });
    if (typeof maxHops === "number") {
      params.set("maxHops", String(maxHops));
    }
    return this.request(
      `/diagnostics/${nodeId}/traceroute?${params.toString()}`,
      {},
      true,
    );
  }

  async runMTR(
    nodeId: string,
    target: string,
    count?: number,
  ): Promise<ApiResponse<unknown>> {
    const params = new URLSearchParams({ target });
    if (typeof count === "number") {
      params.set("count", String(count));
    }
    return this.request(
      `/diagnostics/${nodeId}/mtr?${params.toString()}`,
      {},
      true,
    );
  }

  async runSpeedtest(nodeId: string): Promise<ApiResponse<unknown>> {
    return this.request(`/diagnostics/${nodeId}/speedtest`, {}, true);
  }

  async runLatencyTest(
    nodeId: string,
    testType?: "standard" | "comprehensive",
  ): Promise<ApiResponse<unknown>> {
    const query = testType ? `?testType=${testType}` : "";
    return this.request(`/diagnostics/${nodeId}/latency-test${query}`, {}, true);
  }

  // 认证相关 API
  async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    // Primary path via API_BASE_URL (e.g. /api/auth/login)
    let response = await this.request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });

    // Fallback: if 5xx/502/network error, try root-mapped path (/auth/login) which we proxy to backend in nginx
    if (!response.success) {
      const err = response.error || "";
      const likelyGateway =
        /HTTP error! status: 5\d\d|502|Bad Gateway|Failed to fetch/i.test(err);
      try {
        if (likelyGateway && typeof window !== "undefined") {
          const r = await fetch("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: 'include',
            body: JSON.stringify(credentials),
          });
          if (r.ok) {
            response = await r.json();
          }
        }
      } catch {
        // Ignore fallback errors
      }
    }

    if (response.success && response.data) {
      TokenManager.setToken(response.data.token);
    }

    return response;
  }

  async logout(): Promise<void> {
    TokenManager.removeTokens();
    // 可以调用后端的logout接口
    try {
      await this.request("/auth/logout", { method: "POST" }, true);
    } catch {
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
    try {
      const response = await this.request<LoginResponse>("/auth/refresh", {
        method: "POST",
      });

      if (response.success && response.data) {
        TokenManager.setToken(response.data.token);
        return response.data;
      }
    } catch (error) {
      console.error("Token refresh failed:", error);
    }

    return null;
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.request<User>("/auth/profile", {}, true);
  }

  // 用户管理 API
  async getUsers(): Promise<ApiResponse<User[]>> {
    return this.request<User[]>("/admin/users", {}, true);
  }

  async createUser(
    userData: Omit<User, "id" | "createdAt" | "updatedAt" | "lastLogin"> & {
      password: string;
    },
  ): Promise<ApiResponse<User>> {
    return this.request<User>(
      "/admin/users",
      {
        method: "POST",
        body: JSON.stringify(userData),
      },
      true,
    );
  }

  async updateUser(
    id: string,
    userData: Partial<User>,
  ): Promise<ApiResponse<User>> {
    return this.request<User>(
      `/admin/users/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(userData),
      },
      true,
    );
  }

  async deleteUser(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(
      `/admin/users/${id}`,
      {
        method: "DELETE",
      },
      true,
    );
  }

  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<ApiResponse<void>> {
    // Backend expects PUT /auth/password with { currentPassword, newPassword }
    return this.request<void>(
      "/auth/password",
      {
        method: "PUT",
        body: JSON.stringify({ currentPassword, newPassword }),
      },
      true,
    );
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
      const payloadPart = token.split(".")[1];
      const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
      const padLen = (4 - (base64.length % 4)) % 4;
      const padded = base64 + "=".repeat(padLen);
      const payload = JSON.parse(atob(padded));
      return payload.role || null;
    } catch {
      return null;
    }
  }

  // 系统配置管理 API
  async getSystemConfigs(): Promise<ApiResponse<SystemConfig[]>> {
    return this.request<SystemConfig[]>("/admin/configs", {}, true);
  }

  async getConfigCategories(): Promise<ApiResponse<string[]>> {
    return this.request<string[]>("/admin/configs/categories", {}, true);
  }

  async getSystemConfig(key: string): Promise<ApiResponse<SystemConfig>> {
    return this.request<SystemConfig>(`/admin/configs/${key}`, {}, true);
  }

  async updateSystemConfig(
    key: string,
    value: string,
  ): Promise<ApiResponse<SystemConfig>> {
    return this.request<SystemConfig>(
      `/admin/configs/${key}`,
      {
        method: "PUT",
        body: JSON.stringify({ value }),
      },
      true,
    );
  }

  async batchUpdateConfigs(
    configs: Array<{ key: string; value: string }>,
  ): Promise<ApiResponse<SystemConfig[]>> {
    return this.request<SystemConfig[]>(
      "/admin/configs/batch",
      {
        method: "POST",
        body: JSON.stringify({ configs }),
      },
      true,
    );
  }

  async resetConfigsToDefaults(): Promise<ApiResponse<SystemConfig[]>> {
    return this.request<SystemConfig[]>(
      "/admin/configs/reset",
      {
        method: "POST",
      },
      true,
    );
  }

  async cleanupOldConfigs(): Promise<
    ApiResponse<{ deleted: number; deletedKeys: string[]; remaining: number }>
  > {
    return this.request<{
      deleted: number;
      deletedKeys: string[];
      remaining: number;
    }>(
      "/admin/configs/cleanup",
      {
        method: "POST",
      },
      true,
    );
  }

  async cleanupHeartbeatLogs(
    retainHours?: number,
  ): Promise<ApiResponse<{ deleted: number; retainHours?: number }>> {
    const payload = retainHours && retainHours > 0 ? { retainHours } : {};
    return this.request<{ deleted: number; retainHours?: number }>(
      "/admin/heartbeats/cleanup",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      true,
    );
  }

  async deleteSystemConfig(key: string): Promise<ApiResponse<void>> {
    return this.request<void>(
      `/admin/configs/${key}`,
      {
        method: "DELETE",
      },
      true,
    );
  }

  // 健康检查
  async healthCheck(): Promise<ApiResponse<unknown>> {
    return this.request<unknown>("/health");
  }

  // 获取公共地图配置（无需认证）
  async getPublicMapConfig(): Promise<ApiResponse<MapConfig>> {
    return this.request<MapConfig>("/public/map-config");
  }

  // API信息
  async getApiInfo(): Promise<ApiResponse<unknown>> {
    return this.request<unknown>("/info");
  }

  // 系统版本与更新
  async getSystemVersion(): Promise<
    ApiResponse<{
      localVersion: string;
      latestCommit?: string;
      updateAvailable?: boolean;
      repo: string;
      branch: string;
    }>
  > {
    return this.request("/system/version");
  }

  async getSystemOverview(): Promise<ApiResponse<SystemOverviewData>> {
    return this.request("/admin/overview", {}, true);
  }

  async triggerSystemUpdate(
    forceAgent: boolean = false,
  ): Promise<ApiResponse<{ body?: string }>> {
    return this.request(
      "/admin/system/update",
      {
        method: "POST",
        body: JSON.stringify({ forceAgent }),
      },
      true,
    );
  }

  async getUpdaterHealth(): Promise<ApiResponse<unknown>> {
    return this.request("/admin/system/updater/health", {}, true);
  }

  // 访问者信息API
  async getVisitorInfo(): Promise<ApiResponse<VisitorInfo>> {
    return this.request<VisitorInfo>("/visitor/info");
  }

  async getIPInfo(ip: string): Promise<ApiResponse<IPInfo>> {
    return this.request<IPInfo>(`/visitor/ip/${encodeURIComponent(ip)}`);
  }

  // API密钥管理 API（管理员专用）
  async getApiKeyInfo(): Promise<ApiResponse<ApiKeyInfo>> {
    return this.request<ApiKeyInfo>("/admin/api-key/info", {}, true);
  }

  async regenerateApiKey(): Promise<ApiResponse<{ newApiKey: string }>> {
    return this.request<{ newApiKey: string }>(
      "/admin/api-key/regenerate",
      {
        method: "POST",
      },
      true,
    );
  }

  // 占位节点导入（管理员专用）
  async importPlaceholderNodes(
    items: Array<{
      ip: string;
      name?: string;
      notes?: string;
      tags?: string[];
      neverAdopt?: boolean;
    }>,
  ): Promise<
    ApiResponse<{
      created: number;
      updated: number;
      skipped: number;
      total: number;
    }>
  > {
    return this.request(
      "/admin/nodes/placeholders/import",
      {
        method: "POST",
        body: JSON.stringify({ items }),
      },
      true,
    );
  }

  // 获取Agent安装命令（公开接口）
  async getInstallCommand(): Promise<ApiResponse<InstallCommandData>> {
    // 该接口需要管理员权限
    return this.request<InstallCommandData>(
      "/agents/install-command",
      {},
      true,
    );
  }

  // 客户端延迟测试 API
  async startLatencyTest(): Promise<ApiResponse<LatencyTestStart>> {
    return this.request<LatencyTestStart>(
      "/client-latency/test",
      {
        method: "POST",
      },
      true,
    );
  }

  async getLatencyResults(): Promise<ApiResponse<LatencyTestResults>> {
    return this.request<LatencyTestResults>(
      "/client-latency/results",
      {},
      true,
    );
  }

  // 流媒体解锁 API
  async getNodeStreaming(
    nodeId: string,
  ): Promise<ApiResponse<NodeStreamingData>> {
    return this.request<NodeStreamingData>(`/nodes/${nodeId}/streaming`);
  }

  async triggerStreamingTest(
    nodeId: string,
  ): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(
      `/nodes/${nodeId}/streaming/test`,
      {
        method: "POST",
      },
      true,
    );
  }

  async getNodesByStreaming(service: string): Promise<ApiResponse<NodeData[]>> {
    return this.request<NodeData[]>(`/nodes/streaming/${service}`);
  }

  async getStreamingStats(): Promise<ApiResponse<StreamingStats>> {
    return this.request<StreamingStats>("/streaming/stats");
  }

  // 流媒体解锁总览 API
  async getStreamingOverview(): Promise<
    ApiResponse<import("../types/streaming").StreamingOverview>
  > {
    return this.request("/streaming/overview");
  }

  async getStreamingNodeSummaries(
    filters?: import("../types/streaming").StreamingFilters,
  ): Promise<ApiResponse<import("../types/streaming").NodeStreamingSummary[]>> {
    const params = new URLSearchParams();
    if (filters?.platform) params.append("service", filters.platform);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.country) params.append("country", filters.country);
    if (filters?.region) params.append("region", filters.region);
    if (filters?.keyword) params.append("search", filters.keyword);
    if (filters?.showExpired !== undefined)
      params.append("showExpired", String(filters.showExpired));

    const query = params.toString();
    return this.request(`/streaming/nodes${query ? `?${query}` : ""}`);
  }

  async triggerBulkStreamingTest(nodeIds: string[]): Promise<
    ApiResponse<{
      message?: string;
      queued: number;
      total?: number;
      failures?: Array<{ nodeId: string; reason: string }>;
    }>
  > {
    return this.request(
      "/streaming/test/bulk",
      {
        method: "POST",
        body: JSON.stringify({ nodeIds }),
      },
      true,
    );
  }

  async exportStreamingData(
    format: import("../types/streaming").StreamingExportFormat,
    filters?: import("../types/streaming").StreamingFilters,
  ): Promise<{
    success: boolean;
    data?: Blob;
    fileName?: string;
    error?: string;
  }> {
    const params = new URLSearchParams({ format });
    if (filters?.platform) params.append("service", filters.platform);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.country) params.append("country", filters.country);

    return this.download(`/streaming/export?${params.toString()}`, {}, true);
  }

  // 服务总览 API
  async getServicesOverview(): Promise<
    ApiResponse<import("../types/services").ServicesOverviewStats>
  > {
    return this.request("/services/overview");
  }

  async getNodeServices(
    nodeId: string,
  ): Promise<ApiResponse<import("../types/services").NodeService[]>> {
    return this.request(`/nodes/${nodeId}/services`);
  }

  async getNodeServicesOverview(
    nodeId: string,
  ): Promise<ApiResponse<import("../types/services").NodeServicesOverview>> {
    return this.request(`/nodes/${nodeId}/services/overview`);
  }

  async getAllServices(
    filters?: import("../types/services").ServiceFilters,
  ): Promise<ApiResponse<import("../types/services").NodeService[]>> {
    const params = new URLSearchParams();
    if (filters?.nodeId) params.append("nodeId", filters.nodeId);
    if (filters?.serviceType) params.append("serviceType", filters.serviceType);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.deploymentType)
      params.append("deploymentType", filters.deploymentType as string);
    if (filters?.keyword) params.append("search", filters.keyword);
    if (filters?.priority !== undefined)
      params.append("priority", String(filters.priority));
    if (filters?.showExpired !== undefined)
      params.append("showExpired", String(filters.showExpired));
    if (filters?.tags && filters.tags.length > 0) {
      filters.tags.forEach((tag) => params.append("tag", tag));
    }

    const query = params.toString();
    return this.request(`/services${query ? `?${query}` : ""}`);
  }

  async getNodeServicesGrouped(): Promise<
    ApiResponse<import("../types/services").NodeServicesOverview[]>
  > {
    return this.request("/services/grouped");
  }

  async updateServiceTags(
    serviceId: string,
    tags: string[],
  ): Promise<ApiResponse<import("../types/services").NodeService>> {
    return this.request(
      `/services/${serviceId}/tags`,
      {
        method: "PUT",
        body: JSON.stringify({ tags }),
      },
      true,
    );
  }

  async updateServicePriority(
    serviceId: string,
    priority: number,
  ): Promise<ApiResponse<import("../types/services").NodeService>> {
    return this.request(
      `/services/${serviceId}/priority`,
      {
        method: "PUT",
        body: JSON.stringify({ priority }),
      },
      true,
    );
  }

  async updateServiceNotes(
    serviceId: string,
    notes: string,
  ): Promise<ApiResponse<import("../types/services").NodeService>> {
    return this.request(
      `/services/${serviceId}/notes`,
      {
        method: "PUT",
        body: JSON.stringify({ notes }),
      },
      true,
    );
  }

  async deleteService(serviceId: string): Promise<ApiResponse<void>> {
    return this.request(
      `/services/${serviceId}`,
      {
        method: "DELETE",
      },
      true,
    );
  }

  async exportServices(
    format: "json" | "csv" | "markdown",
    filters?: import("../types/services").ServiceFilters,
  ): Promise<{
    success: boolean;
    data?: Blob;
    fileName?: string;
    error?: string;
  }> {
    const params = new URLSearchParams({ format });
    if (filters?.nodeId) params.append("nodeId", filters.nodeId);
    if (filters?.serviceType) params.append("serviceType", filters.serviceType);
    if (filters?.status) params.append("status", filters.status);

    return this.download(`/services/export?${params.toString()}`, {}, true);
  }

  async triggerServiceScan(
    nodeId: string,
  ): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(
      `/nodes/${nodeId}/services/scan`,
      {
        method: "POST",
      },
      true,
    );
  }
}

export const apiService = new ApiService();
export { TokenManager };
export default apiService;
