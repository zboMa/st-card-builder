/**
 * 场景算力档 + SceneFx 契约
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENE_FX_KEY } from '../src/lib/theme/themeSceneTier.mjs';
import { readLayoutSources } from './helpers/uiSources.mjs';

var root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('scene tier & fx', function() {
  it('themeSceneTier 模块存在', function() {
    assert.ok(existsSync(join(root, 'src/lib/theme/themeSceneTier.mjs')));
    assert.equal(SCENE_FX_KEY, 'st_v3_scene_fx');
  });

  it('SceneFx host + sumiInk 模块存在', function() {
    assert.ok(existsSync(join(root, 'src/lib/theme/sceneFx/host.mjs')));
    assert.ok(existsSync(join(root, 'src/lib/theme/sceneFx/sumiInk.mjs')));
    assert.ok(existsSync(join(root, 'src/lib/theme/sceneFx/interact.mjs')));
  });

  it('Layout 含 sceneFxCanvas 与 tier FOUC', function() {
    var layout = readLayoutSources(root);
    assert.match(layout, /sceneFxCanvas/);
    assert.match(layout, /data-scene-tier/);
    assert.match(layout, /data-scene-fx/);
    assert.match(layout, /initThemeSceneFx/);
    assert.match(layout, /st_v3_scene_fx/);
  });

  it('主题馆含场景特效开关', function() {
    var gallery = readFileSync(join(root, 'src/components/ThemeGallery.astro'), 'utf8');
    assert.match(gallery, /themeGalleryFxToggle/);
    assert.match(gallery, /场景特效/);
  });

  it('水墨 L2 含远山 SVG 与 chrome 规则', function() {
    var css = readFileSync(join(root, 'src/styles/theme/scenes/sumi-ink.css'), 'utf8');
    assert.match(css, /svg\+xml/);
    assert.match(css, /\.btn-primary/);
    assert.match(css, /panel-header/);
    assert.match(css, /data-scene-tier="immersive"/);
  });

  it('shared 含 sceneFxCanvas 且勿 app-shell z-index', function() {
    var css = readFileSync(join(root, 'src/styles/theme/scenes/_shared.css'), 'utf8');
    assert.match(css, /#sceneFxCanvas/);
    assert.doesNotMatch(css, /\.app-shell\s*\{[^}]*z-index/);
  });
});
