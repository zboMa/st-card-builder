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

function onPointerDown(e) {
  if (getEffectiveTier() !== 'immersive') return;
  var scene = document.documentElement.getAttribute('data-app-scene');
  if (scene !== 'sumi-ink') return;

  var t = e.target.closest(SELECTOR);
  if (!t) return;

  var kind = 'splash';
  if (t.classList.contains('btn-primary')) kind = 'seal';
  sceneFxBurst(e.clientX, e.clientY, kind);
}

export function initSceneFxInteract() {
  document.addEventListener('pointerdown', onPointerDown, { passive: true });
}
