/**
 * 世界书面板：渲染、绑定、AI 抽取/扩展、搜索/筛选、新建/编辑/同步
 */
import { WB_FOCUS_OPTIONS } from '../state.mjs';
import { buildExtractShards, estimateExtractCalls } from '../chapters.mjs';
import { strategyLabelZh } from '../../utils.mjs';
import { buildRecallPayload, DEFAULT_EXPAND_BUDGET } from '../recall.mjs';
import {
  getAdultMode,
  getNtlMode,
  ADULT_RAG_BOOST_TERMS,
  NTL_RAG_BOOST_TERMS,
  mergeAdultAttrs,
  buildModeHintBlocks,
  buildAdultContextDigests,
  buildContentModeFlags,
} from '../nsfwSupport.mjs';
import { findEntityMatch, upsertEntity, projectEntitiesToLegacy, isEntityEnriched, ingestLegacyIntoEntities } from '../entityStore.mjs';
import { applyDraftsToWorldbook } from '../sync.mjs';
import { escapeHtml, truncatePreviewLine, parseJsonLoose, normalizeNameList } from '../../utils.mjs';

export { normalizeNameList };

var ENTITY_TYPE_ZH = {
  person: '人物',
  faction: '势力',
  location: '地点',
  item: '物品',
  event: '事件',
  lore: '设定',
  nsfw: 'NSFW',
};

function wbCategoryToEntityType(cat) {
  var c = String(cat || 'setting');
  if (c === 'faction' || c === 'location' || c === 'item' || c === 'event' || c === 'nsfw') return c;
  return 'lore';
}

/** 已抽取世界书条目摘要，供下一步分片注入参考 */
export function formatPriorWbExtractRef(entries) {
  if (!entries || !entries.length) return '';
  var lines = entries.map(function(e) {
    return '- [' + (e.category || 'setting') + '] ' + e.name + ': ' + String(e.content || '').substring(0, 140);
  }).join('\n');
  return '\n【已抽取条目（勿重复同名；可补充完善 content/keys）】\n' + lines;
}

/** 合并单条抽取：同名保留更长 content，合并 keys */
export function mergeWbExtractEntry(all, entry) {
  if (!entry || !entry.name) return;
  var cat = String(entry.category || 'setting');
  if (cat === 'character' || cat === 'relation') return;
  var name = String(entry.name).trim();
  if (!name) return;
  var keys = normalizeNameList(name, entry.keys);
  if (!keys.length) keys = [name];
  var key = cat + '::' + name;
  var found = null;
  for (var i = 0; i < all.length; i++) {
    var e = all[i];
    if ((e.category || 'setting') + '::' + e.name === key) { found = e; break; }
  }
  if (!found) {
    all.push({
      category: cat,
      name: name,
      content: entry.content || '',
      keys: keys,
      layer: entry.layer,
      attrs: entry.attrs && typeof entry.attrs === 'object' ? Object.assign({}, entry.attrs) : undefined,
    });
    return;
  }
  if (String(entry.content || '').length > String(found.content || '').length) {
    found.content = entry.content;
  }
  found.keys = Array.from(new Set((found.keys || []).concat(keys)));
  if (entry.layer) found.layer = entry.layer;
  if (entry.attrs && typeof entry.attrs === 'object') {
    found.attrs = Object.assign({}, found.attrs || {}, entry.attrs);
    if (entry.attrs.adult || (found.attrs && found.attrs.adult)) {
      found.attrs.adult = mergeAdultAttrs(found.attrs.adult, entry.attrs.adult);
    }
  }
}

/** 草稿列表条目形态（抽取过程中逐步预览用） */
function toWbDraftEntry(e, prev) {
  var cat = e.category || 'setting';
  var name = e.name;
  var keys = normalizeNameList(name, e.keys);
  if (!keys.length) keys = [name];
  return {
    category: cat,
    name: name,
    content: e.content || '',
    keys: keys,
    layer: e.layer || (cat === 'setting' || cat === 'worldview' ? 'blue' : 'green'),
    comment: '[小说' + cat + '] ' + name,
    selected: prev && prev.selected != null ? prev.selected : true,
    syncStatus: (prev && prev.syncStatus) || 'unsynced',
    strategy: (e.layer === 'blue' || cat === 'setting' || cat === 'worldview') ? 'constant' : 'selective',
    attrs: e.attrs || (prev && prev.attrs) || undefined,
  };
}

