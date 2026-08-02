/**
 * 审核合规：举报（mod-flag）与高危操作审批流（mod-action）
 * 数据模型见 docs/systems/admin.md。
 */
import { ensureAdminDatabase } from '../couch.mjs';
import { appendAdminAudit } from '../couch.mjs';
import { applyCardModeration, applyNovelModeration, hardDeleteCard, hardDeleteNovel } from './content.mjs';

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

async function newDocId(db, prefix) {
  var n = 0;
  while (n < 5) {
    var id = prefix + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    var existing = await getOrNull(db, id);
    if (!existing) return id;
    n++;
  }
  throw new Error('id_collision');
}

/** 创建举报 */
export async function createFlag(flag) {
  if (!flag || !flag.targetType || !flag.targetUserId) throw new Error('invalid_flag');
  var db = await ensureAdminDatabase();
  var id = await newDocId(db, 'mod-flag/');
  var doc = {
    _id: id,
    type: 'mod-flag',
    targetType: String(flag.targetType), // card | novel
    targetUserId: String(flag.targetUserId),
    cardId: String(flag.cardId || ''),
    novelId: String(flag.novelId || ''),
    reason: String(flag.reason || '').slice(0, 1000),
    reportedBy: String(flag.reportedBy || ''),
    status: 'open', // open | resolved
    resolution: null,
    at: new Date().toISOString(),
  };
  await db.insert(doc);
  return doc;
}

/** 举报列表（可按 status / 目标类型过滤） */
export async function listFlags(status, targetType) {
  var db = await ensureAdminDatabase();
  var res = await db.list({ include_docs: true, startkey: 'mod-flag/', endkey: 'mod-flag/\ufff0' });
  var rows = (res.rows || []).map(function(r) { return r.doc; }).filter(Boolean);
  if (status && status !== 'all') rows = rows.filter(function(f) { return f.status === status; });
  if (targetType && targetType !== 'all') rows = rows.filter(function(f) { return f.targetType === targetType; });
  rows.sort(function(a, b) { return String(b.at || '').localeCompare(String(a.at || '')); });
  return rows;
}

/**
 * 处理举报
 * @param {string} flagId
 * @param {{ action?: 'ignore'|'remove'|'reopen', by?: string }} decision  remove=下架目标
 */
export async function resolveFlag(flagId, decision) {
  var d = decision || {};
  var db = await ensureAdminDatabase();
  var doc = await getOrNull(db, 'mod-flag/' + String(flagId || ''));
  if (!doc) throw Object.assign(new Error('flag_not_found'), { statusCode: 404 });
  var action = d.action || 'ignore';
  var out = {};
  if (action === 'remove') {
    if (doc.targetType === 'card') {
      out = await applyCardModeration(doc.targetUserId, doc.cardId, {
        status: 'removed',
        by: d.by || '',
        reason: '举报处理：' + (doc.reason || ''),
      });
    } else if (doc.targetType === 'novel') {
      out = await applyNovelModeration(doc.targetUserId, doc.cardId, doc.novelId, {
        status: 'removed',
        by: d.by || '',
        reason: '举报处理：' + (doc.reason || ''),
      });
    }
  }
  if (action === 'reopen') {
    doc.status = 'open';
    doc.resolution = null;
  } else {
    doc.status = 'resolved';
    doc.resolution = {
      action: action,
      by: d.by || '',
      at: new Date().toISOString(),
    };
  }
  delete doc._rev;
  await forcePut(db, doc);
  await appendAdminAudit({
    action: 'moderation.flag.' + action,
    targetUserId: doc.targetUserId,
    targetCardId: doc.cardId,
    by: d.by || '',
  });
  return { ok: true, flag: doc, removed: !!out.removed };
}

/**
 * 提交高危操作审批
 * @param {object} req2 { action:'delete-card'|'delete-novel', target:{userId,cardId,novelId?}, by }
 */
export async function createApproval(req2) {
  if (!req2 || !req2.action || !req2.target || !req2.target.userId) throw new Error('invalid_approval');
  var db = await ensureAdminDatabase();
  var id = await newDocId(db, 'mod-action/');
  var doc = {
    _id: id,
    type: 'mod-action',
    action: String(req2.action), // delete-card | delete-novel
    target: {
      userId: String(req2.target.userId),
      cardId: String(req2.target.cardId || ''),
      novelId: String(req2.target.novelId || ''),
    },
    reason: String(req2.reason || ''),
    requestedBy: String(req2.by || ''),
    status: 'pending', // pending | approved | rejected
    decidedBy: null,
    decidedAt: null,
    at: new Date().toISOString(),
  };
  await db.insert(doc);
  return doc;
}

/** 审批列表 */
export async function listApprovals(status) {
  var db = await ensureAdminDatabase();
  var res = await db.list({ include_docs: true, startkey: 'mod-action/', endkey: 'mod-action/\ufff0' });
  var rows = (res.rows || []).map(function(r) { return r.doc; }).filter(Boolean);
  if (status && status !== 'all') rows = rows.filter(function(a) { return a.status === status; });
  rows.sort(function(a, b) { return String(b.at || '').localeCompare(String(a.at || '')); });
  return rows;
}

/** 审批决定：通过后执行删除 */
export async function decideApproval(approvalId, decision) {
  var d = decision || {};
  var db = await ensureAdminDatabase();
  var doc = await getOrNull(db, 'mod-action/' + String(approvalId || ''));
  if (!doc) throw Object.assign(new Error('approval_not_found'), { statusCode: 404 });
  if (doc.status !== 'pending') throw Object.assign(new Error('already_decided'), { statusCode: 409 });
  var approve = d.approve === true;
  doc.status = approve ? 'approved' : 'rejected';
  doc.decidedBy = d.by || '';
  doc.decidedAt = new Date().toISOString();
  var result = null;
  if (approve) {
    var t = doc.target || {};
    if (doc.action === 'delete-card') {
      result = await hardDeleteCard(t.userId, t.cardId, d.by || '');
    } else if (doc.action === 'delete-novel') {
      result = await hardDeleteNovel(t.userId, t.cardId, t.novelId, d.by || '');
    }
  }
  delete doc._rev;
  await forcePut(db, doc);
  await appendAdminAudit({
    action: 'moderation.approve.' + (approve ? 'approved' : 'rejected'),
    targetUserId: doc.target && doc.target.userId,
    targetCardId: doc.target && doc.target.cardId,
    by: d.by || '',
  });
  return { ok: true, approval: doc, executed: result };
}
