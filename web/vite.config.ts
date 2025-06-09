import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import cesium from 'vite-plugin-cesium';
import path from 'path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 读取根目录 .env 文件
  const env = loadEnv(mode, path.resolve(__dirname, '..'));
  return {
    plugins: [react(), cesium()],
    build: {
      emptyOutDir: false, // 不清空输出目录，保留goview子目录
      rollupOptions: {
        output: {
          // 避免文件名冲突
          assetFileNames: 'assets/[name]-[hash][extname]',
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
        }
      }
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: env.VITE_BASE_URL,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        // 开发时代理goview请求
        '/goview': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/goview/, ''),
        },
      },
      cors: {
        origin: ['http://www.virtual-site.com', 'https://www.virtual-site.com'],
        credentials: true,
      },
    },
  };
});
