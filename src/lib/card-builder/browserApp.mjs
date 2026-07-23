/**
 * 制卡主侧唯一启动入口：状态、面板绑定、AI 配置、全局桥接
 */
import { createDefaultCardState } from './state.mjs';
import { createCardStateMachine } from './stateMachine.mjs';
import { createCardBuilderContext } from './shared/context.mjs';
import { registerCardManager } from './panels/cardManager.mjs';
import { registerCharacter } from './panels/character.mjs';
import { registerAdultConfig } from './panels/adultConfig.mjs';
import { registerWorldbook } from './panels/worldbook.mjs';
import { registerAiEngine } from './panels/aiEngine.mjs';
import { registerExport } from './panels/export.mjs';
import { buildExportChecklist } from './exportChecklist.mjs';
import { getFieldInfo, validateFullJSON, countNovelUnsynced } from './fieldValidation.mjs';
import { attachBootAiConfig } from './bootAiConfig.mjs';

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
  safeBind('worldbook', ctx.panels.worldbook && ctx.panels.worldbook.bindModals);
  safeBind('aiEngine', ctx.panels.aiEngine && ctx.panels.aiEngine.bind);
  safeBind('cardManager', ctx.panels.cardManager && ctx.panels.cardManager.bind);
  try {
    if (ctx.panels.character.renderCharTags) ctx.panels.character.renderCharTags();
    if (ctx.panels.adultConfig.renderNsfwBlock) ctx.panels.adultConfig.renderNsfwBlock();
  } catch (err) {
    console.error('[card-builder] initial character/adult render failed', err);
  }

  var bootAi = attachBootAiConfig(ctx);
  var loadAIConfig = bootAi.loadAIConfig;

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
      nsfwEnabled: !!ctx.state.nsfwEnabled,
      nsfwFlavor: ctx.state.nsfwFlavor || '',
      nsfwFlavorItems: ctx.state.nsfwFlavorItems,
      altGreetingCount: Array.isArray(window.__altGreetings__) ? window.__altGreetings__.length : 0,
      extraIssues: extraIssues,
    });
  };
  window.__getExportChecklist__ = window.__assistantCardApi__.exportCheck;
  window.__buildCurrentCardJSON__ = function() {
    if (ctx.panels.cardManager && typeof ctx.panels.cardManager.generateCardJSON === 'function') {
      return ctx.panels.cardManager.generateCardJSON();
    }
    return null;
  };

  if (!window.__altGreetings__) window.__altGreetings__ = [];
  if (!window.__aiDebugLog__) window.__aiDebugLog__ = [];

  loadAIConfig();

  window.addEventListener('st-idb-ready', async function() {
    var ensureFn = window.__ensureIdbReady__ || function() { return Promise.resolve(); };
    await ensureFn();
    var lastId = localStorage.getItem('st_v3_builder_current_id');
    if (lastId && ctx.sm.getAllDrafts()[lastId]) {
      if (ctx.panels.cardManager && typeof ctx.panels.cardManager.loadDraft === 'function') {
        ctx.panels.cardManager.loadDraft(lastId);
      } else {
        ctx.sm.loadDraftIntoState(lastId);
      }
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
