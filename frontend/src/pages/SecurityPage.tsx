import { Header } from '@/components/layout/Header';
import { ThreatVisualization } from '@/components/security/ThreatVisualization';

export const SecurityPage = () => {
  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-6">
        <ThreatVisualization />
      </main>
    </div>
  );
};