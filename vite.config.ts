import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(projectRoot, 'src/shared'),
      // text-to-svg evaluates path.join while loading in the browser even
      // though this editor always uses its URL-based async loader.
      path: resolve(projectRoot, 'src/image-map-editor/canvas/utils/browserPathShim.ts'),
    }
  },
  define: {
    __dirname: JSON.stringify(''),
  },
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
