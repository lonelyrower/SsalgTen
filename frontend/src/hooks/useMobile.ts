import { useState, useEffect } from "react";

interface MobileInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  screenWidth: number;
  screenHeight: number;
  orientation: "portrait" | "landscape";
  hasTouchScreen: boolean;
  isStandalone: boolean; // PWA 全屏模式
}

export const useMobile = (): MobileInfo => {
  const [mobileInfo, setMobileInfo] = useState<MobileInfo>(() => {
    if (typeof window === "undefined") {
      return {
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isIOS: false,
        isAndroid: false,
        screenWidth: 1920,
        screenHeight: 1080,
        orientation: "landscape",
        hasTouchScreen: false,
        isStandalone: false,
      };
    }

    const userAgent = navigator.userAgent.toLowerCase();
    const width = window.innerWidth;
    const height = window.innerHeight;

    return {
      isMobile: width <= 768,
      isTablet: width > 768 && width <= 1024,
      isDesktop: width > 1024,
      isIOS: /iphone|ipad|ipod/.test(userAgent),
      isAndroid: /android/.test(userAgent),
      screenWidth: width,
      screenHeight: height,
      orientation: width > height ? "landscape" : "portrait",
      hasTouchScreen: "ontouchstart" in window || navigator.maxTouchPoints > 0,
      isStandalone: window.matchMedia("(display-mode: standalone)").matches,
    };
  });

  useEffect(() => {
    const updateMobileInfo = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const width = window.innerWidth;
      const height = window.innerHeight;

      setMobileInfo({
        isMobile: width <= 768,
        isTablet: width > 768 && width <= 1024,
        isDesktop: width > 1024,
        isIOS: /iphone|ipad|ipod/.test(userAgent),
        isAndroid: /android/.test(userAgent),
        screenWidth: width,
        screenHeight: height,
        orientation: width > height ? "landscape" : "portrait",
        hasTouchScreen:
          "ontouchstart" in window || navigator.maxTouchPoints > 0,
        isStandalone: window.matchMedia("(display-mode: standalone)").matches,
      });
    };

    const handleResize = () => {
      // 使用 requestAnimationFrame 来防抖，避免频繁更新
      requestAnimationFrame(updateMobileInfo);
    };

    const handleOrientationChange = () => {
      // iOS Safari 需要延迟来获取正确的尺寸
      setTimeout(updateMobileInfo, 100);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleOrientationChange);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleOrientationChange);
    };
  }, []);

  return mobileInfo;
};

// 移动端工具函数
export const mobileUtils = {
  // 防止 iOS Safari 的橡皮筋效果
  preventBounce: (element?: HTMLElement) => {
    const target = element || document.body;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      const startY = touch.clientY;

      const handleTouchMove = (e: TouchEvent) => {
        const touch = e.touches[0];
        const currentY = touch.clientY;
        const deltaY = currentY - startY;

        // 如果在顶部向下滑动或在底部向上滑动，阻止默认行为
        if (
          (target.scrollTop === 0 && deltaY > 0) ||
          (target.scrollHeight - target.scrollTop === target.clientHeight &&
            deltaY < 0)
        ) {
          e.preventDefault();
        }
      };

      const handleTouchEnd = () => {
        target.removeEventListener("touchmove", handleTouchMove);
        target.removeEventListener("touchend", handleTouchEnd);
      };

      target.addEventListener("touchmove", handleTouchMove, { passive: false });
      target.addEventListener("touchend", handleTouchEnd);
    };

    target.addEventListener("touchstart", handleTouchStart);

    return () => {
      target.removeEventListener("touchstart", handleTouchStart);
    };
  },

  // 获取安全区域尺寸
  getSafeAreaInsets: () => {
    const style = getComputedStyle(document.documentElement);
    return {
      top: parseInt(style.getPropertyValue("--sat") || "0"),
      right: parseInt(style.getPropertyValue("--sar") || "0"),
      bottom: parseInt(style.getPropertyValue("--sab") || "0"),
      left: parseInt(style.getPropertyValue("--sal") || "0"),
    };
  },

  // 检查是否支持PWA
  supportsPWA: () => {
    return "serviceWorker" in navigator && "PushManager" in window;
  },

  // 获取网络状态
  getNetworkInfo: () => {
    interface NavigatorWithConnection extends Navigator {
      connection?: {
        effectiveType: string;
        downlink: number;
        rtt: number;
        saveData: boolean;
      };
      mozConnection?: {
        effectiveType: string;
        downlink: number;
        rtt: number;
        saveData: boolean;
      };
      webkitConnection?: {
        effectiveType: string;
        downlink: number;
        rtt: number;
        saveData: boolean;
      };
    }

    const nav = navigator as NavigatorWithConnection;
    const connection =
      nav.connection || nav.mozConnection || nav.webkitConnection;

    if (connection) {
      return {
        effectiveType: connection.effectiveType, // '4g', '3g', '2g', 'slow-2g'
        downlink: connection.downlink, // 下行速度 Mbps
        rtt: connection.rtt, // 往返时间 ms
        saveData: connection.saveData, // 用户是否启用了数据节省模式
      };
    }

    return null;
  },

  // 震动反馈（如果支持）
  vibrate: (pattern: number | number[]) => {
    if ("vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  },
};
