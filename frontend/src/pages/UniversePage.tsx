import { Header } from '@/components/layout/Header';
import { NetworkUniverse } from '@/components/3d/NetworkUniverse';

export const UniversePage = () => {
  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-6">
        <NetworkUniverse />
      </main>
    </div>
  );
};