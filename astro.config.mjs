import { defineConfig } from 'astro/config';

export default defineConfig({
  vite: {
    define: {
      global: 'globalThis',
    },
    resolve: {
      alias: {
        events: 'events',
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: true,
        },
      },
    },
    optimizeDeps: {
      include: ['events'],
    },
  },
});
