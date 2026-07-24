/**
 * 人物面板：渲染、绑定、扫描、扩展、档案编辑
 */
import { buildExtractShards } from '../chapters.mjs';
import { buildRecallPayload, DEFAULT_EXPAND_BUDGET } from '../recall.mjs';
import {
  normalizeCharacterProfile,
  emptyCharacterProfile,
  profileContentDigest,
} from '../schema.mjs';
import {
  profileToCharacterFields,
  entityPersonToCharacterFields,
  profileToWorldbookDraft,
  entityPersonToWorldbookDraft,
} from '../sync.mjs';
import {
  getAdultMode,
  getNtlMode,
  boostAdultSearchQuery,
  extractStyleNsfwSection,
  buildModeHintBlocks,
  buildContentModeFlags,
  buildNsfwFlavorHint,
  buildNtlTabooHint,
  buildPaletteGuidanceBlock,
  getNsfwFlavorItems,
  evaluateFlavorRichness,
  buildFlavorExpandSystemPrompt,
  buildFlavorExpandUserPrompt,
  NSFW_FLAVOR_PRESETS,
  NTL_TABOO_TYPES,
  getNtlTabooTypes,
  evaluateNtlRichness,
  buildNtlExpandSystemPrompt,
  buildNtlExpandUserPrompt,
  buildAdultCanonDigest,
  ADULT_CANON_BUDGET,
  ADULT_RAG_BOOST_TERMS,
  NTL_RAG_BOOST_TERMS,
  resolveWorldframe,
  listVesselEntities,
  personMentionsVessels,
} from '../nsfwSupport.mjs';
import {
  upsertEntity,
  findEntityMatch,
  projectEntitiesToLegacy,
  ingestLegacyIntoEntities,
  isEntityEnriched,
} from '../entityStore.mjs';
import { uid, escapeHtml, parseJsonLoose, normalizeNameList } from '../../utils.mjs';
import { showConfirmDialog } from '../../ui/confirmDialog.mjs';

/**
 * @param {object} ctx — 小说工坊上下文（由 shared/context.mjs 创建，含 $、save、busyFlags 等）
 */

/**
 * attachNovelCharactersRender（拆自原模块）
 */
