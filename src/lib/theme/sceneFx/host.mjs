import { getEffectiveTier } from '../themeSceneTier.mjs';

var canvas = null;
var ctx = null;
var mod = null;
var rafId = null;
var dpr = 1;
var W = 0;
var H = 0;

var LOADERS = {
  'sumi-ink': function() { return import('./sumiInk.mjs'); },
  'frost-shard': function() { return import('./frostShard.mjs'); },
  'ember-blaze': function() { return import('./emberBlaze.mjs'); },
  'bamboo-edge': function() { return import('./bambooEdge.mjs'); },
  'water-wave': function() { return import('./waterWave.mjs'); },
  'fresh-lime': function() { return import('./freshLime.mjs'); },
  'cloud-pavilion': function() { return import('./cloudPavilion.mjs'); },
  'morning-drizzle': function() { return import('./morningDrizzle.mjs'); },
};

function resize() {
  if (!canvas || !ctx) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (mod && mod.resize) mod.resize(W, H);
}

function stopLoop() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function loop() {
  if (mod && mod.tick) mod.tick();
  rafId = requestAnimationFrame(loop);
}

function startLoop() {
  stopLoop();
  rafId = requestAnimationFrame(loop);
}

async function destroyModule() {
  stopLoop();
  if (mod && mod.destroy) mod.destroy();
  mod = null;
}

async function syncModule() {
  await destroyModule();
  if (!canvas) return;

  var tier = getEffectiveTier();
  var scene = document.documentElement.getAttribute('data-app-scene') || 'none';
  if (tier !== 'immersive' || !scene || scene === 'none') {
    canvas.style.opacity = '0';
    canvas.style.display = 'none';
    return;
  }

  var loader = LOADERS[scene];
  if (!loader) {
    canvas.style.opacity = '0';
    canvas.style.display = 'none';
    return;
  }

  var pack = await loader();
  mod = pack.createSceneFx(ctx, canvas);
  canvas.style.display = '';
  resize();
  if (mod.mount) mod.mount();
  canvas.style.display = '';
  canvas.style.opacity = '1';
  startLoop();
  if (mod.playIntro) mod.playIntro();
}

/** @param {number} x @param {number} y @param {string} [kind] */
export function sceneFxBurst(x, y, kind) {
  if (!mod || !mod.burst) return;
  mod.burst(x, y, kind || 'splash');
}

export function initSceneFxHost() {
  canvas = document.getElementById('sceneFxCanvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  resize();
  syncModule();

  window.addEventListener('resize', resize);
  window.addEventListener('app-theme-changed', syncModule);
  window.addEventListener('scene-tier-changed', syncModule);
}

export function replaySceneIntro() {
  if (mod && mod.playIntro) mod.playIntro();
}
