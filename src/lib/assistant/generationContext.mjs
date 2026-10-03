/**
 * 助手长文生成：instruction 门槛、写入类长正文拦截、世界与限定与关联索引。
 * 纯函数，供执行器、面板桥与测试共用。
 */
import { buildWorldviewHintFromItems } from '../presets/worldviews/index.mjs';
import { isSystemEntry } from '../worldbook/worldbookRegistry.mjs';

/** instruction 少于此长度视为没有写清本次生成提示 */
export var MIN_GENERATION_INSTRUCTION = 80;

/** 写入类工具参数里的正文达到此长度，改为走生成工具 */
export var LONG_PROSE_CHARS = 120;

var INSTRUCTION_TOOLS = {
  expand_character_field: true,
  rewrite_greeting: true,
  expand_greeting: true,
  generate_worldbook_entry: true,
  rewrite_worldbook_entry: true,
  expand_worldbook_entry: true,
  novel_expand_character: true,
  novel_rewrite_character: true,
  novel_expand_worldbook: true,
};

var GROUP_LABEL = {
  person: '人物',
  location: '地点',
  item: '物品',
  faction: '势力',
  event: '事件',
};

var GROUP_ORDER = ['人物', '地点', '物品', '势力', '事件', '规则'];

export var RELATION_RULE = '【关联写法】用索引里已有的名字写关系（认识、对立、持有、位于、隶属）。卡上还没有条目时可以新起。已有人物或物品时，人物、物品、事件类正文必须点名其中至少一条，禁止再写一套互不认识的平行卡司。对不上的不要硬拉。场景契约只写谁在场、怎么出场，不把别人的小传写进角色描述。开场白只让会出场的人说话。';

export var STOCK_CHAR_DESC = '本次写场景契约（角色描述），不要写成某一个 NPC 的小传。写清当前局面、叙事视角、已有人物如何出场与调度、用户能做什么、禁止怎样 OOC。加强可扮演的互动与主动性，避免试聊回复过短。关系用卡上已有的人名来写，不要另起一套互不认识的角色。';

export var STOCK_GREETING = '本次只写这一条开场白正文。从场景契约出发，写在场人物的动作、对白和局面，可以多个人说话。不要替用户说话、行动或描写用户心理，结尾把话头抛给用户。只让卡上已经有的、这场会出现的人开口，不要新造一套无关角色。';

export var STOCK_WB = '把这一条展开成可指导扮演的世界书正文。按它的类型写清定义、规则和在剧情里的用法，并写明它和已有人物、地点、物品、势力的关系，例如认识、对立、持有、位于或隶属。保留原标题的方向，不要改去写别的条目，也不要另起一套互不认识的名字。';

export function generationInstructionOf(args) {
  args = args || {};
  return String(args.instruction || args.direction || args.prompt || '').trim();
}

function tooLong(text) {
  return String(text || '').trim().length >= LONG_PROSE_CHARS;
}

function longProseMessage(toolName) {
  return '这是长正文，不要写进 ' + toolName + ' 的参数。请改用生成工具，并在 instruction 里写清这次的生成提示：角色字段用 expand_character_field，开场白用 rewrite_greeting 或 expand_greeting，世界书用 generate_worldbook_entry、expand_worldbook_entry 或 rewrite_worldbook_entry。';
}

/** 执行器拦住的长文错误。这类失败应回到规划改调用，而不是结束本轮。 */
export function isLongFormGuardError(text) {
  var s = String(text || '');
  return s.indexOf('这是长正文') >= 0
    || s.indexOf('长文要逐篇生成') >= 0
    || s.indexOf('instruction 必须写清') >= 0;
}

function directionFromDraft(text, extra) {
  var body = String(text || '').trim();
  if (body.length > 1500) body = body.slice(0, 1500);
  var instruction = '按本轮已经确认的设定写这一篇。下面只是方向，不要原样存成正文：\n'
    + (extra ? String(extra).trim() + '\n' : '')
    + body;
  if (instruction.trim().length < MIN_GENERATION_INSTRUCTION) {
    instruction += '\n写清和已有人物、地点、物品的关系，保留已经确认的事实，不要另起一套互不认识的名字。';
  }
  return instruction;
}

var LONG_CHARACTER_FIELDS = {
  charDesc: true,
  creatorNotes: true,
  firstMes: true,
  post_history_instructions: true,
  postHistoryInstructions: true,
};