export function registerWorldbook(ctx) {
  var panel = {};

  // ---- 渲染辅助 ----

  panel.renderStrategyTag = function(strategy) {
    var s = strategy === 'constant' ? 'constant' : 'selective';
    var cls = s === 'constant' ? 'is-constant' : 'is-selective';
    return '<span class="wb-strategy-tag ' + cls + '">'
      + '<span class="wb-strategy-dot" aria-hidden="true"></span>'
      + escapeHtml(strategyLabelZh(s))
      + '</span>';
  };

  panel.renderWbFocus = function() {
    var state = ctx.state;
    var $ = ctx.$;
    var box = $('novelWbFocusTags');
    if (!box) return;
    box.innerHTML = WB_FOCUS_OPTIONS.map(function(opt) {
      var active = (state.wbFocus || []).indexOf(opt.id) >= 0;
      return '<button type="button" class="novel-focus-tag' + (active ? ' active' : '') + '" data-wb-focus="' + opt.id + '">' + opt.label + '</button>';
    }).join('');
    box.querySelectorAll('[data-wb-focus]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-wb-focus');
        var idx = (state.wbFocus || []).indexOf(id);
        if (idx >= 0) state.wbFocus.splice(idx, 1);
        else state.wbFocus.push(id);
        ctx.save();
        panel.renderWbFocus();
      });
    });
  };

  panel.renderWbEditorFields = function(index, entry, isNew) {
    var e = entry || {};
    var strategy = e.strategy || 'selective';
    return '<div class="novel-wb-inline" data-wb-editor="' + index + '">'
      + '<div class="form-group"><label>标题</label>'
      + '<input type="text" data-field="name" value="' + escapeHtml(e.name || '') + '" placeholder="条目标题" /></div>'
      + '<div class="form-group"><label>触发词（逗号分隔，空则常驻更合适）</label>'
      + '<input type="text" data-field="keys" value="' + escapeHtml((e.keys || []).join(', ')) + '" /></div>'
      + '<div class="form-group"><label>内容</label>'
      + '<textarea data-field="content" rows="8">' + escapeHtml(e.content || '') + '</textarea></div>'
      + '<div class="form-group"><label>触发策略</label>'
      + '<select data-field="strategy">'
      + '<option value="constant"' + (strategy === 'constant' ? ' selected' : '') + '>常驻</option>'
      + '<option value="selective"' + (strategy === 'selective' ? ' selected' : '') + '>可选</option>'
      + '</select></div>'
      + '</div>';
  };

  panel.readWbInlineEditor = function(root) {
    if (!root) return null;
    function val(f) {
      var el = root.querySelector('[data-field="' + f + '"]');
      return el ? el.value : '';
    }
    var name = val('name').trim();
    var keys = val('keys').split(/[,，]/).map(function(k) { return k.trim(); }).filter(Boolean);
    var strategy = val('strategy') || 'selective';
    return {
      name: name,
      content: val('content'),
      keys: keys,
      strategy: strategy,
      layer: strategy === 'constant' ? 'blue' : 'green',
    };
  };

  panel.openWbEditModal = function(index, entry, isNew) {
    var $ = ctx.$;
    var titleEl = $('novelModalWbTitle');
    var bodyEl = $('novelModalWbBody');
    var saveBtn = $('btnNovelWbModalSave');
    if (!bodyEl) return;
    if (titleEl) titleEl.textContent = isNew ? '新建世界书条目' : '编辑世界书条目';
    if (saveBtn) saveBtn.textContent = isNew ? '保存新条目' : '保存';
    bodyEl.innerHTML = panel.renderWbEditorFields(index, entry, isNew);
    ctx.openNovelModal('novelModalWb');
    setTimeout(function() {
      var input = bodyEl.querySelector('[data-field="name"]');
      if (input) input.focus();
    }, 0);
  };

  panel.editWbEntry = function(index) {
    var state = ctx.state;
    var es = ctx.editState;
    if (es.editingWbIndex === index && !es.isCreatingWbEntry) {
      ctx.closeNovelModal('novelModalWb');
      return;
    }
    es.editingWbIndex = index;
    es.isCreatingWbEntry = false;
    panel.openWbEditModal(index, state.wbEntries[index] || {}, false);
  };

  panel.saveWbInline = function(index) {
    var state = ctx.state;
    var $ = ctx.$;
    var root = document.querySelector('[data-wb-editor="' + index + '"]');
    var patch = panel.readWbInlineEditor(root);
    if (!patch || !patch.content.trim()) return alert('内容不能为空');
    var saved;
    if (index < 0) {
      var cat = 'setting';
      saved = {
        category: cat,
        name: patch.name || '未命名',
        content: patch.content,
        keys: patch.keys.length ? patch.keys : [patch.name || '未命名'],
        layer: patch.layer,
        comment: '[小说' + cat + '] ' + (patch.name || '未命名'),
        selected: true,
        syncStatus: 'unsynced',
        strategy: patch.strategy,
      };
      state.wbEntries.push(saved);
      ctx.editState.isCreatingWbEntry = false;
    } else {
      var e = state.wbEntries[index];
      if (!e) return;
      e.name = patch.name || e.name;
      e.content = patch.content;
      e.keys = patch.keys.length ? patch.keys : [e.name];
      e.strategy = patch.strategy;
      e.layer = patch.layer;
      e.comment = '[小说' + (e.category || 'setting') + '] ' + e.name;
      e.syncStatus = e.syncStatus === 'synced' ? 'dirty' : (e.syncStatus || 'unsynced');
      saved = e;
    }
    if (saved) {
      if (!state.entities) state.entities = [];
      var entType = wbCategoryToEntityType(saved.category);
      var attrs = {};
      if (entType === 'lore' && saved.category) attrs.aspect = saved.category;
      upsertEntity(state.entities, {
        type: entType,
        name: saved.name,
        aliases: [],
        summary: String(saved.content || '').slice(0, 120),
        content: saved.content,
        keys: saved.keys,
        layer: saved.layer,
        attrs: attrs,
      }, { source: 'manual' });
      projectEntitiesToLegacy(state);
    }
    ctx.editState.editingWbIndex = -1;
    ctx.closeNovelModal('novelModalWb');
    ctx.save();
    ctx.renderAll();
    if (ctx.setStatus) ctx.setStatus('novelWbStatus', '已保存条目');
  };

  // ---- 主渲染 ----

  panel.render = function() {
    var state = ctx.state;
    var $ = ctx.$;
    var es = ctx.editState;
    var modeEl = $('novelWbShardMode');
    var chunk = $('novelWbChunkSize');
    var perCh = $('novelWbChaptersPerShard');
    var policy = $('novelWbConflictPolicy');
    var typeEl = $('novelWbTypeFilter');
    if (modeEl) modeEl.value = state.wbShardMode === 'chapters' ? 'chapters' : 'chars';
    if (chunk) chunk.value = String(state.wbChunkSize || 8000);
    if (perCh) perCh.value = String(state.wbChaptersPerShard || 1);
    if (ctx.syncShardModeUi) ctx.syncShardModeUi('novelWb', state.wbShardMode);
    if (policy) policy.value = state.conflictPolicy || 'merge';
    if (typeEl && document.activeElement !== typeEl) typeEl.value = es.novelWbTypeFilter || '';
    panel.renderWbFocus();

    var searchInput = $('novelWbSearchInput');
    var searchClear = $('novelWbSearchClear');
    if (searchInput && searchInput.value !== es.novelWbSearchQuery) {
      if (document.activeElement !== searchInput) searchInput.value = es.novelWbSearchQuery;
    }
    if (searchClear) searchClear.style.display = es.novelWbSearchQuery ? '' : 'none';

    var prev = $('novelWbPreview');
    if (!prev) return;
    var q = String(es.novelWbSearchQuery || '').trim().toLowerCase();
    if (!(state.wbEntries || []).length) {
      prev.innerHTML = '<div class="novel-status-text">暂无条目。请先「小说分析」，或 AI 抽取 / 新建。</div>';
      return;
    }

    var syncBadge = ctx.panels.characters ? ctx.panels.characters.syncBadge : function(s) {
      return '<span class="novel-sync-badge ' + (s || 'unsynced') + '">' + (s || '未同步') + '</span>';
    };

    state.wbEntries.forEach(function(e, i) {
      if (es.novelWbTypeFilter && (e.category || '') !== es.novelWbTypeFilter) return;
      var hay = ((e.name || '') + ' ' + (e.comment || '') + ' ' + (e.keys || []).join(' ') + ' ' + (e.content || '')).toLowerCase();
      if (q && hay.indexOf(q) < 0) return;
      var strategyBadge = panel.renderStrategyTag(e.strategy);
      var needExpand = ctx.isUnexpandedWbContent(e.content);
      var ent = e.id
        ? (state.entities || []).find(function(x) { return x.id === e.id; })
        : findEntityMatch(state.entities, e.name, []);
      var enriched = ent ? isEntityEnriched(ent, !!state.strictQuality, getAdultMode(state)) : !needExpand;
      var previewLine = truncatePreviewLine(e.content);
      html += '<div class="entry-item fade-in" data-wb-index="' + i + '">'
        + '<div class="entry-item-header">'
        + '<input type="checkbox" data-wb-sel="' + i + '"' + (e.selected !== false ? ' checked' : '')
        + ' onclick="event.stopPropagation()" />'
        + '<div class="entry-info">'
        + '<div class="entry-info-title-row"><button type="button" class="novel-list-title" data-wb-edit="' + i + '" title="编辑条目">'
        + escapeHtml(e.name || e.comment || '未命名') + '</button>'
        + strategyBadge + syncBadge(e.syncStatus)
        + (enriched ? '' : ' <span class="novel-sync-badge unsynced">待丰满</span>')
        + '</div>'
        + (previewLine ? '<p class="entry-preview-line">' + escapeHtml(previewLine) + '</p>' : '')
        + '<p class="entry-meta-line">' + escapeHtml(e.category || '')
        + ' · ' + String(e.content || '').length + ' 字'
        + ((e.keys || []).length ? ' · 触发词 ' + escapeHtml((e.keys || []).slice(0, 4).join(', ')) : '')
        + '</p>'
        + '</div>'
        + '<div class="entry-actions">'
        + (ent
          ? ctx.iconBtn(
            'data-wb-enrich="' + escapeHtml(ent.id) + '"',
            '✦',
            enriched ? '重新丰满' : 'AI 丰满',
            enriched ? '' : 'btn-ai-expand'
          )
          : ctx.iconBtn(
            'data-wb-expand="' + i + '"',
            '✦',
            needExpand ? 'AI 扩展（未扩展）' : 'AI 重写',
            needExpand ? 'btn-ai-expand' : ''
          ))
        + ctx.iconBtn('data-wb-edit="' + i + '"', '✎', '编辑')
        + ctx.iconBtn('data-wb-sync="' + i + '"', '⇢', '同步到主世界书')
        + ctx.iconBtn('data-wb-del="' + i + '"', '×', '删除', 'is-danger')
        + '</div></div>'
        + '</div>';
    });
    prev.innerHTML = html || '<div class="novel-status-text">无匹配条目</div>';

    prev.querySelectorAll('[data-wb-sel]').forEach(function(cb) {
      cb.addEventListener('change', function() {
        var i = Number(cb.getAttribute('data-wb-sel'));
        if (state.wbEntries[i]) {
          state.wbEntries[i].selected = cb.checked;
          var ent = state.wbEntries[i].id
            ? (state.entities || []).find(function(x) { return x.id === state.wbEntries[i].id; })
            : findEntityMatch(state.entities, state.wbEntries[i].name, []);
          if (ent) ent.selected = cb.checked;
        }
        ctx.save();
      });
    });
    prev.querySelectorAll('[data-wb-edit]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        panel.editWbEntry(Number(btn.getAttribute('data-wb-edit')));
      });
    });
    prev.querySelectorAll('[data-wb-enrich]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var ana = ctx.panels.analyze;
        if (!ana) return;
        ana.runAnalyzeEnrich({ ids: [btn.getAttribute('data-wb-enrich')] }).catch(function(err) {
          if (!ctx.isTrackedAbort(err)) alert('丰满失败: ' + (err.message || err));
        });
      });
    });
    prev.querySelectorAll('[data-wb-expand]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        panel.expandWbEntry(Number(btn.getAttribute('data-wb-expand')));
      });
    });
    prev.querySelectorAll('[data-wb-sync]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var i = Number(btn.getAttribute('data-wb-sync'));
        var entry = state.wbEntries[i];
        if (!entry) return;
        if (!window.__getWorldbookEntries__ || !window.__setWorldbookEntries__) {
          return alert('世界书环境未就绪');
        }
        var cur = window.__getWorldbookEntries__() || [];
        var r = applyDraftsToWorldbook(cur, [entry], state.conflictPolicy);
        window.__setWorldbookEntries__(r.entries);
        window.dispatchEvent(new Event('worldbook-changed'));
        window.dispatchEvent(new Event('card-builder-data-changed'));
        entry.syncStatus = 'synced';
        ctx.save();
        ctx.renderAll();
        if (ctx.setStatus) ctx.setStatus('novelWbStatus', '已同步「' + (entry.name || '') + '」：新增 ' + r.added + ' / 更新 ' + r.updated + ' / 跳过 ' + r.skipped);
      });
    });
    prev.querySelectorAll('[data-wb-del]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (!confirm('确认删除该世界书条目？')) return;
        var i = Number(btn.getAttribute('data-wb-del'));
        var entry = state.wbEntries[i];
        var entId = entry && entry.id;
        if (!entId && entry) {
          var hit = findEntityMatch(state.entities, entry.name, []);
          if (hit) entId = hit.id;
        }
        state.wbEntries.splice(i, 1);
        if (entId) {
          state.entities = (state.entities || []).filter(function(x) { return x.id !== entId; });
          state.relations = (state.relations || []).filter(function(r) {
            return r.fromId !== entId && r.toId !== entId;
          });
        }
        if (ctx.editState.editingWbIndex === i) ctx.closeNovelModal('novelModalWb');
        else if (ctx.editState.editingWbIndex > i) ctx.editState.editingWbIndex--;
        ctx.save();
        ctx.renderAll();
      });
    });
  };

  // ---- 事件绑定 ----

  panel.bind = function() {
    var state = ctx.state;
    var $ = ctx.$;
    var es = ctx.editState;

    var wbMode = $('novelWbShardMode');
    if (wbMode) wbMode.addEventListener('change', function() {
      state.wbShardMode = wbMode.value === 'chapters' ? 'chapters' : 'chars';
      if (ctx.syncShardModeUi) ctx.syncShardModeUi('novelWb', state.wbShardMode);
      ctx.save();
      if (ctx.updateExtractCallEstimates) ctx.updateExtractCallEstimates();
    });
    var wbChunk = $('novelWbChunkSize');
    if (wbChunk) wbChunk.addEventListener('change', function() {
      state.wbChunkSize = parseInt(wbChunk.value, 10) || 8000;
      ctx.save();
      if (ctx.updateExtractCallEstimates) ctx.updateExtractCallEstimates();
    });
    var wbPer = $('novelWbChaptersPerShard');
    if (wbPer) {
      wbPer.addEventListener('change', function() {
        state.wbChaptersPerShard = Math.max(1, Math.floor(parseInt(wbPer.value, 10) || 1));
        wbPer.value = String(state.wbChaptersPerShard);
        ctx.save();
        if (ctx.updateExtractCallEstimates) ctx.updateExtractCallEstimates();
      });
      wbPer.addEventListener('input', function() {
        state.wbChaptersPerShard = Math.max(1, Math.floor(parseInt(wbPer.value, 10) || 1));
        if (ctx.updateExtractCallEstimates) ctx.updateExtractCallEstimates();
      });
    }
    var wbPolicy = $('novelWbConflictPolicy');
    if (wbPolicy) wbPolicy.addEventListener('change', function() {
      state.conflictPolicy = wbPolicy.value;
      ctx.save();
      if (ctx.panels.characters) ctx.panels.characters.render();
      if (ctx.panels.style) ctx.panels.style.render();
    });

    var typeEl = $('novelWbTypeFilter');
    if (typeEl) typeEl.addEventListener('change', function() {
      es.novelWbTypeFilter = typeEl.value || '';
      panel.render();
    });

    var searchInput = $('novelWbSearchInput');
    var searchClear = $('novelWbSearchClear');
    if (searchInput) {
      searchInput.addEventListener('input', function() {
        es.novelWbSearchQuery = searchInput.value || '';
        panel.render();
      });
    }
    if (searchClear) searchClear.addEventListener('click', function() {
      es.novelWbSearchQuery = '';
      if (searchInput) searchInput.value = '';
      panel.render();
    });

    var createBtn = $('btnWbCreateEntry');
    if (createBtn) createBtn.addEventListener('click', function() {
      if (es.isCreatingWbEntry) {
        ctx.closeNovelModal('novelModalWb');
        return;
      }
      es.isCreatingWbEntry = true;
      es.editingWbIndex = -1;
      panel.openWbEditModal(-1, { name: '', content: '', keys: [], strategy: 'selective' }, true);
    });

    var wbSaveBtn = $('btnNovelWbModalSave');
    if (wbSaveBtn) {
      wbSaveBtn.addEventListener('click', function() {
        panel.saveWbInline(es.isCreatingWbEntry ? -1 : es.editingWbIndex);
      });
    }

    var extractBtn = $('btnWbExtract');
    if (extractBtn) extractBtn.addEventListener('click', async function() {
      if (ctx.busyFlags.wbExtract) return;
      try {
        await panel.runExtractWorldbook();
      } catch (e) {
        if (!ctx.isTrackedAbort(e)) {
          alert('抽取失败: ' + e.message);
          if (ctx.setStatus) ctx.setStatus('novelWbStatus', '抽取失败');
        }
      }
    });

    var enrichWb = $('btnWbEnrichSelected');
    if (enrichWb) enrichWb.addEventListener('click', async function() {
      var ids = (state.wbEntries || []).filter(function(e) { return e.selected !== false; }).map(function(e) {
        if (e.id) return e.id;
        var hit = findEntityMatch(state.entities, e.name, []);
        return hit ? hit.id : '';
      }).filter(Boolean);
      if (!ids.length) return alert('请先勾选已有实体的条目（建议先跑小说分析）');
      var ana = ctx.panels.analyze;
      if (!ana) return;
      try {
        await ana.runAnalyzeEnrich({ ids: ids });
      } catch (e) {
        if (!ctx.isTrackedAbort(e)) alert('丰满失败: ' + (e.message || e));
      }
    });

    var clear = $('btnWbClear');
    if (clear) clear.addEventListener('click', function() {
      if (!confirm('清空世界书条目（非人物实体）？')) return;
      state.wbEntries = [];
      state.entities = (state.entities || []).filter(function(e) { return e.type === 'person'; });
      state.relations = (state.relations || []).filter(function(r) {
        var ids = {};
        (state.entities || []).forEach(function(e) { ids[e.id] = true; });
        return ids[r.fromId] && ids[r.toId];
      });
      es.editingWbIndex = -1;
      es.isCreatingWbEntry = false;
      ctx.save();
      ctx.renderAll();
    });

    var syncWb = $('btnSyncWbSelected');
    if (syncWb) syncWb.addEventListener('click', function() {
      try {
        var types = ['faction', 'location', 'item', 'event', 'lore', 'nsfw'];
        var hasEnt = (state.entities || []).some(function(e) {
          return types.indexOf(e.type) >= 0 && e.selected !== false && (e.content || e.summary);
        });
        var totals = { added: 0, updated: 0, skipped: 0 };
        var syncOut = ctx.syncOutputs;
        if (!syncOut) return alert('同步未就绪');
        if (hasEnt) {
          var rEnt = syncOut({ target: 'entities', selected: true, types: types });
          totals.added += rEnt.added || 0;
          totals.updated += rEnt.updated || 0;
          totals.skipped += rEnt.skipped || 0;
        }
        var covered = {};
        (state.entities || []).forEach(function(e) {
          if (!e || e.type === 'person') return;
          var cat = e.type === 'lore'
            ? ((e.attrs && e.attrs.aspect) || 'setting')
            : e.type;
          covered['[小说' + cat + '] ' + e.name] = true;
        });
        var orphanDrafts = (state.wbEntries || []).filter(function(w) {
          if (!w || w.selected === false) return false;
          var cmt = w.comment || ('[小说' + (w.category || 'setting') + '] ' + w.name);
          return !covered[cmt];
        });
        if (orphanDrafts.length) {
          if (!window.__getWorldbookEntries__ || !window.__setWorldbookEntries__) throw new Error('世界书环境未就绪');
          var rOrphan = applyDraftsToWorldbook(
            window.__getWorldbookEntries__() || [],
            orphanDrafts,
            state.conflictPolicy
          );
          if (rOrphan.added || rOrphan.updated) {
            window.__setWorldbookEntries__(rOrphan.entries);
            window.dispatchEvent(new Event('worldbook-changed'));
            window.dispatchEvent(new Event('card-builder-data-changed'));
            orphanDrafts.forEach(function(w) {
              if (state.conflictPolicy !== 'skip') w.syncStatus = 'synced';
            });
            ctx.save();
            ctx.renderAll();
          }
          totals.added += rOrphan.added || 0;
          totals.updated += rOrphan.updated || 0;
          totals.skipped += rOrphan.skipped || 0;
        }
        if (!hasEnt && !orphanDrafts.length) {
          var rWb = syncOut({ target: 'worldbook', selected: true });
          totals = rWb;
        }
        if (ctx.setStatus) ctx.setStatus('novelWbStatus', '世界书同步：新增 ' + (totals.added || 0) + ' / 更新 ' + (totals.updated || 0) + ' / 跳过 ' + (totals.skipped || 0));
      } catch (e) {
        alert(e.message || '同步失败');
      }
    });

    var saveEnt = $('btnNovelEntitySave');
    if (saveEnt) saveEnt.addEventListener('click', function() {
      if (!ctx.editState.editingEntityId) return;
      var ent = (state.entities || []).find(function(e) { return e.id === ctx.editState.editingEntityId; });
      if (!ent) return;
      var nameEl = $('novelEntityName');
      var typeEl2 = $('novelEntityType');
      var aliasesEl = $('novelEntityAliases');
      var sumEl = $('novelEntitySummary');
      var keysEl = $('novelEntityKeys');
      var contentEl = $('novelEntityContent');
      upsertEntity(state.entities, {
        type: typeEl2 ? typeEl2.value : ent.type,
        name: nameEl ? nameEl.value : ent.name,
        aliases: (function() {
          var name = nameEl ? nameEl.value : ent.name;
          var raw = aliasesEl ? aliasesEl.value : '';
          var parts = String(raw).split(/[,，]/).map(function(s) { return s.trim(); }).filter(Boolean);
          return Array.from(new Set(parts));
        })(),
        summary: sumEl ? sumEl.value : ent.summary,
        keys: (function() {
          var name = nameEl ? nameEl.value : ent.name;
          var raw = keysEl ? keysEl.value : '';
          return normalizeNameList(name, raw);
        })(),
        content: contentEl ? contentEl.value : ent.content,
      }, { source: 'manual' });
      projectEntitiesToLegacy(state);
      ctx.save();
      ctx.closeNovelModal('novelModalEntity');
      ctx.renderAll();
      if (ctx.setStatus) ctx.setStatus('novelWbStatus', '已保存 · ' + (nameEl ? nameEl.value : ent.name));
    });
  };

  // ---- AI 扩展 ----

  function wbShardOpts() {
    var state = ctx.state;
    return {
      mode: state.wbShardMode === 'chapters' ? 'chapters' : 'chars',
      chunkSize: state.wbChunkSize || state.chunkSize || 8000,
      chaptersPerShard: state.wbChaptersPerShard || 1,
    };
  }

  panel.expandWbEntry = async function(indexOrOpts, opts) {
    var state = ctx.state;
    var options = opts || {};
    var index = typeof indexOrOpts === 'number' ? indexOrOpts : Number(indexOrOpts && indexOrOpts.index);
    if (indexOrOpts && typeof indexOrOpts === 'object' && indexOrOpts.index == null && indexOrOpts.name) {
      options = Object.assign({}, options, indexOrOpts);
      index = (state.wbEntries || []).findIndex(function(e) {
        return e.name === indexOrOpts.name || e.comment === indexOrOpts.name;
      });
    }
    var g = ctx.gates ? ctx.gates() : { canExtract: false, reasons: ['未就绪'] };
    if (!g.canExtract) {
      var reason = (g.reasons || []).join('\n') || '前置未完成';
      if (!options.silent) alert(reason);
      throw new Error(reason);
    }
    var entry = state.wbEntries && state.wbEntries[index];
    if (!entry) throw new Error('世界书条目未找到');
    var mode = options.mode || 'expand';
    var matchName = entry.name || entry.comment || '';
    var matchKeys = Array.isArray(entry.keys) ? entry.keys.slice() : [];
    var adultWbExp = getAdultMode(state);
    var ntlWbExp = getNtlMode(state);
    if (adultWbExp) {
      ADULT_RAG_BOOST_TERMS.forEach(function(t) {
        if (matchKeys.indexOf(t) < 0) matchKeys.push(t);
      });
    }
    if (ntlWbExp) {
      NTL_RAG_BOOST_TERMS.forEach(function(t) {
        if (matchKeys.indexOf(t) < 0) matchKeys.push(t);
      });
    }
    if (ctx.setStatus) ctx.setStatus('novelWbStatus', '正在为「' + matchName + '」匹配原文…');
    var recall = buildRecallPayload(
      state.chapters,
      matchName,
      matchKeys,
      state.expandBudget || DEFAULT_EXPAND_BUDGET,
      180
    );
    if (!recall.snippetCount) {
      var miss = '未在启用章节中匹配到「' + matchName + '」及其触发词';
      if (ctx.setStatus) ctx.setStatus('novelWbStatus', '未命中原文');
      if (!options.silent) alert(miss);
      throw new Error(miss);
    }
    var ok = await ctx.confirmExpandRecall({
      title: '世界书 AI 扩展 · ' + matchName,
      body: recall.body,
      totalChars: recall.totalChars,
      snippetCount: recall.snippetCount,
      truncated: recall.truncated,
      terms: recall.terms,
      silent: options.silent,
      skipConfirm: options.skipConfirm,
    });
    if (!ok) {
      if (ctx.setStatus) ctx.setStatus('novelWbStatus', '已取消「' + matchName + '」扩展');
      throw new DOMException('已取消', 'AbortError');
    }
    var expandBtn = document.querySelector('[data-wb-expand="' + index + '"]');
    var expandOld = expandBtn ? expandBtn.innerHTML : '';
    if (expandBtn) {
      expandBtn.disabled = true;
      expandBtn.innerHTML = '…';
    }
    try {
      return await ctx.runTracked({
        type: 'novel_wb_expand',
        title: mode === 'rewrite' ? '世界书条目 AI 重写' : '世界书条目 AI 扩展',
        target: matchName,
      }, async function(task) {
        if (ctx.setStatus) ctx.setStatus('novelWbStatus', '正在扩写「' + matchName + '」…');
        var head = ctx.promptText(
          'novelWbExpand',
          '你是小说世界书扩写专家。仅根据原文片段扩写条目描述，禁止臆造。只输出 JSON：{ "name", "content", "keys" }'
        );
        var modeHint = mode === 'rewrite'
          ? '\n【模式】重写：依据原文重建内容，可大幅改写。'
          : '\n【模式】扩写：在已有内容上补全细节，保留可靠事实。';
        var user = head
          + modeHint
          + (options.instruction ? '\n【用户要求】' + options.instruction : '')
          + buildModeHintBlocks(state, 'expand')
          + buildAdultContextDigests(state.entities, 1500, getNtlMode(state))
          + '\n条目标题: ' + matchName
          + '\n类别: ' + (entry.category || 'setting')
          + '\n现有触发词: ' + matchKeys.join('、')
          + (entry.content && mode !== 'rewrite' ? '\n【现有内容】\n' + entry.content : '')
          + (entry.attrs ? '\n【现有 attrs】\n' + JSON.stringify(entry.attrs) : '')
          + buildContentModeFlags(state)
          + '\nContext: ' + (state.contextText || '')
          + '\n召回字数: ' + recall.totalChars + (recall.truncated ? '（已抽样截断）' : '')
          + '\n匹配词: ' + recall.terms.join('、')
          + '\n\n【原文片段】\n' + recall.body
          + '\n\n请输出 JSON（AdultMode 时含 attrs.adult；NtlMode 时可含 attrs.ntl）。';
        var text = await ctx.callAI(user, null, task.signal);
        var json = parseJsonLoose(text);
        if (json.name) entry.name = String(json.name).trim() || entry.name;
        if (json.content) entry.content = String(json.content);
        if (Array.isArray(json.keys) && json.keys.length) {
          entry.keys = json.keys.map(function(k) { return String(k).trim(); }).filter(Boolean);
        }
        if (json.attrs && typeof json.attrs === 'object') {
          entry.attrs = Object.assign({}, entry.attrs || {}, json.attrs);
          if (json.attrs.adult) {
            entry.attrs.adult = mergeAdultAttrs(entry.attrs.adult, json.attrs.adult);
          }
        }
        entry.comment = '[小说' + (entry.category || 'setting') + '] ' + entry.name;
        entry.syncStatus = entry.syncStatus === 'synced' ? 'dirty' : (entry.syncStatus || 'unsynced');
        if (!state.entities) state.entities = [];
        var wbType = wbCategoryToEntityType(entry.category);
        upsertEntity(state.entities, {
          type: wbType === 'nsfw' ? 'nsfw' : wbType,
          name: entry.name,
          content: entry.content,
          keys: entry.keys,
          summary: String(entry.content || '').slice(0, 80),
          attrs: entry.attrs || {},
          layer: entry.layer,
        }, { source: 'expand' });
        projectEntitiesToLegacy(state);
        ctx.save();
        ctx.renderAll();
        if (ctx.setStatus) ctx.setStatus('novelWbStatus', '「' + entry.name + '」扩展完成（召回 ' + recall.totalChars + ' 字）');
        return { index: index, name: entry.name, mode: mode, recallChars: recall.totalChars };
      });
    } catch (e) {
      if (!ctx.isTrackedAbort(e)) {
        if (ctx.setStatus) ctx.setStatus('novelWbStatus', '扩展失败: ' + e.message);
        if (!options.silent) alert('AI 扩展失败: ' + e.message);
      } else {
        if (ctx.setStatus) ctx.setStatus('novelWbStatus', '已取消「' + matchName + '」扩展');
      }
      throw e;
    } finally {
      if (expandBtn) {
        expandBtn.disabled = false;
        expandBtn.innerHTML = expandOld || '✦';
      }
    }
  };

  // ---- AI 抽取 ----

  panel.runExtractWorldbook = async function() {
    var state = ctx.state;
    var $ = ctx.$;
    var g = ctx.gates ? ctx.gates() : { canExtract: false, reasons: ['未就绪'] };
    if (!g.canExtract) throw new Error((g.reasons || []).join('\n') || '前置未完成');
    if (!(state.wbFocus || []).length) throw new Error('请至少勾选一类内容');
    var shards = buildExtractShards(state.chapters, wbShardOpts());
    if (!shards.length) throw new Error('无启用章节文本可抽取');
    if (ctx.setStatus) ctx.setStatus('novelWbStatus', '逐步抽取世界书中（约 ' + shards.length + ' 次）...');
    var queue = $('novelWbQueue');
    if (queue) queue.style.display = 'block';
    var extractBtn = $('btnWbExtract');
    ctx.busyFlags.wbExtract = true;
    ctx.setBtnBusy(extractBtn, true, '抽取中…');
    try {
      return await ctx.runTracked({
        type: 'novel_wb_extract',
        title: '世界书条目抽取',
        target: shards.length + ' 次 · ' + ((state.wbFocus || []).join(',') || ''),
      }, async function(task) {
        var head = ctx.promptText(
          'novelWbExtract',
          '从小说片段抽取非人物世界书事实。禁止输出人物角色卡。keys 尽量挖全。只输出 JSON：{ "entries": [ { "category": "worldview|faction|location|setting|history|item|nsfw", "name": "...", "content": "...", "keys": ["..."], "layer": "green|blue" } ] }'
        );
        var all = (state.wbEntries || []).map(function(e) {
          return {
            category: e.category,
            name: e.name,
            content: e.content,
            keys: e.keys,
            layer: e.layer,
          };
        });

        function flushWbPreview() {
          var prevByKey = {};
          (state.wbEntries || []).forEach(function(e) {
            prevByKey[(e.category || 'setting') + '::' + e.name] = e;
          });
          state.wbEntries = all.map(function(e) {
            var k = (e.category || 'setting') + '::' + e.name;
            return toWbDraftEntry(e, prevByKey[k]);
          });
          ingestLegacyIntoEntities(state, 'legacy_wb');
          projectEntitiesToLegacy(state);
          ctx.save();
          ctx.renderAll();
        }

        for (var idx = 0; idx < shards.length; idx++) {
          if (task.signal && task.signal.aborted) throw new DOMException('已取消', 'AbortError');
          var shard = shards[idx];
          if (queue) queue.textContent = '进度 ' + (idx + 1) + '/' + shards.length + ' · 已 ' + all.length + ' 条';
          var priorRef = formatPriorWbExtractRef(all);
          var user = head
            + priorRef
            + buildModeHintBlocks(state, 'extract')
            + buildAdultContextDigests(state.entities, 2000, getNtlMode(state))
            + '\nFocus: ' + (state.wbFocus || []).join(',')
            + buildContentModeFlags(state)
            + '\nMode: ' + state.narrativeMode
            + '\nContext: ' + (state.contextText || '')
            + '\n【章节 ' + shard.chapterTitle + (shard.part > 1 ? ' · 片' + shard.part : '') + '】\n' + shard.text;
          try {
            var text = await ctx.callAI(user, null, task.signal);
            var json = parseJsonLoose(text);
            (json.entries || []).forEach(function(e) { mergeWbExtractEntry(all, e); });
          } catch (e) {
            if (ctx.isTrackedAbort(e)) throw e;
          }
          flushWbPreview();
          if (window.__aiTaskCenter__ && task.id) {
            window.__aiTaskCenter__.setProgress(task.id, (idx + 1) / shards.length, (idx + 1) + '/' + shards.length);
          }
          if (ctx.setStatus) ctx.setStatus('novelWbStatus', '抽取中 ' + (idx + 1) + '/' + shards.length + ' · 已 ' + state.wbEntries.length + ' 条');
        }
        if (ctx.setStatus) ctx.setStatus('novelWbStatus', '已生成 ' + state.wbEntries.length + ' 条草稿（' + shards.length + ' 步）');
        return { draftCount: state.wbEntries.length, shardsScanned: shards.length };
      });
    } catch (e) {
      if (ctx.isTrackedAbort(e) && ctx.setStatus) ctx.setStatus('novelWbStatus', '⏹ 已取消抽取');
      throw e;
    } finally {
      ctx.busyFlags.wbExtract = false;
      ctx.setBtnBusy(extractBtn, false);
      if (queue) queue.style.display = 'none';
      if (ctx.updateExtractCallEstimates) ctx.updateExtractCallEstimates();
      if (ctx.renderGatesFn) ctx.renderGatesFn();
    }
  };

  ctx.panels.worldbook = panel;
}
