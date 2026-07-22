import { WB_FOCUS_OPTIONS } from '../state.mjs';
import { strategyLabelZh } from '../../utils.mjs';
import { escapeHtml, truncatePreviewLine, parseJsonLoose, normalizeNameList } from '../../utils.mjs';
import { findEntityMatch, upsertEntity, projectEntitiesToLegacy } from '../entityStore.mjs';
import { applyDraftsToWorldbook } from '../sync.mjs';

/**
 * attachNovelWorldbookRender（拆自原模块）
 */
export function attachNovelWorldbookRender(ctx, panel) {
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
        summary: String(saved.content || '').slice(0, ENTITY_SUMMARY_STORE),
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
      prev.innerHTML = '<div class="wb-entries-empty novel-wb-empty-tip">暂无条目。请先「小说分析」，或 AI 抽取 / 新建。</div>';
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


}