function characterLongPlan(item) {
  if (item.kind === 'alt') {
    return {
      tool: 'rewrite_greeting',
      args: {
        target: { alternate: item.index },
        mode: 'rewrite',
        instruction: directionFromDraft(item.text, '这一篇是备选开场白第 ' + (item.index + 1) + ' 条。'),
      },
      label: '备选开场白第 ' + (item.index + 1) + ' 条',
    };
  }
  var key = item.key === 'post_history_instructions' || item.key === 'postHistoryInstructions'
    ? 'creatorNotes'
    : item.key;
  if (key === 'firstMes') {
    return {
      tool: 'rewrite_greeting',
      args: {
        target: 'main',
        mode: 'rewrite',
        instruction: directionFromDraft(item.text, '这一篇是主开场白。'),
      },
      label: '主开场白',
    };
  }
  var label = key === 'creatorNotes' ? '作者注释' : '场景契约';
  return {
    tool: 'expand_character_field',
    args: {
      field: key,
      mode: 'rewrite',
      instruction: directionFromDraft(item.text, '这一篇是' + label + '。'),
    },
    label: label,
  };
}

function collectCharacterLongs(fields) {
  var shorts = {};
  var longs = [];
  var altLong = false;
  Object.keys(fields || {}).forEach(function(k) {
    var v = fields[k];
    if (k === 'altGreetings' && Array.isArray(v)) {
      v.forEach(function(item, i) {
        if (tooLong(item)) {
          altLong = true;
          longs.push({ kind: 'alt', index: i, text: String(item), order: 30 + i });
        }
      });
      if (!altLong) shorts.altGreetings = v;
      return;
    }
    if (LONG_CHARACTER_FIELDS[k] && tooLong(v)) {
      var order = k === 'charDesc' ? 0 : (k === 'creatorNotes' || k === 'post_history_instructions' || k === 'postHistoryInstructions' ? 1 : 2);
      longs.push({ kind: 'field', key: k, text: String(v), order: order });
      return;
    }
    shorts[k] = v;
  });
  longs.sort(function(a, b) { return a.order - b.order; });
  return { shorts: shorts, longs: longs };
}

function followupFromRest(rest) {
  if (!rest.length) return '';
  return '这些还没写，下一篇再各调一次对应的生成工具：' + rest.map(function(item) {
    return item.label;
  }).join('、') + '。';
}

/**
 * 长正文误走写入工具时，改成对应的生成工具。
 * 短字段留在 shortCall，由调用方先写入。没有长正文时返回 null。
 * @returns {null | { tool: string, args: object, shortCall: null | { tool: string, args: object }, followup: string }}
 */
