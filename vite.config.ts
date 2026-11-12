import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('xlsx')) {
            return 'xlsx';
          }
          if (id.includes('react') || id.includes('zustand')) {
            return 'vendor';
          }
        }
      }
    }
  }
});
