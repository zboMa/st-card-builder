/**
 * 开场白初始值：编辑态只存和世界书保底不同的路径。
 * 交给酒馆（导出、试聊）时拼成完整 <initvar>；导入时再拆回来。
 */
import { WB_OWNER } from '../worldbook/worldbookRegistry.mjs';
import { patchForRegistrySlot, upsertWorldbookEntry } from '../worldbook/worldbookEntryBridge.mjs';

var BLOCK_RE = /<UpdateVariable>\s*<initvar>([\s\S]*?)<\/initvar>\s*<\/UpdateVariable>|<initvar>([\s\S]*?)<\/initvar>/gi;

function parseScalar(text) {
  var raw = String(text == null ? '' : text).trim();
  if (!raw || raw === '""' || raw === "''") return '';
  if (raw === 'null') return null;
  if (raw === '{}') return {};
  if (raw === '[]') return [];
  if (/^(true|false)$/i.test(raw)) return raw.toLowerCase() === 'true';
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) return Number(raw);
  if ((raw[0] === '"' && raw[raw.length - 1] === '"') || (raw[0] === "'" && raw[raw.length - 1] === "'")) {
    try { return JSON.parse(raw); } catch (e) { return raw.slice(1, -1); }
  }
  if ((raw[0] === '{' && raw[raw.length - 1] === '}') || (raw[0] === '[' && raw[raw.length - 1] === ']')) {
    try { return JSON.parse(raw); } catch (e) { /* 当普通字符串 */ }
  }
  return raw;
}

