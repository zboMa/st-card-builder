/**
 * Action Engine 策略矩阵与拒绝路径契约
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionEngine } from '../src/lib/actionEngine/engine.mjs';
import { evaluateById } from '../src/lib/actionEngine/policy.mjs';
import { ACTION_CATALOG, listActionIds, TASK_TYPE_TO_ACTION } from '../src/lib/actionEngine/catalog.mjs';
import { ActionDeniedError, isActionDeniedError, scopeKey } from '../src/lib/actionEngine/types.mjs';
import { AI_TASK_TYPES } from '../src/lib/aiTaskCenter.mjs';

function baseSnap(extra) {
  return Object.assign({
    currentCardId: 'card-1',
    currentStoryId: 'story-1',
    aiConfigured: true,
    adminOps: true,
    backupEnabled: true,
    novelGates: { hasSource: true, hasChapters: true, canExtract: true, reasons: [] },
    leases: [],
    activeTasks: [],
  }, extra || {});
}

test('catalog covers all listed action ids and maps known AI task types', function() {
  var ids = listActionIds();
  assert.ok(ids.length >= 40);
  ids.forEach(function(id) {
    assert.ok(ACTION_CATALOG[id], id);
    assert.equal(ACTION_CATALOG[id].id, id);
  });
  Object.keys(TASK_TYPE_TO_ACTION).forEach(function(t) {
    assert.ok(ACTION_CATALOG[TASK_TYPE_TO_ACTION[t]], 'mapped ' + t);
  });
  // AI_TASK_TYPES 中的小说/引擎/故事类应有映射（other 除外）
  ['novel_char_scan', 'novel_wb_extract', 'engine_generate', 'story_outline', 'story_chapter', 'chat_reply'].forEach(function(t) {
    assert.ok(AI_TASK_TYPES[t]);
    assert.ok(TASK_TYPE_TO_ACTION[t]);
  });
});

test('card heavy blocks lifecycle.card.*', function() {
  var snap = baseSnap({
    leases: [{
      scope: scopeKey('card', 'card-1'),
      ownerActionId: 'novel.analyze.all',
      label: '分析中…',
      tier: 'heavy',
    }],
  });
  ['lifecycle.card.switch', 'lifecycle.card.delete', 'lifecycle.card.duplicate',
    'lifecycle.card.create', 'lifecycle.card.import', 'lifecycle.card.version.switch',
    'lifecycle.novel.source.clear', 'lifecycle.novel.chapters.batch'].forEach(function(id) {
    var v = evaluateById(id, snap);
    assert.equal(v.enabled, false, id);
    assert.ok(/任务进行中|取消/.test(v.reason), id + ' reason=' + v.reason);
  });
});

test('scan and extract are mutually exclusive on same card', function() {
  var snap = baseSnap({
    leases: [{
      scope: 'card:card-1',
      ownerActionId: 'novel.char.scan',
      label: '扫描中…',
      tier: 'heavy',
    }],
  });
  var extract = evaluateById('novel.wb.extract', snap);
  assert.equal(extract.enabled, false);
  var self = evaluateById('novel.char.scan', snap);
  assert.equal(self.enabled, false);
  assert.ok(self.label || self.reason);
});

test('story heavy blocks story lifecycle', function() {
  var snap = baseSnap({
    leases: [{
      scope: 'story:story-1',
      ownerActionId: 'story.chapter.write',
      label: '撰写中…',
      tier: 'heavy',
    }],
  });
  assert.equal(evaluateById('lifecycle.story.open', snap).enabled, false);
  assert.equal(evaluateById('lifecycle.story.delete', snap).enabled, false);
  assert.equal(evaluateById('story.outline.generate', snap).enabled, false);
});

test('missing AI config disables requiresAi actions', function() {
  var snap = baseSnap({ aiConfigured: false });
  var v = evaluateById('novel.char.scan', snap);
  assert.equal(v.enabled, false);
  assert.match(v.reason, /AI/);
});

test('pipeline gates block extract without chapters', function() {
  var snap = baseSnap({
    novelGates: {
      hasSource: true,
      hasChapters: false,
      canExtract: false,
      reasons: ['请先在「拆章」生成并启用章节'],
    },
  });
  assert.equal(evaluateById('novel.wb.extract', snap).enabled, false);
  assert.equal(evaluateById('lifecycle.novel.chapters.split', snap).enabled, true);
});

test('assertAllowed throws ActionDeniedError', function() {
  var eng = createActionEngine({
    applyNovelGates: false,
    getCardId: function() { return 'c1'; },
    getStoryId: function() { return ''; },
    getAiConfigured: function() { return true; },
    getNovelGates: function() {
      return { hasSource: true, hasChapters: true, canExtract: true, reasons: [] };
    },
    getTaskCenter: function() { return null; },
  });
  eng.beginScope({ ownerActionId: 'card.engine.generate', scope: 'card:c1' });
  assert.throws(function() {
    eng.assertAllowed('lifecycle.card.switch');
  }, function(err) {
    return isActionDeniedError(err) || err.name === 'ActionDeniedError';
  });
  eng.endScope('card.engine.generate');
  eng.assertAllowed('lifecycle.card.switch');
});

test('admin ops=false denies write; backup scope disables backup button view', function() {
  var denyOps = evaluateById('admin.backup.run', baseSnap({ adminOps: false }));
  assert.equal(denyOps.enabled, false);

  var busy = evaluateById('admin.backup.run', baseSnap({
    leases: [{
      scope: 'admin:global',
      ownerActionId: 'admin.backup.run',
      label: '备份中…',
      tier: 'heavy',
    }],
  }));
  assert.equal(busy.enabled, false);

  var purgeWhileBackup = evaluateById('admin.token.purge', baseSnap({
    leases: [{
      scope: 'admin:global',
      ownerActionId: 'admin.backup.run',
      label: '备份中…',
      tier: 'heavy',
    }],
  }));
  assert.equal(purgeWhileBackup.enabled, false);
});

test('engine.run autoScope begin/end', async function() {
  var eng = createActionEngine({
    applyNovelGates: false,
    getCardId: function() { return 'c1'; },
    getAiConfigured: function() { return true; },
    getNovelGates: function() {
      return { hasSource: true, hasChapters: true, canExtract: true, reasons: [] };
    },
    getTaskCenter: function() { return null; },
  });
  var saw = false;
  await eng.run('novel.char.scan', async function() {
    saw = true;
    var mid = eng.evaluate('lifecycle.card.switch');
    assert.equal(mid.enabled, false);
  });
  assert.ok(saw);
  assert.equal(eng.evaluate('lifecycle.card.switch').enabled, true);
});
