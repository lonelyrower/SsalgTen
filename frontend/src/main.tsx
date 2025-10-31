import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { loadMapConfig } from "./utils/configLoader";

// Declare build time global variable
declare const __BUILD_TIME__: string;

// Log build information
console.info(
  `%c🚀 SsalgTen Frontend %c\n` +
    `%cBuild Time: ${__BUILD_TIME__}\n` +
    `%cIf you see old content, please: %c\n` +
    `1. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)\n` +
    `2. Clear browser cache\n` +
    `3. Open DevTools > Application > Clear storage`,
  "color: #3b82f6; font-size: 14px; font-weight: bold",
  "",
  "color: #10b981",
  "color: #f59e0b; font-weight: bold",
  "color: #6b7280",
);

// Handle unhandled promise rejections
window.addEventListener("unhandledrejection", (event) => {
  // Suppress browser extension related errors
  if (
    event.reason?.message?.includes("message channel closed") ||
    event.reason?.message?.includes(
      "listener indicated an asynchronous response",
    )
  ) {
    console.warn("Browser extension related error suppressed:", event.reason);
    event.preventDefault();
    return;
  }
  // Log other errors for debugging
  console.error("Unhandled promise rejection:", event.reason);
});

// Handle runtime errors
window.addEventListener("error", (event) => {
  // Suppress extension-related errors
  if (
    event.message?.includes("Extension") ||
    event.filename?.includes("extension")
  ) {
    console.warn("Browser extension error suppressed:", event.message);
    event.preventDefault();
    return;
  }
});

// 加载地图配置后再渲染应用
loadMapConfig()
  .then(() => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((error) => {
    console.error("Failed to initialize app:", error);
    // 即使加载失败也要渲染应用
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
