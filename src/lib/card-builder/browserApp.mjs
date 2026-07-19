/**
 * 制卡主侧浏览器端：状态、UI 绑定、AI 调用、桥接
 */
import { createDefaultCardState, buildDraftSnapshot, genId, buildCardJSONFromDraft } from './state.mjs';
import { createCardStateMachine } from './stateMachine.mjs';
import { createCardBuilderContext } from './shared/context.mjs';
import { registerCardManager } from './panels/cardManager.mjs';
import { registerCharacter } from './panels/character.mjs';
import { registerWorldbook } from './panels/worldbook.mjs';
import { registerAiEngine } from './panels/aiEngine.mjs';
import { registerExport } from './panels/export.mjs';

var state = createDefaultCardState();
var sm = createCardStateMachine(state);
var ctx = createCardBuilderContext(sm);

registerCardManager(ctx);
registerCharacter(ctx);
registerWorldbook(ctx);
registerAiEngine(ctx);
registerExport(ctx);

// ============================================================
//  全局面板初始化
// ============================================================
function initPanels() {
  if (ctx.panels.character && ctx.panels.character.bind) ctx.panels.character.bind();
  if (ctx.panels.worldbook && ctx.panels.worldbook.bind) ctx.panels.worldbook.bind();
  if (ctx.panels.aiEngine && ctx.panels.aiEngine.bind) ctx.panels.aiEngine.bind();
  if (ctx.panels.cardManager && ctx.panels.cardManager.bind) ctx.panels.cardManager.bind();

  ctx.panels.character.renderCharTags();
  if (ctx.panels.character.renderNsfwBlock) ctx.panels.character.renderNsfwBlock();
}

// ============================================================
//  桥接：全局变量 / window.__xxx__
// ============================================================

// Field dict — static, defined in main script
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
  if (info.enum && value !== undefined && value !== null && value !== '' && info.enum.indexOf(value) === -1) return '值不在允许范围';
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

window.__fieldDict__ = { getFieldInfo: getFieldInfo, validateFullJSON: validateFullJSON };

// ============================================================
//  AI Config 持久化
// ============================================================
var AI_KEY = 'st_v3_builder_ai_config';

function saveAIConfig() {
  var apiUrl = ctx.$('apiUrl');
  var apiKey = ctx.$('apiKey');
  var modelSelect = ctx.$('modelSelect');
  var aiDebugEnable = ctx.$('aiDebugEnable');
  var tagContextCharsEl = ctx.$('tagContextChars');
  var embeddingModel = ctx.$('embeddingModel');
  var embeddingApiUrl = ctx.$('embeddingApiUrl');
  var embeddingApiKey = ctx.$('embeddingApiKey');

  var presetList = [];
  if (ctx.panels.aiEngine && ctx.panels.aiEngine.getActivePresetsStr) {
    // We need parsedPresetList access — stored in aiEngine panel's closure
    presetList = ctx.panels.aiEngine.getParsedPresetList ? ctx.panels.aiEngine.getParsedPresetList() : [];
  }

  localStorage.setItem(AI_KEY, JSON.stringify({
    url: apiUrl ? apiUrl.value.trim() : '',
    key: apiKey ? apiKey.value.trim() : '',
    model: modelSelect ? modelSelect.value : '',
    debug: !!(aiDebugEnable && aiDebugEnable.checked),
    tagContextChars: ctx.$('tagContextChars')
      ? (parseInt(ctx.$('tagContextChars').value, 10) || 12000)
      : 12000,
    embeddingModel: embeddingModel ? embeddingModel.value : '',
    embeddingApiUrl: embeddingApiUrl ? embeddingApiUrl.value : '',
    embeddingApiKey: embeddingApiKey ? embeddingApiKey.value : '',
    novelRag: typeof window.__getNovelRagOptions__ === 'function'
      ? window.__getNovelRagOptions__()
      : { enabled: true, budget: 12000 },
    presetList: presetList,
    nsfwEnabled: !!ctx.state.nsfwEnabled,
    nsfwFlavor: ctx.state.nsfwFlavor || '',
    ntlEnabled: !!ctx.state.ntlEnabled,
    ntlTabooTypes: (ctx.state.ntlTabooTypes || []).slice(),
  }));
}

