/**
 * 试聊面板 ↔ chatRuntime 桥接（浏览器侧）
 */

import { ST_PARITY_VERSION } from './stCompat.mjs';
import { buildChatCompletionMessages } from './prompt/build.mjs';
import { applyRegexPipeline, PLACEMENT_AI } from './regex/pipeline.mjs';

export { ST_PARITY_VERSION, PLACEMENT_AI };

/**
 * 组装试聊 Chat Completions messages
 * @param {object} opts
 * @param {() => object} [opts.getChar]
 * @param {() => any[]} [opts.getWb]
 * @param {() => any[]} [opts.getRegex]
 * @param {() => { role: string, content: string }[]} [opts.getPresets]
 * @param {{ role: string, content: string }[]} [opts.history]
 * @param {number} [opts.scanDepth]
 * @param {string} [opts.userName]
 * @param {string} [opts.rpCoreText]
 * @returns {{ messages: { role: string, content: string }[], debug: object, parityVersion: string }}
 */
export function buildTrialChatMessages(opts) {
  var o = opts || {};
  var char = {};
  try {
    char = typeof o.getChar === 'function' ? (o.getChar() || {}) : (o.char || {});
  } catch (e) {
    char = {};
  }
  var worldbookEntries = [];
  try {
    worldbookEntries = typeof o.getWb === 'function' ? (o.getWb() || []) : (o.worldbookEntries || []);
  } catch (e2) {
    worldbookEntries = [];
  }
  var regexScripts = [];
  try {
    regexScripts = typeof o.getRegex === 'function' ? (o.getRegex() || []) : (o.regexScripts || []);
  } catch (e3) {
    regexScripts = [];
  }
  var presetMessages = [];
  try {
    presetMessages = typeof o.getPresets === 'function' ? (o.getPresets() || []) : (o.presetMessages || []);
  } catch (e4) {
    presetMessages = [];
  }
  if (!Array.isArray(worldbookEntries)) worldbookEntries = [];
  if (!Array.isArray(regexScripts)) regexScripts = [];
  if (!Array.isArray(presetMessages)) presetMessages = [];

  var built = buildChatCompletionMessages({
    char: char,
    history: Array.isArray(o.history) ? o.history : [],
    worldbookEntries: worldbookEntries,
    regexScripts: regexScripts,
    presetMessages: presetMessages,
    scanDepth: o.scanDepth,
    userName: o.userName,
    rpCoreText: o.rpCoreText != null ? String(o.rpCoreText) : '',
  });

  return {
    messages: built.messages,
    debug: built.debug,
    parityVersion: ST_PARITY_VERSION,
  };
}

/**
 * 从 debug.activated 生成 WB 触发条数据
 * @param {object} debug
 * @returns {{ comment: string, strategy: string, isTriggered: boolean }[]}
 */
export function formatWbTriggerTags(debug) {
  var activated = debug && Array.isArray(debug.activated) ? debug.activated : [];
  return activated.map(function(e) {
    var strategy = e && e.strategy
      ? e.strategy
      : (e && e.constant ? 'constant' : 'selective');
    return {
      comment: (e && e.comment) ? String(e.comment) : '未命名',
      strategy: strategy,
      isTriggered: true,
    };
  });
}

/**
 * 展示侧正则：AI placement + display ephemerality + depth 0
 * @param {string} aiText
 * @param {any[]} scripts
 * @returns {string}
 */
export function applyDisplayRegex(aiText, scripts) {
  var res = applyRegexPipeline(aiText == null ? '' : String(aiText), scripts || [], {
    placement: PLACEMENT_AI,
    ephemerality: 'display',
    messageDepth: 0,
  });
  return res.text;
}
