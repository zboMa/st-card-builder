import { APP_THEMES } from './themeCatalog.mjs';
import { applyTheme, getThemeId } from './themeBoot.mjs';
import { getUserSceneFxOn, setUserSceneFxOn } from './themeSceneTier.mjs';

var modalEl = null;
var originalId = null;
var selectedId = null;
var originalFxOn = null;
var pendingFxOn = null;

function renderCards(grid) {
  if (!grid) return;
  grid.innerHTML = '';
  APP_THEMES.forEach(function(meta) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-gallery-card';
    btn.setAttribute('data-theme-id', meta.id);

    var preview = document.createElement('span');
    preview.className = 'theme-gallery-card__preview ' + meta.previewClass;
    preview.setAttribute('aria-hidden', 'true');

    var body = document.createElement('span');
    body.className = 'theme-gallery-card__body';

    var titleRow = document.createElement('span');
    titleRow.className = 'theme-gallery-card__title';
    titleRow.textContent = meta.label;

    if (meta.tagline && meta.tagline !== '默认') {
      var tag = document.createElement('span');
      tag.className = 'theme-gallery-card__tag';
      tag.textContent = meta.tagline;
      titleRow.appendChild(tag);
    }

    var blurb = document.createElement('span');
    blurb.className = 'theme-gallery-card__blurb';
    blurb.textContent = meta.blurb;

    body.appendChild(titleRow);
    body.appendChild(blurb);
    btn.appendChild(preview);
    btn.appendChild(body);
    grid.appendChild(btn);
  });
}

function syncCardsSelection() {
  if (!modalEl) return;
  var pick = selectedId != null ? selectedId : getThemeId();
  modalEl.querySelectorAll('.theme-gallery-card[data-theme-id]').forEach(function(el) {
    el.setAttribute('aria-pressed', el.getAttribute('data-theme-id') === pick ? 'true' : 'false');
  });
}

function syncEntryRow() {
  var cur = getThemeId();
  for (var i = 0; i < APP_THEMES.length; i++) {
    if (APP_THEMES[i].id !== cur) continue;
    var meta = APP_THEMES[i];
    var label = document.getElementById('themeEntryLabel');
    var preview = document.getElementById('themeEntryPreview');
    var entry = document.getElementById('btnThemeGalleryOpen');
    if (label) label.textContent = meta.label;
    if (preview) {
      preview.className = 'theme-entry__preview ' + meta.previewClass;
    }
    if (entry) entry.setAttribute('aria-label', '外观：' + meta.label);
    return;
  }
}

function syncFxToggle() {
  var el = document.getElementById('themeGalleryFxToggle');
  if (!el) return;
  var on = pendingFxOn != null ? pendingFxOn : getUserSceneFxOn();
  el.checked = !!on;
}

function openGallery() {
  if (!modalEl) return;
  originalId = getThemeId();
  selectedId = originalId;
  originalFxOn = getUserSceneFxOn();
  pendingFxOn = originalFxOn;
  renderCards(modalEl.querySelector('#themeGalleryGrid'));
  syncCardsSelection();
  syncFxToggle();
  modalEl.hidden = false;
  modalEl.setAttribute('aria-hidden', 'false');
  document.body.classList.add('is-theme-gallery-open');
  var first = modalEl.querySelector('.theme-gallery-card[aria-pressed="true"]') ||
    modalEl.querySelector('.theme-gallery-card');
  if (first) first.focus();
}

function closeGallery(revert) {
  if (!modalEl) return;
  if (revert) {
    if (originalId != null) applyTheme(originalId);
    if (originalFxOn != null) setUserSceneFxOn(originalFxOn);
  }
  originalId = null;
  selectedId = null;
  originalFxOn = null;
  pendingFxOn = null;
  modalEl.hidden = true;
  modalEl.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('is-theme-gallery-open');
}

function bindModal() {
  modalEl = document.getElementById('themeGalleryModal');
  if (!modalEl) return;

  var grid = modalEl.querySelector('#themeGalleryGrid');
  var btnApply = modalEl.querySelector('#btnThemeGalleryApply');

  modalEl.querySelectorAll('[data-theme-gallery-close]').forEach(function(el) {
    el.addEventListener('click', function() {
      closeGallery(true);
    });
  });

  grid && grid.addEventListener('click', function(e) {
    var card = e.target.closest('.theme-gallery-card[data-theme-id]');
    if (!card) return;
    var id = card.getAttribute('data-theme-id');
    if (!id) return;
    selectedId = id;
    applyTheme(id);
    syncCardsSelection();
  });

  btnApply && btnApply.addEventListener('click', function() {
    if (selectedId) applyTheme(selectedId);
    if (pendingFxOn != null) setUserSceneFxOn(pendingFxOn);
    syncEntryRow();
    closeGallery(false);
  });

  var fxToggle = document.getElementById('themeGalleryFxToggle');
  fxToggle && fxToggle.addEventListener('change', function() {
    pendingFxOn = !!fxToggle.checked;
    setUserSceneFxOn(pendingFxOn);
  });

  document.addEventListener('keydown', function(e) {
    if (!modalEl || modalEl.hidden) return;
    if (e.key === 'Escape') {
      closeGallery(true);
      e.preventDefault();
    }
  });
}

export function initThemeGallery() {
  bindModal();
  syncEntryRow();
  window.addEventListener('app-theme-changed', syncEntryRow);

  var entry = document.getElementById('btnThemeGalleryOpen');
  if (entry) {
    entry.addEventListener('click', openGallery);
  }
}
