/**
 * 制卡主侧唯一启动入口：状态、面板绑定、AI 配置、全局桥接
 */
import { createDefaultCardState } from './state.mjs';
import { createCardStateMachine } from './stateMachine.mjs';
import { escapeHtml } from '../utils.mjs';
import { createCardBuilderContext } from './shared/context.mjs';
import { registerCardManager } from './panels/cardManager.mjs';
import { registerCharacter } from './panels/character.mjs';
import { registerAdultConfig } from './panels/adultConfig.mjs';
import { registerWorldbook } from './panels/worldbook.mjs';
import { registerAiEngine } from './panels/aiEngine.mjs';
import { registerExport } from './panels/export.mjs';
import { buildExportChecklist } from './exportChecklist.mjs';

var FIELD_DICT = {
  "name": { label: "角色名", tip: "角色的显示名称", type: "string", required: true },
  "description": { label: "角色描述(顶层)", tip: "V2兼容字段，与data.description同步", type: "string" },
  "personality": { label: "性格(顶层)", tip: "通常留空，推荐写入角色描述", type: "string" },
  "scenario": { label: "场景(顶层)", tip: "通常留空，推荐用世界书承载场景", type: "string" },
  "first_mes": { label: "开场白(顶层)", tip: "角色说的第一句话", type: "string" },
  "mes_example": { label: "对话示例(顶层)", tip: "示范角色说话风格", type: "string" },
  "creatorcomment": { label: "作者注释(顶层)", tip: "V2兼容字段", type: "string" },
  "avatar": { label: "头像标记", tip: "头像文件名或none", type: "string" },
  "talkativeness": { label: "话痨程度", tip: "0.0~1.0 控制主动发言频率", type: "string" },
  "fav": { label: "收藏标记", tip: "是否被标记为收藏", type: "boolean" },
  "tags": { label: "标签(顶层)", tip: "分类标签数组", type: "array" },
  "spec": { label: "卡片规格", tip: "固定为chara_card_v3", type: "string", required: true, enum: ["chara_card_v3"] },
  "spec_version": { label: "规格版本", tip: "固定为3.0", type: "string", required: true, enum: ["3.0"] },
  "data.name": { label: "角色名", tip: "主数据层角色名", type: "string", required: true },
  "data.description": { label: "角色描述", tip: "核心描述：外貌、性格、背景", type: "string", required: true },
  "data.personality": { label: "性格", tip: "推荐写在description里", type: "string" },
  "data.scenario": { label: "场景", tip: "推荐用世界书代替", type: "string" },
  "data.first_mes": { label: "开场白", tip: "首次对话角色发送的第一条消息", type: "string", required: true },
  "data.mes_example": { label: "对话示例", tip: "格式：<START>\\n{{char}}: ...", type: "string" },
  "data.creator_notes": { label: "作者注释", tip: "给使用者看的说明，不注入AI", type: "string" },
  "data.system_prompt": { label: "系统提示词", tip: "最高优先级系统指令，慎用", type: "string" },
  "data.post_history_instructions": { label: "历史后指令", tip: "Author's Note位置的指令", type: "string" },
  "data.tags": { label: "标签", tip: "分类标签数组", type: "array" },
  "data.creator": { label: "创作者", tip: "卡片制作者名字", type: "string" },
  "data.character_version": { label: "卡片版本", tip: "迭代版本号", type: "string" },
  "data.alternate_greetings": { label: "备选开场白", tip: "多个可选开场白", type: "array" },
  "data.extensions": { label: "扩展数据", tip: "扩展字段容器", type: "object" },
  "data.extensions.world": { label: "关联世界书", tip: "关联的世界书名称", type: "string" },
  "data.extensions.regex_scripts": { label: "正则脚本列表", tip: "嵌入卡片的正则替换脚本", type: "array" },
};

function getFieldInfo(path) {
  if (FIELD_DICT[path]) return FIELD_DICT[path];
  var n1 = path.replace(/\.(\d+)\./g, '[].');
  if (FIELD_DICT[n1]) return FIELD_DICT[n1];
  var n2 = path.replace(/\.(\d+)$/g, '[]');
  if (FIELD_DICT[n2]) return FIELD_DICT[n2];
  return undefined;
}

function validateField(path, value) {
  var info = getFieldInfo(path);
  if (!info) return null;
  if (info.required && (value === undefined || value === null || value === '')) return '必填字段不能为空';
  if (value !== null && value !== undefined && info.type !== 'any') {
    var t = Array.isArray(value) ? 'array' : typeof value;
    if (t !== info.type) return '类型错误：期望 ' + info.type + '，实际 ' + t;
  }
  if (info.enum && value !== undefined && value !== null && value !== '' && info.enum.indexOf(value) === -1) {
    return '值不在允许范围';
  }
  if (info.range && typeof value === 'number') {
    if (info.range.min !== undefined && value < info.range.min) return '最小值为 ' + info.range.min;
    if (info.range.max !== undefined && value > info.range.max) return '最大值为 ' + info.range.max;
  }
  return null;
}

function validateFullJSON(obj, pp, errs) {
  if (!pp) pp = '';
  if (!errs) errs = [];
  if (obj === null || obj === undefined) return errs;
  if (Array.isArray(obj)) {
    obj.forEach(function(it, i) {
      var p = pp + '.' + i;
      if (typeof it === 'object' && it !== null) validateFullJSON(it, p, errs);
      else {
        var e = validateField(p, it);
        if (e) errs.push({ path: p, message: e, value: it });
      }
    });
  } else if (typeof obj === 'object') {
    Object.keys(obj).forEach(function(k) {
      var fp = pp ? pp + '.' + k : k;
      var v = obj[k];
      var e = validateField(fp, v);
      if (e) errs.push({ path: fp, message: e, value: v });
      if (typeof v === 'object' && v !== null) validateFullJSON(v, fp, errs);
    });
  }
  return errs;
}

