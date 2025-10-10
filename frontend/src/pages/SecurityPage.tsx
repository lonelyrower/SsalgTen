import { Header } from '@/components/layout/Header';
import { ThreatVisualization } from '@/components/security/ThreatVisualization';
import { Shield } from 'lucide-react';

export const SecurityPage = () => {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* 页面头部 - 紧凑设计 */}
        <div className="mb-6">
          <div className="bg-white dark:bg-gray-800 border-b-2 border-blue-500/20 dark:border-blue-400/20 px-4 py-3">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                安全中心
              </h1>
            </div>
          </div>
        </div>

        <ThreatVisualization />
      </main>
    </div>
  );
};