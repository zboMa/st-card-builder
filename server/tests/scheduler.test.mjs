import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseSchedule, runDueTasks } from '../src/scheduler.mjs';

describe('scheduler: parseSchedule', function() {
  it('纯数字毫秒', function() {
    assert.equal(parseSchedule('300000'), 300000);
  });
  it('@every 单位', function() {
    assert.equal(parseSchedule('@every:30m'), 30 * 60 * 1000);
    assert.equal(parseSchedule('@every:2h'), 2 * 60 * 60 * 1000);
    assert.equal(parseSchedule('@every:1d'), 24 * 60 * 60 * 1000);
    assert.equal(parseSchedule('@every:5s'), 5000);
  });
  it('@daily / @hourly / @weekly / @minutely', function() {
    assert.equal(parseSchedule('@daily'), 24 * 60 * 60 * 1000);
    assert.equal(parseSchedule('@hourly'), 60 * 60 * 1000);
    assert.equal(parseSchedule('@weekly'), 7 * 24 * 60 * 60 * 1000);
    assert.equal(parseSchedule('@minutely'), 60 * 1000);
  });
  it('非法 → null', function() {
    assert.equal(parseSchedule(''), null);
    assert.equal(parseSchedule('cron * * * * *'), null);
    assert.equal(parseSchedule('@every:'), null);
  });
});

function fakeDb(tasks, opts) {
  opts = opts || {};
  var calls = { insert: [], destroy: [] };
  return {
    calls: calls,
    handlerState: opts.handlerState || {},
    list: async function() {
      return { rows: (tasks || []).map(function(t) { return { doc: t }; }) };
    },
    get: async function(id) {
      var t = (tasks || []).find(function(x) { return x._id === id; });
      if (t) return t;
      var e = new Error('missing');
      e.statusCode = 404;
      throw e;
    },
    insert: async function(doc) {
      calls.insert.push(doc);
      return { ok: true };
    },
  };
}

describe('scheduler: runDueTasks', function() {
  it('未到期任务不执行', async function() {
    var now = Date.now();
    var db = fakeDb([
      { _id: 'task/t1', id: 't1', handler: 'a', enabled: true, schedule: '@daily', lastRun: new Date(now - 1000).toISOString() },
    ]);
    var ran = [];
    var out = await runDueTasks(now, {
      db: db,
      handlers: { a: { run: async function() { ran.push(1); return { ok: 1 }; } } },
    });
    assert.equal(out.length, 0);
    assert.equal(ran.length, 0);
  });

  it('到期任务执行并写记录', async function() {
    var now = Date.now();
    var db = fakeDb([
      { _id: 'task/t1', id: 't1', handler: 'a', enabled: true, schedule: '@minutely', lastRun: new Date(now - 10 * 60 * 1000).toISOString() },
    ]);
    var ran = [];
    var out = await runDueTasks(now, {
      db: db,
      handlers: { a: { run: async function() { ran.push(1); return { done: true }; } } },
    });
    assert.equal(out.length, 1);
    assert.equal(out[0].status, 'ok');
    assert.equal(ran.length, 1);
    var docs = db.calls.insert;
    var runDoc = docs.find(function(d) { return d.type === 'task-run'; });
    assert.ok(runDoc, '写 task-run 记录');
    assert.equal(runDoc.taskId, 't1');
    assert.equal(runDoc.status, 'ok');
  });

  it('handler 抛错 → 记录 error 状态', async function() {
    var now = Date.now();
    var db = fakeDb([
      { _id: 'task/t1', id: 't1', handler: 'a', enabled: true, schedule: '@minutely', lastRun: new Date(now - 10 * 60 * 1000).toISOString() },
    ]);
    var out = await runDueTasks(now, {
      db: db,
      handlers: { a: { run: async function() { throw new Error('boom'); } } },
    });
    assert.equal(out[0].status, 'error');
    var runDoc = db.calls.insert.find(function(d) { return d.type === 'task-run'; });
    assert.equal(runDoc.status, 'error');
    assert.equal(runDoc.error, 'boom');
  });

  it('disabled 任务跳过', async function() {
    var now = Date.now();
    var db = fakeDb([
      { _id: 'task/t1', id: 't1', handler: 'a', enabled: false, schedule: '@minutely', lastRun: new Date(now - 10 * 60 * 1000).toISOString() },
    ]);
    var out = await runDueTasks(now, { db: db, handlers: { a: { run: async function() { return 1; } } } });
    assert.equal(out.length, 0);
  });
});