function countNovelUnsynced() {
  try {
    var bridge = window.__novelWorkshopBridge__;
    if (!bridge || typeof bridge.getState !== 'function') return 0;
    var st = bridge.getState() || {};
    var entities = Array.isArray(st.entities) ? st.entities : [];
    var n = 0;
    entities.forEach(function(e) {
      if (e && (e.syncStatus === 'unsynced' || e.syncStatus === 'dirty')) n += 1;
    });
    var chars = Array.isArray(st.characters) ? st.characters : [];
    chars.forEach(function(c) {
      if (c && (c.syncStatus === 'unsynced' || c.syncStatus === 'dirty')) n += 1;
    });
    return n;
  } catch (e) {
    return 0;
  }
}

/**
 * 启动制卡主侧（须在 DOM 就绪后调用）
 */
export function bootCardBuilder() {
  window.__fieldDict__ = { getFieldInfo: getFieldInfo, validateFullJSON: validateFullJSON };

  var state = createDefaultCardState();
  var sm = createCardStateMachine(state);
  var ctx = createCardBuilderContext(sm);

  registerCardManager(ctx);
  registerCharacter(ctx);
  registerAdultConfig(ctx);
  registerWorldbook(ctx);
  registerAiEngine(ctx);
  registerExport(ctx);

  function safeBind(name, fn) {
    if (!fn) return;
    try { fn(); } catch (err) {
      console.error('[card-builder] panel bind failed: ' + name, err);
    }
  }
  safeBind('character', ctx.panels.character && ctx.panels.character.bind);
  safeBind('adultConfig', ctx.panels.adultConfig && ctx.panels.adultConfig.bind);
  safeBind('worldbook', ctx.panels.worldbook && ctx.panels.worldbook.bind);
  safeBind('aiEngine', ctx.panels.aiEngine && ctx.panels.aiEngine.bind);
  safeBind('cardManager', ctx.panels.cardManager && ctx.panels.cardManager.bind);
  try {
    if (ctx.panels.character.renderCharTags) ctx.panels.character.renderCharTags();
    if (ctx.panels.adultConfig.renderNsfwBlock) ctx.panels.adultConfig.renderNsfwBlock();
  } catch (err) {
    console.error('[card-builder] initial character/adult render failed', err);
  }

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
    return ctx.state.worldbookEntries.map(function(e) {
      return {
        comment: e.comment || '',
        content: e.content || '',
        keys: e.keys || [],
        strategy: e.strategy || 'selective',
        position: e.position || 4,
        depth: e.depth || 4,
        role: e.role || 0,
        order: e.order || 100,
        prob: e.prob || 100,
        enabled: e.enabled !== false,
      };
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

  window.__assistantCardApi__ = window.__assistantCardApi__ || {};
  window.__assistantCardApi__.exportCheck = function() {
    var wb = Array.isArray(ctx.state.worldbookEntries) ? ctx.state.worldbookEntries : [];
    var noKeys = wb.filter(function(e) {
      return e && e.enabled !== false && (!e.keys || !e.keys.length);
    }).length;
    var extraIssues = typeof window.__getCorruptionExportIssues__ === 'function'
      ? window.__getCorruptionExportIssues__()
      : [];
    return buildExportChecklist({
      charName: ctx.state.charName,
      charDesc: ctx.state.charDesc,
      firstMes: ctx.state.firstMes || (document.getElementById('firstMes') || {}).value || '',
      creatorNotes: ctx.state.creatorNotes,
      hasAvatar: !!(ctx.state.avatarInIdb || ctx.state.avatarBase64),
      worldbookCount: wb.length,
      worldbookNoKeys: noKeys,
      novelUnsyncedCount: countNovelUnsynced(),
      altGreetingCount: Array.isArray(window.__altGreetings__) ? window.__altGreetings__.length : 0,
      extraIssues: extraIssues,
    });
  };
  window.__getExportChecklist__ = window.__assistantCardApi__.exportCheck;

  if (!window.__altGreetings__) window.__altGreetings__ = [];
  if (!window.__aiDebugLog__) window.__aiDebugLog__ = [];

  loadAIConfig();

  window.addEventListener('st-idb-ready', async function() {
    var ensureFn = window.__ensureIdbReady__ || function() { return Promise.resolve(); };
    await ensureFn();
    var lastId = localStorage.getItem('st_v3_builder_current_id');
    if (lastId && ctx.sm.getAllDrafts()[lastId]) {
      ctx.sm.loadDraftIntoState(lastId);
    }
    if (ctx.panels.cardManager && ctx.panels.cardManager.updateCardManagerUI) {
      ctx.panels.cardManager.updateCardManagerUI();
    }
    if (ctx.panels.adultConfig && ctx.panels.adultConfig.renderNsfwBlock) {
      ctx.panels.adultConfig.renderNsfwBlock();
    }
  });

  window.addEventListener('hashchange', function() {
    if (ctx.panels.cardManager && ctx.panels.cardManager.updateCardManagerUI) {
      ctx.panels.cardManager.updateCardManagerUI();
    }
  });
  window.addEventListener('app-view-changed', function() {
    if (ctx.panels.cardManager && ctx.panels.cardManager.updateCardManagerUI) {
      ctx.panels.cardManager.updateCardManagerUI();
    }
  });

  return ctx;
}

/** DOM 就绪后启动；可在 Astro 模块脚本顶层直接调用 */
export function initCardBuilder() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function onReady() {
      document.removeEventListener('DOMContentLoaded', onReady);
      bootCardBuilder();
    });
  } else {
    bootCardBuilder();
  }
}
