/**
 * 纯函数工具（无 DOM 依赖，无副作用，可单元测试）
 * 从 browserApp.mjs 提取，供所有模块复用。
 */

export function uid(prefix) {
  return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 10);
}

export function deepCopy(obj) {
  if (typeof structuredClone === 'function') return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

var CRC_TABLE = new Array(256);
for (var c = 0; c < 256; c++) {
  var n = c;
  for (var k = 0; k < 8; k++) n = (n & 1) ? (0xedb88320 ^ (n >>> 1)) : (n >>> 1);
  CRC_TABLE[c] = n;
}

export function crc32(arr) {
  var crc = 0 ^ (-1);
  for (var i = 0; i < arr.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ arr[i]) & 0xff];
  return (crc ^ (-1)) >>> 0;
}

export function createTextChunk(kw, text) {
  var b64 = btoa(unescape(encodeURIComponent(text)));
  var kb = new TextEncoder().encode(kw);
  var tb = new TextEncoder().encode(b64);
  var d = new Uint8Array(kb.length + 1 + tb.length);
  d.set(kb, 0);
  d[kb.length] = 0;
  d.set(tb, kb.length + 1);
  var ty = new TextEncoder().encode('tEXt');
  var td = new Uint8Array(4 + d.length);
  td.set(ty, 0);
  td.set(d, 4);
  var cs = crc32(td);
  var ch = new Uint8Array(4 + 4 + d.length + 4);
  ch[0] = (d.length >>> 24) & 0xff;
  ch[1] = (d.length >>> 16) & 0xff;
  ch[2] = (d.length >>> 8) & 0xff;
  ch[3] = d.length & 0xff;
  ch.set(td, 4);
  ch[ch.length - 4] = (cs >>> 24) & 0xff;
  ch[ch.length - 3] = (cs >>> 16) & 0xff;
  ch[ch.length - 2] = (cs >>> 8) & 0xff;
  ch[ch.length - 1] = cs & 0xff;
  return ch;
}

export function strategyLabelZh(strategy) {
  if (strategy === 'constant') return '\u5E38\u9A7B';
  if (strategy === 'vectorized') return '\u5411\u91CF\u5316';
  return '\u53EF\u9009';
}

export function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function truncatePreviewLine(text, maxLen) {
  var cap = maxLen || 100;
  var one = String(text || '').replace(/\s+/g, ' ').trim();
  if (!one) return '';
  return one.length > cap ? one.slice(0, cap) + '…' : one;
}

export function parseJsonLoose(text) {
  var fence = String(text || '').match(/```(?:json)?\s*([\s\S]*?)```/i);
  var raw = fence ? fence[1] : text;
  try {
    return JSON.parse(raw);
  } catch (e) {
    var first = String(raw).indexOf('{');
    var last = String(raw).lastIndexOf('}');
    if (first >= 0 && last > first) return JSON.parse(String(raw).slice(first, last + 1));
    var a0 = String(raw).indexOf('[');
    var a1 = String(raw).lastIndexOf(']');
    if (a0 >= 0 && a1 > a0) return JSON.parse(String(raw).slice(a0, a1 + 1));
    throw new Error('JSON 解析失败');
  }
}

export function normalizeNameList(primary, raw) {
  var name = String(primary || '').trim();
  var out = [];
  function add(t) {
    var s = String(t == null ? '' : t).trim();
    if (!s || s === name) return;
    if (out.indexOf(s) < 0) out.push(s);
  }
  if (Array.isArray(raw)) {
    raw.forEach(function(item) {
      String(item == null ? '' : item).split(/[,，、／/|;；\s]+/).forEach(add);
    });
  } else if (raw != null && String(raw).trim()) {
    String(raw).split(/[,，、／/|;；\s]+/).forEach(add);
  }
  return out;
}
