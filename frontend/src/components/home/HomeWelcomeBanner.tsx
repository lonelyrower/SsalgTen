import { Globe } from "lucide-react";

interface HomeWelcomeBannerProps {
  userName?: string;
}

export const HomeWelcomeBanner: React.FC<HomeWelcomeBannerProps> = ({
  userName,
}) => {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-2xl)] bg-white dark:bg-gray-800 shadow-[var(--shadow-xl)] border border-[hsl(var(--border-subtle)_/_0.5)] dark:border-[hsl(var(--border-muted)_/_0.5)] p-6">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-cyan-500/5 to-blue-500/5 dark:from-blue-400/5 dark:via-cyan-400/5 dark:to-blue-400/5"></div>
      <div className="relative z-10 flex items-center space-x-4">
        <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-[var(--radius-xl)] shadow-[var(--shadow-lg)]">
          <Globe className="h-8 w-8 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-blue-700 dark:from-white dark:to-cyan-300 bg-clip-text text-transparent">
            全球节点网络
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            欢迎回来, {userName} - 实时监控全球网络节点状态
          </p>
        </div>
      </div>
    </div>
  );
};
