import { defineConfig } from 'astro/config';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 18826,
  },
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
          // target: 'http://127.0.0.1:8787',
          target: 'http://card-api.taojiu.love',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    optimizeDeps: {
      include: ['events', 'js-tiktoken'],
    },
  },
});