export function attachNovelCharactersRender(ctx, panel) {
  panel.syncBadge = function(status) {
    var s = status || 'unsynced';
    var label = s === 'synced' ? '已同步' : (s === 'dirty' ? '有本地修改' : '未同步');
    return '<span class="novel-sync-badge ' + s + '">' + label + '</span>';
  };

  /** 按人物 id/名找实体 */
  panel.findPersonEntityForChar = function(ch) {
    if (!ch) return null;
    var state = ctx.state;
    var byId = (state.entities || []).find(function(e) { return e.id === ch.id && e.type === 'person'; });
    if (byId) return byId;
    return findEntityMatch(state.entities, ch.name, ch.aliases || []);
  };

  /** 按 id/名定位人物 */
  panel.findCharacter = function(target) {
    var state = ctx.state;
    var t = target || {};
    if (typeof t === 'string') t = { id: t, name: t };
    var id = t.id != null ? String(t.id) : '';
    var name = t.name != null ? String(t.name) : (t.titleMatch != null ? String(t.titleMatch) : '');
    if (id) {
      var byId = state.characters.find(function(c) { return c.id === id; });
      if (byId) return byId;
    }
    if (name) {
      var exact = state.characters.find(function(c) { return c.name === name; });
      if (exact) return exact;
      var q = name.toLowerCase();
      return state.characters.find(function(c) {
        return String(c.name || '').toLowerCase().indexOf(q) >= 0;
      }) || null;
    }
    return null;
  };

  panel.addCharactersByNames = function(names, note) {
    var state = ctx.state;
    if (!state.entities) state.entities = [];
    (names || []).forEach(function(raw) {
      var name = String(raw || '').trim();
      if (!name) return;
      if (state.characters.some(function(c) { return c.name === name; })) return;
      upsertEntity(state.entities, {
        type: 'person',
        name: name,
        aliases: [],
        summary: note || '',
      }, { source: 'manual' });
    });
    projectEntitiesToLegacy(state);
  };

  /** 共享：删除人物（列表 / 图谱） */
  panel.deleteCharacter = async function(id, opts) {
    opts = opts || {};
    var state = ctx.state;
    if (!opts.skipConfirm) {
      var ok = await showConfirmDialog({
        icon: '🗑️',
        title: '删除人物？',
        message: '确认删除该人物？此操作不可撤销。',
        okText: '删除',
        cancelText: '取消',
      });
      if (!ok) return false;
    }
    var ch = state.characters.find(function(c) { return c.id === id; });
    var ent = panel.findPersonEntityForChar(ch)
      || (state.entities || []).find(function(e) { return e.id === id; });
    if (ch) state.characters = state.characters.filter(function(c) { return c.id !== id; });
    if (ent) {
      state.entities = (state.entities || []).filter(function(e) { return e.id !== ent.id; });
      state.relations = (state.relations || []).filter(function(r) {
        return r.fromId !== ent.id && r.toId !== ent.id;
      });
    }
    ctx.save();
    ctx.renderAll();
    return true;
  };

  /** 共享：同步人物 → 世界书人物条 */
  panel.syncCharacterToWorldbook = function(id) {
    ctx.syncOutputs({ target: 'character_worldbook', ids: [id], selected: false });
    ctx.setStatus('novelCharStatus', '已同步到世界书人物条（不写入主角设定）');
  };

  /** 共享：丰满人物实体（单点默认预览确认） */
  panel.enrichCharacterEntity = async function(entityId, opts) {
    opts = opts || {};
    var ana = ctx.panels.analyze;
    if (!ana) throw new Error('分析面板未就绪');
    return ana.runAnalyzeEnrich({
      ids: [entityId],
      confirm: opts.confirm !== false,
      skipConfirm: !!opts.skipConfirm,
      silent: !!opts.silent,
      sourceBtn: opts.sourceBtn || null,
    });
  };

  panel.render = function() {
    var state = ctx.state;
    var es = ctx.editState;
    var grid = ctx.$('novelCharGrid');
    var idCheck = ctx.$('novelScanIdentity');
    var stage = ctx.$('novelSplitStage');
    var modeEl = ctx.$('novelCharShardMode');
    var chunk = ctx.$('novelCharChunkSize');
    var perCh = ctx.$('novelCharChaptersPerShard');
    var policy = ctx.$('novelCharConflictPolicy');
    if (idCheck) idCheck.checked = !!state.scanWithIdentity;
    if (stage) stage.checked = !!state.splitByStage;
    if (modeEl) modeEl.value = state.charShardMode === 'chapters' ? 'chapters' : 'chars';
    if (chunk) chunk.value = String(state.charChunkSize || 8000);
    if (perCh) perCh.value = String(state.charChaptersPerShard || 1);
    if (ctx.syncShardModeUi) ctx.syncShardModeUi('novelChar', state.charShardMode);
    if (policy) policy.value = state.conflictPolicy || 'merge';

    var countEl = ctx.$('novelCharCount');
    if (countEl) countEl.textContent = String((state.characters || []).length);
    var enrichedMeta = ctx.$('novelCharEnrichedMeta');
    if (enrichedMeta) {
      var enrichedN = (state.characters || []).filter(function(c) {
        var ent = panel.findPersonEntityForChar(c);
        return ent ? isEntityEnriched(ent, !!state.strictQuality, getAdultMode(state)) : !!c.profile;
      }).length;
      if ((state.characters || []).length && enrichedN > 0) {
        enrichedMeta.hidden = false;
        enrichedMeta.textContent = '已丰满 ' + enrichedN;
      } else {
        enrichedMeta.hidden = true;
        enrichedMeta.textContent = '';
      }
    }

    var searchInput = ctx.$('novelCharSearchInput');
    var searchClear = ctx.$('novelCharSearchClear');
    if (searchInput && searchInput.value !== es.novelCharSearchQuery) {
      if (document.activeElement !== searchInput) searchInput.value = es.novelCharSearchQuery;
    }
    if (searchClear) searchClear.style.display = es.novelCharSearchQuery ? '' : 'none';

    if (!grid) return;
    if (!(state.characters || []).length) {
      grid.innerHTML = '<div class="novel-list-empty">暂无人物。请先「小说分析」，或手动添加 / 扫描全书。</div>';
      return;
    }
    var q = String(es.novelCharSearchQuery || '').trim().toLowerCase();
    var list = state.characters.filter(function(c) {
      if (!q) return true;
      var hay = ((c.name || '') + ' ' + (c.aliases || []).join(' ') + ' ' + (c.note || '')).toLowerCase();
      return hay.indexOf(q) >= 0;
    });
    if (!list.length) {
      grid.innerHTML = '<div class="novel-list-empty">未找到匹配「' + escapeHtml(es.novelCharSearchQuery) + '」的人物。</div>';
      return;
    }
    grid.innerHTML = list.map(function(c) {
      var ent = panel.findPersonEntityForChar(c);
      var enriched = ent ? isEntityEnriched(ent, !!state.strictQuality, getAdultMode(state)) : !!c.profile;
      var note = c.note || (c.profile ? '已扩展' : '待扩展');
      var canSync = !!(c.profile || (ent && String(ent.content || ent.summary || '').trim()));
      var needExpand = !c.profile;
      return '<div class="novel-list-row" data-char-id="' + c.id + '">'
        + '<input type="checkbox" data-char-sel="' + c.id + '"' + (c.selected ? ' checked' : '') + ' />'
        + '<div class="novel-list-main">'
        + '<button type="button" class="novel-list-title" data-char-edit="' + c.id + '" title="查看/编辑档案">'
        + escapeHtml(c.name) + '</button>'
        + '<div>' + panel.syncBadge(c.syncStatus)
        + (enriched ? '' : ' <span class="novel-sync-badge unsynced">待丰满</span>')
        + '</div>'
        + '<div class="novel-list-meta">' + escapeHtml(note).slice(0, 80)
        + ' · 出现约 ' + (c.hits || 0) + ' 段'
        + (c.aliases && c.aliases.length ? ' · 别名 ' + escapeHtml(c.aliases.join('、')) : '')
        + '</div></div>'
        + '<div class="novel-list-actions">'
        + (canSync
          ? ctx.iconBtn('data-char-sync-wb="' + c.id + '"', '📖', '同步到世界书人物条')
          : '')
        + (ent
          ? ctx.iconBtn(
            'data-char-enrich="' + escapeHtml(ent.id) + '"',
            '✦',
            enriched ? '重新丰满' : 'AI 丰满',
            enriched ? '' : 'btn-ai-expand'
          )
          : ctx.iconBtn(
            'data-char-expand="' + c.id + '"',
            '✦',
            needExpand ? 'AI 扩展（未扩展）' : 'AI 重写',
            needExpand ? 'btn-ai-expand' : ''
          ))
        + ctx.iconBtn('data-char-edit="' + c.id + '"', '✎', '编辑档案')
        + ctx.iconBtn('data-char-del="' + c.id + '"', '×', '删除', 'is-danger')
        + '</div></div>';
    }).join('');

    grid.querySelectorAll('[data-char-sel]').forEach(function(cb) {
      cb.addEventListener('change', function() {
        var id = cb.getAttribute('data-char-sel');
        state.characters = state.characters.map(function(c) {
          return c.id === id ? Object.assign({}, c, { selected: cb.checked }) : c;
        });
        var ent = (state.entities || []).find(function(e) { return e.id === id; })
          || panel.findPersonEntityForChar(state.characters.find(function(c) { return c.id === id; }));
        if (ent) ent.selected = cb.checked;
        ctx.save();
      });
    });
    grid.querySelectorAll('[data-char-del]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        panel.deleteCharacter(btn.getAttribute('data-char-del'));
      });
    });
    grid.querySelectorAll('[data-char-enrich]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        panel.enrichCharacterEntity(btn.getAttribute('data-char-enrich'), { sourceBtn: btn }).catch(function(e) {
          if (!ctx.isTrackedAbort(e)) alert('丰满失败: ' + (e.message || e));
        });
      });
    });
    grid.querySelectorAll('[data-char-expand]').forEach(function(btn) {
      btn.addEventListener('click', function() { panel.expand(btn.getAttribute('data-char-expand')); });
    });
    grid.querySelectorAll('[data-char-edit]').forEach(function(btn) {
      btn.addEventListener('click', function() { panel.openProfileEditor(btn.getAttribute('data-char-edit')); });
    });
    grid.querySelectorAll('[data-char-sync-wb]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        panel.syncCharacterToWorldbook(btn.getAttribute('data-char-sync-wb'));
      });
    });
  };

  panel.openProfileEditor = function(id) {
    var state = ctx.state;
    var ch = state.characters.find(function(c) { return c.id === id; });
    if (!ch) return;
    ctx.editState.editingCharId = id;
    var title = ctx.$('novelModalProfileTitle');
    var aliases = ctx.$('novelCharAliases');
    var jsonEl = ctx.$('novelCharProfileJson');
    if (title) title.textContent = '人物档案 · ' + ch.name;
    if (aliases) aliases.value = (ch.aliases || []).join(', ');
    if (jsonEl) jsonEl.value = JSON.stringify(ch.profile || emptyCharacterProfile(ch.name), null, 2);
    ctx.openNovelModal('novelModalProfile');
  };

  panel.openEntityEditor = function(id) {
    var state = ctx.state;
    var ent = (state.entities || []).find(function(e) { return e.id === id; });
    if (!ent) return;
    ctx.editState.editingEntityId = id;
    var title = ctx.$('novelModalEntityTitle');
    var nameEl = ctx.$('novelEntityName');
    var typeEl = ctx.$('novelEntityType');
    var aliasesEl = ctx.$('novelEntityAliases');
    var sumEl = ctx.$('novelEntitySummary');
    var keysEl = ctx.$('novelEntityKeys');
    var contentEl = ctx.$('novelEntityContent');
    if (title) title.textContent = '编辑实体 · ' + ent.name;
    if (nameEl) nameEl.value = ent.name || '';
    if (typeEl) typeEl.value = ent.type || 'lore';
    if (aliasesEl) aliasesEl.value = (ent.aliases || []).join(', ');
    if (sumEl) sumEl.value = ent.summary || '';
    if (keysEl) keysEl.value = (ent.keys || []).join(', ');
    if (contentEl) contentEl.value = ent.content || '';
    ctx.openNovelModal('novelModalEntity');
  };

  /**
   * await 人物 AI 扩展/重写（附录1）；供 UI 与助手共用
   * @param {string|object} targetIdOrOpts
   * @param {{ mode?: string, instruction?: string, openEditor?: boolean, silent?: boolean, skipConfirm?: boolean }} [opts]
   */

}
