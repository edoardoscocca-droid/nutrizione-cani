import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  base: './',
  optimizeDeps: { exclude: ['highs'] },
  test: { environment: 'node', testTimeout: 30000 },
} as never);
