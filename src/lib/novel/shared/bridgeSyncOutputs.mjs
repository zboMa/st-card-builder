/**
 * 小说工坊助手桥接 + 产出同步
 */
import { createDefaultNovelState } from '../state.mjs';
import { splitIntoChapters } from '../chapters.mjs';
import { normalizeCharacterPatch } from '../../assistant/characterFields.mjs';
import { deepCopy } from '../../utils.mjs';
import {
  profileToCharacterFields,
  applyDraftsToWorldbook,
  profileToWorldbookDraft,
  entityPersonToCharacterFields,
  entityPersonToWorldbookDraft,
  styleToWorldbookDraft,
  syncEntitiesToWorldbook,
} from '../sync.mjs';
import { findEntityMatch, upsertEntity, projectEntitiesToLegacy, isEntityEnriched } from '../entityStore.mjs';
import {
  getAdultMode,
  setAdultMode,
  getNtlMode,
  setNtlMode,
  getNsfwFlavor,
  setNsfwFlavor,
  getNsfwFlavorItems,
  setNsfwFlavorItems,
  getNtlTabooTypes,
  setNtlTabooTypes,
  getNtlTabooItems,
  setNtlTabooItems,
  buildStatusBarNsfwDraftFromEntities,
  buildStatusBarNtlDraftFromEntities,
  setAdultWorldframe,
  suggestAdultWorldframe,
  resolveWorldframe,
  NSFW_FLAVOR_PRESETS,
  NTL_TABOO_TYPES,
  MAX_NSFW_FLAVOR_ITEMS,
} from '../nsfwSupport.mjs';