export function redirectLongFormCall(toolName, args) {
  args = args || {};
  if (toolName === 'update_character_fields') {
    var split = collectCharacterLongs(args.fields || {});
    if (!split.longs.length) return null;
    var first = characterLongPlan(split.longs[0]);
    var rest = split.longs.slice(1).map(characterLongPlan);
    var shortKeys = Object.keys(split.shorts);
    return {
      tool: first.tool,
      args: first.args,
      shortCall: shortKeys.length
        ? { tool: 'update_character_fields', args: { fields: split.shorts } }
        : null,
      followup: followupFromRest(rest),
    };
  }
  if (toolName === 'replace_character_section' && LONG_CHARACTER_FIELDS[args.field] && tooLong(args.content)) {
    var replaced = characterLongPlan({ kind: 'field', key: args.field, text: String(args.content) });
    return { tool: replaced.tool, args: replaced.args, shortCall: null, followup: '' };
  }
  if (toolName === 'update_alternate_greeting' && tooLong(args.content)) {
    var alt = characterLongPlan({ kind: 'alt', index: Number(args.index) || 0, text: String(args.content) });
    return { tool: alt.tool, args: alt.args, shortCall: null, followup: '' };
  }
  if (toolName === 'update_worldbook_entry') {
    var patch = args.patch || {};
    if (!tooLong(patch.content)) return null;
    var shortPatch = {};
    Object.keys(patch).forEach(function(k) {
      if (k !== 'content') shortPatch[k] = patch[k];
    });
    var target = args.target && typeof args.target === 'object' ? args.target : {};
    if (!args.target || typeof args.target !== 'object') {
      if (args.index != null) target.index = args.index;
      if (args.comment) target.comment = args.comment;
      if (args.id) target.id = args.id;
      if (args.titleMatch) target.titleMatch = args.titleMatch;
    }
    var titleHint = patch.comment || args.comment || (target && target.comment) || '';
    return {
      tool: 'rewrite_worldbook_entry',
      args: {
        target: target,
        mode: 'rewrite',
        instruction: directionFromDraft(patch.content, titleHint ? '这一篇是世界书条目「' + titleHint + '」。' : '这一篇是已有的世界书条目。'),
      },
      shortCall: Object.keys(shortPatch).length
        ? { tool: 'update_worldbook_entry', args: { target: target, patch: shortPatch } }
        : null,
      followup: '',
    };
  }
  if (toolName === 'create_worldbook_entry') {
    var list = Array.isArray(args.entries) ? args.entries.slice() : [];
    if (args.entry && typeof args.entry === 'object') list.push(args.entry);
    if (args.content) list.push(args);
    var longEntries = [];
    for (var e = 0; e < list.length; e++) {
      if (tooLong(entryContentOf(list[e]))) longEntries.push(list[e]);
    }
    if (!longEntries.length) return null;
    var entry = longEntries[0] || {};
    var title = String(entry.comment || entry.displayName || entry.name || '').trim();
    var keys = Array.isArray(entry.keys) ? entry.keys.map(function(k) { return String(k || '').trim(); }).filter(Boolean) : [];
    var extra = '这一篇是新的世界书条目'
      + (title ? '，标题用「' + title + '」' : '')
      + (keys.length ? '，触发词：' + keys.join('、') : '')
      + '。';
    return {
      tool: 'generate_worldbook_entry',
      args: { instruction: directionFromDraft(entryContentOf(entry), extra) },
      shortCall: null,
      followup: longEntries.length > 1
        ? '还有 ' + (longEntries.length - 1) + ' 条长正文没写，下一篇再各调一次 generate_worldbook_entry。'
        : '',
    };
  }
  return null;
}

function entryContentOf(entry) {
  if (!entry || typeof entry !== 'object') return '';
  if (entry.content != null) return String(entry.content);
  if (entry.blurb != null) return String(entry.blurb);
  return '';
}

function longProseError(toolName, args) {
  args = args || {};
  if (toolName === 'update_character_fields') {
    var fields = args.fields || {};
    var keys = ['charDesc', 'firstMes', 'creatorNotes'];
    for (var i = 0; i < keys.length; i++) {
      if (tooLong(fields[keys[i]])) return longProseMessage(toolName);
    }
    var alts = fields.altGreetings;
    if (Array.isArray(alts)) {
      for (var a = 0; a < alts.length; a++) {
        if (tooLong(alts[a])) return longProseMessage(toolName);
      }
    }
  }
  if (toolName === 'replace_character_section' && tooLong(args.content)) {
    return longProseMessage(toolName);
  }
  if (toolName === 'update_alternate_greeting' && tooLong(args.content)) {
    return longProseMessage(toolName);
  }
  if (toolName === 'update_worldbook_entry') {
    var patch = args.patch || {};
    if (tooLong(patch.content)) return longProseMessage(toolName);
  }
  if (toolName === 'create_worldbook_entry') {
    var list = Array.isArray(args.entries) ? args.entries.slice() : [];
    if (args.entry && typeof args.entry === 'object') list.push(args.entry);
    if (args.content) list.push(args);
    for (var e = 0; e < list.length; e++) {
      if (tooLong(entryContentOf(list[e]))) return longProseMessage(toolName);
    }
  }
  return '';
}

/**
 * 长文工具缺生成提示、或长正文误走写入工具时，返回给模型的错误；否则空串。
 */
export function longFormToolError(toolName, args) {
  if (toolName === 'generate_character_draft' || toolName === 'generate_worldbook_skeleton') {
    return '长文要逐篇生成，不要用 ' + toolName + ' 一次写完。角色字段用 expand_character_field，开场白用 rewrite_greeting 或 expand_greeting，世界书正文用 generate_worldbook_entry、expand_worldbook_entry 或 rewrite_worldbook_entry，小说长文用 novel_expand_character 或 novel_expand_worldbook。每次一篇，instruction 写清这次的生成提示。';
  }
  if (INSTRUCTION_TOOLS[toolName]) {
    var text = generationInstructionOf(args);
    if (text.length < MIN_GENERATION_INSTRUCTION) {
      return '调用 ' + toolName + ' 时，instruction 必须写清这次的生成提示（已确认的设定、这篇要写的内容、和已有人物或物品地点的关系），不能空着或只写一句话。';
    }
  }
  return longProseError(toolName, args);
}

