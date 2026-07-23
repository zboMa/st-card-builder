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

var SCENE_FX_MODULES = {
  'sumi-ink': 'sumiInk.mjs',
  'frost-shard': 'frostShard.mjs',
  'ember-blaze': 'emberBlaze.mjs',
  'bamboo-edge': 'bambooEdge.mjs',
  'water-wave': 'waterWave.mjs',
  'fresh-lime': 'freshLime.mjs',
  'cloud-pavilion': 'cloudPavilion.mjs',
  'morning-drizzle': 'morningDrizzle.mjs',
};

var SCENE_CSS = [
  'sumi-ink', 'frost-shard', 'ember-blaze', 'bamboo-edge',
  'water-wave', 'fresh-lime', 'cloud-pavilion', 'morning-drizzle',
];

describe('scene tier & fx', function() {
  it('themeSceneTier 模块存在', function() {
    assert.ok(existsSync(join(root, 'src/lib/theme/themeSceneTier.mjs')));
    assert.equal(SCENE_FX_KEY, 'st_v3_scene_fx');
  });

  it('SceneFx host + 全部 scene 模块存在', function() {
    assert.ok(existsSync(join(root, 'src/lib/theme/sceneFx/host.mjs')));
    assert.ok(existsSync(join(root, 'src/lib/theme/sceneFx/interact.mjs')));
    Object.keys(SCENE_FX_MODULES).forEach(function(scene) {
      assert.ok(
        existsSync(join(root, 'src/lib/theme/sceneFx', SCENE_FX_MODULES[scene])),
        scene + ' fx module',
      );
    });
  });

  it('host.mjs 注册全部 scene loader', function() {
    var host = readFileSync(join(root, 'src/lib/theme/sceneFx/host.mjs'), 'utf8');
    Object.keys(SCENE_FX_MODULES).forEach(function(scene) {
      assert.match(host, new RegExp("'" + scene + "'"), scene + ' loader');
    });
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

  it('各 scene L2 含 SVG/chrome 规则', function() {
    var sceneDir = join(root, 'src/styles/theme/scenes');
    SCENE_CSS.forEach(function(id) {
      var css = readFileSync(join(sceneDir, id + '.css'), 'utf8');
      assert.match(css, /svg\+xml|svg%3E/, id + ' signature svg');
      assert.match(css, /\.btn-primary/, id + ' btn-primary');
      assert.match(css, /panel-header/, id + ' panel-header');
      assert.match(css, /data-scene-tier="immersive"/, id + ' immersive tier');
    });
  });

  it('shared 含 sceneFxCanvas 且勿 app-shell z-index', function() {
    var css = readFileSync(join(root, 'src/styles/theme/scenes/_shared.css'), 'utf8');
    assert.match(css, /#sceneFxCanvas/);
    assert.doesNotMatch(css, /\.app-shell\s*\{[^}]*z-index/);
    SCENE_CSS.forEach(function(id) {
      assert.match(css, new RegExp('data-app-scene="' + id + '"\\]\\[data-scene-tier="immersive"\\] #sceneFxCanvas'));
    });
  });
});