window.__persistAiConfig__ = saveAIConfig;

function loadAIConfig() {
  try {
    var c = JSON.parse(localStorage.getItem(AI_KEY));
    if (!c) return;
    var apiUrl = ctx.$('apiUrl');
    var apiKey = ctx.$('apiKey');
    var modelSelect = ctx.$('modelSelect');
    var aiDebugEnable = ctx.$('aiDebugEnable');
    var tagContextCharsEl = ctx.$('tagContextChars');

    if (c.url && apiUrl) apiUrl.value = c.url;
    if (c.key && apiKey) apiKey.value = c.key;
    if (c.model && modelSelect) {
      modelSelect.innerHTML = '<option value="' + c.model + '">' + c.model + '</option>';
      modelSelect.value = c.model;
    }
    if (aiDebugEnable) aiDebugEnable.checked = !!c.debug;
    if (c.tagContextChars != null && window.__setTagContextChars__) {
      window.__setTagContextChars__(c.tagContextChars);
    } else if (c.tagContextChars != null && tagContextCharsEl) {
      tagContextCharsEl.value = String(c.tagContextChars);
    }
    try {
      if (c.embeddingApiUrl != null) {
        localStorage.setItem('st_v3_builder_embedding_api_url', String(c.embeddingApiUrl || ''));
        var embUrlEl = ctx.$('embeddingApiUrl');
        if (embUrlEl) embUrlEl.value = String(c.embeddingApiUrl || '');
      }
      if (c.embeddingApiKey != null) {
        localStorage.setItem('st_v3_builder_embedding_api_key', String(c.embeddingApiKey || ''));
        var embKeyEl = ctx.$('embeddingApiKey');
        if (embKeyEl) embKeyEl.value = String(c.embeddingApiKey || '');
      }
      if (c.embeddingModel != null) {
        localStorage.setItem('st_v3_builder_embedding_model', String(c.embeddingModel || ''));
        var embEl = ctx.$('embeddingModel');
        if (embEl) embEl.value = String(c.embeddingModel || '');
      }
      if (c.novelRag) {
        localStorage.setItem('st_v3_builder_novel_rag', JSON.stringify(c.novelRag));
        var en = ctx.$('assistantNovelRagEnable');
        var bu = ctx.$('assistantNovelRagBudget');
        if (en) en.checked = c.novelRag.enabled !== false;
        if (bu && c.novelRag.budget) bu.value = String(c.novelRag.budget);
      }
    } catch (eRag) { /* ignore */ }
    if (c.nsfwFlavor != null) ctx.state.nsfwFlavor = String(c.nsfwFlavor || '');
    if (c.nsfwEnabled != null) ctx.state.nsfwEnabled = !!c.nsfwEnabled;
    if (c.ntlEnabled != null) ctx.state.ntlEnabled = !!c.ntlEnabled;
    if (Array.isArray(c.ntlTabooTypes)) ctx.state.ntlTabooTypes = c.ntlTabooTypes.slice();
    if (c.presetList && Array.isArray(c.presetList) && c.presetList.length > 0) {
      if (ctx.panels.aiEngine && ctx.panels.aiEngine.loadPresetsFromConfig) {
        ctx.panels.aiEngine.loadPresetsFromConfig(c.presetList);
      }
    }
  } catch (e) { console.warn('Loading AI config from storage failed', e); }
  ctx.updateAIDebugStatus();
}

// AI Config input listeners
var apiUrl = ctx.$('apiUrl');
var apiKey = ctx.$('apiKey');
var modelSelect = ctx.$('modelSelect');
var aiDebugEnable = ctx.$('aiDebugEnable');
if (apiUrl) apiUrl.addEventListener('input', saveAIConfig);
if (apiKey) apiKey.addEventListener('input', saveAIConfig);
if (modelSelect) modelSelect.addEventListener('change', saveAIConfig);
if (aiDebugEnable) aiDebugEnable.addEventListener('change', function() { ctx.updateAIDebugStatus(); saveAIConfig(); });