function outlineTypeOf(entry) {
  entry = entry || {};
  var t = String(entry.outlineType || entry.type || entry.category || '').trim();
  if (t.indexOf('outline_') === 0) t = t.slice('outline_'.length);
  if (t === 'character' || t === 'person' || t === 'npc') return 'person';
  if (GROUP_LABEL[t]) return t;
  var k = String(entry.kind || '');
  if (k.indexOf('outline_') === 0) {
    var fromKind = k.slice('outline_'.length);
    if (GROUP_LABEL[fromKind]) return fromKind;
  }
  if (k === 'novel_person' || k.indexOf('person') >= 0) return 'person';
  if (k.indexOf('location') >= 0) return 'location';
  if (k.indexOf('item') >= 0) return 'item';
  if (k.indexOf('faction') >= 0) return 'faction';
  if (k.indexOf('event') >= 0) return 'event';
  return '';
}

function groupOf(entry) {
  var t = outlineTypeOf(entry);
  return GROUP_LABEL[t] || '规则';
}

function titleOf(entry) {
  entry = entry || {};
  return String(entry.comment || entry.displayName || entry.name || entry.title || '').trim();
}

function keysOf(entry) {
  var keys = entry && entry.keys;
  if (!Array.isArray(keys)) return [];
  return keys.map(function(k) { return String(k || '').trim(); }).filter(Boolean);
}

function oneLine(text, maxLen) {
  var one = String(text || '').replace(/\s+/g, ' ').trim();
  var cap = maxLen || 48;
  if (!one) return '';
  return one.length > cap ? one.slice(0, cap) + '…' : one;
}

/**
 * @param {object[]} entries
 * @param {{ excludeIndex?: number, focusText?: string, maxRelated?: number, relatedChars?: number }} [opts]
 */
export function buildRelationIndex(entries, opts) {
  opts = opts || {};
  var focus = String(opts.focusText || '');
  var maxRelated = opts.maxRelated != null ? opts.maxRelated : 4;
  var relatedChars = opts.relatedChars != null ? opts.relatedChars : 400;
  var buckets = {};
  GROUP_ORDER.forEach(function(g) { buckets[g] = []; });
  var related = [];
  (entries || []).forEach(function(entry, index) {
    if (!entry || isSystemEntry(entry)) return;
    if (opts.excludeIndex != null && index === opts.excludeIndex) return;
    var title = titleOf(entry);
    if (!title) return;
    var keys = keysOf(entry);
    var blurb = oneLine(entry.content || entry.blurb || '');
    var line = '- ' + title + (blurb ? '｜' + blurb : '') + (keys.length ? '｜' + keys.slice(0, 6).join('、') : '');
    buckets[groupOf(entry)].push(line);
    var linked = false;
    if (title.length >= 2 && focus.indexOf(title) >= 0) linked = true;
    if (!linked) {
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].length >= 2 && focus.indexOf(keys[i]) >= 0) {
          linked = true;
          break;
        }
      }
    }
    if (linked && related.length < maxRelated) {
      var body = String(entry.content || entry.blurb || '').trim();
      if (body.length > relatedChars) body = body.slice(0, relatedChars) + '…';
      if (body) related.push('【' + title + '】\n' + body);
    }
  });
  var lines = ['【已有关联】'];
  var any = false;
  GROUP_ORDER.forEach(function(g) {
    if (!buckets[g].length) return;
    any = true;
    lines.push(g);
    buckets[g].forEach(function(line) { lines.push(line); });
  });
  if (!any) return { indexText: '', relatedText: '', rule: '' };
  return {
    indexText: lines.join('\n'),
    relatedText: related.length ? '【相关条目正文】\n' + related.join('\n\n') : '',
    rule: RELATION_RULE,
  };
}

export function formatRelationBlock(entries, focusText) {
  var rel = buildRelationIndex(entries, { focusText: focusText || '' });
  if (!rel.indexText) return '';
  return rel.indexText + (rel.relatedText ? '\n' + rel.relatedText : '') + '\n' + rel.rule;
}

/** 当前卡的成人开关。写进世界与限定，供人物条决定要不要写「情欲」一节。 */
export function formatAdultModeLine(nsfwOn, ntlOn) {
  return '【当前开关】AdultMode=' + (nsfwOn ? 'true' : 'false')
    + '；NtlMode=' + (ntlOn ? 'true' : 'false') + '。';
}

