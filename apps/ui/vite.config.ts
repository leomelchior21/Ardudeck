import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@ardudeck/core': path.resolve(repoRoot, 'core', 'src', 'index.ts'),
    },
  },
  server: {
    port: Number(process.env.ARDUDECK_UI_PORT ?? 5173),
    strictPort: true,
    fs: { allow: [repoRoot] },
    proxy: {
      '/api': { target: 'http://127.0.0.1:8080', changeOrigin: true },
      '/ws': { target: 'ws://127.0.0.1:8080', ws: true },
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2019',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
