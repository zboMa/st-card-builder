import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  upsertWorldbookEntry,
  toStExportEntry,
  fromStImportEntry,
  fromAiJsonEntry,
  toAiJsonEntry,
  normalizeWorldbookEntriesForDraft,
  patchForRegistrySlot,
  entryExportComment,
  getDefaultWBEntryV2,
  entryDisplayLabel,
  normalizeAiJsonRow,
} from '../src/lib/worldbook/worldbookEntryBridge.mjs';
import { kindToFamily, entryFamily, isSystemEntry } from '../src/lib/worldbook/worldbookRegistry.mjs';

test('upsert adult digest slot 幂等', function() {
  var patch = patchForRegistrySlot('adult', 'flavor', {
    content: '口味正文',
    strategy: 'constant',
    order: 930,
  });
  assert.ok(patch);
  var es = upsertWorldbookEntry([], patch, { owner: 'adult', ownerSlot: 'flavor', id: patch.id });
  assert.equal(es.length, 1);
  assert.equal(es[0].kind, 'adult_flavor');
  assert.equal(entryExportComment(es[0]), '[成人体系]NSFW口味');
  var es2 = upsertWorldbookEntry(es, { content: '更新' }, { owner: 'adult', ownerSlot: 'flavor' });
  assert.equal(es2.length, 1);
  assert.equal(es2[0].content, '更新');
  assert.equal(es2[0].id, es[0].id);
});

test('ST 导入未知 comment → user', function() {
  var e = fromStImportEntry({ comment: '自定义设定', content: 'x', keys: ['a'] });
  assert.equal(e.owner, 'user');
  assert.equal(e.kind, 'user');
  assert.equal(e.displayName, '自定义设定');
  assert.ok(e.id);
  assert.equal(e.comment, undefined);
});

test('toStExportEntry / toAiJsonEntry 保留 comment 键', function() {
  var e = fromStImportEntry({ comment: '自定义', content: 'c' });
  var st = toStExportEntry(e);
  assert.equal(st.comment, '自定义');
  var ai = toAiJsonEntry(e);
  assert.equal(ai.comment, '自定义');
  assert.equal(ai.id, e.id);
});

test('fromAiJsonEntry 新 user 条', function() {
  var e = fromAiJsonEntry({ comment: '新标题', content: '正文', keys: ['k'] });
  assert.equal(e.displayName, '新标题');
  assert.equal(e.owner, 'user');
  assert.equal(e.kind, 'user');
});

test('fromAiJsonEntry 接受 title 别名', function() {
  var e = fromAiJsonEntry({ title: '别名标题', content: '正文' });
  assert.equal(e.displayName, '别名标题');
});

test('缺 owner 的 user 条不算体系', function() {
  assert.equal(isSystemEntry({ kind: 'user' }), false);
  assert.equal(isSystemEntry({ kind: 'user', owner: 'user' }), false);
  assert.equal(isSystemEntry({ kind: 'adult_flavor', owner: 'adult' }), true);
});

test('entryDisplayLabel 无标题时回退正文摘要', function() {
  var e = fromAiJsonEntry({ comment: '', content: '这是一段足够长的正文摘要用于列表展示', keys: [] });
  e.displayName = '';
  assert.match(entryDisplayLabel(e), /正文摘要/);
});

test('fromAiJsonEntry type → outline_* + owner user', function() {
  var e = fromAiJsonEntry(
    { comment: '青云峰', type: 'location', content: 'x', keys: [] },
    getDefaultWBEntryV2(),
  );
  assert.equal(e.kind, 'outline_location');
  assert.equal(e.outlineType, 'location');
  assert.equal(e.owner, 'user');
  assert.equal(entryFamily(e), 'user');
  var ai = toAiJsonEntry(e);
  assert.equal(ai.type, 'location');
});

test('entryFamily outline 仅看 owner', function() {
  assert.equal(entryFamily({ kind: 'outline_person', owner: 'aiEngine' }), 'engine');
  assert.equal(entryFamily({ kind: 'outline_person', owner: 'user' }), 'user');
});

test('legacy 草稿整表清空', function() {
  var r = normalizeWorldbookEntriesForDraft([{ comment: '旧', content: 'x' }]);
  assert.equal(r.legacyCleared, true);
  assert.equal(r.entries.length, 0);
});

test('kindToFamily 非 outline', function() {
  assert.equal(kindToFamily('mvu_initvar'), 'mvu');
  assert.equal(kindToFamily('user'), 'user');
  assert.throws(function() { kindToFamily('outline_person'); });
});
