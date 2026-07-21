#!/usr/bin/env node
/**
 * 将 Astro dist 拆成两份静态包：
 * - dist-card/        → /var/www/card（主站，不含 /admin）
 * - dist-card-admin/  → /var/www/card-admin（管理端根目录即 admin 页）
 */
import {
  cpSync,
  rmSync,
  mkdirSync,
  existsSync,
  readdirSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

var root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
var dist = path.join(root, 'dist');
var card = path.join(root, 'dist-card');
var admin = path.join(root, 'dist-card-admin');

if (!existsSync(dist) || !existsSync(path.join(dist, 'index.html'))) {
  console.error('[pack-frontends] 缺少 dist/，请先 npm run build（astro）');
  process.exit(1);
}
if (!existsSync(path.join(dist, 'admin', 'index.html'))) {
  console.error('[pack-frontends] 缺少 dist/admin/index.html');
  process.exit(1);
}

function wipe(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

wipe(card);
wipe(admin);

// 主站：整包去掉 admin/
cpSync(dist, card, { recursive: true });
rmSync(path.join(card, 'admin'), { recursive: true, force: true });

// 管理端：admin 页抬到站点根 + 共享 _astro / favicon
cpSync(path.join(dist, 'admin'), admin, { recursive: true });
if (existsSync(path.join(dist, '_astro'))) {
  cpSync(path.join(dist, '_astro'), path.join(admin, '_astro'), { recursive: true });
}
['favicon.svg', 'favicon.ico'].forEach(function(name) {
  var src = path.join(dist, name);
  if (existsSync(src)) cpSync(src, path.join(admin, name));
});

function countFiles(dir) {
  var n = 0;
  function walk(d) {
    readdirSync(d).forEach(function(name) {
      var p = path.join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else n += 1;
    });
  }
  walk(dir);
  return n;
}

console.log('[pack-frontends] dist-card files=', countFiles(card));
console.log('[pack-frontends] dist-card-admin files=', countFiles(admin));
console.log('[pack-frontends] ok');
