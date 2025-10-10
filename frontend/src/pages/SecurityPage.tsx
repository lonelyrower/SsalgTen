import { Header } from '@/components/layout/Header';
import { ThreatVisualization } from '@/components/security/ThreatVisualization';
import { Shield } from 'lucide-react';

export const SecurityPage = () => {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-6 md:py-8">
        {/* 页面标题 */}
        <div className="mb-6 md:mb-8">
          <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-4 md:p-6">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-cyan-500/5 to-blue-500/5 dark:from-blue-400/5 dark:via-cyan-400/5 dark:to-blue-400/5"></div>
            <div className="relative z-10 flex items-center space-x-3 md:space-x-4">
              <div className="p-2 md:p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg flex-shrink-0">
                <Shield className="h-6 w-6 md:h-8 md:w-8 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl md:text-3xl font-bold bg-gradient-to-r from-gray-900 to-blue-700 dark:from-white dark:to-cyan-300 bg-clip-text text-transparent">
                  安全中心
                </h1>
                <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-0.5 md:mt-1 hidden sm:block">
                  实时监控网络威胁和安全事件
                </p>
              </div>
            </div>
          </div>
        </div>

        <ThreatVisualization />
      </main>
    </div>
  );
};