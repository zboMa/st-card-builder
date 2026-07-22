import { generateCardJSON } from '../state.mjs';
import {
  normalizeCharTags,
  mergeCharTags,
  buildTagGenContext,
  parseTagsFromAiText,
  DEFAULT_TAG_CONTEXT_CHARS,
} from '../../charTags.mjs';
import {
  getWorldviewPreset,
  buildWorldviewHintFromItems,
  normalizeWorldviewPresetItems,
  primaryWorldviewPresetId,
} from '../../presets/worldviews/index.mjs';
import {
  ENGINE_GEN_MODE_FULL,
  ENGINE_GEN_MODE_SKELETON,
  normalizeEngineGenMode,
  clampSlotCount,
  buildScaledQuota,
  formatQuotaForPrompt,
  normalizeOutlineSlots,
  slotToWorldbookEntry,
  formatOutlineRef,
  formatEnrichedEntriesRef,
  isSkeletonEntry,
  OUTLINE_TYPE_LABELS,
} from '../enginePipeline.mjs';

const AI_KEY = 'st_v3_builder_ai_config';
const PENDING_OUTLINE_KEY = 'st_v3_ai_pending_outline';

/**
 * AI 引擎：共享闭包状态与 helpers（拆自 aiEngine）
 */
/** @param {object} ctx */
export function createAiEngineShared(ctx) {
  var parsedPresetList = [];
  var cachedSearchResults = null;
  var pendingOutlineSlots = null;

  // ====================================================================
  //  Internal helpers
  // ====================================================================

  function getEngineGenMode() {
    var el = ctx.$('aiEngineGenMode');
    return normalizeEngineGenMode(el ? el.value : ENGINE_GEN_MODE_FULL);
  }

  function isPauseAfterOutline() {
    var el = ctx.$('aiEnginePauseAfterOutline');
    return !!(el && el.checked);
  }

  function syncEngineModeUi() {
    var mode = getEngineGenMode();
    var hint = ctx.$('aiEngineModeHint');
    var btn = ctx.$('btnAiGenerate');
    var pauseRow = ctx.$('aiEnginePauseAfterOutline');
    if (hint) {
      hint.textContent = mode === ENGINE_GEN_MODE_SKELETON
        ? '仅骨架：快速产出短条目，需稍后用「AI重写」展开。'
        : '完整生成：先出分类型大纲，再自动逐条写满（可勾选大纲后暂停）。';
    }
    if (btn) {
      btn.textContent = mode === ENGINE_GEN_MODE_SKELETON
        ? '一键生成角色、世界书骨架与开场白'
        : '一键完整生成（角色·大纲·丰满·开场白）';
    }
    if (pauseRow && pauseRow.parentElement) {
      pauseRow.parentElement.style.opacity = mode === ENGINE_GEN_MODE_FULL ? '1' : '0.45';
      pauseRow.disabled = mode !== ENGINE_GEN_MODE_FULL;
    }
  }

  function buildAdultHintsForWbType(type) {
    var adultHints = (typeof window.__buildAdultPromptHints__ === 'function')
      ? (window.__buildAdultPromptHints__() || {})
      : { nsfw: buildNsfwFlavorHint(), ntl: buildNtlHintForPrompt(), vessel: '', canon: buildAdultCanonHint() };
    // 人物/物品/能力更需要成人与载体；规则地点少灌
    if (type === 'person' || type === 'item' || type === 'ability') {
      return (adultHints.nsfw || '') + (adultHints.ntl || '') + (adultHints.vessel || '') + (adultHints.canon || '');
    }
    if (type === 'faction' || type === 'location' || type === 'event') {
      return (adultHints.vessel || '') + (adultHints.canon || '');
    }
    return adultHints.canon || '';
  }

  function buildNsfwFlavorHint() {
    if (typeof window.__buildAdultPromptHints__ === 'function') {
      var hints = window.__buildAdultPromptHints__() || {};
      return hints.nsfw || '';
    }
    var nsfwConfig = window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {};
    var data = window.__nsfwFlavorData__;
    if (!nsfwConfig.enabled || !data) return '';
    var items = Array.isArray(nsfwConfig.flavorItems) ? nsfwConfig.flavorItems : [];
    if (!items.length && nsfwConfig.flavor) items = [{ id: nsfwConfig.flavor, note: '' }];
    if (!items.length) return '';
    if (typeof data.buildHintFromItems === 'function') {
      return data.buildHintFromItems(items);
    }
    return '';
  }

  function buildNtlHintForPrompt() {
    if (typeof window.__buildAdultPromptHints__ === 'function') {
      var hints = window.__buildAdultPromptHints__() || {};
      return hints.ntl || '';
    }
    var nsfwConfig = window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {};
    var data = window.__nsfwFlavorData__;
    if (!nsfwConfig.ntlEnabled || !data) return '';
    var items = Array.isArray(nsfwConfig.ntlTabooItems) && nsfwConfig.ntlTabooItems.length
      ? nsfwConfig.ntlTabooItems
      : (nsfwConfig.ntlTabooTypes || []).map(function(id) { return { id: id, note: '' }; });
    if (!items.length) return '';
    if (typeof data.buildNtlHintFromTypes === 'function') {
      return data.buildNtlHintFromTypes(items, { tabooTypes: data.tabooTypes });
    }
    var lines = ['\n【NTL 禁忌方向】'];
    items.forEach(function(it) {
      var id = it && it.id ? it.id : it;
      var info = data.tabooTypes && data.tabooTypes[id];
      if (info) {
        lines.push('- ' + info.label + '：' + info.description
          + (it && it.note ? '；用户补充：' + it.note : ''));
      }
    });
    return lines.join('\n');
  }

  function buildAdultCanonHint() {
    if (typeof window.__buildAdultPromptHints__ === 'function') {
      var hints = window.__buildAdultPromptHints__() || {};
      return hints.canon || '';
    }
    return '';
  }

  function getTagContextChars() {
    var el = ctx.$('tagContextChars');
    return el ? (parseInt(el.value, 10) || DEFAULT_TAG_CONTEXT_CHARS) : DEFAULT_TAG_CONTEXT_CHARS;
  }

  function renderCharTags() {
    var charTagsList = ctx.$('charTagsList');
    if (!charTagsList) return;
    var tags = normalizeCharTags(ctx.state.charTags);
    ctx.state.charTags = tags;
    charTagsList.innerHTML = tags.map(function(tag, i) {
      return (
        '<span class="char-tag-chip" data-tag-index="' + i + '">' +
          '<span class="char-tag-chip-text">' + ctx.escapeHtml(tag) + '</span>' +
          '<button type="button" class="char-tag-chip-remove" data-tag-action="remove" data-tag-index="' + i + '" title="移除" aria-label="移除标签">×</button>' +
        '</span>'
      );
    }).join('');
  }

  function setCharTags(next, opts) {
    ctx.state.charTags = normalizeCharTags(next);
    renderCharTags();
    if (!opts || opts.save !== false) ctx.save();
  }

  function setCharTagsAiTip(text, kind) {
    var tipEl = ctx.$('charTagsAiTip');
    if (!tipEl) return;
    tipEl.textContent = text || '';
    tipEl.classList.remove('is-warn', 'is-ok', 'is-err');
    if (kind) tipEl.classList.add('is-' + kind);
  }

  function sleep(ms) {
    return new Promise(function(r) { setTimeout(r, ms); });
  }

  function getWorldviewPresetItems() {
    if (!Array.isArray(ctx.state.worldviewPresetItems)) ctx.state.worldviewPresetItems = [];
    ctx.state.worldviewPresetItems = normalizeWorldviewPresetItems(ctx.state.worldviewPresetItems);
    return ctx.state.worldviewPresetItems.slice();
  }

  function getWorldviewPresetId() {
    return primaryWorldviewPresetId(getWorldviewPresetItems());
  }

  function setWorldviewPresetItems(raw, legacyId) {
    ctx.state.worldviewPresetItems = normalizeWorldviewPresetItems(raw, legacyId);
    refreshWorldviewSummary();
    return ctx.state.worldviewPresetItems.slice();
  }

  function syncContinueEnrichBtn() {
    var contBtn = ctx.$('btnAiContinueEnrich');
    if (!contBtn) return;
    var slots = getPendingOutlineSlots();
    contBtn.hidden = !(slots && slots.length);
  }

  function getPendingOutlineSlots() {
    if (pendingOutlineSlots && pendingOutlineSlots.length) return pendingOutlineSlots;
    try {
      var raw = sessionStorage.getItem(PENDING_OUTLINE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        pendingOutlineSlots = parsed;
        return pendingOutlineSlots;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function setPendingOutlineSlots(slots) {
    pendingOutlineSlots = (slots && slots.length) ? slots.slice() : null;
    try {
      if (pendingOutlineSlots) {
        sessionStorage.setItem(PENDING_OUTLINE_KEY, JSON.stringify(pendingOutlineSlots));
      } else {
        sessionStorage.removeItem(PENDING_OUTLINE_KEY);
      }
    } catch (e) { /* ignore */ }
    syncContinueEnrichBtn();
  }

  function refreshWorldviewSummary() {
    var el = ctx.$('aiWorldviewSummary');
    var items = getWorldviewPresetItems();
    if (!el) return;
    if (!items.length) {
      el.textContent = '未选择预设——请到「世界与限定」添加，或在下方填写阶段提示词。';
      return;
    }
    var parts = items.map(function(it, idx) {
      var p = getWorldviewPreset(it.id) || { label: it.id };
      return (idx === 0 ? '主「' : '叠加「') + (p.label || it.id) + '」';
    });
    var cfg = window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {};
    var wf = cfg.adultWorldframe || ctx.state.adultWorldframe || '';
    var wfLabel = '';
    var data = window.__nsfwFlavorData__;
    if (wf && data && data.worldframes && data.worldframes[wf]) {
      wfLabel = data.worldframes[wf].label || wf;
    }
    el.textContent = parts.join(' + ')
      + (wfLabel ? (' · 载体框架「' + wfLabel + '」') : '');
  }

  function fillWorldviewSelect(selectedId) {
    if (selectedId) {
      setWorldviewPresetItems([{ id: selectedId, note: '' }]);
    } else {
      refreshWorldviewSummary();
    }
  }

  function syncWorldframeFromPresetItems(items) {
    var primaryId = primaryWorldviewPresetId(items || getWorldviewPresetItems());
    var p = getWorldviewPreset(primaryId);
    if (!p || !p.mapsToWorldframe) return;
    if (ctx.state.adultWorldframeForced) return;
    ctx.state.adultWorldframe = p.mapsToWorldframe;
    if (ctx.panels.adultConfig && ctx.panels.adultConfig.renderWorldframeRow) {
      ctx.panels.adultConfig.renderWorldframeRow();
    }
  }

  function syncWorldframeFromPreset(presetId) {
    syncWorldframeFromPresetItems(presetId ? [{ id: presetId, note: '' }] : getWorldviewPresetItems());
  }

  function buildActiveWorldviewHint(stage) {
    return buildWorldviewHintFromItems(getWorldviewPresetItems(), { stage: stage || 'all' }) || '';
  }

  /** 唯一持久化入口：委托 browserApp.__persistAiConfig__（字段并集） */
  function persistAiConfig() {
    if (typeof window.__persistAiConfig__ === 'function') {
      window.__persistAiConfig__();
      return;
    }
    // boot 前兜底：写入并集字段，避免半截对象覆盖
    var nsfwConfig = window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {};
    localStorage.setItem(AI_KEY, JSON.stringify({
      url:        (ctx.$('apiUrl') ? ctx.$('apiUrl').value.trim() : ''),
      key:        (ctx.$('apiKey') ? ctx.$('apiKey').value.trim() : ''),
      model:      (ctx.$('modelSelect') ? ctx.$('modelSelect').value : ''),
      debug:      !!(ctx.$('aiDebugEnable') && ctx.$('aiDebugEnable').checked),
      tagContextChars: getTagContextChars(),
      embeddingModel: (ctx.$('embeddingModel') ? ctx.$('embeddingModel').value : '') || '',
      embeddingApiUrl: (ctx.$('embeddingApiUrl') ? ctx.$('embeddingApiUrl').value : '') || '',
      embeddingApiKey: (ctx.$('embeddingApiKey') ? ctx.$('embeddingApiKey').value : '') || '',
      novelRag: window.__getNovelRagOptions__
        ? window.__getNovelRagOptions__()
        : (function() {
            try { var v = JSON.parse(localStorage.getItem('st_v3_builder_novel_rag')); return v || { enabled: true, budget: 12000 }; } catch(e) { return { enabled: true, budget: 12000 }; }
          })(),
      presetList: parsedPresetList,
      worldviewPresetId: getWorldviewPresetId(),
      worldviewPresetItems: getWorldviewPresetItems(),
      nsfwEnabled:   !!nsfwConfig.enabled,
      nsfwFlavor:    nsfwConfig.flavor || '',
      nsfwFlavorItems: Array.isArray(nsfwConfig.flavorItems)
        ? nsfwConfig.flavorItems.map(function(it) {
            return { id: String((it && it.id) || ''), note: String((it && it.note) || '') };
          }).filter(function(it) { return it.id; })
        : (nsfwConfig.flavor ? [{ id: nsfwConfig.flavor, note: '' }] : []),
      eroticPostureItems: Array.isArray(nsfwConfig.postureItems)
        ? nsfwConfig.postureItems.map(function(it) {
            return { id: String((it && it.id) || ''), note: String((it && it.note) || '') };
          }).filter(function(it) { return it.id; })
        : [],
      eroticSpeechItems: Array.isArray(nsfwConfig.speechItems)
        ? nsfwConfig.speechItems.map(function(it) {
            return { id: String((it && it.id) || ''), note: String((it && it.note) || '') };
          }).filter(function(it) { return it.id; })
        : [],
      ntlEnabled:    !!nsfwConfig.ntlEnabled,
      ntlTabooTypes: (nsfwConfig.ntlTabooTypes || []).slice(),
      ntlTabooItems: Array.isArray(nsfwConfig.ntlTabooItems)
        ? nsfwConfig.ntlTabooItems.map(function(it) {
            return { id: String((it && it.id) || ''), note: String((it && it.note) || '') };
          }).filter(function(it) { return it.id; })
        : (nsfwConfig.ntlTabooTypes || []).map(function(id) { return { id: String(id), note: '' }; }),
      corruptionEnabled: !!ctx.state.corruptionEnabled,
      corruptionPreset: ctx.state.corruptionPreset || '5',
      corruptionCustomBrief: ctx.state.corruptionCustomBrief || '',
      corruptionExtraNotes: ctx.state.corruptionExtraNotes || '',
      corruptionStageNames: Array.isArray(ctx.state.corruptionStageNames) ? ctx.state.corruptionStageNames.slice() : [],
      corruptionSelectedNames: Array.isArray(ctx.state.corruptionSelectedNames) ? ctx.state.corruptionSelectedNames.slice() : [],
      corruptionDefaultFemaleOnly: ctx.state.corruptionDefaultFemaleOnly !== false,
      corruptionSyncStatusBar: ctx.state.corruptionSyncStatusBar !== false,
      adultWorldframe: nsfwConfig.adultWorldframe || ctx.state.adultWorldframe || '',
      adultWorldframeForced: nsfwConfig.adultWorldframeForced || ctx.state.adultWorldframeForced || '',
      engineGenMode: getEngineGenMode(),
      pauseAfterOutline: isPauseAfterOutline(),
      skeletonCount: window.__getSkeletonCount__ ? window.__getSkeletonCount__() : 10,
    }));
  }

  function closeWbModalSingle() {
    var modal = ctx.$('wbModalSingle');
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    if (modal._wbModalHome && modal.parentNode !== modal._wbModalHome) {
      modal._wbModalHome.appendChild(modal);
    }
    var WB_MODAL_IDS = ['wbModalSingle', 'wbModalOrganize', 'wbModalKeygen', 'wbModalEdit'];
    var anyOpen = WB_MODAL_IDS.some(function(mid) {
      var m = document.getElementById(mid);
      return m && !m.hidden;
    });
    if (!anyOpen) document.body.classList.remove('wb-modal-open');
  }

  function formatCharRefForPrompt(charData) {
    if (!charData) return '';
    return '\n【阶段1已生成角色参考】\n'
      + JSON.stringify({
        charName: charData.charName || '',
        wbName: charData.wbName || '',
        charDesc: String(charData.charDesc || '').substring(0, 600),
        creatorNotes: String(charData.creatorNotes || '').substring(0, 240),
        tags: charData.tags || charData.charTags || [],
      });
  }

  function formatWbSkeletonRef(entries) {
    if (!entries || !entries.length) return '';
    var lines = entries.map(function(e) {
      return '- ' + (e.comment || '未命名') + ': ' + String(e.content || '').substring(0, 100);
    }).join('\n');
    return '\n【阶段2已生成世界书骨架参考（勿重复，可补充关联）】\n' + lines;
  }

  // ====================================================================
  //  AI Engine Panel
  // ====================================================================


  return {
    getEngineGenMode: getEngineGenMode,
    isPauseAfterOutline: isPauseAfterOutline,
    syncEngineModeUi: syncEngineModeUi,
    buildAdultHintsForWbType: buildAdultHintsForWbType,
    buildNsfwFlavorHint: buildNsfwFlavorHint,
    buildNtlHintForPrompt: buildNtlHintForPrompt,
    buildAdultCanonHint: buildAdultCanonHint,
    getTagContextChars: getTagContextChars,
    renderCharTags: renderCharTags,
    setCharTags: setCharTags,
    setCharTagsAiTip: setCharTagsAiTip,
    sleep: sleep,
    getWorldviewPresetItems: getWorldviewPresetItems,
    getWorldviewPresetId: getWorldviewPresetId,
    setWorldviewPresetItems: setWorldviewPresetItems,
    syncContinueEnrichBtn: syncContinueEnrichBtn,
    getPendingOutlineSlots: getPendingOutlineSlots,
    setPendingOutlineSlots: setPendingOutlineSlots,
    refreshWorldviewSummary: refreshWorldviewSummary,
    fillWorldviewSelect: fillWorldviewSelect,
    syncWorldframeFromPresetItems: syncWorldframeFromPresetItems,
    syncWorldframeFromPreset: syncWorldframeFromPreset,
    buildActiveWorldviewHint: buildActiveWorldviewHint,
    persistAiConfig: persistAiConfig,
    closeWbModalSingle: closeWbModalSingle,
    formatCharRefForPrompt: formatCharRefForPrompt,
    formatWbSkeletonRef: formatWbSkeletonRef,
    get parsedPresetList() { return parsedPresetList; },
    set parsedPresetList(v) { parsedPresetList = v; },
    get cachedSearchResults() { return cachedSearchResults; },
    set cachedSearchResults(v) { cachedSearchResults = v; },
    get pendingOutlineSlots() { return pendingOutlineSlots; },
    set pendingOutlineSlots(v) { pendingOutlineSlots = v; },
  };
}
