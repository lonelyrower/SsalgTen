import { useState, useEffect } from 'react';

const STORAGE_KEY = 'visitor_location_visible';

/**
 * 管理访客位置可见性的 Hook
 * 使用 localStorage 保存用户偏好
 */
export function useVisitorLocationVisibility() {
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === null ? true : stored === 'true';
    } catch (error) {
      console.warn('Failed to read visitor location visibility from localStorage', error);
      return true;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, String(isVisible));
    } catch (error) {
      console.warn('Failed to save visitor location visibility to localStorage', error);
    }
  }, [isVisible]);

  const toggleVisibility = () => {
    setIsVisible(prev => !prev);
  };

  const show = () => {
    setIsVisible(true);
  };

  const hide = () => {
    setIsVisible(false);
  };

  return {
    isVisible,
    toggleVisibility,
    show,
    hide,
  };
}

export default useVisitorLocationVisibility;
