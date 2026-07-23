/**
 * 场景算力档：L3 immersive / L2 scene / L0 none
 * 关特效 → L2 静态全覆盖，不是退回换色。
 */

export var SCENE_FX_KEY = 'st_v3_scene_fx';
export var FX_KEY_LEGACY = 'st_v3_fx_enabled';

/** @returns {boolean} */
export function getUserSceneFxOn() {
  try {
    var s = localStorage.getItem(SCENE_FX_KEY);
    if (s === null) s = localStorage.getItem(FX_KEY_LEGACY);
    if (s === null) {
      return !window.matchMedia('(max-width: 900px)').matches;
    }
    return s === '1';
  } catch (e) {
    return true;
  }
}

/** @param {boolean} on */
export function setUserSceneFxOn(on) {
  var v = on ? '1' : '0';
  try {
    localStorage.setItem(SCENE_FX_KEY, v);
    localStorage.setItem(FX_KEY_LEGACY, v);
  } catch (e) {}
  applySceneTier();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('scene-tier-changed', { detail: { fxOn: on } }));
  }
}

/** @returns {'none'|'scene'|'immersive'} */
export function getEffectiveTier() {
  if (typeof document === 'undefined') return 'none';
  var scene = document.documentElement.getAttribute('data-app-scene') || 'none';
  if (!scene || scene === 'none') return 'none';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'scene';
  if (!getUserSceneFxOn()) return 'scene';
  return 'immersive';
}

export function applySceneTier() {
  if (typeof document === 'undefined') return;
  var tier = getEffectiveTier();
  var fxOn = getUserSceneFxOn();
  document.documentElement.setAttribute('data-scene-tier', tier);
  document.documentElement.setAttribute('data-scene-fx', fxOn ? 'on' : 'off');
}

export function initSceneTier() {
  applySceneTier();
  try {
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', applySceneTier);
  } catch (e) {}
  window.addEventListener('app-theme-changed', applySceneTier);
}

/** @returns {boolean} 供 ParticleCanvas / GSAP 等 legacy 读取 */
export function isImmersiveFxEnabled() {
  return getEffectiveTier() === 'immersive';
}
