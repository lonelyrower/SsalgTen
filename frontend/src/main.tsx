import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  // Suppress browser extension related errors
  if (event.reason?.message?.includes('message channel closed') || 
      event.reason?.message?.includes('listener indicated an asynchronous response')) {
    console.warn('Browser extension related error suppressed:', event.reason);
    event.preventDefault();
    return;
  }
  // Log other errors for debugging
  console.error('Unhandled promise rejection:', event.reason);
});

// Handle runtime errors
window.addEventListener('error', (event) => {
  // Suppress extension-related errors
  if (event.message?.includes('Extension') || event.filename?.includes('extension')) {
    console.warn('Browser extension error suppressed:', event.message);
    event.preventDefault();
    return;
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
