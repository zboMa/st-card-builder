import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UPDATE_FIND,
  INIT_FIND,
  HIDE_FIND,
  rowsFromPatchJson,
  buildUpdateDisplayReplace,
} from '../src/lib/mvu/updateBlock.mjs';
import { applyRegexScript } from '../src/lib/regexScripts.mjs';

var SAMPLE = [
  '<UpdateVariable>',
  '<Analyze>',
  'The time passed is minimal.',
  '</Analyze>',
  '<JSONPatch>',
  '[',
  '  {',
  '    "op": "replace",',
  '    "path": "/世界/当前时间",',
  '    "value": "天元243年4月15日巳时"',
  '  },',
  '  {',
  '    "op": "replace",',
  '    "path": "/NPC/小说人物·王语嫣/情绪",',
  '    "value": "惶恐无助"',
  '  },',
  '  {',
  '    "op": "delta",',
  '    "path": "/NPC/小说人物·王语嫣/好感度",',
  '    "value": 2',
  '  }',
  ']',
  '</JSONPatch>',
  '</UpdateVariable>',
].join('\n');

var OLD = [
  '<UpdateVariable>',
  '<Analysis>old</Analysis>',
  '<JSONPatch>',
  '[{ "op": "remove", "path": "/世界/天气" }]',
  '</JSONPatch>',
  '</UpdateVariable>',
  '<DisplayPatch><article>旧卡片</article></DisplayPatch>',
].join('\n');

var INIT = [
  '开场正文',
  '<UpdateVariable>',
  '<initvar>',
  '世界:',
  '  当前时间: 辰时',
  '</initvar>',
  '</UpdateVariable>',
].join('\n');

test('当前 MVU 更新块能匹配，并拆成可读列表', function() {
  var re = new RegExp(UPDATE_FIND);
  var m = SAMPLE.match(re);
  assert.ok(m);
  var rows = rowsFromPatchJson(m[1]);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], { op: '已更新', field: '当前时间', where: '世界', value: '天元243年4月15日巳时' });
  assert.equal(rows[1].field, '情绪');
  assert.equal(rows[1].where, 'NPC / 小说人物·王语嫣');
  assert.equal(rows[2].op, '数值变化');
  assert.equal(rows[2].value, '+2');
});

test('旧的 Analysis 加 DisplayPatch 也能被吃掉', function() {
  var applied = applyRegexScript({ findRegex: UPDATE_FIND, replaceString: 'LIST' }, OLD);
  assert.equal(applied.ok, true);
  assert.equal(applied.result, 'LIST');
  assert.equal(applied.result.includes('旧卡片'), false);
  assert.equal(applied.result.includes('DisplayPatch'), false);
});

test('替换结果是默认折叠的列表，JSON 落在第一组', function() {
  var html = buildUpdateDisplayReplace();
  assert.match(html, /<details class="mvu-upd">/);
  assert.equal(html.includes('<details class="mvu-upd" open'), false);
  assert.match(html, /<summary class="mvu-upd-sum">变量更新<\/summary>/);
  assert.match(html, /class="mvu-upd-src">\$1<\/script>/);
  var applied = applyRegexScript({ findRegex: UPDATE_FIND, replaceString: html }, '前文\n\n' + SAMPLE);
  assert.equal(applied.ok, true);
  assert.match(applied.result, /前文/);
  assert.match(applied.result, /惶恐无助/);
  assert.equal(applied.result.includes('<Analyze>'), false);
});

test('开场初始值从画面去掉，提示词里整段更新块去掉', function() {
  var shown = applyRegexScript({ findRegex: INIT_FIND, replaceString: '' }, INIT);
  assert.equal(shown.ok, true);
  assert.match(shown.result, /开场正文/);
  assert.equal(shown.result.includes('initvar'), false);
  var hidden = applyRegexScript({ findRegex: HIDE_FIND, replaceString: '' }, '正文\n' + SAMPLE);
  assert.equal(hidden.result.trim(), '正文');
  var hiddenOld = applyRegexScript({ findRegex: HIDE_FIND, replaceString: '' }, '正文\n' + OLD);
  assert.equal(hiddenOld.result.trim(), '正文');
});
