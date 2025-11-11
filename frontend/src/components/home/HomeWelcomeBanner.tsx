import { Globe } from "lucide-react";

interface HomeWelcomeBannerProps {
  userName?: string;
}

export const HomeWelcomeBanner: React.FC<HomeWelcomeBannerProps> = ({
  userName,
}) => {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-card shadow-xl border border-border p-6">
      <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--info))]/5 via-[hsl(var(--info))]/5 to-[hsl(var(--info))]/5"></div>
      <div className="relative z-10 flex items-center space-x-4">
        <div className="p-3 bg-gradient-to-br from-[hsl(var(--info))] to-[hsl(var(--info))]/80 rounded-xl shadow-lg">
          <Globe className="h-8 w-8 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold gradient-text">
            全球节点网络
          </h1>
          <p className="text-muted-foreground mt-1">
            欢迎回来, {userName} - 实时监控全球网络节点状态
          </p>
        </div>
      </div>
    </div>
  );
};