export function buildWorldConstraintBlock(worldviewHint, adultHints) {
  var parts = [];
  var wv = String(worldviewHint || '').trim();
  if (wv) parts.push(wv);
  var hints = adultHints || {};
  ['gate', 'nsfw', 'posture', 'speech', 'ntl', 'canon', 'vessel'].forEach(function(k) {
    var block = String(hints[k] || '').trim();
    if (block) parts.push(block);
  });
  if (!parts.length) return '';
  return '【世界与限定】\n' + parts.join('\n');
}

/**
 * 拼进第二次模型调用的上下文。instruction 是助手传入的本次生成提示。
 */
export function buildGenerationPack(opts) {
  opts = opts || {};
  var instruction = String(opts.instruction || '').trim();
  var parts = [];
  if (instruction) {
    parts.push('【本次任务】\n' + instruction + '\n本次任务优先于通用模板。与世界与限定或已有条目冲突时，保留已确认的 Limits 与已写事实，其余以本次任务为准。');
  }
  var world = buildWorldConstraintBlock(opts.worldviewHint, opts.adultHints);
  if (world) parts.push(world);
  if (opts.includeRelations !== false) {
    var rel = buildRelationIndex(opts.entries, {
      excludeIndex: opts.excludeIndex,
      focusText: [instruction, opts.focusTitle, opts.focusText].filter(Boolean).join('\n'),
      maxRelated: opts.maxRelated,
      relatedChars: opts.relatedChars,
    });
    if (rel.indexText) {
      parts.push(rel.indexText + (rel.relatedText ? '\n' + rel.relatedText : '') + '\n' + rel.rule);
    }
  }
  if (opts.includeCharacter !== false && opts.character) {
    var name = String(opts.character.charName || '').trim();
    var desc = String(opts.character.charDesc || '').trim();
    var cap = opts.charDescCap || 800;
    if (desc.length > cap) desc = desc.slice(0, cap) + '…';
    if (name || desc) {
      parts.push('【场景契约摘要】' + name + (desc ? '\n' + desc : '') + '\n此段只作场面参考。人物小传写在世界书，不要把摘要扩写成另一篇角色描述。');
    }
  }
  return parts.join('\n\n');
}

/** 浏览器里读取卡面世界与限定。无 window 时返回空。 */
export function collectBrowserGenerationInputs() {
  var empty = { worldviewHint: '', adultHints: null };
  if (typeof window === 'undefined') return empty;
  var cfg = {};
  var adult = {};
  try {
    if (typeof window.__getNsfwConfig__ === 'function') cfg = window.__getNsfwConfig__() || {};
  } catch (e) {
    cfg = {};
  }
  try {
    if (typeof window.__buildAdultPromptHints__ === 'function') adult = window.__buildAdultPromptHints__() || {};
  } catch (e2) {
    adult = {};
  }
  var wv = '';
  try {
    wv = buildWorldviewHintFromItems(cfg.worldviewPresetItems || [], { stage: 'all' }) || '';
  } catch (e3) {
    wv = '';
  }
  return { worldviewHint: wv, adultHints: adult };
}

export function readCardGenerationPack(opts) {
  if (typeof window === 'undefined' || typeof window.__cardGenerationPack__ !== 'function') return '';
  try {
    return window.__cardGenerationPack__(opts || {}) || '';
  } catch (e) {
    return '';
  }
}

/** 生成结果未点名已有人物/物品时给出提示，不阻断写入。 */
export function relationMentionWarning(text, entries) {
  var body = String(text || '');
  var names = [];
  (entries || []).forEach(function(entry) {
    if (!entry || isSystemEntry(entry)) return;
    var g = groupOf(entry);
    if (g !== '人物' && g !== '物品') return;
    var title = titleOf(entry);
    if (title.length >= 2) names.push(title);
    keysOf(entry).forEach(function(k) {
      if (k.length >= 2) names.push(k);
    });
  });
  if (!names.length) return '';
  var hit = names.some(function(n) { return body.indexOf(n) >= 0; });
  if (hit) return '';
  var shown = [];
  names.forEach(function(n) {
    if (shown.indexOf(n) < 0 && shown.length < 8) shown.push(n);
  });
  return '正文未点名已有人物或物品（' + shown.join('、') + '）。若这篇和他们有关，请再用生成工具把关系写进去。';
}
