import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open: true,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1000, // three.js khá lớn
    rollupOptions: {
      // Hai trang: game (index.html) và quản trị (admin.html).
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin.html'),
      },
    },
  },
});
