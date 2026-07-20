/**
 * 组装 Chat Completions messages（试聊实用顺序，非 ST Prompt Manager 逐块等价）
 */

import { applyMacros } from '../macros.mjs';
import { scanWorldInfo } from '../worldInfo/scan.mjs';
import { injectWorldInfo, joinEntryContents, partitionActivated } from '../worldInfo/inject.mjs';
import { applyRegexPipeline, applyRegexToMessages, PLACEMENT_WORLD } from '../regex/pipeline.mjs';

/**
 * 解析 mes_example 为 few-shot 消息（粗分：<START> / {{user}}: / {{char}}:）
 * @param {string} raw
 * @param {{ charName: string, userName: string }} names
 * @returns {{ role: string, content: string }[]}
 */
function parseMesExamples(raw, names) {
  var text = applyMacros(String(raw || ''), names).trim();
  if (!text) return [];
  // 按 <START> 分段，忽略空段
  var blocks = text.split(/<START>/i).map(function(s) { return s.trim(); }).filter(Boolean);
  var msgs = [];
  var userRe = new RegExp('^' + escapeRe(names.userName) + '\\s*:', 'i');
  var charRe = new RegExp('^' + escapeRe(names.charName) + '\\s*:', 'i');
  // 也识别字面 {{user}}: / {{char}}:（宏已展开后一般是名字）
  var genericUser = /^(?:\{\{user\}\}|User)\s*:/i;
  var genericChar = /^(?:\{\{char\}\}|Char(?:acter)?)\s*:/i;

  function pushLines(block) {
    var lines = block.split(/\n/);
    var curRole = null;
    var curBuf = [];
    function flush() {
      if (curRole && curBuf.length) {
        msgs.push({ role: curRole, content: curBuf.join('\n').trim() });
      }
      curRole = null;
      curBuf = [];
    }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (userRe.test(line) || genericUser.test(line)) {
        flush();
        curRole = 'user';
        curBuf = [line.replace(/^[^:]+:\s*/, '')];
      } else if (charRe.test(line) || genericChar.test(line)) {
        flush();
        curRole = 'assistant';
        curBuf = [line.replace(/^[^:]+:\s*/, '')];
      } else if (curRole) {
        curBuf.push(line);
      }
    }
    flush();
  }

  for (var b = 0; b < blocks.length; b++) pushLines(blocks[b]);
  // 若无法解析出对话行，整段作为 system few-shot 旁注跳过（不硬塞）
  return msgs;
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {object[]} activated
 * @param {any[]} regexScripts
 * @returns {{ entries: object[], regexLog: object[] }}
 */
function applyWorldRegex(activated, regexScripts) {
  var log = [];
  var entries = (activated || []).map(function(e) {
    var res = applyRegexPipeline(e.content || '', regexScripts, {
      placement: PLACEMENT_WORLD,
      ephemerality: 'prompt',
      messageDepth: null,
    });
    for (var i = 0; i < res.applied.length; i++) {
      log.push(Object.assign({ entryId: e.id, comment: e.comment }, res.applied[i]));
    }
    if (res.text === e.content) return e;
    return Object.assign({}, e, { content: res.text });
  });
  return { entries: entries, regexLog: log };
}

/**
 * @param {object} opts
 * @returns {{ messages: { role: string, content: string }[], debug: object }}
 */
