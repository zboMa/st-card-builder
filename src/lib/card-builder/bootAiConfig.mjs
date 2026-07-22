/**
 * 制卡 boot：AI 配置持久化与 window 桥（拆自 browserApp）
 */
import { escapeHtml } from '../utils.mjs';
import { buildExportChecklist } from './exportChecklist.mjs';
import { countNovelUnsynced } from './fieldValidation.mjs';

export function attachBootAiConfig(ctx) {
  var AI_KEY = 'st_v3_builder_ai_config';

  function saveAIConfig() {
    var presetList = ctx.panels.aiEngine && ctx.panels.aiEngine.getParsedPresetList
      ? ctx.panels.aiEngine.getParsedPresetList()
      : [];
    var worldviewPresetItems = Array.isArray(ctx.state.worldviewPresetItems)
      ? ctx.state.worldviewPresetItems
      : (ctx.panels.aiEngine && ctx.panels.aiEngine.getWorldviewPresetItems
        ? ctx.panels.aiEngine.getWorldviewPresetItems()
        : []);
    var worldviewPresetId = worldviewPresetItems[0] ? worldviewPresetItems[0].id : '';
    localStorage.setItem(AI_KEY, JSON.stringify({
      url: (document.getElementById('apiUrl') || {}).value || '',
      key: (document.getElementById('apiKey') || {}).value || '',
      model: (document.getElementById('modelSelect') || {}).value || '',
      debug: !!(document.getElementById('aiDebugEnable') && document.getElementById('aiDebugEnable').checked),
      tagContextChars: document.getElementById('tagContextChars')
        ? (parseInt(document.getElementById('tagContextChars').value, 10) || 12000)
        : 12000,
      embeddingModel: (document.getElementById('embeddingModel') || {}).value || '',
      embeddingApiUrl: (document.getElementById('embeddingApiUrl') || {}).value || '',
      embeddingApiKey: (document.getElementById('embeddingApiKey') || {}).value || '',
      novelRag: typeof window.__getNovelRagOptions__ === 'function'
        ? window.__getNovelRagOptions__()
        : { enabled: true, budget: 12000 },
      presetList: presetList,
      // 兼容旧键：主源已迁入卡草稿 worldviewPresetItems
      worldviewPresetId: String(worldviewPresetId || ''),
      worldviewPresetItems: Array.isArray(worldviewPresetItems)
        ? worldviewPresetItems.map(function(it) {
            return { id: String((it && it.id) || ''), note: String((it && it.note) || '') };
          }).filter(function(it) { return it.id; })
        : [],
      nsfwEnabled: !!ctx.state.nsfwEnabled,
      nsfwFlavor: ctx.state.nsfwFlavor || '',
      nsfwFlavorItems: Array.isArray(ctx.state.nsfwFlavorItems)
        ? ctx.state.nsfwFlavorItems.map(function(it) {
            return { id: String((it && it.id) || ''), note: String((it && it.note) || '') };
          }).filter(function(it) { return it.id; })
        : (ctx.state.nsfwFlavor ? [{ id: ctx.state.nsfwFlavor, note: '' }] : []),
      eroticPostureItems: Array.isArray(ctx.state.eroticPostureItems)
        ? ctx.state.eroticPostureItems.map(function(it) {
            return { id: String((it && it.id) || ''), note: String((it && it.note) || '') };
          }).filter(function(it) { return it.id; })
        : [],
      eroticSpeechItems: Array.isArray(ctx.state.eroticSpeechItems)
        ? ctx.state.eroticSpeechItems.map(function(it) {
            return { id: String((it && it.id) || ''), note: String((it && it.note) || '') };
          }).filter(function(it) { return it.id; })
        : [],
      ntlEnabled: !!ctx.state.ntlEnabled,
      ntlTabooTypes: (ctx.state.ntlTabooTypes || []).slice(),
      ntlTabooItems: Array.isArray(ctx.state.ntlTabooItems)
        ? ctx.state.ntlTabooItems.map(function(it) {
            return { id: String((it && it.id) || ''), note: String((it && it.note) || '') };
          }).filter(function(it) { return it.id; })
        : (ctx.state.ntlTabooTypes || []).map(function(id) { return { id: String(id), note: '' }; }),
      corruptionEnabled: !!ctx.state.corruptionEnabled,
      corruptionPreset: ctx.state.corruptionPreset || '5',
      corruptionCustomBrief: ctx.state.corruptionCustomBrief || '',
      corruptionExtraNotes: ctx.state.corruptionExtraNotes || '',
      corruptionStageNames: Array.isArray(ctx.state.corruptionStageNames) ? ctx.state.corruptionStageNames.slice() : [],
      corruptionSelectedNames: Array.isArray(ctx.state.corruptionSelectedNames) ? ctx.state.corruptionSelectedNames.slice() : [],
      corruptionDefaultFemaleOnly: ctx.state.corruptionDefaultFemaleOnly !== false,
      corruptionSyncStatusBar: ctx.state.corruptionSyncStatusBar !== false,
      adultWorldframe: ctx.state.adultWorldframe || '',
      adultWorldframeForced: ctx.state.adultWorldframeForced || '',
      engineGenMode: (document.getElementById('aiEngineGenMode') || {}).value || 'full',
      pauseAfterOutline: !!(document.getElementById('aiEnginePauseAfterOutline')
        && document.getElementById('aiEnginePauseAfterOutline').checked),
      skeletonCount: typeof window.__getSkeletonCount__ === 'function'
        ? window.__getSkeletonCount__()
        : (parseInt((document.getElementById('wbSkeletonCount') || {}).value, 10) || 10),
    }));
    ctx.updateAIDebugStatus();
  }

  function loadAIConfig() {
    try {
      var c = JSON.parse(localStorage.getItem(AI_KEY));
      if (!c) return;
      if (c.url) {
        var apiUrl = document.getElementById('apiUrl');
        if (apiUrl) apiUrl.value = c.url;
      }
      if (c.key) {
        var apiKey = document.getElementById('apiKey');
        if (apiKey) apiKey.value = c.key;
      }
      if (c.model) {
        var modelSel = document.getElementById('modelSelect');
        if (modelSel) {
          var em = escapeHtml(c.model);
          modelSel.innerHTML = '<option value="' + em + '">' + em + '</option>';
          modelSel.value = c.model;
        }
      }
      var dbg = document.getElementById('aiDebugEnable');
      if (dbg) dbg.checked = !!c.debug;
      if (c.tagContextChars != null && window.__setTagContextChars__) {
        window.__setTagContextChars__(c.tagContextChars);
      }
      try {
        if (c.embeddingApiUrl != null) {
          localStorage.setItem('st_v3_builder_embedding_api_url', String(c.embeddingApiUrl || ''));
          var embUrl = document.getElementById('embeddingApiUrl');
          if (embUrl) embUrl.value = String(c.embeddingApiUrl || '');
        }
        if (c.embeddingApiKey != null) {
          localStorage.setItem('st_v3_builder_embedding_api_key', String(c.embeddingApiKey || ''));
          var embKey = document.getElementById('embeddingApiKey');
          if (embKey) embKey.value = String(c.embeddingApiKey || '');
        }
        if (c.embeddingModel != null) {
          localStorage.setItem('st_v3_builder_embedding_model', String(c.embeddingModel || ''));
          var embModel = document.getElementById('embeddingModel');
          if (embModel) embModel.value = String(c.embeddingModel || '');
        }
        if (c.novelRag) {
          localStorage.setItem('st_v3_builder_novel_rag', JSON.stringify(c.novelRag));
          var en = document.getElementById('assistantNovelRagEnable');
          var bu = document.getElementById('assistantNovelRagBudget');
          if (en) en.checked = c.novelRag.enabled !== false;
          if (bu && c.novelRag.budget) bu.value = String(c.novelRag.budget);
        }
      } catch (eRag) { /* ignore */ }
      if (Array.isArray(c.nsfwFlavorItems) && c.nsfwFlavorItems.length) {
        ctx.state.nsfwFlavorItems = c.nsfwFlavorItems.map(function(it) {
          return { id: String((it && it.id) || ''), note: String((it && it.note) || '') };
        }).filter(function(it) { return it.id; });
        ctx.state.nsfwFlavor = ctx.state.nsfwFlavorItems[0] ? ctx.state.nsfwFlavorItems[0].id : '';
      } else if (c.nsfwFlavor != null) {
        ctx.state.nsfwFlavor = String(c.nsfwFlavor || '');
        ctx.state.nsfwFlavorItems = ctx.state.nsfwFlavor
          ? [{ id: ctx.state.nsfwFlavor, note: '' }]
          : [];
      }
      if (Array.isArray(c.eroticPostureItems)) {
        ctx.state.eroticPostureItems = c.eroticPostureItems.map(function(it) {
          return { id: String((it && it.id) || ''), note: String((it && it.note) || '') };
        }).filter(function(it) { return it.id; });
      }
      if (Array.isArray(c.eroticSpeechItems)) {
        ctx.state.eroticSpeechItems = c.eroticSpeechItems.map(function(it) {
          return { id: String((it && it.id) || ''), note: String((it && it.note) || '') };
        }).filter(function(it) { return it.id; });
      }
      if (c.nsfwEnabled != null) ctx.state.nsfwEnabled = !!c.nsfwEnabled;
      if (c.ntlEnabled != null) ctx.state.ntlEnabled = !!c.ntlEnabled;
      if (Array.isArray(c.ntlTabooItems) && c.ntlTabooItems.length) {
        ctx.state.ntlTabooItems = c.ntlTabooItems.map(function(it) {
          return { id: String((it && it.id) || ''), note: String((it && it.note) || '') };
        }).filter(function(it) { return it.id; });
        ctx.state.ntlTabooTypes = ctx.state.ntlTabooItems.map(function(it) { return it.id; });
      } else if (Array.isArray(c.ntlTabooTypes)) {
        ctx.state.ntlTabooTypes = c.ntlTabooTypes.slice();
        ctx.state.ntlTabooItems = ctx.state.ntlTabooTypes.map(function(id) { return { id: id, note: '' }; });
      }
      if (c.corruptionEnabled != null) ctx.state.corruptionEnabled = !!c.corruptionEnabled;
      if (c.corruptionPreset != null) ctx.state.corruptionPreset = String(c.corruptionPreset || '5');
      if (c.corruptionCustomBrief != null) ctx.state.corruptionCustomBrief = String(c.corruptionCustomBrief || '');
      if (c.corruptionExtraNotes != null) ctx.state.corruptionExtraNotes = String(c.corruptionExtraNotes || '');
      if (Array.isArray(c.corruptionStageNames)) ctx.state.corruptionStageNames = c.corruptionStageNames.slice();
      if (Array.isArray(c.corruptionSelectedNames)) ctx.state.corruptionSelectedNames = c.corruptionSelectedNames.slice();
      if (c.corruptionDefaultFemaleOnly != null) ctx.state.corruptionDefaultFemaleOnly = !!c.corruptionDefaultFemaleOnly;
      if (c.corruptionSyncStatusBar != null) ctx.state.corruptionSyncStatusBar = !!c.corruptionSyncStatusBar;
      if (typeof c.adultWorldframe === 'string') ctx.state.adultWorldframe = c.adultWorldframe || '';
      if (typeof c.adultWorldframeForced === 'string') {
        ctx.state.adultWorldframeForced = c.adultWorldframeForced || '';
      }
      // 世界观预设：若卡草稿尚无，则从旧 AI 配置迁移一次
      var draftHasWv = Array.isArray(ctx.state.worldviewPresetItems) && ctx.state.worldviewPresetItems.length > 0;
      if (!draftHasWv && (Array.isArray(c.worldviewPresetItems) || c.worldviewPresetId)) {
        if (ctx.panels.aiEngine && ctx.panels.aiEngine.applyWorldviewPresetItems) {
          ctx.panels.aiEngine.applyWorldviewPresetItems(
            c.worldviewPresetItems,
            c.worldviewPresetId || ''
          );
        } else if (ctx.panels.aiEngine && ctx.panels.aiEngine.applyWorldviewPresetId) {
          ctx.panels.aiEngine.applyWorldviewPresetId(c.worldviewPresetId || '');
        }
        ctx.save();
      } else if (ctx.panels.aiEngine && ctx.panels.aiEngine.refreshWorldviewSummary) {
        ctx.panels.aiEngine.refreshWorldviewSummary();
      }
      if (c.presetList && Array.isArray(c.presetList) && c.presetList.length > 0) {
        if (ctx.panels.aiEngine && ctx.panels.aiEngine.loadPresetsFromConfig) {
          ctx.panels.aiEngine.loadPresetsFromConfig(c.presetList);
        }
      }
      if (ctx.panels.aiEngine && ctx.panels.aiEngine.applyEnginePipelineOptions) {
        ctx.panels.aiEngine.applyEnginePipelineOptions(c);
      } else {
        var modeEl = document.getElementById('aiEngineGenMode');
        if (modeEl && c.engineGenMode) modeEl.value = String(c.engineGenMode);
        var pauseEl = document.getElementById('aiEnginePauseAfterOutline');
        if (pauseEl && c.pauseAfterOutline != null) pauseEl.checked = !!c.pauseAfterOutline;
        if (c.skeletonCount != null && window.__setSkeletonCount__) {
          window.__setSkeletonCount__(c.skeletonCount);
        }
      }
      if (ctx.panels.adultConfig && ctx.panels.adultConfig.renderWorldframeRow) {
        try { ctx.panels.adultConfig.renderWorldframeRow(); } catch (eWf) { /* ignore */ }
      }
    } catch (e) {
      console.warn('Loading AI config from storage failed', e);
    }
    ctx.updateAIDebugStatus();
  }

  // AI Config：aiEngine.bind 已挂监听；此处再挂一份到统一 saveAIConfig（含 NSFW 等）
  var apiUrlEl = document.getElementById('apiUrl');
  var apiKeyEl = document.getElementById('apiKey');
  var modelSelEl = document.getElementById('modelSelect');
  var dbgEl = document.getElementById('aiDebugEnable');
  if (apiUrlEl) apiUrlEl.addEventListener('input', saveAIConfig);
  if (apiKeyEl) apiKeyEl.addEventListener('input', saveAIConfig);
  if (modelSelEl) modelSelEl.addEventListener('change', saveAIConfig);
  if (dbgEl) dbgEl.addEventListener('change', function() {
    ctx.updateAIDebugStatus();
    saveAIConfig();
  });
  var genModeSel = document.getElementById('aiEngineGenMode');
  var pauseOutlineEl = document.getElementById('aiEnginePauseAfterOutline');
  var skCountInput = document.getElementById('wbSkeletonCount');
  if (genModeSel) genModeSel.addEventListener('change', saveAIConfig);
  if (pauseOutlineEl) pauseOutlineEl.addEventListener('change', saveAIConfig);
  if (skCountInput) {
    skCountInput.addEventListener('change', saveAIConfig);
    skCountInput.addEventListener('input', saveAIConfig);
  }

  window.triggerGlobalUpdate = function() { ctx.save(); };
  window.__getCurrentDraftId__ = function() { return ctx.sm.getCurrentDraftId(); };
  window.__getWorldbookEntries__ = function() {
    return ctx.state.worldbookEntries.map(function(e, i) {
      var out = {
        id: e.id != null ? e.id : i,
        comment: e.comment || '',
        content: e.content || '',
        keys: e.keys || [],
        strategy: e.strategy || 'selective',
        position: e.position != null ? e.position : 4,
        depth: e.depth != null ? e.depth : 4,
        role: e.role != null ? e.role : 0,
        order: e.order != null ? e.order : 100,
        prob: e.prob != null ? e.prob : 100,
        enabled: e.enabled !== false,
      };
      if (e.secondaryKeys != null) out.secondaryKeys = e.secondaryKeys;
      if (e.secondary_keys != null) out.secondary_keys = e.secondary_keys;
      if (e.selectiveLogic != null) out.selectiveLogic = e.selectiveLogic;
      if (e.group != null) out.group = e.group;
      if (e.groupWeight != null) out.groupWeight = e.groupWeight;
      if (e.group_weight != null) out.group_weight = e.group_weight;
      if (e.groupOverride != null) out.groupOverride = e.groupOverride;
      if (e.group_override != null) out.group_override = e.group_override;
      if (e.preventRecursion != null) out.preventRecursion = e.preventRecursion;
      if (e.prevent_recursion != null) out.prevent_recursion = e.prevent_recursion;
      if (e.delayUntilRecursion != null) out.delayUntilRecursion = e.delayUntilRecursion;
      if (e.delay_until_recursion != null) out.delay_until_recursion = e.delay_until_recursion;
      if (e.useProbability != null) out.useProbability = e.useProbability;
      if (e.useRegex != null) out.useRegex = e.useRegex;
      if (e.extensions) out.extensions = e.extensions;
      return out;
    });
  };
  window.__setWorldbookEntries__ = function(entries) {
    if (!Array.isArray(entries)) return;
    ctx.state.worldbookEntries = entries.slice();
    if (ctx.panels.worldbook && ctx.panels.worldbook.renderEntriesList) {
      ctx.panels.worldbook.renderEntriesList();
    }
    ctx.save();
  };
  window.__getRegexScripts__ = function() {
    return Array.isArray(ctx.state.regexScripts) ? ctx.state.regexScripts.slice() : [];
  };
  window.__setRegexScripts__ = function(list, opts) {
    opts = opts || {};
    ctx.state.regexScripts = Array.isArray(list) ? list.slice() : [];
    ctx.save();
    if (!opts.silent) window.dispatchEvent(new CustomEvent('card-builder-data-changed'));
  };
  window.__getTavernHelperScripts__ = function() {
    return Array.isArray(ctx.state.tavernHelperScripts) ? ctx.state.tavernHelperScripts.slice() : [];
  };
  window.__setTavernHelperScripts__ = function(list, opts) {
    opts = opts || {};
    ctx.state.tavernHelperScripts = Array.isArray(list) ? list.slice() : [];
    ctx.save();
    if (!opts.silent) window.dispatchEvent(new CustomEvent('card-builder-data-changed'));
  };
  window.__injectMvuEntries__ = function(entries, newRegexScripts) {
    if (!Array.isArray(entries)) return;
    entries.forEach(function(entry) {
      var idx = -1;
      for (var i = 0; i < ctx.state.worldbookEntries.length; i++) {
        if (ctx.state.worldbookEntries[i].comment === entry.comment) { idx = i; break; }
      }
      if (idx >= 0) ctx.state.worldbookEntries[idx] = entry;
      else ctx.state.worldbookEntries.push(entry);
    });
    if (Array.isArray(newRegexScripts)) {
      newRegexScripts.forEach(function(rx) {
        var rxIdx = -1;
        for (var j = 0; j < ctx.state.regexScripts.length; j++) {
          if (ctx.state.regexScripts[j].scriptName === rx.scriptName) { rxIdx = j; break; }
        }
        if (rxIdx >= 0) ctx.state.regexScripts[rxIdx] = rx;
        else ctx.state.regexScripts.push(rx);
      });
    }
    if (ctx.panels.worldbook && ctx.panels.worldbook.renderEntriesList) {
      ctx.panels.worldbook.renderEntriesList();
    }
    ctx.save();
    window.dispatchEvent(new CustomEvent('card-builder-data-changed'));
  };
  window.__setTavernHelperScript__ = function(name, code, enabled) {
    if (!name) return;
    var isEnabled = enabled !== false;
    if (!Array.isArray(ctx.state.tavernHelperScripts)) ctx.state.tavernHelperScripts = [];
    var found = false;
    for (var i = 0; i < ctx.state.tavernHelperScripts.length; i++) {
      if (ctx.state.tavernHelperScripts[i].name === name) {
        ctx.state.tavernHelperScripts[i].content = code;
        ctx.state.tavernHelperScripts[i].enabled = isEnabled;
        found = true;
        break;
      }
    }
    if (!found && isEnabled) {
      ctx.state.tavernHelperScripts.push({
        type: 'script',
        enabled: true,
        name: name,
        id: crypto.randomUUID
          ? crypto.randomUUID()
          : (Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)),
        content: code,
        info: '由 Card Builder 变量卡生成器自动创建',
        button: { enabled: true, buttons: [] },
        data: {},
      });
    }
    ctx.save();
    window.dispatchEvent(new CustomEvent('card-builder-data-changed'));
  };
  window.__deleteMvuArtifacts__ = function(options) {
    options = options || {};
    var comments = Array.isArray(options.comments) ? options.comments : [];
    var regexNames = Array.isArray(options.regexNames) ? options.regexNames : [];
    var helperNames = Array.isArray(options.helperNames) ? options.helperNames : [];
    if (comments.length) {
      ctx.state.worldbookEntries = ctx.state.worldbookEntries.filter(function(entry) {
        return comments.indexOf(entry && entry.comment) < 0;
      });
    }
    if (regexNames.length && Array.isArray(ctx.state.regexScripts)) {
      ctx.state.regexScripts = ctx.state.regexScripts.filter(function(script) {
        return regexNames.indexOf(script && script.scriptName) < 0;
      });
    }
    if (helperNames.length && Array.isArray(ctx.state.tavernHelperScripts)) {
      ctx.state.tavernHelperScripts = ctx.state.tavernHelperScripts.filter(function(script) {
        return helperNames.indexOf(script && script.name) < 0;
      });
    }
    if (ctx.panels.worldbook && ctx.panels.worldbook.renderEntriesList) {
      ctx.panels.worldbook.renderEntriesList();
    }
    ctx.save();
    window.dispatchEvent(new CustomEvent('card-builder-data-changed'));
  };
  window.__getCardExtension__ = function(key) {
    if (!key) return ctx.state.cardBuilderExtensions || {};
    return ctx.state.cardBuilderExtensions ? ctx.state.cardBuilderExtensions[key] : undefined;
  };
  window.__setCardExtension__ = function(key, value, opts) {
    opts = opts || {};
    if (!key) return;
    if (!ctx.state.cardBuilderExtensions || typeof ctx.state.cardBuilderExtensions !== 'object') {
      ctx.state.cardBuilderExtensions = {};
    }
    if (value === undefined || value === null) delete ctx.state.cardBuilderExtensions[key];
    else ctx.state.cardBuilderExtensions[key] = value;
    ctx.save();
    if (!opts.silent) window.dispatchEvent(new CustomEvent('card-builder-data-changed'));
  };
  window.__runAiTask__ = ctx.runTracked;
  window.__isAiAbortError__ = ctx.isTrackedAbort;
  window.__assistantFetchAI__ = ctx.fetchAIContent;
  window.__persistAiConfig__ = saveAIConfig;

  // 试聊：预设消息桥（aiEngine 未就绪时返回 []）
  window.__getActivePresetMessages__ = function() {
    if (ctx.panels.aiEngine && typeof ctx.panels.aiEngine.getActivePresetMessages === 'function') {
      return ctx.panels.aiEngine.getActivePresetMessages();
    }
    return [];
  };

  // 试聊：角色卡字段桥（缺字段用空字符串，不抛错）
  window.__getChatCharacterPayload__ = function() {
    var s = ctx.state || {};
    var domVal = function(id) {
      var el = document.getElementById(id);
      return el && el.value != null ? String(el.value) : '';
    };
    return {
      name: s.charName || domVal('charName') || '角色',
      description: s.charDesc || domVal('charDesc') || '',
      personality: s.personality != null ? String(s.personality) : '',
      scenario: s.scenario != null ? String(s.scenario) : '',
      mesExample: s.mesExample != null ? String(s.mesExample)
        : (s.mes_example != null ? String(s.mes_example) : ''),
      systemPrompt: s.systemPrompt != null ? String(s.systemPrompt)
        : (s.system_prompt != null ? String(s.system_prompt) : ''),
      creatorNotes: s.creatorNotes || domVal('creatorNotes') || '',
      firstMes: s.firstMes || domVal('firstMes') || '你好。',
    };
  };


  return { saveAIConfig: saveAIConfig, loadAIConfig: loadAIConfig };
}
