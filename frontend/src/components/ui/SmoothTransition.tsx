import React, { memo, useEffect, useState } from 'react';

interface SmoothTransitionProps {
  children: React.ReactNode;
  data: any;
  duration?: number;
  className?: string;
}

// 平滑过渡组件，避免数据更新时的闪跳
export const SmoothTransition: React.FC<SmoothTransitionProps> = memo(({ 
  children, 
  data, 
  duration = 300,
  className = '' 
}) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [prevData, setPrevData] = useState(data);

  useEffect(() => {
    if (JSON.stringify(data) !== JSON.stringify(prevData)) {
      setIsTransitioning(true);
      
      const timer = setTimeout(() => {
        setPrevData(data);
        setIsTransitioning(false);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [data, prevData, duration]);

  return (
    <div 
      className={`transition-all duration-${duration} ease-in-out ${
        isTransitioning ? 'opacity-90 transform scale-[0.99]' : 'opacity-100 transform scale-100'
      } ${className}`}
    >
      {children}
    </div>
  );
});