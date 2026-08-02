/**
 * 定时任务调度器（stcb-admin 库 task/ 文档驱动）
 * 每 30s tick 一次，扫描 task/ 文档，对到期任务执行 handler，写 task-run/ 记录。
 * 数据模型见 docs/systems/admin.md。
 */
import { ensureAdminDatabase } from './couch.mjs';
import { rebuildIndex } from './index/aggregate.mjs';
import { purgeExpiredBearerTokens } from './auth/bearer.mjs';
import { runBackup } from './backup.mjs';
import { config } from './config.mjs';

var TICK_MS = 30 * 1000;

var HANDLERS = {
  'index.rebuild': { run: rebuildIndex, label: '重建聚合索引' },
  'token.purge': { run: purgeExpiredBearerTokens, label: '清理过期 Token' },
  'backup.periodic': {
    run: function() {
      if (!config.backupEnabled) return { skipped: 'disabled' };
      return runBackup('scheduler');
    },
    label: '周期逻辑备份',
  },
};

function parseUnit(u) {
  var s = String(u || '').trim();
  var m = /^(\d+)\s*(ms|s|m|h|d)?$/.exec(s);
  if (!m) return null;
  var n = Number(m[1]);
  var unit = m[2] || 'ms';
  if (unit === 's') return n * 1000;
  if (unit === 'm') return n * 60 * 1000;
  if (unit === 'h') return n * 60 * 60 * 1000;
  if (unit === 'd') return n * 24 * 60 * 60 * 1000;
  return n;
}

/** 解析任务间隔毫秒；不支持则 null */
export function parseSchedule(sched) {
  var s = String(sched || '').trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  var every = /^@every:(.+)$/.exec(s);
  if (every) return parseUnit(every[1]);
  if (s === '@hourly') return 60 * 60 * 1000;
  if (s === '@daily') return 24 * 60 * 60 * 1000;
  if (s === '@weekly') return 7 * 24 * 60 * 60 * 1000;
  if (s === '@minutely') return 60 * 1000;
  return null;
}

function forcePut(db, doc) {
  return db.insert(doc).then(function() { return true; }, function(e) {
    if (!e || e.statusCode !== 409) throw e;
    return db.get(doc._id).then(function(ex) {
      return db.insert(Object.assign({}, doc, { _rev: ex._rev })).then(function() { return true; });
    }, function(e2) {
      if (e2 && e2.statusCode === 404) return db.insert(doc).then(function() { return true; });
      throw e2;
    });
  });
}

function getOrNull(db, id) {
  return db.get(String(id || '')).then(function(d) { return d; }, function(e) {
    if (e && e.statusCode === 404) return null;
    throw e;
  });
}

/** 注册/更新任务文档（内置任务由 seed 创建；管理端用） */
export async function putTask(task) {
  var db = await ensureAdminDatabase();
  var id = 'task/' + String(task && task.id || '');
  var doc = Object.assign({}, task || {}, {
    _id: id,
    type: 'task',
  });
  var existing = await getOrNull(db, id);
  if (existing) doc._rev = existing._rev;
  if (existing && doc.createdAt == null) doc.createdAt = existing.createdAt;
  if (!doc.createdAt) doc.createdAt = new Date().toISOString();
  await db.insert(doc);
  return doc;
}

/** 内置任务：默认开启 */
export function seedTasks() {
  var seeds = [
    { id: 'index.rebuild', name: '重建聚合索引', handler: 'index.rebuild', schedule: '@daily', enabled: true, builtin: true },
    { id: 'token.purge', name: '清理过期插件 Token', handler: 'token.purge', schedule: '@daily', enabled: true, builtin: true },
    { id: 'backup.periodic', name: '周期逻辑备份', handler: 'backup.periodic', schedule: '@daily', enabled: false, builtin: true },
  ];
  return Promise.all(seeds.map(function(s) {
    return putTask(s).catch(function(e) { console.warn('[scheduler] seed', s.id, e); });
  }));
}

async function runDueTasks(now, deps) {
  deps = deps || {};
  var db = deps.db || await ensureAdminDatabase();
  var handlers = deps.handlers || HANDLERS;
  var res = await db.list({ include_docs: true, startkey: 'task/', endkey: 'task/\ufff0' });
  var ran = [];
  for (var i = 0; i < (res.rows || []).length; i++) {
    var doc = res.rows[i] && res.rows[i].doc;
    if (!doc || !doc.enabled) continue;
    var handler = handlers[doc.handler];
    if (!handler) continue;
    var interval = parseSchedule(doc.schedule);
    if (!interval || interval <= 0) continue;
    var last = doc.lastRun ? Date.parse(doc.lastRun) : 0;
    if (Number.isFinite(last) && now - last < interval) continue;

    doc.lastRun = new Date(now).toISOString();
    doc.lastStatus = 'running';
    try { await db.insert(doc); } catch (e) { /* ignore */ }
    try {
      var result = await handler.run();
      doc.lastStatus = 'ok';
      doc.lastResult = JSON.stringify(result).slice(0, 2000);
      doc.lastError = null;
    } catch (e) {
      doc.lastStatus = 'error';
      doc.lastError = String(e && e.message || e).slice(0, 2000);
      doc.lastResult = null;
      console.error('[scheduler] task failed', doc.id, e);
    }
    doc.lastFinishedAt = new Date().toISOString();
    delete doc._rev;
    try { await forcePut(db, doc); } catch (e) { /* ignore */ }
    try {
      await db.insert({
        _id: 'task-run/' + doc.id + '/' + now,
        type: 'task-run',
        taskId: doc.id,
        status: doc.lastStatus,
        at: new Date(now).toISOString(),
        result: doc.lastResult || null,
        error: doc.lastError || null,
      });
    } catch (e) { /* ignore */ }
    ran.push({ id: doc.id, status: doc.lastStatus });
  }
  return ran;
}

var started = false;
var timers = [];

/** 启动调度器（幂等）；opts.disable 可停用（测试用） */
export function startScheduler(opts) {
  var o = opts || {};
  if (started) return;
  if (o.disable) { started = true; return; }
  started = true;
  seedTasks();
  var tick = function() {
    runDueTasks(Date.now()).catch(function(e) {
      console.error('[scheduler] tick', e);
    });
  };
  var t = setInterval(tick, o.tickMs || TICK_MS);
  if (typeof t.unref === 'function') t.unref();
  timers.push(t);
}

export function stopScheduler() {
  timers.forEach(function(t) { try { clearInterval(t); } catch (e) { /* ignore */ } });
  timers = [];
  started = false;
}

export { runDueTasks };
