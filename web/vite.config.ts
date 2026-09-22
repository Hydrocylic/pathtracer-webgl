
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {

    dedupe: ['three'],
    alias: {
      '@core': fileURLToPath(new URL('../src', import.meta.url)),
    },
  },
  publicDir: fileURLToPath(new URL('../public', import.meta.url)),
  server: {
    port: 5174,
    strictPort: true,
    fs: { allow: ['..'] },
  },
});