export function setCharacterFields(fields, $) {
  if (!fields) return;
  var norm = normalizeCharacterPatch(fields);
  fields = norm.fields;
  if (!Object.keys(fields).length) return;
  if (fields.charName != null && $('charName')) {
    $('charName').value = fields.charName;
    $('charName').dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (fields.wbName != null && $('wbName')) {
    $('wbName').value = fields.wbName;
    $('wbName').dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (fields.charDesc != null && $('charDesc')) {
    $('charDesc').value = fields.charDesc;
    $('charDesc').dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (fields.creatorNotes != null && $('creatorNotes')) {
    $('creatorNotes').value = fields.creatorNotes;
    $('creatorNotes').dispatchEvent(new Event('input', { bubbles: true }));
  }
  window.dispatchEvent(new Event('card-builder-data-changed'));
}

export function setGreetingFields(firstMes, altGreetings, $) {
  if (firstMes != null && $('firstMes')) {
    $('firstMes').value = String(firstMes);
    $('firstMes').dispatchEvent(new Event('input', { bubbles: true }));
  }
  window.__altGreetings__ = Array.isArray(altGreetings) ? altGreetings.slice() : [];
  if (typeof window.__renderAltGreetings__ === 'function') window.__renderAltGreetings__();
  window.dispatchEvent(new Event('card-builder-data-changed'));
}

export function applyRagOptionsFromUi(ctx, opts) {
  opts = opts || {};
  var state = ctx.state;
  if (!state.rag) state.rag = {};
  if (opts.enabled != null) state.rag.enabled = !!opts.enabled;
  if (opts.budget != null) state.rag.budget = Math.max(2000, Math.floor(Number(opts.budget) || 12000));
  ctx.save();
}

export function syncRagOptionsToAiPanel(ctx) {
  var state = ctx.state;
  var $ = ctx.$;
  if (!state.rag) return;
  try {
    var enableEl = $('assistantNovelRagEnable');
    var budgetEl = $('assistantNovelRagBudget');
    if (enableEl) enableEl.checked = state.rag.enabled !== false;
    if (budgetEl) budgetEl.value = String(state.rag.budget || 12000);
    localStorage.setItem('st_v3_builder_novel_rag', JSON.stringify({
      enabled: state.rag.enabled !== false,
      budget: state.rag.budget || 12000,
    }));
  } catch (e) { /* ignore */ }
}

/** 小说工坊 → 主卡同步（拆自 bridge） */
export function syncOutputs(ctx, opts) {
  var $ = ctx.$;
  var state = ctx.state;
  opts = opts || {};
  var target = opts.target || 'worldbook';
  if (opts.policy) state.conflictPolicy = opts.policy;
  var selectedOnly = opts.selected !== false;

  var findPersonEntityForChar = ctx.panels.characters
    ? ctx.panels.characters.findPersonEntityForChar
    : function() { return null; };

  function setFields(fields) {
    setCharacterFields(fields, $);
  }

  // 主角管道与世界书管道隔离：默认「人物同步」只进世界书。
  // 写入主角 Description 必须显式 asProtagonist:true（高级/危险操作，UI 默认不提供）。
  if ((target === 'character' || target === 'characters') && !opts.asProtagonist) {
    var redirected = syncOutputs(ctx, Object.assign({}, opts, {
      target: 'character_worldbook',
      asProtagonist: false,
    }));
    return Object.assign({}, redirected, {
      redirectedFrom: 'character',
      note: '人物档案已改走世界书管道（不再写入主角角色设定）',
    });
  }

  if ((target === 'character' || target === 'characters') && opts.asProtagonist) {
    function charCanSync(c) {
      if (!c) return false;
      if (c.profile) return true;
      var ent = findPersonEntityForChar(c);
      return !!(ent && String(ent.content || ent.summary || '').trim());
    }
    var sel = state.characters.filter(function(c) {
      return charCanSync(c) && (!selectedOnly || c.selected);
    });
    if (opts.ids || opts.names) {
      var want = {};
      (opts.ids || []).forEach(function(id) { want[id] = true; });
      var names = (opts.names || []).map(function(n) { return String(n).toLowerCase(); });
      sel = state.characters.filter(function(c) {
        if (!charCanSync(c)) return false;
        if (want[c.id]) return true;
        return names.indexOf(String(c.name || '').toLowerCase()) >= 0;
      });
    }
    if (!sel.length) throw new Error('没有可同步的人物（需档案或实体正文）');
    var curDesc = ($('charDesc') && $('charDesc').value) || '';
    var applied = 0;
    sel.forEach(function(c, idx) {
      var policyOne = idx === 0 ? state.conflictPolicy : 'merge';
      var descNow = idx === 0 ? curDesc : (($('charDesc') && $('charDesc').value) || '');
      var fieldOpts = { setCharName: idx === 0, omitNsfw: true };
      var r = c.profile
        ? profileToCharacterFields(c.profile, c.name, policyOne, descNow, fieldOpts)
        : entityPersonToCharacterFields(findPersonEntityForChar(c), policyOne, descNow, fieldOpts);
      if (r.skipped) return;
      setFields(r.fields);
      c.syncStatus = 'synced';
      var entSync = findPersonEntityForChar(c);
      if (entSync) entSync.syncStatus = 'synced';
      applied++;
    });
    ctx.save();
    ctx.renderAll();
    return {
      target: 'character',
      asProtagonist: true,
      applied: applied,
      policy: state.conflictPolicy,
      warning: '已写入主角角色设定（高级操作）；成人字段已剥离，人物正文仍建议以世界书为准',
    };
  }

  if (target === 'character_worldbook' || target === 'chars_wb') {
    if (!window.__getWorldbookEntries__ || !window.__setWorldbookEntries__) throw new Error('世界书环境未就绪');
    function charCanSyncWb(c) {
      if (!c) return false;
      if (c.profile) return true;
      var ent = findPersonEntityForChar(c);
      return !!(ent && String(ent.content || ent.summary || '').trim());
    }
    var selC = state.characters.filter(function(c) {
      return charCanSyncWb(c) && (!selectedOnly || c.selected);
    });
    if (opts.ids || opts.names) {
      var wantC = {};
      (opts.ids || []).forEach(function(id) { wantC[id] = true; });
      var namesC = (opts.names || []).map(function(n) { return String(n).toLowerCase(); });
      selC = state.characters.filter(function(c) {
        if (!charCanSyncWb(c)) return false;
        if (wantC[c.id]) return true;
        return namesC.indexOf(String(c.name || '').toLowerCase()) >= 0;
      });
    }
    if (!selC.length) throw new Error('没有可同步的人物（需档案或实体正文）');
    var drafts = selC.map(function(c) {
      if (c.profile) return profileToWorldbookDraft(c.profile, c.name);
      return entityPersonToWorldbookDraft(findPersonEntityForChar(c));
    }).filter(Boolean);
    var cur = window.__getWorldbookEntries__() || [];
    var r1 = applyDraftsToWorldbook(cur, drafts, state.conflictPolicy);
    if (r1.added || r1.updated) {
      window.__setWorldbookEntries__(r1.entries);
      window.dispatchEvent(new Event('worldbook-changed'));
      window.dispatchEvent(new Event('card-builder-data-changed'));
      if (state.conflictPolicy !== 'skip') {
        selC.forEach(function(c) {
          c.syncStatus = 'synced';
          var entW = findPersonEntityForChar(c);
          if (entW) entW.syncStatus = 'synced';
        });
      }
      ctx.save();
      ctx.renderAll();
    }
    return Object.assign({ target: 'character_worldbook' }, r1);
  }

  if (target === 'style') {
    if (!state.styleText || !state.styleText.trim()) throw new Error('暂无文风文本');
    if (!window.__getWorldbookEntries__ || !window.__setWorldbookEntries__) throw new Error('世界书环境未就绪');
    var styleDraft = styleToWorldbookDraft(state.styleText);
    var curStyleWb = window.__getWorldbookEntries__() || [];
    var rStyle = applyDraftsToWorldbook(curStyleWb, [styleDraft], state.conflictPolicy);
    if (rStyle.skipped && !rStyle.added && !rStyle.updated) {
      return { target: 'style', skipped: true, policy: state.conflictPolicy, comment: styleDraft.comment };
    }
    window.__setWorldbookEntries__(rStyle.entries);
    window.dispatchEvent(new Event('worldbook-changed'));
    window.dispatchEvent(new Event('card-builder-data-changed'));
    state.styleSyncStatus = 'synced';
    ctx.save();
    ctx.renderAll();
    return Object.assign({ target: 'style', comment: styleDraft.comment, policy: state.conflictPolicy }, rStyle);
  }

  if (target === 'entities' || target === 'knowledge') {
    if (!window.__getWorldbookEntries__ || !window.__setWorldbookEntries__) throw new Error('世界书环境未就绪');
    var ents = (state.entities || []).slice();
    if (opts.ids && opts.ids.length) {
      var wantE = {};
      opts.ids.forEach(function(id) { wantE[id] = true; });
      ents = ents.filter(function(e) { return wantE[e.id]; });
    }
    if (opts.types && opts.types.length) {
      ents = ents.filter(function(e) { return opts.types.indexOf(e.type) >= 0; });
    }
    if (selectedOnly) ents = ents.filter(function(e) { return e.selected !== false; });
    if (!ents.length) throw new Error('没有可同步的实体');

    // 实体同步：人物只进世界书，绝不写主角 Description
    var charApplied = 0;
    var personWbDrafts = [];
    var persons = ents.filter(function(e) { return e.type === 'person'; });
    persons.forEach(function(e) {
      var pd = entityPersonToWorldbookDraft(e);
      if (pd) personWbDrafts.push(pd);
    });

    var wbEnts = ents.filter(function(e) { return e.type !== 'person'; });
    var curEntWb = window.__getWorldbookEntries__() || [];
    var rEnt = syncEntitiesToWorldbook(curEntWb, wbEnts, state.conflictPolicy, { selectedOnly: false });
    if (personWbDrafts.length) {
      var rPersonWb = applyDraftsToWorldbook(rEnt.entries, personWbDrafts, state.conflictPolicy);
      rEnt.entries = rPersonWb.entries;
      rEnt.added += rPersonWb.added;
      rEnt.updated += rPersonWb.updated;
      rEnt.skipped += rPersonWb.skipped;
    }
    var wroteWb = !!(rEnt.added || rEnt.updated);
    if (wroteWb) {
      window.__setWorldbookEntries__(rEnt.entries);
      window.dispatchEvent(new Event('worldbook-changed'));
      window.dispatchEvent(new Event('card-builder-data-changed'));
    }
    if (wroteWb && state.conflictPolicy !== 'skip') {
      wbEnts.forEach(function(e) { e.syncStatus = 'synced'; });
      persons.forEach(function(e) {
        if (personWbDrafts.some(function(d) { return d && d.name === e.name; })) {
          e.syncStatus = 'synced';
        }
      });
    }
    ctx.save();
    ctx.renderAll();
    return Object.assign({
      target: target,
      policy: state.conflictPolicy,
      charApplied: charApplied,
      personWb: personWbDrafts.length,
    }, rEnt);
  }

  if (!window.__getWorldbookEntries__ || !window.__setWorldbookEntries__) throw new Error('世界书环境未就绪');
  var wbDrafts = (state.wbEntries || []).filter(function(e) {
    return selectedOnly ? e.selected !== false : true;
  });
  if (!wbDrafts.length) throw new Error('没有可同步的世界书草稿');
  var curWb = window.__getWorldbookEntries__() || [];
  var r2 = applyDraftsToWorldbook(curWb, wbDrafts, state.conflictPolicy);
  if (r2.added || r2.updated) {
    window.__setWorldbookEntries__(r2.entries);
    window.dispatchEvent(new Event('worldbook-changed'));
    window.dispatchEvent(new Event('card-builder-data-changed'));
    if (state.conflictPolicy !== 'skip') {
      wbDrafts.forEach(function(e) { e.syncStatus = 'synced'; });
    }
    ctx.save();
    ctx.renderAll();
  }
  return Object.assign({ target: 'worldbook', policy: state.conflictPolicy }, r2);
}

