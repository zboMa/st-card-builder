import { getEffectiveTier } from '../themeSceneTier.mjs';

var canvasBlend = null;
var canvasAmbient = null;
var ctxBlend = null;
var ctxAmbient = null;
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
  'doom-carrion': function() { return import('./doomCarrion.mjs'); },
  'moon-haze': function() { return import('./moonHaze.mjs'); },
};

function resizeCanvas(canvas, ctx) {
  if (!canvas || !ctx) return;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resize() {
  if (!canvasBlend && !canvasAmbient) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  resizeCanvas(canvasBlend, ctxBlend);
  resizeCanvas(canvasAmbient, ctxAmbient);
  if (mod && mod.resize) mod.resize(W, H);
}

function clearCtx(ctx) {
  if (!ctx) return;
  var ref = canvasBlend || canvasAmbient;
  if (!ref) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ref.width, ref.height);
  ctx.restore();
}

function stopLoop() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  clearCtx(ctxBlend);
  clearCtx(ctxAmbient);
}

function loop() {
  if (mod) {
    if (mod.tickBlend && ctxBlend) {
      ctxBlend.save();
      ctxBlend.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctxBlend.clearRect(0, 0, W, H);
      mod.tickBlend();
      ctxBlend.restore();
    }
    if (mod.tickAmbient && ctxAmbient) {
      ctxAmbient.save();
      ctxAmbient.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctxAmbient.clearRect(0, 0, W, H);
      mod.tickAmbient();
      ctxAmbient.restore();
    }
    if (mod.tick && !mod.tickBlend && !mod.tickAmbient) {
      var legacyCtx = ctxAmbient || ctxBlend;
      if (legacyCtx) {
        legacyCtx.save();
        legacyCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        legacyCtx.clearRect(0, 0, W, H);
        mod.tick();
        legacyCtx.restore();
      }
    }
  }
  rafId = requestAnimationFrame(loop);
}

function startLoop() {
  stopLoop();
  rafId = requestAnimationFrame(loop);
}

function setCanvasVisible(on) {
  if (canvasBlend) {
    canvasBlend.style.display = on ? '' : 'none';
    canvasBlend.style.opacity = on ? '' : '0';
  }
  if (canvasAmbient) {
    canvasAmbient.style.display = on ? '' : 'none';
    canvasAmbient.style.opacity = on ? '' : '0';
  }
}

async function destroyModule() {
  stopLoop();
  if (mod && mod.destroy) mod.destroy();
  mod = null;
}

async function syncModule() {
  await destroyModule();
  if (!canvasBlend && !canvasAmbient) return;

  var tier = getEffectiveTier();
  var scene = document.documentElement.getAttribute('data-app-scene') || 'none';
  if (tier !== 'immersive' || !scene || scene === 'none') {
    setCanvasVisible(false);
    return;
  }

  var loader = LOADERS[scene];
  if (!loader) {
    setCanvasVisible(false);
    return;
  }

  var pack = await loader();
  mod = pack.createSceneFx({
    blend: ctxBlend,
    ambient: ctxAmbient,
    canvasBlend: canvasBlend,
    canvasAmbient: canvasAmbient,
  });
  resize();
  if (mod.mount) mod.mount();
  setCanvasVisible(true);
  startLoop();
  if (mod.playIntro) mod.playIntro();
}

/** @param {number} x @param {number} y @param {string} [kind] */
export function sceneFxBurst(x, y, kind) {
  if (!mod || !mod.burst) return;
  mod.burst(x, y, kind || 'splash');
}

export function initSceneFxHost() {
  canvasBlend = document.getElementById('sceneFxCanvasBlend');
  canvasAmbient = document.getElementById('sceneFxCanvasAmbient');
  if (!canvasBlend && !canvasAmbient) return;
  if (canvasBlend) ctxBlend = canvasBlend.getContext('2d');
  if (canvasAmbient) ctxAmbient = canvasAmbient.getContext('2d');
  resize();
  syncModule();

  window.addEventListener('resize', resize);
  window.addEventListener('app-theme-changed', syncModule);
  window.addEventListener('scene-tier-changed', syncModule);
}

export function replaySceneIntro() {
  if (mod && mod.playIntro) mod.playIntro();
}
