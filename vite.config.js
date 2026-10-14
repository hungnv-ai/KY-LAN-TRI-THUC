import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open: true,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1000, // three.js khá lớn
  },
});
