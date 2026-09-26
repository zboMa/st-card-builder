import { execFileSync } from 'node:child_process';
import { defineConfig } from 'astro/config';

/**
 * 开发时代理目标。
 * Windows + WSL NAT 时，本机 127.0.0.1:8787 到不了 Ubuntu 里的 API，改用 WSL 网卡地址。
 * 覆盖：DEV_API_PROXY=http://127.0.0.1:8787
 */
function devApiProxyTarget() {
  if (process.env.DEV_API_PROXY) return process.env.DEV_API_PROXY;
  if (process.platform !== 'win32') return 'http://127.0.0.1:8787';
  try {
    const out = execFileSync('wsl', ['-e', 'hostname', '-I'], {
      encoding: 'utf8',
      timeout: 20000,
      windowsHide: true,
    });
    const ip = String(out).replace(/\0/g, '').trim().split(/\s+/)[0];
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return 'http://' + ip + ':8787';
  } catch {
    /* 无 WSL 时回退本机回环 */
  }
  return 'http://127.0.0.1:8787';
}

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
          target: devApiProxyTarget(),
          changeOrigin: true,
        },
      },
    },
    optimizeDeps: {
      include: ['events', 'js-tiktoken'],
    },
  },
});
