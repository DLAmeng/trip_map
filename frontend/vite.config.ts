import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// 迁移期:Vite dev server(5173)和 Express(8080)同时跑。
// 前端代码里所有 /api、/photos、/runtime-config.js 请求都直接走相对路径,
// 由 dev proxy 转发到 Express,避免写两套 URL。
// 生产期(Phase 5)会把 vite build 产物交给 Express 托管,到时无需 proxy。
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
      '/photos': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
      '/runtime-config.js': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
