import { useState, useEffect } from 'react';

const STORAGE_KEY = 'visitor_location_visible';
const STORAGE_EVENT = 'visitor_location_visibility_changed';

/**
 * 管理访客位置可见性的 Hook
 * 使用 localStorage 保存用户偏好，并在组件间同步状态
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

  // 监听其他组件的状态变化
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: CustomEvent<{ isVisible: boolean }>) => {
      // 只有当新值与当前值不同时才更新，避免循环
      if (e.detail.isVisible !== isVisible) {
        setIsVisible(e.detail.isVisible);
      }
    };

    window.addEventListener(STORAGE_EVENT, handleStorageChange as EventListener);

    return () => {
      window.removeEventListener(STORAGE_EVENT, handleStorageChange as EventListener);
    };
  }, [isVisible]);

  // 保存到 localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, String(isVisible));
    } catch (error) {
      console.warn('Failed to save visitor location visibility to localStorage', error);
    }
  }, [isVisible]);

  const toggleVisibility = () => {
    setIsVisible(prev => {
      const newValue = !prev;
      // 触发自定义事件通知其他组件
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: { isVisible: newValue } }));
      }
      return newValue;
    });
  };

  const show = () => {
    setIsVisible(true);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: { isVisible: true } }));
    }
  };

  const hide = () => {
    setIsVisible(false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: { isVisible: false } }));
    }
  };

  return {
    isVisible,
    toggleVisibility,
    show,
    hide,
  };
}

export default useVisitorLocationVisibility;
