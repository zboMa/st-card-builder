/**
 * Story Studio boot：首次进入 story-* 视图再加载 browserApp
 */
function isStoryView(view) {
  return String(view || '').indexOf('story-') === 0;
}

function currentAppView() {
  var active = document.querySelector('.app-view.is-active');
  return active ? active.getAttribute('data-view') || '' : '';
}

var booted = false;

export function bootStoryStudioWhenNeeded() {
  if (booted) return Promise.resolve();
  if (!isStoryView(currentAppView())) return Promise.resolve();
  booted = true;
  return import('../../lib/storyStudio/browserApp.mjs').then(function(mod) {
    if (typeof mod.initStoryStudio === 'function') mod.initStoryStudio();
  }).catch(function(err) {
    booted = false;
    console.error('[story] lazy boot failed', err);
  });
}

export function attachStoryStudioLazyBoot() {
  function tryBoot() {
    bootStoryStudioWhenNeeded();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryBoot);
  } else {
    tryBoot();
  }
  window.addEventListener('app-view-changed', tryBoot);
  window.addEventListener('hashchange', tryBoot);
}
