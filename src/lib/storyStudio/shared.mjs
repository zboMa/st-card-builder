/**
 * Story Studio 共享状态与基础工具（拆自 browserApp）
 */

import {
  normalizeNovel,
  upsertCatalogEntry,
} from './state.mjs';
import {
  loadCatalog,
  saveCatalog,
  loadNovel,
  saveNovel,
  loadActiveNovelId,
  saveActiveNovelId,
} from './idb.mjs';
import { normalizeCharacterVersion } from './version.mjs';
import { DRAFTS_KEY, CURRENT_KEY } from '../card-builder/state.mjs';

export var state = {
  cardId: '',
  catalog: [],
  novel: null,
  status: '',
  busy: false,
};

export var ui = {
  ssBranchTreeOpen: false,
  ssBranchExpandedId: '',
  ssReadTocOpen: false,
  ssBranchPopoverDocHandler: null,
  /** 写作台当前选中的章节 id（切章前用来把 DOM 写回旧章） */
  writeChapterId: '',
};

export function $(id) {
  return document.getElementById(id);
}

export function setStatus(msg) {
  state.status = String(msg || '');
  ['ssManageStatus', 'ssGraphStatus', 'ssOutlineStatus', 'ssWriteStatus', 'ssReadStatus'].forEach(function(id) {
    var el = $(id);
    if (!el) return;
    el.textContent = state.status;
    if (id === 'ssManageStatus') {
      if (state.status) {
        el.hidden = false;
        el.style.display = '';
      } else {
        el.hidden = true;
      }
    }
  });
}

export function getCardId() {
  try {
    var id = localStorage.getItem('st_v3_builder_current_id');
    if (id) return id;
  } catch (e) { /* ignore */ }
  return state.cardId || 'default';
}

export function getCardSeed() {
  var charName = '';
  var charDesc = '';
  var wb = [];
  try {
    var nameEl = $('charName');
    var descEl = $('charDesc');
    if (nameEl) charName = nameEl.value || '';
    if (descEl) charDesc = descEl.value || '';
  } catch (e) { /* ignore */ }
  if (window.__getWorldbookEntries__) {
    try { wb = window.__getWorldbookEntries__() || []; } catch (e2) { wb = []; }
  }
  return { charName: charName, charDesc: charDesc, worldbookEntries: wb };
}

export function promptText(id, fallback) {
  if (window.__promptStore__ && window.__promptStore__.get) {
    var t = window.__promptStore__.get(id);
    if (t) return t;
  }
  return fallback || '';
}

export async function callAI(userContent, systemExtra, signal) {
  var apiUrlEl = $('apiUrl');
  var apiKeyEl = $('apiKey');
  var modelEl = $('modelSelect');
  if (!apiUrlEl || !modelEl || !modelEl.value) throw new Error('未配置 AI 模型（请先到「AI 配置」）');
  var messages = [];
  if (systemExtra) messages.push({ role: 'system', content: systemExtra });
  messages.push({ role: 'user', content: userContent });
  var res = await fetch(String(apiUrlEl.value).replace(/\/$/, '') + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (apiKeyEl ? apiKeyEl.value.trim() : ''),
    },
    body: JSON.stringify({ model: modelEl.value, messages: messages, temperature: 0.7 }),
    signal: signal,
  });
  if (!res.ok) throw new Error(res.status === 429 ? '429 限流' : 'HTTP ' + res.status);
  var data = await res.json();
  var text = data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : '';
  text = String(text || '').trim();
  if (!text) throw new Error('模型返回空内容');
  return text;
}

export function runTracked(meta, fn) {
  var center = window.__aiTaskCenter__;
  if (center && typeof center.run === 'function') return center.run(meta, fn);
  return fn({ signal: undefined, id: null });
}

export function isAbort(err) {
  if (window.__isAiAbortError__) return window.__isAiAbortError__(err);
  return !!(err && (err.name === 'AbortError' || /abort|取消/i.test(String(err.message || ''))));
}

export function getCharacterVersion() {
  try {
    var el = $('characterVersion');
    if (el && String(el.value || '').trim()) {
      return normalizeCharacterVersion(el.value);
    }
  } catch (e) { /* ignore */ }
  try {
    var id = localStorage.getItem(CURRENT_KEY);
    var drafts = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}') || {};
    var d = id && drafts[id];
    if (d && d.characterVersion) return normalizeCharacterVersion(d.characterVersion);
  } catch (e2) { /* ignore */ }
  return '1.0';
}

export async function mirrorStoryDocs(cardId, novel, catalog) {
  try {
    var mod = await import('../sync/storyMirror.mjs');
    if (catalog) await mod.mirrorCatalogToPouch(cardId, catalog);
    if (novel) {
      await mod.mirrorNovelToPouch(cardId, novel);
      await mod.mirrorActiveToPouch(cardId, novel.id);
    }
  } catch (e) {
    console.warn('[storyStudio] pouch mirror', e);
  }
}

export async function persistNovel() {
  if (!state.novel) return;
  var cardId = getCardId();
  state.novel.cardId = cardId;
  state.novel.updatedAt = Date.now();
  state.novel = normalizeNovel(state.novel);
  await saveNovel(cardId, state.novel.id, state.novel);
  state.catalog = upsertCatalogEntry(state.catalog, state.novel);
  await saveCatalog(cardId, state.catalog);
  await saveActiveNovelId(cardId, state.novel.id);
  await mirrorStoryDocs(cardId, state.novel, state.catalog);
}

export async function reloadCatalog() {
  var cardId = getCardId();
  state.cardId = cardId;
  // Story 与卡开包独立：进入创作时再拉云端目录
  try {
    var sync = await import('../sync/index.mjs');
    if (sync.isCloudEnabled && sync.isCloudEnabled()) {
      await sync.pullStoryCatalogToLocal(cardId);
    }
  } catch (e) {
    console.warn('[storyStudio] pull catalog', e);
  }
  state.catalog = await loadCatalog(cardId);
  var activeId = await loadActiveNovelId(cardId);
  if (activeId) {
    var raw = await loadNovelOrPull(cardId, activeId);
    state.novel = raw ? normalizeNovel(raw) : null;
  } else {
    state.novel = null;
  }
  if (!state.novel && state.catalog.length) {
    var first = state.catalog[0];
    var raw2 = await loadNovelOrPull(cardId, first.id);
    if (raw2) {
      state.novel = normalizeNovel(raw2);
      await saveActiveNovelId(cardId, state.novel.id);
    }
  }
}

export async function loadNovelOrPull(cardId, novelId) {
  var raw = await loadNovel(cardId, novelId);
  if (raw) return raw;
  try {
    var sync = await import('../sync/index.mjs');
    if (sync.isCloudEnabled && sync.isCloudEnabled()) {
      return await sync.pullStoryNovelToLocal(cardId, novelId);
    }
  } catch (e) {
    console.warn('[storyStudio] pull novel', e);
  }
  return null;
}

export function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
