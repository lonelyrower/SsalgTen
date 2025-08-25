import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core vendor libraries
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['lucide-react'],
          'vendor-utils': ['clsx', 'tailwind-merge'],
          
          // Admin components chunk
          'admin': [
            './src/components/admin/UserManagement',
            './src/components/admin/SystemSettings',
            './src/components/admin/UserModal'
          ],
          
          // Map chunk
          'map': [
            './src/components/map/WorldMap'
          ],
          
          // Dashboard components chunk
          'dashboard': [
            './src/components/dashboard/EnhancedStats',
            './src/components/dashboard/ActivityLog'
          ]
        }
      }
    },
    // Increase chunk size warning limit since we're optimizing chunks
    chunkSizeWarningLimit: 1000
  }
})