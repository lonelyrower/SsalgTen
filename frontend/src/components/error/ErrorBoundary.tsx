import { Component, type ErrorInfo, type ReactNode } from "react";
import { logger } from "@/utils/logger";
import { AlertCircle, RefreshCw, Home, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error("ErrorBoundary caught an error:", error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // 调用外部错误处理回调
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // 在开发环境中记录更详细的错误信息
    if (process.env.NODE_ENV === "development") {
      logger.group("🚨 Error Boundary Details");
      logger.error("Error:", error);
      logger.error("Error Info:", errorInfo);
      logger.error("Component Stack:", errorInfo.componentStack);
      logger.groupEnd();
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认错误UI
      return (
        <div className="min-h-screen bg-surface-base flex items-center justify-center p-4">
          <div className="max-w-md w-full surface-elevated rounded-lg shadow-lg p-6">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-[hsl(var(--error))]/10 p-3">
                  <AlertCircle className="h-8 w-8 text-[hsl(var(--error))]" />
                </div>
              </div>

              <h1 className="text-xl font-semibold text-foreground mb-2">
                应用程序出现错误
              </h1>

              <p className="text-muted-foreground mb-6">
                很抱歉，应用程序遇到了意外错误。请尝试刷新页面或返回首页。
              </p>

              {/* 错误详情（仅开发环境显示） */}
              {process.env.NODE_ENV === "development" && this.state.error && (
                <details className="text-left mb-6 p-4 bg-muted rounded-lg">
                  <summary className="cursor-pointer text-sm font-medium text-foreground mb-2 flex items-center">
                    <Bug className="h-4 w-4 mr-2" />
                    开发者信息
                  </summary>
                  <div className="text-xs text-muted-foreground space-y-2">
                    <div>
                      <strong>错误:</strong>
                      <pre className="mt-1 p-2 bg-[hsl(var(--error))]/10 rounded text-[hsl(var(--error))] overflow-x-auto whitespace-pre-wrap">
                        {this.state.error.toString()}
                      </pre>
                    </div>
                    {this.state.errorInfo && (
                      <div>
                        <strong>组件堆栈:</strong>
                        <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto whitespace-pre-wrap">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}

              {/* 操作按钮 */}
              <div className="space-y-3">
                <Button
                  onClick={this.handleRetry}
                  className="w-full flex items-center justify-center"
                  variant="outline"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  重试
                </Button>

                <div className="flex space-x-3">
                  <Button
                    onClick={this.handleReload}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    刷新页面
                  </Button>

                  <Button
                    onClick={this.handleGoHome}
                    size="sm"
                    className="flex-1"
                  >
                    <Home className="h-4 w-4 mr-2" />
                    返回首页
                  </Button>
                </div>
              </div>

              {/* 联系信息 */}
              <div className="mt-6 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  如果问题持续出现，请联系技术支持
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
