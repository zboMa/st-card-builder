/**
 * 壳层精品场景主题契约（11 套 + 场景层）
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APP_THEMES,
  DEFAULT_THEME_ID,
  STORAGE_KEY,
  LEGACY_THEME_MAP,
  migrateThemeId,
  sceneIdForTheme,
} from '../src/lib/theme/themeCatalog.mjs';
import { readLayoutSources } from './helpers/uiSources.mjs';

var root = join(dirname(fileURLToPath(import.meta.url)), '..');
var themesPath = join(root, 'src/styles/tokens-themes.css');
var scenesPath = join(root, 'src/styles/theme/scenes.css');
var sidebarPath = join(root, 'src/components/AppSidebar.astro');

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

var SCENE_THEMES = [
  'sumi-ink', 'frost-shard', 'ember-blaze', 'bamboo-edge',
  'water-wave', 'fresh-lime', 'cloud-pavilion', 'morning-drizzle',
  'doom-carrion', 'moon-haze',
];

describe('app shell themes', function() {
  it('tokens-themes.css 存在', function() {
    assert.ok(existsSync(themesPath));
  });

  it('catalog 为 11 套主题', function() {
    assert.equal(APP_THEMES.length, 11);
    assert.deepEqual(
      APP_THEMES.map(function(t) { return t.id; }),
      ['nocturne', 'sumi-ink', 'frost-shard', 'ember-blaze', 'bamboo-edge',
        'water-wave', 'fresh-lime', 'cloud-pavilion', 'morning-drizzle',
        'doom-carrion', 'moon-haze'],
    );
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

  it('v1 → v2 迁移 map', function() {
    assert.equal(migrateThemeId('ink'), 'sumi-ink');
    assert.equal(migrateThemeId('frost'), 'frost-shard');
    assert.equal(migrateThemeId('jade'), 'bamboo-edge');
    assert.equal(migrateThemeId('rose'), 'nocturne');
    assert.equal(migrateThemeId('neon'), 'nocturne');
    assert.equal(migrateThemeId('unknown'), 'nocturne');
    assert.equal(migrateThemeId(''), 'nocturne');
    Object.keys(LEGACY_THEME_MAP).forEach(function(oldId) {
      assert.equal(migrateThemeId(oldId), LEGACY_THEME_MAP[oldId]);
    });
  });

  it('scene id：nocturne 无场景，其余与 theme id 对齐', function() {
    assert.equal(sceneIdForTheme('nocturne'), 'none');
    SCENE_THEMES.forEach(function(id) {
      assert.equal(sceneIdForTheme(id), id);
    });
    assert.equal(sceneIdForTheme('ink'), 'sumi-ink');
  });

  it('tokens.css 引入场景装饰层', function() {
    var css = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8');
    assert.match(css, /theme\/scenes\.css/);
    assert.ok(existsSync(scenesPath));
  });

  it('Layout 含 FOUC、data-app-scene 与 theme boot', function() {
    var layout = readLayoutSources(root);
    assert.match(layout, /st_v3_app_theme/);
    assert.match(layout, /data-app-theme/);
    assert.match(layout, /data-app-scene/);
    assert.match(layout, /themeBoot\.mjs/);
    assert.match(layout, /themePickerBoot\.mjs/);
    assert.match(layout, /ThemeGallery/);
    assert.match(layout, /doom-carrion/);
    assert.match(layout, /moon-haze/);
  });

  it('侧栏单行入口，无 v1 swatch 网格', function() {
    var sidebar = readFileSync(sidebarPath, 'utf8');
    assert.match(sidebar, /theme-entry/);
    assert.match(sidebar, /btnThemeGalleryOpen/);
    assert.doesNotMatch(sidebar, /theme-swatch/);
  });

  it('scene 层不得破坏移动端侧栏 fixed 抽屉', function() {
    var shared = readFileSync(join(root, 'src/styles/theme/scenes/_shared.css'), 'utf8');
    assert.match(shared, /@media \(max-width:\s*900px\)/);
    assert.match(shared, /\.app-sidebar[\s\S]*position:\s*fixed/);
    assert.doesNotMatch(shared, /\.app-shell\s*\{[^}]*z-index/);
    assert.match(shared, /assistant-panel[\s\S]*z-index:\s*8500/);

    var sceneDir = join(root, 'src/styles/theme/scenes');
    SCENE_THEMES.forEach(function(file) {
      var css = readFileSync(join(sceneDir, file + '.css'), 'utf8');
      assert.doesNotMatch(
        css,
        /\.app-sidebar\s*\{[^}]*position:\s*relative/,
        file + ' must not set .app-sidebar position:relative',
      );
    });
  });

  it('STORAGE_KEY 常量', function() {
    assert.equal(STORAGE_KEY, 'st_v3_app_theme');
  });
});