// ============================================================
//  角色字段 input → 存盘
// ============================================================
['charName', 'wbName', 'charDesc', 'firstMes', 'creatorNotes'].forEach(function(id) {
  var el = ctx.$(id);
  if (el) el.addEventListener('input', function() { ctx.save(); });
});

// ============================================================
//  桥接
// ============================================================
window.triggerGlobalUpdate = function() { ctx.save(); };

window.__getCurrentDraftId__ = function() {
  return ctx.sm.getCurrentDraftId();
};

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
  if (!opts.silent) {
    window.dispatchEvent(new CustomEvent('card-builder-data-changed'));
  }
};

window.__getTavernHelperScripts__ = function() {
  return Array.isArray(ctx.state.tavernHelperScripts) ? ctx.state.tavernHelperScripts.slice() : [];
};

window.__setTavernHelperScripts__ = function(list, opts) {
  opts = opts || {};
  ctx.state.tavernHelperScripts = Array.isArray(list) ? list.slice() : [];
  ctx.save();
  if (!opts.silent) {
    window.dispatchEvent(new CustomEvent('card-builder-data-changed'));
  }
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
      var scripts = ctx.state.regexScripts;
      for (var j = 0; j < scripts.length; j++) {
        if (scripts[j].scriptName === rx.scriptName) { rxIdx = j; break; }
      }
      if (rxIdx >= 0) scripts[rxIdx] = rx;
      else scripts.push(rx);
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
      id: crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)),
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
  if (!ctx.state.cardBuilderExtensions || typeof ctx.state.cardBuilderExtensions !== 'object')
    ctx.state.cardBuilderExtensions = {};
  if (value === undefined || value === null) delete ctx.state.cardBuilderExtensions[key];
  else ctx.state.cardBuilderExtensions[key] = value;
  ctx.save();
  if (!opts.silent) {
    window.dispatchEvent(new CustomEvent('card-builder-data-changed'));
  }
};

// AI task bridge
window.__runAiTask__ = ctx.runTracked;

function isAiAbort(err) {
  return ctx.isTrackedAbort(err);
}
window.__isAiAbortError__ = isAiAbort;

window.__assistantFetchAI__ = ctx.fetchAIContent;

if (!window.__altGreetings__) window.__altGreetings__ = [];
if (!window.__aiDebugLog__) window.__aiDebugLog__ = [];

// ============================================================
//  初始化
// ============================================================
function initApp() {
  initPanels();
  loadAIConfig();

  // Load last active draft
  var lastId = localStorage.getItem('st_v3_builder_current_id');
  if (lastId && sm.getAllDrafts()[lastId]) {
    sm.loadDraftIntoState(lastId);
    if (ctx.panels.cardManager && ctx.panels.cardManager.loadDraft) {
      ctx.panels.cardManager.loadDraft(lastId);
    }
  } else {
    if (ctx.panels.cardManager && ctx.panels.cardManager.createBlankDraft) {
      ctx.panels.cardManager.createBlankDraft({ jumpToCharacter: false });
    }
  }

  // Card manager update after IDB ready
  window.addEventListener('st-idb-ready', function() {
    if (ctx.panels.cardManager && ctx.panels.cardManager.updateCardManagerUI) {
      ctx.panels.cardManager.updateCardManagerUI();
    }
  });

  // Hash change → update card manager
  window.addEventListener('hashchange', function() {
    if (ctx.panels.cardManager && ctx.panels.cardManager.updateCardManagerUI) {
      ctx.panels.cardManager.updateCardManagerUI();
    }
  });

  window.addEventListener('app-view-changed', function(ev) {
    if (ctx.panels.cardManager && ctx.panels.cardManager.updateCardManagerUI) {
      ctx.panels.cardManager.updateCardManagerUI();
    }
  });
}

initApp();
