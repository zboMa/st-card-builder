/**
 * 水墨 L3 视觉冒烟：Canvas 须有可见像素 + 点击主按钮有溅墨
 * npm run build && node scripts/e2e-sumi-visual.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

var root = join(dirname(fileURLToPath(import.meta.url)), '..');
var shotDir = join(root, 'artifacts/e2e-sumi');

function fail(msg) {
  console.error('[e2e-sumi-visual] FAIL:', msg);
  process.exit(1);
}

function ok(msg) {
  console.log('[e2e-sumi-visual] OK:', msg);
}

if (!existsSync(join(root, 'dist/index.html'))) {
  fail('run npm run build first');
}

mkdirSync(shotDir, { recursive: true });

var previewProc = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4323'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
});

function killPreview() {
  if (!previewProc.killed) previewProc.kill('SIGTERM');
}

function waitForServer() {
  return new Promise(function(resolve, reject) {
    var deadline = Date.now() + 35000;
    function tick() {
      fetch('http://127.0.0.1:4323/')
        .then(function(r) { if (r.ok) resolve(); else throw new Error('bad'); })
        .catch(function() {
          if (Date.now() > deadline) reject(new Error('timeout'));
          else setTimeout(tick, 300);
        });
    }
    tick();
  });
}

function sampleCanvasBrightness(page) {
  return page.evaluate(function() {
    var ids = ['sceneFxCanvasBlend', 'sceneFxCanvasAmbient'];
    var max = 0;
    var hits = 0;
    for (var k = 0; k < ids.length; k++) {
      var c = document.getElementById(ids[k]);
      if (!c) continue;
      var ctx = c.getContext('2d');
      if (!ctx) continue;
      var w = c.width;
      var h = c.height;
      if (w < 10 || h < 10) continue;
      var pts = [
        [w * 0.2, h * 0.2], [w * 0.5, h * 0.45], [w * 0.75, h * 0.65], [w * 0.35, h * 0.55],
      ];
      pts.forEach(function(p) {
        var d = ctx.getImageData(Math.floor(p[0]), Math.floor(p[1]), 1, 1).data;
        var lum = d[0] + d[1] + d[2];
        if (d[3] > 6) hits++;
        if (lum > max) max = lum;
      });
    }
    if (hits === 0 && max === 0) return { ok: false, reason: 'no canvas pixels' };
    return { ok: hits >= 1 && max > 80, hits: hits, max: max, tier: document.documentElement.getAttribute('data-scene-tier') };
  });
}

async function main() {
  var playwright;
  try {
    playwright = await import('playwright');
  } catch (e) {
    fail('playwright missing');
  }

  try {
    await waitForServer();
    ok('preview up');

    var browser = await playwright.chromium.launch({ headless: true });
    var page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.addInitScript(function() {
      localStorage.setItem('st_v3_app_theme', 'sumi-ink');
      localStorage.setItem('st_v3_scene_fx', '1');
      localStorage.setItem('st_v3_fx_enabled', '1');
    });

    await page.goto('http://127.0.0.1:4323/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    var tier = await page.evaluate(function() {
      return {
        tier: document.documentElement.getAttribute('data-scene-tier'),
        fx: document.documentElement.getAttribute('data-scene-fx'),
        scene: document.documentElement.getAttribute('data-app-scene'),
      };
    });
    if (tier.tier !== 'immersive') fail('expected immersive, got ' + JSON.stringify(tier));
    ok('tier immersive');

    var sample1 = await sampleCanvasBrightness(page);
    if (!sample1.ok) fail('canvas too empty before click: ' + JSON.stringify(sample1));
    ok('canvas has visible ink (max lum ' + sample1.max + ')');

    await page.screenshot({ path: join(shotDir, 'sumi-immersive.png'), fullPage: false });
    ok('screenshot saved');

    var btn = page.locator('.btn-primary').first();
    if (await btn.count()) {
      var box = await btn.boundingBox();
      if (box) {
        var cx = box.x + box.width / 2;
        var cy = box.y + box.height / 2;
        await page.mouse.click(cx, cy);
        await page.waitForTimeout(450);
        var afterClick = await page.evaluate(function(click) {
          var ids = ['sceneFxCanvasBlend', 'sceneFxCanvasAmbient'];
          for (var k = 0; k < ids.length; k++) {
            var c = document.getElementById(ids[k]);
            var ctx = c && c.getContext('2d');
            if (!ctx) continue;
            var x = Math.floor(click.x * (c.width / c.clientWidth));
            var y = Math.floor(click.y * (c.height / c.clientHeight));
            var d = ctx.getImageData(x, y, 1, 1).data;
            if (d[3] > 20 && (d[0] + d[1] + d[2]) > 60) {
              return { ok: true, a: d[3], lum: d[0] + d[1] + d[2], layer: ids[k] };
            }
          }
          return { ok: false };
        }, { x: cx, y: cy });
        if (!afterClick.ok) fail('click burst not visible at button: ' + JSON.stringify(afterClick));
        ok('click burst visible at button (lum ' + afterClick.lum + ')');
      }
    }

    await browser.close();
    ok('all passed');
  } finally {
    killPreview();
  }
}

main().catch(function(err) {
  killPreview();
  fail(err && err.message ? err.message : String(err));
});
