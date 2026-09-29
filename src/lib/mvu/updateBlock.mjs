/**
 * MVU 更新块 / 开场初始值的识别与展示。
 * 酒馆正则只做替换，列表由替换进去的脚本按 JSONPatch 画出来。
 */

export var UPDATE_FIND = '<UpdateVariable>\\s*<(?:Analyze|Analysis)>[\\s\\S]*?</(?:Analyze|Analysis)>\\s*<JSONPatch>([\\s\\S]*?)</JSONPatch>\\s*</UpdateVariable>(?:\\s*<DisplayPatch>[\\s\\S]*?</DisplayPatch>)?';

export var INIT_FIND = '<UpdateVariable>\\s*<initvar>[\\s\\S]*?</initvar>\\s*</UpdateVariable>';

export var HIDE_FIND = '<UpdateVariable>[\\s\\S]*?</UpdateVariable>(?:\\s*<DisplayPatch>[\\s\\S]*?</DisplayPatch>)?';

export function decodePointer(path) {
  return String(path || '').replace(/^\/+/, '').split('/').filter(Boolean).map(function(part) {
    return part.replace(/~1/g, '/').replace(/~0/g, '~');
  });
}

function formatPatchValue(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try { return JSON.stringify(value); } catch (e) { return String(value); }
}

export function rowsFromPatchJson(text) {
  var opLabel = {
    replace: '已更新',
    insert: '已新增',
    delta: '数值变化',
    remove: '已移除',
    move: '已移动',
  };
  var parsed;
  try { parsed = JSON.parse(String(text || '').trim()); } catch (e) { return null; }
  if (!Array.isArray(parsed)) return null;
  return parsed.map(function(item) {
    item = item || {};
    var op = String(item.op || '');
    var parts = decodePointer(item.path || item.from || '');
    var field = parts.length ? parts[parts.length - 1] : '变量';
    var where = parts.length > 1 ? parts.slice(0, -1).join(' / ') : '';
    var value = '';
    if (op === 'remove') value = '已移除';
    else if (op === 'move') {
      var to = decodePointer(item.to || '').join(' / ');
      value = to ? ('移到 ' + to) : '已移动';
    } else if (op === 'delta') {
      var num = Number(item.value);
      value = Number.isFinite(num) ? ((num > 0 ? '+' : '') + String(num)) : formatPatchValue(item.value);
    } else value = formatPatchValue(item.value);
    return {
      op: opLabel[op] || '变更',
      field: field,
      where: where,
      value: value,
    };
  });
}

export function fillUpdateList(box) {
  var src = box.querySelector('.mvu-upd-src');
  var body = box.querySelector('.mvu-upd-body');
  var sum = box.querySelector('.mvu-upd-sum');
  var raw = src ? src.textContent : '';
  var rows = rowsFromPatchJson(raw);
  if (!rows) {
    if (sum) sum.textContent = '变量更新';
    if (body) {
      body.textContent = '';
      var pre = document.createElement('pre');
      pre.className = 'mvu-upd-raw';
      pre.textContent = String(raw || '').trim();
      body.appendChild(pre);
    }
    return;
  }
  if (sum) sum.textContent = rows.length ? ('变量更新 · ' + rows.length + ' 项') : '变量更新 · 没有变化';
  if (!body) return;
  body.textContent = '';
  if (!rows.length) return;
  var list = document.createElement('div');
  list.className = 'mvu-upd-list';
  rows.forEach(function(row) {
    var item = document.createElement('div');
    item.className = 'mvu-upd-item';
    var head = document.createElement('div');
    head.className = 'mvu-upd-head';
    head.textContent = row.where ? (row.op + ' · ' + row.where) : row.op;
    var field = document.createElement('div');
    field.className = 'mvu-upd-field';
    field.textContent = row.field;
    var value = document.createElement('div');
    value.className = 'mvu-upd-value';
    value.textContent = row.value;
    item.appendChild(head);
    item.appendChild(field);
    item.appendChild(value);
    list.appendChild(item);
  });
  body.appendChild(list);
}

export function mountUpdateList(container, rawText) {
  var details = document.createElement('details');
  details.className = 'mvu-upd';
  var sum = document.createElement('summary');
  sum.className = 'mvu-upd-sum';
  sum.textContent = '变量更新';
  var body = document.createElement('div');
  body.className = 'mvu-upd-body';
  var src = document.createElement('script');
  src.type = 'application/json';
  src.className = 'mvu-upd-src';
  src.textContent = String(rawText || '');
  details.appendChild(sum);
  details.appendChild(body);
  details.appendChild(src);
  fillUpdateList(details);
  if (container) container.appendChild(details);
  return details;
}

var UPDATE_LIST_CSS = [
  '.mvu-upd{margin:8px 0;color:inherit;font:inherit}',
  '.mvu-upd-sum{cursor:pointer}',
  '.mvu-upd-item{padding:8px 0;border-top:1px solid rgba(128,128,128,.35)}',
  '.mvu-upd-head{opacity:.72;font-size:.8rem}',
  '.mvu-upd-field{font-weight:700;margin-top:2px}',
  '.mvu-upd-value{margin-top:2px;white-space:pre-wrap;word-break:break-word}',
  '.mvu-upd-raw{margin:8px 0 0;white-space:pre-wrap;word-break:break-word;font-size:.8rem}',
].join('');

function updateListScript() {
  return [
    decodePointer.toString(),
    formatPatchValue.toString(),
    rowsFromPatchJson.toString(),
    fillUpdateList.toString(),
    '(function(){',
    '  function boot(){',
    '    var node=document.currentScript;',
    '    var box=node&&node.parentElement;',
    '    if(box) fillUpdateList(box);',
    '  }',
    '  if(typeof errorCatched==="function") errorCatched(boot)(); else boot();',
    '})();',
  ].join('\n');
}

export function buildUpdateDisplayReplace() {
  var html = '<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><style>'
    + UPDATE_LIST_CSS
    + '</style></head><body><details class="mvu-upd"><summary class="mvu-upd-sum">变量更新</summary><div class="mvu-upd-body"></div><script type="application/json" class="mvu-upd-src">$1</script><script>\n'
    + updateListScript()
    + '\n</script></details></body></html>';
  return '```html\n' + html + '\n```';
}

export var FORMAT_TPL = [
  '---',
  '变量输出格式:',
  '  rule:',
  '    - 在回复末尾输出一个 <UpdateVariable>，里面只放 <Analyze> 和 <JSONPatch>',
  '    - 不要输出 <DisplayPatch>，也不要输出 <initvar>',
  '    - JSONPatch 是 JSON 数组，操作只用 replace、delta、insert、remove、move',
  '    - path 以 / 分隔，例如 /世界/当前时间、/NPC/角色名/好感度',
  '    - 不要更新名字以 _ 开头的字段',
  '    - Analyze 用简短中文说明这一轮为什么变，不要写长篇',
  '  format: |-',
  '    <UpdateVariable>',
  '    <Analyze>',
  '    简短说明',
  '    </Analyze>',
  '    <JSONPatch>',
  '    [',
  '      { "op": "replace", "path": "/世界/当前时间", "value": "新的值" },',
  '      { "op": "delta", "path": "/NPC/角色名/好感度", "value": 1 }',
  '    ]',
  '    </JSONPatch>',
  '    </UpdateVariable>',
].join('\n');
