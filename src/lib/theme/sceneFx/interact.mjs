import { getEffectiveTier } from '../themeSceneTier.mjs';
import { sceneFxBurst } from './host.mjs';

var SELECTOR = [
  '.btn-primary',
  '.btn-inline',
  '.app-sidebar-item[data-view]',
  '.theme-gallery-card[data-theme-id]',
  '.theme-entry',
  '.btn-icon',
].join(',');

/** @type {Record<string, { default: string, primary: string }>} */
var BURST_KIND = {
  'sumi-ink': { default: 'splash', primary: 'seal' },
  'frost-shard': { default: 'crystal', primary: 'crystal' },
  'ember-blaze': { default: 'spark', primary: 'heat' },
  'bamboo-edge': { default: 'windcut', primary: 'windcut' },
  'water-wave': { default: 'ripple', primary: 'ripple' },
  'fresh-lime': { default: 'zest', primary: 'zest' },
  'cloud-pavilion': { default: 'puff', primary: 'gild' },
  'morning-drizzle': { default: 'raindrop', primary: 'raindrop' },
};

function onPointerDown(e) {
  if (getEffectiveTier() !== 'immersive') return;
  var scene = document.documentElement.getAttribute('data-app-scene');
  if (!scene || scene === 'none') return;

  var kinds = BURST_KIND[scene];
  if (!kinds) return;

  var t = e.target.closest(SELECTOR);
  if (!t) return;

  var kind = t.classList.contains('btn-primary') ? kinds.primary : kinds.default;
  sceneFxBurst(e.clientX, e.clientY, kind);
}

export function initSceneFxInteract() {
  document.addEventListener('pointerdown', onPointerDown, { passive: true });
}