function yamlScalar(value) {
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.length ? JSON.stringify(value) : '[]';
  if (typeof value === 'object') return '{}';
  var s = String(value);
  if (!s) return '""';
  if (/[:#{}\[\],&*?|\-<>=!%@`]|^\s|\s$/.test(s)) return JSON.stringify(s);
  return s;
}

function renderYamlValue(value, indent) {
  var pad = ' '.repeat(indent);
  if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length) {
    return '\n' + Object.keys(value).map(function(k) {
      return pad + k + ':' + renderYamlValue(value[k], indent + 2);
    }).join('\n');
  }
  return ' ' + yamlScalar(value);
}

export function parseInitYaml(text) {
  var root = {};
  var stack = [{ indent: -1, obj: root }];
  String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).forEach(function(line) {
    if (!line.trim() || /^\s*#/.test(line) || /^\s*---\s*$/.test(line)) return;
    var fence = line.trim();
    if (/^```/.test(fence)) return;
    var m = line.match(/^(\s*)([^:#][^:]*):(?:\s*(.*))?$/);
    if (!m) return;
    var indent = m[1].length;
    var key = m[2].trim();
    var valueText = (m[3] || '').trim();
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    var parent = stack[stack.length - 1].obj;
    if (!valueText) {
      parent[key] = parent[key] && typeof parent[key] === 'object' && !Array.isArray(parent[key]) ? parent[key] : {};
      stack.push({ indent: indent, obj: parent[key] });
    } else {
      parent[key] = parseScalar(valueText);
    }
  });
  return root;
}

export function renderInitYaml(root) {
  return Object.keys(root || {}).map(function(k) {
    return k + ':' + renderYamlValue(root[k], 2);
  }).join('\n');
}

export function flattenLeaves(obj, prefix, out) {
  var dest = out || {};
  Object.keys(obj || {}).forEach(function(key) {
    var value = obj[key];
    var path = prefix ? prefix + '.' + key : key;
    if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length) {
      flattenLeaves(value, path, dest);
    } else {
      dest[path] = value;
    }
  });
  return dest;
}

export function nestLeaves(map) {
  var root = {};
  Object.keys(map || {}).forEach(function(path) {
    var parts = String(path || '').split('.').map(function(p) { return p.trim(); }).filter(Boolean);
    if (!parts.length) return;
    var cur = root;
    parts.forEach(function(part, i) {
      if (i === parts.length - 1) {
        cur[part] = map[path];
        return;
      }
      if (!cur[part] || typeof cur[part] !== 'object' || Array.isArray(cur[part])) cur[part] = {};
      cur = cur[part];
    });
  });
  return root;
}

function sameValue(a, b) {
  if (a === b) return true;
  if (typeof a === 'object' || typeof b === 'object') {
    try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; }
  }
  return false;
}

export function copyOverrideMap(map) {
  var out = {};
  if (!map || typeof map !== 'object' || Array.isArray(map)) return out;
  Object.keys(map).forEach(function(k) {
    var path = String(k || '').trim();
    if (!path || map[k] === undefined) return;
    out[path] = map[k];
  });
  return out;
}

export function diffLeaves(baseline, full) {
  var base = baseline || {};
  var out = {};
  Object.keys(full || {}).forEach(function(path) {
    if (!sameValue(base[path], full[path])) out[path] = full[path];
  });
  return out;
}

export function applyOverrides(baseline, overrides) {
  var out = copyOverrideMap(baseline);
  var extra = copyOverrideMap(overrides);
  Object.keys(extra).forEach(function(path) { out[path] = extra[path]; });
  return out;
}

function unwrapFence(yaml) {
  var s = String(yaml || '').trim();
  var m = s.match(/^```(?:yaml|yml)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1].trim() : s;
}

export function splitGreetingText(text) {
  var raw = String(text == null ? '' : text);
  var re = new RegExp(BLOCK_RE.source, 'gi');
  var match = re.exec(raw);
  if (!match) return { prose: raw, hadBlock: false, failed: false, leaves: {} };
  var leaves = {};
  var failed = false;
  var pieces = [];
  var last = 0;
  while (match) {
    var inner = unwrapFence(match[1] != null ? match[1] : match[2]);
    var parsed = parseInitYaml(inner);
    var part = flattenLeaves(parsed);
    if (inner && !Object.keys(part).length) failed = true;
    else Object.keys(part).forEach(function(k) { leaves[k] = part[k]; });
    if (!failed) {
      pieces.push(raw.slice(last, match.index));
      last = match.index + match[0].length;
    }
    match = re.exec(raw);
  }
  if (failed) return { prose: raw, hadBlock: true, failed: true, leaves: {} };
  pieces.push(raw.slice(last));
  var prose = pieces.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { prose: prose, hadBlock: true, failed: false, leaves: leaves };
}

export function composeGreetingText(prose, overrides, baseline) {
  var split = splitGreetingText(prose);
  if (split.failed) return String(prose == null ? '' : prose);
  var ov = copyOverrideMap(overrides);
  if (!Object.keys(ov).length) return split.prose;
  var full = applyOverrides(baseline || {}, ov);
  var yaml = renderInitYaml(nestLeaves(full));
  var body = String(split.prose || '').replace(/\s*$/, '');
  var block = '<UpdateVariable>\n<initvar>\n' + yaml + '\n</initvar>\n</UpdateVariable>';
  return body ? (body + '\n\n' + block) : block;
}

export function parseOverrideLines(text) {
  var out = {};
  String(text || '').split(/\r?\n/).forEach(function(line) {
    var s = String(line || '').trim();
    if (!s || s.charAt(0) === '#') return;
    var eq = s.indexOf('=');
    var colon = s.indexOf(':');
    var cut = eq >= 0 ? eq : colon;
    if (cut <= 0) return;
    var path = s.slice(0, cut).trim();
    if (!path) return;
    out[path] = parseScalar(s.slice(cut + 1));
  });
  return out;
}

export function formatOverrideLines(map) {
  return Object.keys(copyOverrideMap(map)).map(function(path) {
    return path + '=' + yamlScalar(map[path]);
  }).join('\n');
}

export function findInitvarEntry(entries) {
  var list = Array.isArray(entries) ? entries : [];
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    if (!e) continue;
    if (String(e.owner || '') === WB_OWNER.mvu && String(e.ownerSlot || '') === 'initvar') return e;
    var c = String(e.comment || e.displayName || '');
    if (c.indexOf('[initvar]') >= 0 || c.indexOf('变量初始化') >= 0) return e;
  }
  return null;
}

export function baselineLeavesFromEntries(entries) {
  var entry = findInitvarEntry(entries);
  if (!entry || !String(entry.content || '').trim()) return {};
  return flattenLeaves(parseInitYaml(entry.content));
}

export function installBaselineEntry(entries, yaml) {
  var patch = patchForRegistrySlot(WB_OWNER.mvu, 'initvar', {
    content: String(yaml || ''),
    keys: [],
    strategy: 'selective',
    position: 0,
    depth: 0,
    role: 0,
    order: 1000,
    prob: 100,
    enabled: false,
  });
  return upsertWorldbookEntry(entries, patch);
}

function oneSlot(text, baseline, previous, resetMissing) {
  var split = splitGreetingText(text);
  if (split.failed) return { prose: String(text == null ? '' : text), overrides: copyOverrideMap(previous) };
  if (!split.hadBlock) {
    return {
      prose: split.prose,
      overrides: resetMissing ? {} : copyOverrideMap(previous),
    };
  }
  return { prose: split.prose, overrides: diffLeaves(baseline, split.leaves), leaves: split.leaves };
}

/**
 * 把主开场和备选从酒馆正文拆回「正文 + 差异」。
 * 没有世界书保底、但主开场带了完整初始值时，用主开场补一条禁用的保底，主开场差异留空。
 * resetMissing：正文里没有初始值块时清空差异。导入和整段重写用 true；只改措辞用 false。
 */
export function applyGreetingTexts(opts) {
  opts = opts || {};
  var entries = Array.isArray(opts.entries) ? opts.entries.slice() : [];
  var baseline = baselineLeavesFromEntries(entries);
  var baselineInstalled = false;
  var firstRaw = opts.firstMes == null ? '' : String(opts.firstMes);
  var firstProbe = splitGreetingText(firstRaw);
  if (!Object.keys(baseline).length && firstProbe.hadBlock && !firstProbe.failed && Object.keys(firstProbe.leaves).length) {
    baseline = firstProbe.leaves;
    entries = installBaselineEntry(entries, renderInitYaml(nestLeaves(baseline)));
    baselineInstalled = true;
  }
  var resetMain = opts.resetMain != null ? opts.resetMain : opts.resetMissing !== false;
  var resetAlts = opts.resetAlts != null ? opts.resetAlts : opts.resetMissing !== false;
  var main = oneSlot(firstRaw, baseline, opts.previousMain, resetMain);
  var prevAlts = Array.isArray(opts.previousAlts) ? opts.previousAlts : [];
  var altRaw = Array.isArray(opts.altGreetings) ? opts.altGreetings : [];
  var altGreetings = [];
  var greetingInitAlts = [];
  altRaw.forEach(function(text, i) {
    var slot = oneSlot(text, baseline, prevAlts[i], resetAlts);
    altGreetings.push(slot.prose);
    greetingInitAlts.push(slot.overrides);
  });
  return {
    firstMes: main.prose,
    greetingInitMain: main.overrides,
    altGreetings: altGreetings,
    greetingInitAlts: greetingInitAlts,
    entries: entries,
    baselineInstalled: baselineInstalled,
  };
}

/**
 * 开场初始值的 target 与开场白工具相同：main、{ alternate:n }、{ index }、数字序号。
 * 缺 target 不默认主开场，避免写到另一条上。
 */
export function resolveGreetingSlot(target, altCount, indexFallback) {
  var count = typeof altCount === 'number' ? altCount : 0;
  var isMain = target === 'main'
    || (target && typeof target === 'object' && (target.main === true || target.kind === 'main'));
  var altIndex = null;
  if (!isMain) {
    if (typeof target === 'number') altIndex = target;
    else if (target && typeof target === 'object' && typeof target.alternate === 'number') altIndex = target.alternate;
    else if (target && typeof target === 'object' && typeof target.index === 'number') altIndex = target.index;
    else if (typeof indexFallback === 'number') altIndex = indexFallback;
    else return { ok: false, error: '缺少 target' };
    if (altIndex < 0 || altIndex >= count) return { ok: false, error: '备选开场白序号越界' };
    return { ok: true, main: false, index: altIndex, target: { alternate: altIndex } };
  }
  return { ok: true, main: true, index: -1, target: 'main' };
}

function normalizeOverrideInput(raw) {
  if (raw == null || raw === '') return { ok: true, map: {}, empty: true };
  if (typeof raw === 'string') {
    return { ok: true, map: parseOverrideLines(raw), empty: !String(raw).trim() };
  }
  if (Array.isArray(raw)) {
    return { ok: true, map: parseOverrideLines(raw.join('\n')), empty: !raw.length };
  }
  if (typeof raw !== 'object') return { ok: false, error: 'overrides 须为路径到值的对象' };
  var map = {};
  Object.keys(raw).forEach(function(key) {
    var path = String(key || '').trim();
    if (!path) return;
    var value = raw[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      var flat = flattenLeaves(value, path);
      Object.keys(flat).forEach(function(leaf) { map[leaf] = flat[leaf]; });
      return;
    }
    map[path] = value;
  });
  return { ok: true, map: map, empty: !Object.keys(raw).length };
}

/**
 * 把一组路径差异合并进某一条开场。clear 从空表开始；值为 null 删掉该路径。
 * 没有世界书保底时拒绝写入（清空除外）。与保底相同的值不留下。
 */
export function applyGreetingInitChange(state, opts) {
  state = state || {};
  opts = opts || {};
  var altCount = typeof state.altCount === 'number' ? state.altCount : 0;
  var slot = resolveGreetingSlot(opts.target, altCount, opts.index);
  if (!slot.ok) return { ok: false, error: slot.error };

  var parsed = normalizeOverrideInput(opts.overrides);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  var clearing = opts.clear === true;
  if (!clearing && parsed.empty) return { ok: false, error: '缺少 overrides' };

  var baseline = state.baseline && typeof state.baseline === 'object' ? state.baseline : {};
  var hasBaseline = Object.keys(baseline).length > 0;
  if (!hasBaseline && !parsed.empty) return { ok: false, error: '请先生成变量' };

  var main = copyOverrideMap(state.greetingInitMain);
  var alts = (Array.isArray(state.greetingInitAlts) ? state.greetingInitAlts : []).map(copyOverrideMap);
  while (alts.length < altCount) alts.push({});
  var next = clearing ? {} : copyOverrideMap(slot.main ? main : alts[slot.index]);
  Object.keys(parsed.map).forEach(function(path) {
    var value = parsed.map[path];
    if (value === null || (hasBaseline && Object.prototype.hasOwnProperty.call(baseline, path) && sameValue(baseline[path], value))) {
      delete next[path];
      return;
    }
    next[path] = value;
  });
  if (slot.main) main = next;
  else alts[slot.index] = next;
  return {
    ok: true,
    target: slot.target,
    overrides: next,
    cleared: clearing,
    greetingInitMain: main,
    greetingInitAlts: alts,
  };
}

function clipInitValue(value) {
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  var s = String(value == null ? '' : value).trim();
  return s.length > 80 ? s.slice(0, 80) : s;
}

function extractDraftText(text) {
  var s = String(text || '').trim();
  var fenced = s.match(/```(?:yaml|yml|text)?\s*([\s\S]*?)```/i);
  if (fenced) s = fenced[1].trim();
  return s.split(/\r?\n/).map(function(line) {
    return String(line || '').replace(/^\s*[-*]\s+/, '');
  }).join('\n');
}

/**
 * 把模型输出收成「只属于保底、且和保底不同」的路径。
 * 保底里没有的路径记在 dropped，不写入。
 */
export function interpretGreetingInitDraft(text, baseline) {
  var base = baseline && typeof baseline === 'object' ? baseline : {};
  var parsed = parseOverrideLines(extractDraftText(text));
  var overrides = {};
  var dropped = [];
  Object.keys(parsed).forEach(function(path) {
    if (!Object.prototype.hasOwnProperty.call(base, path)) {
      dropped.push(path);
      return;
    }
    var value = clipInitValue(parsed[path]);
    if (sameValue(base[path], value)) return;
    overrides[path] = value;
  });
  return {
    overrides: overrides,
    dropped: dropped,
    empty: !Object.keys(overrides).length,
  };
}

export function buildGreetingInitUserPrompt(prose, baseline) {
  var lines = formatOverrideLines(baseline);
  return '【世界书保底】\n' + (lines || '（空）')
    + '\n\n【这一条开场白】\n' + String(prose || '').trim()
    + '\n\n只输出这场相对保底真正改掉的路径。设定里已成立、这场没改的不要输出。每行一条：路径=值。每个值不超过一句。没有差异就什么都不要输出。';
}
