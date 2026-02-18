import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    port: 3000,
    host: '0.0.0.0',  // Для доступа из Docker

    // Проксирование API запросов на backend
    proxy: {
      '/api': {
        target: process.env.VITE_API_INTERNAL_URL || 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        // Логирование для отладки
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Proxying:', req.method, req.url, '-> backend');
          });
        },
      },
      // Проксирование health endpoint
      '/health': {
        target: process.env.VITE_API_INTERNAL_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
    },

    // HMR настройки для Docker
    watch: {
      usePolling: true,  // Для Docker volumes
    },
  },

  // Оптимизация для разработки
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'axios'],
  },

  // Build настройки
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
