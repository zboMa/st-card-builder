/**
 * 小说工坊 boot：首次进入 novel-* 视图再加载 browserApp（减首屏 chunk）
 */
function isNovelView(view) {
  var v = String(view || '').trim();
  if (!v) return false;
  return v === 'novel-source' || v.indexOf('novel-') === 0;
}

function currentAppView() {
  var active = document.querySelector('.app-view.is-active');
  return active ? active.getAttribute('data-view') || '' : '';
}

var booted = false;
var bootPromise = null;

export function bootNovelWorkshopWhenNeeded() {
  if (booted) return bootPromise || Promise.resolve();
  var view = currentAppView();
  if (!isNovelView(view)) return Promise.resolve();
  booted = true;
  bootPromise = import('../../lib/novel/browserApp.mjs').then(function(mod) {
    mod.initNovelWorkshop();
  }).catch(function(err) {
    booted = false;
    bootPromise = null;
    console.error('[novel] lazy boot failed', err);
    throw err;
  });
  return bootPromise;
}

export function attachNovelWorkshopLazyBoot() {
  function tryBoot() {
    bootNovelWorkshopWhenNeeded().catch(function() { /* logged */ });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryBoot);
  } else {
    tryBoot();
  }
  window.addEventListener('app-view-changed', tryBoot);
  window.addEventListener('hashchange', tryBoot);
}
