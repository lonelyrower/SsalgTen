import { apiService, type ApiResponse } from './api';

// Enhanced API service with user feedback
class EnhancedApiService {
  private static instance: EnhancedApiService;
  private notificationCallbacks: {
    showError?: (title: string, message?: string) => void;
    showSuccess?: (title: string, message?: string) => void;
  } = {};

  static getInstance(): EnhancedApiService {
    if (!EnhancedApiService.instance) {
      EnhancedApiService.instance = new EnhancedApiService();
    }
    return EnhancedApiService.instance;
  }

  setNotificationCallbacks(callbacks: {
    showError?: (title: string, message?: string) => void;
    showSuccess?: (title: string, message?: string) => void;
  }) {
    this.notificationCallbacks = callbacks;
  }

  private handleError(operation: string, error: string) {
    console.error(`${operation} failed:`, error);
    
    if (this.notificationCallbacks.showError) {
      let userMessage = error;
      
      // 用户友好的错误消息映射
      if (error.includes('Authentication')) {
        userMessage = '登录已过期，请重新登录';
      } else if (error.includes('Network') || error.includes('fetch')) {
        userMessage = '网络连接失败，请检查网络设置';
      } else if (error.includes('500')) {
        userMessage = '服务器内部错误，请稍后重试';
      } else if (error.includes('404')) {
        userMessage = '请求的资源不存在';
      } else if (error.includes('403')) {
        userMessage = '没有权限执行此操作';
      }
      
      this.notificationCallbacks.showError(operation, userMessage);
    }
  }

  private handleSuccess(operation: string, message?: string) {
    if (this.notificationCallbacks.showSuccess) {
      this.notificationCallbacks.showSuccess(operation, message);
    }
  }

  // Enhanced API methods with user feedback
  async deleteNode(id: string, showFeedback = true): Promise<ApiResponse<void>> {
    const result = await apiService.deleteNode(id);
    
    if (showFeedback) {
      if (result.success) {
        this.handleSuccess('删除节点成功');
      } else {
        this.handleError('删除节点失败', result.error || '未知错误');
      }
    }
    
    return result;
  }

  async createUser(userData: any, showFeedback = true): Promise<ApiResponse<any>> {
    const result = await apiService.createUser(userData);
    
    if (showFeedback) {
      if (result.success) {
        this.handleSuccess('创建用户成功');
      } else {
        this.handleError('创建用户失败', result.error || '未知错误');
      }
    }
    
    return result;
  }

  async updateUser(id: string, userData: any, showFeedback = true): Promise<ApiResponse<any>> {
    const result = await apiService.updateUser(id, userData);
    
    if (showFeedback) {
      if (result.success) {
        this.handleSuccess('更新用户成功');
      } else {
        this.handleError('更新用户失败', result.error || '未知错误');
      }
    }
    
    return result;
  }

  async deleteUser(id: string, showFeedback = true): Promise<ApiResponse<void>> {
    const result = await apiService.deleteUser(id);
    
    if (showFeedback) {
      if (result.success) {
        this.handleSuccess('删除用户成功');
      } else {
        this.handleError('删除用户失败', result.error || '未知错误');
      }
    }
    
    return result;
  }

  async createNode(nodeData: any, showFeedback = true): Promise<ApiResponse<any>> {
    const result = await apiService.createNode(nodeData);
    
    if (showFeedback) {
      if (result.success) {
        this.handleSuccess('创建节点成功');
      } else {
        this.handleError('创建节点失败', result.error || '未知错误');
      }
    }
    
    return result;
  }

  async updateNode(id: string, nodeData: any, showFeedback = true): Promise<ApiResponse<any>> {
    const result = await apiService.updateNode(id, nodeData);
    
    if (showFeedback) {
      if (result.success) {
        this.handleSuccess('更新节点成功');
      } else {
        this.handleError('更新节点失败', result.error || '未知错误');
      }
    }
    
    return result;
  }

  // 添加登录错误处理
  async login(credentials: any, showFeedback = true): Promise<ApiResponse<any>> {
    const result = await apiService.login(credentials);
    
    if (showFeedback && !result.success) {
      let errorMessage = result.error || '登录失败';
      if (errorMessage.includes('Invalid credentials')) {
        errorMessage = '用户名或密码错误';
      } else if (errorMessage.includes('User not found')) {
        errorMessage = '用户不存在';
      }
      this.handleError('登录失败', errorMessage);
    }
    
    return result;
  }

  // 代理其他API方法（不需要特殊处理的）
  getNodes = apiService.getNodes.bind(apiService);
  getNodeById = apiService.getNodeById.bind(apiService);
  getStats = apiService.getStats.bind(apiService);
  getNodeDiagnostics = apiService.getNodeDiagnostics.bind(apiService);
  // TODO: These methods need to be implemented in apiService
  // getNodeDetails = apiService.getNodeDetails?.bind(apiService);
  getUsers = apiService.getUsers.bind(apiService);
  // getUserById = apiService.getUserById?.bind(apiService);
  getInstallCommand = apiService.getInstallCommand.bind(apiService);
  logout = apiService.logout.bind(apiService);
  refreshToken = apiService.refreshToken.bind(apiService);
}

export const enhancedApiService = EnhancedApiService.getInstance();