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

export function registerAiEngine(ctx) {
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

  ctx.panels.aiEngine = {

    // ===== 预设 =====

    renderPresetList: function() {
      var container = ctx.$('presetListContainer');
      var statusEl = ctx.$('presetStatus');
      if (!parsedPresetList.length) {
        if (container) container.style.display = 'none';
        if (statusEl) statusEl.textContent = '未找到可用规则';
        return;
      }
      if (container) container.style.display = 'block';
      if (statusEl) statusEl.textContent = '\u2705 预设载入成功！已加载 ' + parsedPresetList.length + ' 条规则';
      var html = parsedPresetList.map(function(it, i) {
        var typeBadge = '';
        var nm = (it.name || '').toLowerCase();
        if (nm.indexOf('example') >= 0 || nm.indexOf('dialogue') >= 0 || nm.indexOf('\u793a\u4f8b') >= 0) {
          typeBadge = ' <span style="font-size:0.6rem;color:#34d399;background:rgba(16,185,129,0.1);padding:1px 5px;border-radius:4px;">\u793a\u4f8b\u5bf9\u8bdd</span>';
        } else if (nm.indexOf('jailbreak') >= 0 || nm.indexOf('nsfw') >= 0 || nm.indexOf('\u8d8a\u72f1') >= 0) {
          typeBadge = ' <span style="font-size:0.6rem;color:#f59e0b;background:rgba(245,158,11,0.1);padding:1px 5px;border-radius:4px;">JB</span>';
        } else {
          typeBadge = ' <span style="font-size:0.6rem;color:var(--color-text-muted);background:rgba(100,116,139,0.1);padding:1px 5px;border-radius:4px;">system</span>';
        }
        return '<div class="preset-item"><input type="checkbox" id="preset_chk_' + i + '" data-index="' + i + '"' + (it.enabled ? ' checked' : '') + ' /><label for="preset_chk_' + i + '">' + it.name + typeBadge + '</label></div>';
      }).join('');

      if (container) {
        container.innerHTML = html;
        container.querySelectorAll('input[type="checkbox"]').forEach(function(chk) {
          chk.addEventListener('change', function(e) {
            parsedPresetList[parseInt(e.target.getAttribute('data-index'))].enabled = e.target.checked;
            persistAiConfig();
          });
        });
      }
    },

    getActivePresetsStr: function() {
      return parsedPresetList.filter(function(p) { return p.enabled; })
        .map(function(p) { return '[\u89c4\u5219: ' + p.name + ']\n' + p.content; }).join('\n\n');
    },

    getActivePresetMessages: function() {
      return parsedPresetList.filter(function(p) { return p.enabled; })
        .map(function(p) { return { role: p.role || 'system', content: p.content }; });
    },

    loadPresetsFromConfig: function(presets) {
      if (presets && Array.isArray(presets) && presets.length > 0) {
        parsedPresetList = presets;
        ctx.panels.aiEngine.renderPresetList();
      }
    },

    getParsedPresetList: function() {
      return parsedPresetList;
    },

    // ===== 搜索 =====

    performSearchIfEnabled: async function(query) {
      var sc = window.__searchConfig__;
      if (!sc || !sc.isEnabled()) return { searchText: '', searchResults: null, mode: 'off' };
      var engine = sc.getEngine();
      var customQuery = sc.getCustomQuery();
      var effective = customQuery || query;
      var count = sc.getResultCount();
      var lang = sc.getLang();
      if (engine !== 'none') {
        try {
          var results = await sc.executeSearch(effective, count, lang);
          if (results && results.length > 0) {
            cachedSearchResults = results;
            return { searchText: sc.formatForPrompt(results), searchResults: results, mode: 'engine' };
          }
        } catch (err) {
          return { searchText: ctx.promptText('aiNativeSearch', effective), searchResults: null, mode: 'ai_fallback', error: err.message };
        }
      }
      return { searchText: ctx.promptText('aiNativeSearch', effective), searchResults: null, mode: 'ai_native' };
    },

    // ===== AI 模型拉取 =====

    fetchModels: async function() {
      var apiUrlEl = ctx.$('apiUrl');
      var apiKeyEl = ctx.$('apiKey');
      var modelEl = ctx.$('modelSelect');
      // 主反馈在 API 配置页；aiStatus 仅在引擎弹窗内，避免「点了没反应」
      var statusEl = ctx.$('fetchModelsStatus') || ctx.$('aiStatus');
      var btnEl = ctx.$('btnFetchModels');
      var escape = ctx.escapeHtml || function(s) { return String(s == null ? '' : s); };

      function setFetchStatus(msg, ok) {
        if (!statusEl) return;
        statusEl.textContent = msg || '';
        statusEl.style.color = ok === true ? '#10b981' : (ok === false ? '#ef4444' : 'var(--color-text-muted)');
      }

      var base = apiUrlEl ? String(apiUrlEl.value || '').trim() : '';
      if (!base) {
        setFetchStatus('请先填写 API 接口地址', false);
        return;
      }
      // 兼容用户填到 /v1 或 /v1/chat/completions
      base = base.replace(/\/$/, '');
      if (/\/chat\/completions$/i.test(base)) base = base.replace(/\/chat\/completions$/i, '');
      var url = base + '/models';
      var key = apiKeyEl ? apiKeyEl.value.trim() : '';

      ctx.setBtnBusy(btnEl, true, '\u23f3...');
      setFetchStatus('正在拉取模型列表…', null);
      try {
        var h = { 'Content-Type': 'application/json' };
        if (key) h['Authorization'] = 'Bearer ' + key;
        var res = await fetch(url, { headers: h });
        var rawText = await res.text();
        var result = null;
        try {
          result = rawText ? JSON.parse(rawText) : null;
        } catch (parseErr) {
          throw new Error(
            '接口未返回 JSON（HTTP ' + res.status + '）。请确认地址形如 https://api.example.com/v1'
          );
        }
        if (!res.ok) {
          var errMsg = (result && (result.error && result.error.message || result.message || result.error)) || ('HTTP ' + res.status);
          throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
        }
        var models = Array.isArray(result && result.data)
          ? result.data.map(function(m) { return m && (m.id || m.name); }).filter(Boolean)
          : Array.isArray(result) ? result.map(function(m) { return m && (m.id || m.name) || m; }).filter(Boolean) : [];
        models = models.map(function(m) { return String(m); });
        models.sort();
        if (!models.length) {
          if (modelEl) {
            modelEl.innerHTML = '<option value="">未获取到模型</option>';
          }
          setFetchStatus('请求成功但模型列表为空，请检查接口是否支持 GET /models', false);
          return;
        }
        if (modelEl) {
          modelEl.innerHTML = models.map(function(m) {
            var em = escape(m);
            return '<option value="' + em + '">' + em + '</option>';
          }).join('');
          var saved = {};
          try { saved = JSON.parse(localStorage.getItem(AI_KEY)) || {}; } catch (e) { console.warn('Parsing saved AI config failed', e); }
          if (saved.model && models.indexOf(saved.model) >= 0) modelEl.value = saved.model;
        }
        persistAiConfig();
        setFetchStatus('\u2705 成功获取 ' + models.length + ' 个模型', true);
        var modalStatus = ctx.$('aiStatus');
        if (modalStatus && modalStatus !== statusEl) {
          modalStatus.textContent = '\u2705 成功获取 ' + models.length + ' 个模型！';
          modalStatus.style.color = '#10b981';
        }
      } catch (err) {
        var msg = (err && err.message) ? err.message : String(err);
        if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
          msg = '网络失败或被 CORS 拦截。请确认接口允许浏览器跨域，或改用支持 CORS 的中转地址。';
        }
        setFetchStatus('\u274c ' + msg, false);
        var modalStatusErr = ctx.$('aiStatus');
        if (modalStatusErr && modalStatusErr !== statusEl) {
          modalStatusErr.textContent = '\u274c ' + msg;
          modalStatusErr.style.color = '#ef4444';
        }
      } finally {
        ctx.setBtnBusy(btnEl, false);
      }
    },

    // ===== AI 一键生成（完整：大纲→丰满 / 仅骨架） =====

    runFullGeneration: async function() {
      var apiUrlEl   = ctx.$('apiUrl');
      var apiKeyEl   = ctx.$('apiKey');
      var modelEl    = ctx.$('modelSelect');
      var promptEl   = ctx.$('aiPrompt');
      var wbPromptEl = ctx.$('wbPrompt');
      var greetEl    = ctx.$('greetingPrompt');
      var statusEl   = ctx.$('aiStatus');
      var btnEl      = ctx.$('btnAiGenerate');
      var contBtn    = ctx.$('btnAiContinueEnrich');

      var url   = (apiUrlEl ? apiUrlEl.value : '').replace(/\/$/, '') + '/chat/completions';
      var key   = apiKeyEl ? apiKeyEl.value.trim() : '';
      var model = modelEl ? modelEl.value : '';
      if (!model) { window.alert('请先拉取模型！'); return; }

      var charExtra = promptEl ? promptEl.value.trim() : '';
      var wvItems = getWorldviewPresetItems();
      var wvId = primaryWorldviewPresetId(wvItems);
      var wvPreset = getWorldviewPreset(wvId);
      var hasWorldview = wvItems.length > 0;
      if (!charExtra && !hasWorldview) {
        window.alert('请添加世界观预设（可多选组合），或填写角色设定额外要求！');
        return;
      }

      var genMode = getEngineGenMode();
      var pauseOutline = genMode === ENGINE_GEN_MODE_FULL && isPauseAfterOutline();
      var wvCharHint = buildActiveWorldviewHint('char');
      var wvWbHint = buildActiveWorldviewHint('worldbook');
      var wvGreetHint = buildActiveWorldviewHint('greeting');
      var searchQuery = charExtra
        || (wvItems.map(function(it) {
          var p = getWorldviewPreset(it.id);
          return p ? (p.label + ' ' + (p.description || '')) : '';
        }).filter(Boolean).join(' ') || '');

      var slotCount = window.__getSkeletonCount__ ? window.__getSkeletonCount__() : 10;
      slotCount = clampSlotCount(slotCount);
      var quota = buildScaledQuota(slotCount);
      var searchEnabled = window.__searchConfig__ && window.__searchConfig__.isEnabled();
      // steps: search? + char + outlineOrSkeletonBatches + enrich?(slots) + cross? + greet
      var enrichSteps = genMode === ENGINE_GEN_MODE_FULL && !pauseOutline ? slotCount + 1 : 0;
      var skBatches = genMode === ENGINE_GEN_MODE_SKELETON ? Math.ceil(slotCount / 5) : 1;
      var totalSteps = (searchEnabled ? 1 : 0) + 1 + skBatches + enrichSteps + 1;
      var currentStep = 0;
      var hacker = window.__hackerAnim__;
      var charData = null;

      if (btnEl) btnEl.disabled = true;
      setPendingOutlineSlots(null);
      cachedSearchResults = null;

      if (hacker) { hacker.start(); hacker.setPhase('\u26a1 初始化引擎...'); hacker.setProgress(0, totalSteps); hacker.setDetail(hacker.randomMsg()); }

      var aiCenter = window.__aiTaskCenter__;
      var engineTask = aiCenter ? aiCenter.create({
        type: 'engine_generate',
        title: genMode === ENGINE_GEN_MODE_FULL ? 'AI 引擎完整生成' : 'AI 引擎骨架生成',
        target: (charExtra || (wvPreset && wvPreset.label) || '').slice(0, 40),
      }) : null;
      var engineSignal = engineTask && engineTask.signal;

      try {
        var headers = { 'Content-Type': 'application/json' };
        if (key) headers['Authorization'] = 'Bearer ' + key;
        var presetsStr = ctx.panels.aiEngine.getActivePresetsStr();
        var searchInjection = '';

        if (searchEnabled) {
          if (engineSignal && engineSignal.aborted) throw new DOMException('已取消', 'AbortError');
          currentStep++;
          if (aiCenter && engineTask) aiCenter.setProgress(engineTask.id, currentStep / totalSteps, '联网搜索');
          if (hacker) { hacker.setPhase('\ud83c\udf10 [阶段 ' + currentStep + '/' + totalSteps + '] 联网搜索...'); hacker.setProgress(currentStep, totalSteps); }
          if (statusEl) { statusEl.textContent = '\ud83c\udf10 联网搜索中...'; statusEl.style.color = '#38bdf8'; }
          var searchResult = await ctx.panels.aiEngine.performSearchIfEnabled(searchQuery);
          searchInjection = searchResult.searchText || '';
          await sleep(300);
        }

        // —— 阶段1：角色 ——
        if (engineSignal && engineSignal.aborted) throw new DOMException('已取消', 'AbortError');
        currentStep++;
        if (aiCenter && engineTask) aiCenter.setProgress(engineTask.id, currentStep / totalSteps, '构建角色');
        if (hacker) { hacker.setPhase('\ud83e\uddec [阶段 ' + currentStep + '/' + totalSteps + '] 构建角色...'); hacker.setProgress(currentStep, totalSteps); }
        if (statusEl) { statusEl.textContent = '\u23f3 [阶段1] 角色设定...'; statusEl.style.color = '#38bdf8'; }

        var p1Sys = ctx.promptText('charGen')
          + (presetsStr ? '\n【文风要求】：\n' + presetsStr : '')
          + '\n【约束】主角 Description 禁止写入 NSFW_information、恶堕分期、情欲口味或 NTL 禁忌层；此类内容只属于世界书人物。'
          + '\n【冲突处理】若「用户额外要求」与「世界观预设」冲突，以用户额外要求为准。'
          + (wvCharHint || '')
          + searchInjection;
        var p1User = [
          hasWorldview ? ('已选用世界观预设：' + wvItems.map(function(it, idx) {
            var p = getWorldviewPreset(it.id);
            var lab = p ? p.label : it.id;
            return (idx === 0 ? '主·' : '叠加·') + lab;
          }).join(' + ')) : '',
          charExtra ? ('角色额外要求（优先）：\n' + charExtra) : '角色额外要求：无（请严格按世界观预设组合生成）',
        ].filter(Boolean).join('\n\n');

        var aiResp1 = await ctx.fetchAIContent({
          context: '角色生成/阶段1',
          url: url, headers: headers, model: model,
          messages: [{ role: 'system', content: p1Sys }, { role: 'user', content: p1User }],
          temperature: 0.85,
          httpErrorPrefix: '角色生成失败 HTTP ',
          signal: engineSignal,
        });
        charData = ctx.extractJsonObj(aiResp1.content, '角色生成/阶段1');
        ctx.state.charName = charData.charName || '';
        ctx.state.wbName = charData.wbName || '';
        ctx.state.charDesc = charData.charDesc || '';
        ctx.state.creatorNotes = charData.creatorNotes || '';
        if (Array.isArray(charData.tags) || Array.isArray(charData.charTags)) {
          setCharTags(charData.tags || charData.charTags, { save: false });
        }
        ctx.state.worldbookEntries = [];
        ctx.save();
        await sleep(300);
        var charRef = formatCharRefForPrompt(charData);
        var wbGoal = wbPromptEl ? wbPromptEl.value.trim() : '';

        var outlineSlots = [];

        if (genMode === ENGINE_GEN_MODE_FULL) {
          // —— 大纲 ——
          if (engineSignal && engineSignal.aborted) throw new DOMException('已取消', 'AbortError');
          currentStep++;
          if (aiCenter && engineTask) aiCenter.setProgress(engineTask.id, currentStep / totalSteps, '世界书大纲');
          if (hacker) { hacker.setPhase('\ud83d\uddd2\ufe0f 世界书大纲...'); hacker.setProgress(currentStep, totalSteps); }
          if (statusEl) statusEl.textContent = '\u23f3 生成分类型大纲（' + formatQuotaForPrompt(quota) + '）...';

          var outlineSys = ctx.promptText('wbOutline')
            + charRef
            + '\n【配额】共 ' + slotCount + ' 条：' + formatQuotaForPrompt(quota)
            + (wbGoal ? '\n【方向·优先】：' + wbGoal : '')
            + (presetsStr ? '\n【文风】：' + presetsStr.substring(0, 200) : '')
            + (wvWbHint || '')
            + searchInjection;
          var outlineUser = '请输出恰好约 ' + slotCount + ' 条 slots 的 JSON 大纲。';
          var aiOutline = await ctx.fetchAIContent({
            context: '世界书大纲',
            url: url, headers: headers, model: model,
            messages: [{ role: 'system', content: outlineSys }, { role: 'user', content: outlineUser }],
            temperature: 0.7,
            httpErrorPrefix: '大纲生成失败 HTTP ',
            signal: engineSignal,
          });
          var outlineObj = null;
          try { outlineObj = ctx.extractJsonObj(aiOutline.content, '世界书大纲'); }
          catch (e1) {
            try {
              var arr = ctx.extractJsonArray(aiOutline.content, '世界书大纲/数组');
              outlineObj = { slots: arr };
            } catch (e2) { throw new Error('大纲 JSON 解析失败'); }
          }
          outlineSlots = normalizeOutlineSlots(outlineObj, slotCount);
          if (!outlineSlots.length) throw new Error('大纲 slots 为空');
          outlineSlots.forEach(function(s, i) { s._i = i; });
          ctx.state.worldbookEntries = outlineSlots.map(function(s, i) {
            return slotToWorldbookEntry(s, 100 + i);
          });
          ctx.renderAll();
          ctx.save();
          if (hacker) hacker.setDetail('\u2705 大纲 ' + outlineSlots.length + ' 槽');

          if (pauseOutline) {
            setPendingOutlineSlots(outlineSlots.slice());
            if (aiCenter && engineTask) aiCenter.succeed(engineTask.id);
            if (hacker) {
              hacker.stop();
              hacker.setPhase('\u23f8 大纲已就绪');
              hacker.setDetail('已暂停。确认大纲后点击「继续：按大纲逐条丰满」。');
              setTimeout(function() { if (hacker) hacker.hide(); }, 4000);
            }
            if (statusEl) {
              statusEl.textContent = '\u23f8 大纲 ' + outlineSlots.length + ' 条已写入（待丰满）。可编辑后点「继续丰满」。';
              statusEl.style.color = '#f59e0b';
            }
            return;
          }

          setPendingOutlineSlots(null);

          currentStep = await ctx.panels.aiEngine._enrichOutlineSlots({
            url: url, headers: headers, model: model,
            charRef: charRef, outlineSlots: outlineSlots,
            wvWbHint: wvWbHint, presetsStr: presetsStr, searchInjection: searchInjection,
            engineSignal: engineSignal, engineTask: engineTask, aiCenter: aiCenter,
            hacker: hacker, statusEl: statusEl,
            currentStep: currentStep, totalSteps: totalSteps,
          });
        } else {
          // —— 仅骨架（旧批次逻辑）——
          var remaining = slotCount;
          var batchIndex = 0;
          while (remaining > 0) {
            if (engineSignal && engineSignal.aborted) throw new DOMException('已取消', 'AbortError');
            var batchSize = Math.min(remaining, 5);
            batchIndex++; currentStep++;
            if (aiCenter && engineTask) aiCenter.setProgress(engineTask.id, currentStep / totalSteps, '骨架批次 ' + batchIndex);
            if (hacker) { hacker.setPhase('\ud83e\uddb4 骨架批次 ' + batchIndex); hacker.setProgress(currentStep, totalSteps); }
            if (statusEl) statusEl.textContent = '\u23f3 骨架... ' + ctx.state.worldbookEntries.length + '/' + slotCount;
            var existingTitles = ctx.state.worldbookEntries.map(function(e) { return e.comment; }).join('、');
            var skSys = ctx.promptText('wbSkeleton', { batchSize: batchSize })
              + charRef
              + '\n【角色】：' + ctx.state.charName + ' | ' + String(ctx.state.charDesc || '').substring(0, 300)
              + (existingTitles ? '\n【已有条目禁止重复】：' + existingTitles : '')
              + (wbGoal ? '\n【方向·优先】：' + wbGoal : '')
              + (presetsStr ? '\n【文风】：' + presetsStr.substring(0, 200) : '')
              + (wvWbHint || '')
              + searchInjection
              + '\n【输出】：JSON数组 [{ "comment":"标题", "content":"一句话", "keys":["词"], "strategy":"selective" }, ...]';
            try {
              var aiResp2 = await ctx.fetchAIContent({
                context: '世界书骨架/批次' + batchIndex,
                url: url, headers: headers, model: model,
                messages: [{ role: 'system', content: skSys }, { role: 'user', content: '生成' + batchSize + '条骨架' }],
                temperature: 0.9, httpErrorPrefix: 'HTTP ', signal: engineSignal,
              });
              var skeletons;
              try { skeletons = ctx.extractJsonArray(aiResp2.content, '骨架' + batchIndex); }
              catch (pe) { skeletons = [ctx.extractJsonObj(aiResp2.content, '骨架fb')]; }
              skeletons.forEach(function(sk) {
                if (!sk || !sk.comment) return;
                ctx.state.worldbookEntries.push({
                  comment: sk.comment || '未命名',
                  content: sk.content || '(待展开)',
                  keys: Array.isArray(sk.keys) ? sk.keys : [],
                  strategy: sk.strategy || 'selective',
                  position: 4, depth: 4, role: 0, order: 100, prob: 100,
                });
              });
              ctx.renderAll();
              ctx.save();
            } catch (bErr) {
              if (ctx.isTrackedAbort(bErr)) throw bErr;
              if (hacker) hacker.setDetail('\u26a0\ufe0f 批次失败: ' + bErr.message);
            }
            remaining -= batchSize;
            await sleep(200);
          }
        }

        // —— 开场白 ——
        await ctx.panels.aiEngine._generateGreetingPhase({
          url: url, headers: headers, model: model,
          charRef: charRef, greetEl: greetEl, hasWorldview: hasWorldview,
          presetsStr: presetsStr, wvGreetHint: wvGreetHint, searchInjection: searchInjection,
          engineSignal: engineSignal, engineTask: engineTask, aiCenter: aiCenter,
          hacker: hacker, statusEl: statusEl,
          currentStep: currentStep, totalSteps: totalSteps,
        });

        if (aiCenter && engineTask) aiCenter.succeed(engineTask.id);
        var doneMode = genMode === ENGINE_GEN_MODE_FULL ? '完整条目' : '骨架';
        if (hacker) {
          hacker.stop();
          hacker.setPhase('\ud83c\udf89 生成完毕');
          hacker.setProgress(totalSteps, totalSteps);
          hacker.setDetail('角色「' + ctx.state.charName + '」+ ' + ctx.state.worldbookEntries.length + ' 条' + doneMode + ' + 开场白');
          setTimeout(function() { if (hacker) hacker.hide(); }, 5000);
        }
        if (statusEl) {
          statusEl.textContent = '\u2705 完毕！' + ctx.state.worldbookEntries.length + ' 条' + doneMode
            + (genMode === ENGINE_GEN_MODE_SKELETON ? '（可用 AI重写展开）' : '');
          statusEl.style.color = '#10b981';
        }
      } catch (err) {
        if (ctx.isTrackedAbort(err)) {
          if (aiCenter && engineTask && engineTask.status !== 'cancelled') aiCenter.cancel(engineTask.id);
          if (hacker) { hacker.stop(); hacker.setPhase('\u23f9 已取消'); setTimeout(function() { if (hacker) hacker.hide(); }, 2000); }
          if (statusEl) { statusEl.textContent = '\u23f9 已取消'; statusEl.style.color = 'var(--color-text-muted)'; }
        } else {
          if (aiCenter && engineTask) aiCenter.fail(engineTask.id, err);
          if (hacker) { hacker.stop(); hacker.setPhase('\u274c 中止'); hacker.setDetail(err.message); setTimeout(function() { if (hacker) hacker.hide(); }, 3000); }
          if (statusEl) { statusEl.textContent = '\u274c 中止: ' + err.message; statusEl.style.color = '#ef4444'; }
        }
      } finally {
        if (btnEl) btnEl.disabled = false;
      }
    },

    _enrichOutlineSlots: async function(o) {
      var slots = o.outlineSlots || [];
      var currentStep = o.currentStep || 0;
      var failCount = 0;
      for (var i = 0; i < slots.length; i++) {
        if (o.engineSignal && o.engineSignal.aborted) throw new DOMException('已取消', 'AbortError');
        currentStep++;
        var slot = slots[i];
        var typeLab = OUTLINE_TYPE_LABELS[slot.type] || slot.type;
        if (o.aiCenter && o.engineTask) {
          o.aiCenter.setProgress(o.engineTask.id, currentStep / o.totalSteps, '丰满 ' + (i + 1) + '/' + slots.length);
        }
        if (o.hacker) {
          o.hacker.setPhase('\u2728 丰满 ' + (i + 1) + '/' + slots.length + ' · ' + typeLab);
          o.hacker.setProgress(currentStep, o.totalSteps);
          o.hacker.setDetail(slot.comment);
        }
        if (o.statusEl) {
          o.statusEl.textContent = '\u23f3 丰满 ' + (i + 1) + '/' + slots.length + '「' + slot.comment + '」';
          o.statusEl.style.color = '#38bdf8';
        }

        var entryIdx = -1;
        for (var j = 0; j < ctx.state.worldbookEntries.length; j++) {
          if (ctx.state.worldbookEntries[j].comment === slotToWorldbookEntry(slot, 0).comment
            || ctx.state.worldbookEntries[j].comment === slot.comment
            || (ctx.state.worldbookEntries[j].outlineBlurb === slot.blurb && isSkeletonEntry(ctx.state.worldbookEntries[j]))) {
            entryIdx = j;
            break;
          }
        }
        if (entryIdx < 0) entryIdx = i;

        var enrichSys = ctx.promptText('wbEnrichFromOutline')
          + (o.charRef || '')
          + formatOutlineRef(slots)
          + formatEnrichedEntriesRef(ctx.state.worldbookEntries)
          + buildAdultHintsForWbType(slot.type)
          + (o.wvWbHint || '')
          + (o.presetsStr ? '\n【文风】：' + String(o.presetsStr).substring(0, 200) : '')
          + (o.searchInjection || '');
        var enrichUser = [
          '【本条大纲】type=' + slot.type + '（' + typeLab + '）',
          '标题：' + slot.comment,
          '职责：' + slot.blurb,
          '关联：' + ((slot.links && slot.links.length) ? slot.links.join('、') : '无'),
          '请展开为完整词条 JSON。',
        ].join('\n');

        var ok = false;
        for (var attempt = 0; attempt < 2 && !ok; attempt++) {
          try {
            var aiEn = await ctx.fetchAIContent({
              context: '大纲丰满/' + slot.comment,
              url: o.url, headers: o.headers, model: o.model,
              messages: [{ role: 'system', content: enrichSys }, { role: 'user', content: enrichUser }],
              temperature: 0.75,
              httpErrorPrefix: '丰满失败 HTTP ',
              signal: o.engineSignal,
            });
            var ed = ctx.extractJsonObj(aiEn.content, '大纲丰满/' + slot.comment);
            var target = ctx.state.worldbookEntries[entryIdx] || slotToWorldbookEntry(slot, 100 + i);
            target.comment = ed.comment || target.comment || slot.comment;
            target.content = ed.content || target.content;
            target.keys = Array.isArray(ed.keys) ? ed.keys : (target.keys || slot.keys || []);
            if (ed.strategy) target.strategy = ed.strategy;
            if (ed.position != null) target.position = parseInt(ed.position, 10) || target.position;
            target.outlineType = slot.type;
            target.outlineLinks = (slot.links || []).slice();
            ctx.state.worldbookEntries[entryIdx] = target;
            ctx.renderAll();
            ctx.save();
            ok = true;
          } catch (enErr) {
            if (ctx.isTrackedAbort(enErr)) throw enErr;
            if (attempt === 1) {
              failCount++;
              if (o.hacker) o.hacker.setDetail('\u26a0\ufe0f 跳过「' + slot.comment + '」: ' + enErr.message);
            }
          }
        }
        await sleep(180);
      }

      // 交叉补边
      currentStep++;
      if (o.aiCenter && o.engineTask) o.aiCenter.setProgress(o.engineTask.id, currentStep / o.totalSteps, '交叉补边');
      if (o.hacker) { o.hacker.setPhase('\ud83e\udd1d 交叉补边...'); o.hacker.setProgress(currentStep, o.totalSteps); }
      if (o.statusEl) o.statusEl.textContent = '\u23f3 交叉补边（互指）...';
      try {
        var crossSys = ctx.promptText('wbCrossLink')
          + formatEnrichedEntriesRef(ctx.state.worldbookEntries, { maxEntries: 16, perEntryChars: 160 });
        var crossResp = await ctx.fetchAIContent({
          context: '世界书交叉补边',
          url: o.url, headers: o.headers, model: o.model,
          messages: [
            { role: 'system', content: crossSys },
            { role: 'user', content: '为需要互指的条目输出 patches。' },
          ],
          temperature: 0.5,
          httpErrorPrefix: '交叉补边 HTTP ',
          signal: o.engineSignal,
        });
        var crossObj = ctx.extractJsonObj(crossResp.content, '交叉补边');
        var patches = Array.isArray(crossObj && crossObj.patches) ? crossObj.patches : [];
        patches.forEach(function(p) {
          if (!p || !p.comment || !p.append) return;
          var hit = ctx.state.worldbookEntries.find(function(e) { return e.comment === p.comment; });
          if (!hit) return;
          var append = String(p.append).trim();
          if (!append) return;
          if (String(hit.content || '').indexOf(append.slice(0, 24)) >= 0) return;
          hit.content = String(hit.content || '').trim() + '\n' + append;
        });
        if (patches.length) { ctx.renderAll(); ctx.save(); }
      } catch (cErr) {
        if (ctx.isTrackedAbort(cErr)) throw cErr;
        if (o.hacker) o.hacker.setDetail('\u26a0\ufe0f 交叉补边跳过: ' + cErr.message);
      }
      if (failCount && o.statusEl) {
        o.statusEl.textContent = '\u26a0\ufe0f 丰满完成（' + failCount + ' 条失败已跳过）';
      }
      return currentStep;
    },

    _generateGreetingPhase: async function(o) {
      var currentStep = (o.currentStep || 0) + 1;
      if (o.engineSignal && o.engineSignal.aborted) throw new DOMException('已取消', 'AbortError');
      if (o.aiCenter && o.engineTask) o.aiCenter.setProgress(o.engineTask.id, currentStep / o.totalSteps, '开场白');
      if (o.hacker) { o.hacker.setPhase('\ud83d\udcac 开场白...'); o.hacker.setProgress(currentStep, o.totalSteps); }
      if (o.statusEl) { o.statusEl.textContent = '\u23f3 生成开场白...'; o.statusEl.style.color = '#38bdf8'; }
      var greetUserDir = (o.greetEl && o.greetEl.value.trim())
        || (o.hasWorldview
          ? '请基于世界观预设与角色/世界书，生成沉浸式主开场白与 2 条备选'
          : '根据角色与世界书生成沉浸式主开场白与 2 条备选');
      var greetSys = ctx.promptText('greetingGen')
        + (o.charRef || '')
        + formatWbSkeletonRef(ctx.state.worldbookEntries)
        + formatEnrichedEntriesRef(ctx.state.worldbookEntries, { maxEntries: 8, perEntryChars: 120 })
        + (o.presetsStr ? '\n【文风】：' + String(o.presetsStr).substring(0, 200) : '')
        + '\n【约束】开场白面向主角互动，勿写成恶堕进度或 NTL 调教说明书。'
        + (o.wvGreetHint || '')
        + (o.searchInjection || '');
      var aiResp3 = await ctx.fetchAIContent({
        context: '开场白/阶段3',
        url: o.url, headers: o.headers, model: o.model,
        messages: [{ role: 'system', content: greetSys }, { role: 'user', content: greetUserDir }],
        temperature: 0.88,
        httpErrorPrefix: '开场白生成失败 HTTP ',
        signal: o.engineSignal,
      });
      var greetData = ctx.extractJsonObj(aiResp3.content, '开场白/阶段3');
      ctx.state.firstMes = greetData.firstMes || '';
      ctx.state.altGreetings = (greetData.altGreetings && Array.isArray(greetData.altGreetings)) ? greetData.altGreetings : [];
      window.__altGreetings__ = ctx.state.altGreetings;
      if (window.__renderAltGreetings__) window.__renderAltGreetings__();
      ctx.save();
      return currentStep;
    },

    /** 大纲暂停后继续丰满 + 开场白 */
    continueEnrichFromOutline: async function() {
      var contBtn = ctx.$('btnAiContinueEnrich');
      var statusEl = ctx.$('aiStatus');
      var apiUrlEl = ctx.$('apiUrl');
      var apiKeyEl = ctx.$('apiKey');
      var modelEl = ctx.$('modelSelect');
      var greetEl = ctx.$('greetingPrompt');
      var url = (apiUrlEl ? apiUrlEl.value : '').replace(/\/$/, '') + '/chat/completions';
      var key = apiKeyEl ? apiKeyEl.value.trim() : '';
      var model = modelEl ? modelEl.value : '';
      if (!model) { window.alert('请先选择模型'); return; }

      var slots = getPendingOutlineSlots();
      if (!slots || !slots.length) {
        window.alert('没有待丰满的大纲条目。请先用「完整生成」并勾选「大纲完成后暂停」。');
        syncContinueEnrichBtn();
        return;
      }

      var headers = { 'Content-Type': 'application/json' };
      if (key) headers['Authorization'] = 'Bearer ' + key;
      var presetsStr = ctx.panels.aiEngine.getActivePresetsStr();
      var wvItems = getWorldviewPresetItems();
      var wvWbHint = buildActiveWorldviewHint('worldbook');
      var wvGreetHint = buildActiveWorldviewHint('greeting');
      var charRef = formatCharRefForPrompt({
        charName: ctx.state.charName,
        charDesc: ctx.state.charDesc,
        wbName: ctx.state.wbName,
        creatorNotes: ctx.state.creatorNotes,
        tags: ctx.state.charTags,
      });
      var totalSteps = slots.length + 2;
      var hacker = window.__hackerAnim__;
      var aiCenter = window.__aiTaskCenter__;
      var engineTask = aiCenter ? aiCenter.create({
        type: 'engine_enrich',
        title: '按大纲丰满世界书',
        target: slots.length + ' 条',
      }) : null;
      if (contBtn) contBtn.disabled = true;
      if (hacker) { hacker.start(); hacker.setPhase('继续丰满...'); hacker.setProgress(0, totalSteps); }

      try {
        await ctx.panels.aiEngine._enrichOutlineSlots({
          url: url, headers: headers, model: model,
          charRef: charRef, outlineSlots: slots,
          wvWbHint: wvWbHint, presetsStr: presetsStr, searchInjection: '',
          engineSignal: engineTask && engineTask.signal,
          engineTask: engineTask, aiCenter: aiCenter,
          hacker: hacker, statusEl: statusEl,
          currentStep: 0, totalSteps: totalSteps,
        });
        await ctx.panels.aiEngine._generateGreetingPhase({
          url: url, headers: headers, model: model,
          charRef: charRef, greetEl: greetEl,
          hasWorldview: wvItems.length > 0,
          presetsStr: presetsStr, wvGreetHint: wvGreetHint, searchInjection: '',
          engineSignal: engineTask && engineTask.signal,
          engineTask: engineTask, aiCenter: aiCenter,
          hacker: hacker, statusEl: statusEl,
          currentStep: slots.length + 1, totalSteps: totalSteps,
        });
        setPendingOutlineSlots(null);
        if (aiCenter && engineTask) aiCenter.succeed(engineTask.id);
        if (hacker) { hacker.stop(); hacker.setPhase('\u2705 丰满完成'); setTimeout(function() { if (hacker) hacker.hide(); }, 3000); }
        if (statusEl) { statusEl.textContent = '\u2705 丰满与开场白完成'; statusEl.style.color = '#10b981'; }
      } catch (err) {
        if (aiCenter && engineTask) {
          if (ctx.isTrackedAbort(err)) aiCenter.cancel(engineTask.id);
          else aiCenter.fail(engineTask.id, err);
        }
        if (statusEl) { statusEl.textContent = '\u274c ' + (err.message || err); statusEl.style.color = '#ef4444'; }
        if (hacker) { hacker.stop(); setTimeout(function() { if (hacker) hacker.hide(); }, 2000); }
      } finally {
        if (contBtn) contBtn.disabled = false;
      }
    },

    // ===== AI 单条世界书 =====

    generateContextAwareWBEntry: async function(customDirection, stepInfo, signal) {
      if (!stepInfo) stepInfo = '';
      var apiUrlEl = ctx.$('apiUrl');
      var apiKeyEl = ctx.$('apiKey');
      var modelEl  = ctx.$('modelSelect');
      var url   = (apiUrlEl ? apiUrlEl.value : '').replace(/\/$/, '') + '/chat/completions';
      var key   = apiKeyEl ? apiKeyEl.value.trim() : '';
      var model = modelEl ? modelEl.value : '';
      var searchInjection = '';

      if (window.__searchConfig__ && window.__searchConfig__.isEnabled()) {
        var sq = customDirection || ctx.state.charName + ' ' + ctx.state.charDesc.substring(0, 100);
        var sr = await ctx.panels.aiEngine.performSearchIfEnabled(sq);
        searchInjection = sr.searchText || '';
      }

      var wbIncludeOtherEntries = ctx.$('wbIncludeOtherEntries');
      var includeOthers = !wbIncludeOtherEntries || wbIncludeOtherEntries.checked;

      var existingCtx = includeOthers
        ? ctx.state.worldbookEntries.map(function(e) {
            return '[标题:' + e.comment + '] (策略:' + e.strategy + '): ' + e.content;
          }).join('\n-----\n')
        : '';

      var ctxStr = includeOthers
        ? (existingCtx ? '\n【已有设定(不可重复)】：\n' + existingCtx : '\n【当前世界书为空】')
        : '\n【已跳过融合已有世界书条目】';

      var presetsStr  = ctx.panels.aiEngine.getActivePresetsStr();
      var presetBlock = presetsStr ? '\n\n【文风约束】：\n' + presetsStr : '';
      var wbIncludeCharData = ctx.$('wbIncludeCharData');
      // 默认不注入主角 Description（两管道隔离）；仅高级勾选时作背景参考
      var includeChar = wbIncludeCharData && wbIncludeCharData.checked;
      var charBlock   = includeChar
        ? '\n【高级·主角背景参考（勿写入本条为角色设定）】：' + ctx.state.charName + ' | ' + String(ctx.state.charDesc || '').slice(0, 2000) + '\n'
        : '\n【管道】世界书生成与主角角色设定分离；默认不读取主角 Description。\n';
      var adultHints = (typeof window.__buildAdultPromptHints__ === 'function')
        ? window.__buildAdultPromptHints__()
        : { nsfw: buildNsfwFlavorHint(), ntl: buildNtlHintForPrompt(), canon: buildAdultCanonHint() };
      var wvWbSingle = buildActiveWorldviewHint('worldbook');
      var sysPrompt   = (ctx.promptText('wbSingle') || '')
        + stepInfo + charBlock + '\n' + ctxStr + '\n' + presetBlock
        + (adultHints.nsfw || '') + (adultHints.ntl || '') + (adultHints.vessel || '')
        + (adultHints.canon || '')
        + (wvWbSingle || '')
        + searchInjection
        + '\n【说明】人物类条目标题建议「[小说人物] 名字」；成人内容只写世界书，勿写主角卡面。'
        + '\n【冲突处理】若「用户额外要求」与「世界观预设」冲突，以用户额外要求为准。'
        + '\n【输出】：1个JSON对象 { "comment": "标题", "content": "详细设定(至少100字)", "keys": ["触发词"], "strategy": "selective 或 constant", "position": 4 }';
      var userPrompt  = customDirection ? '【方向·优先】：' + customDirection : '【自由发挥，拒绝重复；有世界观预设则紧贴预设语汇】';
      var headers     = { 'Content-Type': 'application/json' };
      if (key) headers['Authorization'] = 'Bearer ' + key;

      var aiResp = await ctx.fetchAIContent({
        context: '世界书单条生成',
        url: url,
        headers: headers,
        model: model,
        messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: userPrompt }],
        temperature: 0.8,
        httpErrorPrefix: '请求失败 HTTP ',
        signal: signal,
      });
      var entry = ctx.extractJsonObj(aiResp.content, '世界书单条生成');
      ctx.state.worldbookEntries.push({
        comment: entry.comment || '拓展设定',
        content: entry.content || '',
        keys: Array.isArray(entry.keys) ? entry.keys : [],
        strategy: entry.strategy || 'selective',
        position: parseInt(entry.position) || 4,
        depth: 4,
        role: 0,
        order: 100,
        prob: 100,
      });
    },

    runSingleWbEntry: async function() {
      var modelEl = ctx.$('modelSelect');
      if (!modelEl || !modelEl.value) { window.alert('请先选择模型！'); return; }
      var btnEl = ctx.$('btnAiSingleWb');
      ctx.setBtnBusy(btnEl, true, '\u23f3 Roll中...');
      try {
        await ctx.runTracked({
          type: 'wb_single',
          title: '世界书单条生成',
          target: ((ctx.$('wbSinglePrompt') ? ctx.$('wbSinglePrompt').value : '') || '').slice(0, 40),
        }, async function(task) {
          await ctx.panels.aiEngine.generateContextAwareWBEntry(
            (ctx.$('wbSinglePrompt') ? ctx.$('wbSinglePrompt').value : '').trim(),
            '单条补充。',
            task.signal
          );
        });
        ctx.renderAll();
        ctx.save();
        var promptEl = ctx.$('wbSinglePrompt');
        if (promptEl) promptEl.value = '';
        closeWbModalSingle();
      } catch (err) {
        if (!ctx.isTrackedAbort(err)) window.alert('生成失败: ' + err.message);
      } finally {
        ctx.setBtnBusy(btnEl, false);
      }
    },

    // ===== AI 字符串 tag 生成 =====

    runCharTagsGen: async function() {
      var apiUrlEl = ctx.$('apiUrl');
      var modelEl  = ctx.$('modelSelect');
      var url   = (apiUrlEl ? apiUrlEl.value : '').replace(/\/$/, '');
      var model = modelEl ? modelEl.value : '';

      if (!url || !model) {
        setCharTagsAiTip('请先在「AI 配置」填写接口与模型', 'warn');
        return;
      }

      var maxChars = getTagContextChars();
      var ctxText = buildTagGenContext({
        description: ctx.state.charDesc,
        firstMes: ctx.state.firstMes,
        altGreetings: ctx.state.altGreetings || [],
        worldbookEntries: ctx.state.worldbookEntries,
      }, maxChars);

      if (!String(ctxText || '').trim()) {
        setCharTagsAiTip('请先填写角色设定或开场白等内容', 'warn');
        return;
      }

      var apiKeyEl = ctx.$('apiKey');
      var key = apiKeyEl ? apiKeyEl.value.trim() : '';
      var headers = { 'Content-Type': 'application/json' };
      if (key) headers['Authorization'] = 'Bearer ' + key;
      var sysPrompt = ctx.promptText('charTagsGen')
        || '根据角色设定与世界书，生成 5-12 个短中文分类标签。只输出 JSON 数组，例如 ["奇幻","恋爱"]。不要解释。';
      // 主角标签：不注入 NSFW 口味

      var btnEl = ctx.$('btnAiGenCharTags');
      if (btnEl) btnEl.disabled = true;
      var oldLabel = btnEl ? btnEl.textContent : '';
      ctx.setBtnBusy(btnEl, true, '生成中…');
      setCharTagsAiTip('正在生成标签…', null);

      try {
        await ctx.runTracked({
          type: 'char_tags_generate',
          title: '角色标签 AI 生成',
          target: (ctx.state.charName || '').slice(0, 40) || '标签',
        }, async function(task) {
          var aiResp = await ctx.fetchAIContent({
            context: '角色标签生成',
            url: url + '/chat/completions',
            headers: headers,
            model: model,
            messages: [
              { role: 'system', content: sysPrompt },
              { role: 'user', content: ctxText },
            ],
            temperature: 0.4,
            httpErrorPrefix: '标签生成失败 HTTP ',
            signal: task && task.signal,
          });
          var parsed = parseTagsFromAiText(aiResp.content);
          if (!parsed.length) throw new Error('未解析到有效标签');
          var merged = mergeCharTags(ctx.state.charTags, parsed);
          var before = normalizeCharTags(ctx.state.charTags).length;
          setCharTags(merged);
          var added = normalizeCharTags(merged).length - before;
          setCharTagsAiTip(
            added > 0 ? ('已合并 ' + added + ' 个新标签（共 ' + normalizeCharTags(merged).length + '）') : '无新增（已与现有标签去重）',
            'ok'
          );
        });
      } catch (err) {
        if (ctx.isTrackedAbort(err)) setCharTagsAiTip('已停止', 'warn');
        else setCharTagsAiTip(String(err.message || err), 'err');
      } finally {
        ctx.setBtnBusy(btnEl, false);
      }
    },

    // ===== 预览 =====

    updatePreview: function() {
      var fj = generateCardJSON(ctx.state);
      if (window.updatePreviewPanel) window.updatePreviewPanel(fj);
    },

    applyWorldviewPresetId: function(id) {
      fillWorldviewSelect(String(id || '').trim());
    },

    getWorldviewPresetId: function() {
      return getWorldviewPresetId();
    },

    getWorldviewPresetItems: function() {
      return getWorldviewPresetItems();
    },

    applyWorldviewPresetItems: function(items, legacyId) {
      setWorldviewPresetItems(items, legacyId);
      syncWorldframeFromPresetItems(getWorldviewPresetItems());
      refreshWorldviewSummary();
    },

    refreshWorldviewSummary: refreshWorldviewSummary,

    // ===== 绑定事件 =====

    bind: function() {
      refreshWorldviewSummary();
      syncContinueEnrichBtn();
      window.__refreshAiEngineWorldviewSummary__ = refreshWorldviewSummary;
      window.__syncAiContinueEnrichBtn__ = syncContinueEnrichBtn;
      window.addEventListener('worldview-presets-changed', function() {
        refreshWorldviewSummary();
      });
      window.addEventListener('nsfw-config-changed', function() {
        refreshWorldviewSummary();
      });

      var presetInput = ctx.$('presetInput');
      if (presetInput) {
        presetInput.addEventListener('change', function(e) {
          var file = e.target.files[0]; if (!file) return;
          var reader = new FileReader();
          reader.onload = function(ev) {
            try {
              var data = JSON.parse(ev.target.result);
              parsedPresetList = [];
              if (data.prompts) {
                var ao = (data.prompt_order && data.prompt_order.length > 0)
                  ? data.prompt_order[data.prompt_order.length - 1].order : [];
                var ei = ao.filter(function(i) { return i.enabled; }).map(function(i) { return i.identifier; });
                data.prompts.forEach(function(p) {
                  if (p.content && !p.marker) {
                    parsedPresetList.push({
                      id:                 p.identifier,
                      name:               p.name || '规则',
                      content:            p.content,
                      role:               p.role || 'system',
                      injection_position: p.injection_position || 0,
                      injection_depth:    p.injection_depth || 4,
                      enabled:            ao.length > 0 ? ei.indexOf(p.identifier) >= 0 : true,
                    });
                  }
                });
              }
              ctx.panels.aiEngine.renderPresetList();
              persistAiConfig();
            } catch (err) {
              var presetStatus = ctx.$('presetStatus');
              if (presetStatus) {
                presetStatus.innerHTML = '\u274c 解析失败: ' + err.message;
                presetStatus.style.color = '#ef4444';
              }
              var presetListContainer = ctx.$('presetListContainer');
              if (presetListContainer) presetListContainer.style.display = 'none';
            }
          };
          reader.readAsText(file);
        });
      }

      var btnFetchModels = ctx.$('btnFetchModels');
      if (btnFetchModels) {
        btnFetchModels.addEventListener('click', function() {
          ctx.panels.aiEngine.fetchModels();
        });
      }

      var btnAiGenerate = ctx.$('btnAiGenerate');
      if (btnAiGenerate) {
        btnAiGenerate.addEventListener('click', function() {
          ctx.panels.aiEngine.runFullGeneration();
        });
      }

      var btnAiContinueEnrich = ctx.$('btnAiContinueEnrich');
      if (btnAiContinueEnrich) {
        btnAiContinueEnrich.addEventListener('click', function() {
          ctx.panels.aiEngine.continueEnrichFromOutline();
        });
      }

      var genModeEl = ctx.$('aiEngineGenMode');
      if (genModeEl) {
        genModeEl.addEventListener('change', function() {
          syncEngineModeUi();
          persistAiConfig();
        });
      }
      var pauseEl = ctx.$('aiEnginePauseAfterOutline');
      if (pauseEl) {
        pauseEl.addEventListener('change', function() {
          persistAiConfig();
        });
      }
      var skCountEl = ctx.$('wbSkeletonCount');
      if (skCountEl) {
        skCountEl.addEventListener('change', function() { persistAiConfig(); });
        skCountEl.addEventListener('input', function() { persistAiConfig(); });
      }
      document.querySelectorAll('.wb-count-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          // AIPanel 已改 value；下一帧持久化
          setTimeout(function() { persistAiConfig(); }, 0);
        });
      });

      syncEngineModeUi();

      // 单条世界书按钮由 worldbook.bind 独占（避免双绑定）

      var btnAiGenCharTags = ctx.$('btnAiGenCharTags');
      if (btnAiGenCharTags) {
        btnAiGenCharTags.addEventListener('click', function() {
          ctx.panels.aiEngine.runCharTagsGen();
        });
      }
    },

    /** 从 AI 配置恢复生成模式 / 暂停选项 / 条数 */
    applyEnginePipelineOptions: function(cfg) {
      if (!cfg || typeof cfg !== 'object') return;
      var modeEl = ctx.$('aiEngineGenMode');
      if (modeEl && cfg.engineGenMode != null) {
        modeEl.value = normalizeEngineGenMode(cfg.engineGenMode);
      }
      var pauseEl = ctx.$('aiEnginePauseAfterOutline');
      if (pauseEl && cfg.pauseAfterOutline != null) {
        pauseEl.checked = !!cfg.pauseAfterOutline;
      }
      if (cfg.skeletonCount != null && window.__setSkeletonCount__) {
        window.__setSkeletonCount__(cfg.skeletonCount);
      }
      syncEngineModeUi();
    },
  };
}
