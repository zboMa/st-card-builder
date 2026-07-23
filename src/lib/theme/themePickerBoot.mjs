import { APP_THEMES } from './themeCatalog.mjs';
import { applyTheme, getThemeId } from './themeBoot.mjs';

function renderSwatches(container) {
  if (!container) return;
  var cur = getThemeId();
  container.innerHTML = '';
  APP_THEMES.forEach(function(meta) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-swatch';
    btn.setAttribute('data-theme-id', meta.id);
    btn.setAttribute('aria-pressed', meta.id === cur ? 'true' : 'false');
    btn.setAttribute('aria-label', meta.label + '：' + meta.blurb);
    btn.title = meta.label + ' — ' + meta.blurb;

    var dot = document.createElement('span');
    dot.className = 'theme-swatch__dot';
    dot.style.background = meta.sample;
    dot.setAttribute('aria-hidden', 'true');

    var label = document.createElement('span');
    label.className = 'theme-swatch__label';
    label.textContent = meta.label;

    btn.appendChild(dot);
    btn.appendChild(label);
    container.appendChild(btn);
  });
}

function syncLead(leadEl) {
  if (!leadEl) return;
  var cur = getThemeId();
  for (var i = 0; i < APP_THEMES.length; i++) {
    if (APP_THEMES[i].id === cur) {
      leadEl.textContent = '当前：' + APP_THEMES[i].label + ' · ' + APP_THEMES[i].blurb;
      return;
    }
  }
}

function bindGrid(container, leadEl) {
  if (!container) return;
  container.addEventListener('click', function(e) {
    var btn = e.target.closest('.theme-swatch[data-theme-id]');
    if (!btn) return;
    var id = btn.getAttribute('data-theme-id');
    if (!id) return;
    applyTheme(id);
    container.querySelectorAll('.theme-swatch[data-theme-id]').forEach(function(el) {
      el.setAttribute('aria-pressed', el.getAttribute('data-theme-id') === id ? 'true' : 'false');
    });
    syncLead(leadEl);
  });
}

export function initThemePicker() {
  var grid = document.getElementById('themeSwatchGrid');
  var lead = document.getElementById('themeSwatchLead');
  if (!grid) return;
  renderSwatches(grid);
  syncLead(lead);
  bindGrid(grid, lead);
  window.addEventListener('app-theme-changed', function() {
    var cur = getThemeId();
    grid.querySelectorAll('.theme-swatch[data-theme-id]').forEach(function(el) {
      el.setAttribute('aria-pressed', el.getAttribute('data-theme-id') === cur ? 'true' : 'false');
    });
    syncLead(lead);
  });
}
