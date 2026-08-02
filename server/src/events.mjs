/**
 * 前端行为埋点（event/）+ 按日趋势报表
 */
import { ensureAdminDatabase, listUserRegistry } from './couch.mjs';
import { listCardIndex } from './index/aggregate.mjs';

export async function appendEvent(e) {
  var db = await ensureAdminDatabase();
  var id = 'event/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  var doc = Object.assign({
    _id: id,
    type: 'event',
    at: new Date().toISOString(),
  }, e || {});
  try {
    await db.insert(doc);
  } catch (err) {
    console.warn('[event]', err);
  }
  return doc;
}

function dayKey(iso) {
  if (!iso) return null;
  var t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  var d = new Date(t);
  return d.toISOString().slice(0, 10);
}

/** 按日聚合：事件 / 注册用户 / 新建卡 */
export async function dailyTrends(days) {
  days = Math.max(1, Math.min(90, Number(days) || 30));
  var since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
  var byDate = {};
  for (var i = days - 1; i >= 0; i--) {
    var d = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
    byDate[d] = { date: d, events: 0, users: 0, cards: 0 };
  }

  var db = await ensureAdminDatabase();
  var evRes = await db.list({ include_docs: true, startkey: 'event/', endkey: 'event/\ufff0', limit: 10000 });
  (evRes.rows || []).forEach(function(r) {
    var d = dayKey(r.doc && r.doc.at);
    if (d && d >= since && byDate[d]) byDate[d].events += 1;
  });

  var users = await listUserRegistry(5000);
  (users || []).forEach(function(u) {
    var d = dayKey(u && (u.createdAt || u.updatedAt));
    if (d && d >= since && byDate[d]) byDate[d].users += 1;
  });

  var cards = await listCardIndex({ limit: 10000, offset: 0 });
  (cards.items || []).forEach(function(c) {
    var d = dayKey(c && (c.createdAt || c.updatedAt));
    if (d && d >= since && byDate[d]) byDate[d].cards += 1;
  });

  return Object.keys(byDate).sort().map(function(k) { return byDate[k]; });
}