export function buildChatCompletionMessages(opts) {
  var o = opts || {};
  var char = o.char || {};
  var charName = char.name != null ? String(char.name) : 'Character';
  var userName = o.userName != null ? String(o.userName) : 'User';
  var names = { charName: charName, userName: userName };
  var history = Array.isArray(o.history) ? o.history.map(function(m) {
    return { role: m.role, content: m.content != null ? String(m.content) : '' };
  }) : [];
  var worldbookEntries = o.worldbookEntries || [];
  var regexScripts = o.regexScripts || [];
  var presetMessages = Array.isArray(o.presetMessages) ? o.presetMessages : [];
  var scanDepth = o.scanDepth == null ? 2 : o.scanDepth;
  var rpCoreText = o.rpCoreText != null ? String(o.rpCoreText) : '';
  var rng = o.rng;

  // 1–2. scan
  var scan = scanWorldInfo({
    entries: worldbookEntries,
    history: history,
    scanDepth: scanDepth,
    rng: rng,
  });

  // 3. WORLD placement regex on activated content
  var worldRx = applyWorldRegex(scan.activated, regexScripts);
  var activated = worldRx.entries;

  var slots = partitionActivated(activated);
  var injected = injectWorldInfo({ messages: history, activated: activated });
  var historyWithDepth = injected.messages;

  var messages = [];
  var macro = function(t) { return applyMacros(t, names); };

  // system: rpCore + [Character] desc + personality/scenario
  var systemParts = [];
  if (rpCoreText) systemParts.push(macro(rpCoreText));
  var desc = char.description != null ? String(char.description) : '';
  if (desc) systemParts.push('[Character]\n' + macro(desc));
  if (char.personality) systemParts.push('[Personality]\n' + macro(String(char.personality)));
  if (char.scenario) systemParts.push('[Scenario]\n' + macro(String(char.scenario)));
  if (char.systemPrompt) systemParts.push(macro(String(char.systemPrompt)));

  var beforeChar = joinEntryContents(slots.beforeChar);
  var afterChar = joinEntryContents(slots.afterChar);
  if (beforeChar) systemParts.push(macro(beforeChar));
  // afterChar 紧随角色块
  if (afterChar) systemParts.push(macro(afterChar));

  if (systemParts.length) {
    messages.push({ role: 'system', content: systemParts.join('\n\n') });
  }

  // preset system msgs
  var presetSystem = [];
  var presetFewshots = [];
  for (var pi = 0; pi < presetMessages.length; pi++) {
    var pm = presetMessages[pi];
    if (!pm) continue;
    var prow = { role: pm.role || 'system', content: macro(String(pm.content || '')) };
    if (prow.role === 'system') presetSystem.push(prow);
    else presetFewshots.push(prow);
  }
  for (var psi = 0; psi < presetSystem.length; psi++) messages.push(presetSystem[psi]);

  // mes_example + WI EM 槽 + Start chat
  var beforeEM = joinEntryContents(slots.beforeEM);
  var afterEM = joinEntryContents(slots.afterEM);
  if (beforeEM) messages.push({ role: 'system', content: macro(beforeEM) });

  var fewshots = parseMesExamples(char.mesExample || '', names);
  for (var fi = 0; fi < fewshots.length; fi++) messages.push(fewshots[fi]);

  if (afterEM) messages.push({ role: 'system', content: macro(afterEM) });

  for (var pfi = 0; pfi < presetFewshots.length; pfi++) messages.push(presetFewshots[pfi]);

  messages.push({ role: 'system', content: 'Start chat' });

  // history（含 @D）
  for (var hi = 0; hi < historyWithDepth.length; hi++) {
    var hm = historyWithDepth[hi];
    messages.push({
      role: hm.role,
      content: macro(String(hm.content || '')),
    });
  }

  // Author note + WI AN
  var anParts = [];
  var beforeAN = joinEntryContents(slots.beforeAN);
  var afterAN = joinEntryContents(slots.afterAN);
  if (beforeAN) anParts.push(macro(beforeAN));
  if (char.creatorNotes) anParts.push(macro(String(char.creatorNotes)));
  if (afterAN) anParts.push(macro(afterAN));
  if (anParts.length) {
    messages.push({ role: 'system', content: anParts.join('\n\n') });
  }

  // other 槽
  var other = joinEntryContents(slots.other);
  if (other) messages.push({ role: 'system', content: macro(other) });

  // continue 指令
  messages.push({
    role: 'system',
    content: 'Continue the chat as ' + charName + '.',
  });

  // 5. USER/AI regex prompt ephemerality
  var msgRx = applyRegexToMessages(messages, regexScripts, 'prompt');
  messages = msgRx.messages;

  var regexLog = worldRx.regexLog.concat(msgRx.applied);

  return {
    messages: messages,
    debug: {
      activated: activated,
      scanBuffer: scan.scanBuffer,
      skipped: scan.skipped,
      regexLog: regexLog,
      slots: slots,
      depthInjections: injected.depthInjections,
    },
  };
}
