/**
 * 移动端 + 水墨 scene 端到端冒烟：侧栏须 off-screen，主内容可见。
 * 用法：npm run build && node scripts/e2e-theme-mobile.mjs
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

var root = join(dirname(fileURLToPath(import.meta.url)), '..');
var distIndex = join(root, 'dist/index.html');

function fail(msg) {
  console.error('[e2e-theme-mobile] FAIL:', msg);
  process.exit(1);
}

function ok(msg) {
  console.log('[e2e-theme-mobile] OK:', msg);
}

if (!existsSync(distIndex)) {
  fail('dist/index.html missing — run npm run build first');
}

var previewProc = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4322'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
});

function waitForServer(ms) {
  return new Promise(function(resolve, reject) {
    var deadline = Date.now() + ms;
    function tick() {
      fetch('http://127.0.0.1:4322/')
        .then(function(r) { if (r.ok) resolve(); else throw new Error('bad status'); })
        .catch(function() {
          if (Date.now() > deadline) reject(new Error('preview server timeout'));
          else setTimeout(tick, 300);
        });
    }
    tick();
  });
}

function killPreview() {
  if (!previewProc.killed) previewProc.kill('SIGTERM');
}

async function main() {
  var playwright;
  try {
    playwright = await import('playwright');
  } catch (e) {
    fail('playwright not installed — run: npx playwright install chromium');
  }

  try {
    await waitForServer(30000);
    ok('preview server up');

    var browser = await playwright.chromium.launch({ headless: true });
    var page = await browser.newPage();
    await page.setViewportSize({ width: 390, height: 844 });

    await page.addInitScript(function() {
      localStorage.setItem('st_v3_app_theme', 'sumi-ink');
    });

    await page.goto('http://127.0.0.1:4322/', { waitUntil: 'networkidle' });

    var scene = await page.evaluate(function() {
      return document.documentElement.getAttribute('data-app-scene');
    });
    if (scene !== 'sumi-ink') fail('expected data-app-scene=sumi-ink, got ' + scene);
    ok('水墨 scene 已应用');

    var sidebarStyle = await page.evaluate(function() {
      var el = document.getElementById('appSidebar');
      if (!el) return null;
      var cs = getComputedStyle(el);
      return { position: cs.position, transform: cs.transform, zIndex: cs.zIndex };
    });
    if (!sidebarStyle) fail('missing #appSidebar');
    if (sidebarStyle.position !== 'fixed') {
      fail('sidebar position must be fixed on mobile, got ' + sidebarStyle.position);
    }
    ok('侧栏 position:fixed');

    var offScreen = await page.evaluate(function() {
      var el = document.getElementById('appSidebar');
      var rect = el.getBoundingClientRect();
      return rect.right <= 8;
    });
    if (!offScreen) fail('closed drawer must be off-screen (sidebar overlaps main content)');
    ok('关闭时侧栏在屏外');

    var mainVisible = await page.evaluate(function() {
      var view = document.querySelector('.app-view[data-view="novel-manage"]') ||
        document.querySelector('.app-view.is-active') ||
        document.querySelector('.app-container');
      if (!view) return false;
      var rect = view.getBoundingClientRect();
      return rect.width > 100 && rect.height > 100;
    });
    if (!mainVisible) fail('main content area not visible');
    ok('主内容区可见');

    await page.click('#btnMobileNavOpen');
    await page.waitForTimeout(350);

    var drawerOpen = await page.evaluate(function() {
      return document.getElementById('appSidebar').classList.contains('is-drawer-open');
    });
    if (!drawerOpen) fail('drawer did not open after hamburger click');
    ok('汉堡打开抽屉');

    var sidebarInView = await page.evaluate(function() {
      var rect = document.getElementById('appSidebar').getBoundingClientRect();
      return rect.left >= -2 && rect.width > 50;
    });
    if (!sidebarInView) fail('drawer open but sidebar not visible');
    ok('打开时侧栏可见');

    await browser.close();
    ok('all checks passed');
  } finally {
    killPreview();
  }
}

main().catch(function(err) {
  killPreview();
  fail(err && err.message ? err.message : String(err));
});
