import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    allowedHosts: [
      'ubuntu-8gb-nbg1-1.tail706c84.ts.net',
    ],
    proxy: {
      '/n8n-api': {
        target: 'http://localhost:5678',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/n8n-api/, '/api/v1'),
      },
    },
  },
});
