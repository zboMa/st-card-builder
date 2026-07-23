/**
 * 壳层 8 主题契约
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_THEMES, DEFAULT_THEME_ID, STORAGE_KEY } from '../src/lib/theme/themeCatalog.mjs';
import { readLayoutSources } from './helpers/uiSources.mjs';

var root = join(dirname(fileURLToPath(import.meta.url)), '..');
var themesPath = join(root, 'src/styles/tokens-themes.css');
var layoutPath = join(root, 'src/layouts/Layout.astro');

var THEME_COLOR_TOKENS = [
  '--color-paper',
  '--color-paper-glow-a',
  '--color-accent',
  '--color-on-accent',
  '--color-text',
  '--color-glass',
  '--color-scrim',
  '--color-danger',
  '--color-msg-user-bg',
  '--shadow-panel',
];

describe('app shell themes', function() {
  it('tokens-themes.css 存在', function() {
    assert.ok(existsSync(themesPath));
  });

  it('catalog 与 CSS 块一一对应', function() {
    var css = readFileSync(themesPath, 'utf8');
    APP_THEMES.forEach(function(meta) {
      assert.match(css, new RegExp('\\[data-app-theme="' + meta.id + '"\\]'), meta.id);
    });
  });

  it('每套主题含关键语义 token', function() {
    var css = readFileSync(themesPath, 'utf8');
    APP_THEMES.forEach(function(meta) {
      var re = new RegExp('\\[data-app-theme="' + meta.id + '"\\][\\s\\S]*?(?=\\n\\[data-app-theme=|\\n@media|$)');
      var block = css.match(re);
      assert.ok(block, 'missing block ' + meta.id);
      THEME_COLOR_TOKENS.forEach(function(name) {
        assert.match(block[0], new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), meta.id + ' ' + name);
      });
    });
  });

  it('默认 nocturne + :root 别名', function() {
    var css = readFileSync(themesPath, 'utf8');
    assert.match(css, /:root,\s*\n\[data-app-theme="nocturne"\]/);
    assert.equal(DEFAULT_THEME_ID, 'nocturne');
  });

  it('Layout 含 FOUC 防闪脚本与 theme boot', function() {
    var layout = readLayoutSources(root);
    assert.match(layout, /st_v3_app_theme/);
    assert.match(layout, /data-app-theme/);
    assert.match(layout, /themeBoot\.mjs/);
    assert.match(layout, /themePickerBoot\.mjs/);
  });

  it('STORAGE_KEY 常量', function() {
    assert.equal(STORAGE_KEY, 'st_v3_app_theme');
  });
});
