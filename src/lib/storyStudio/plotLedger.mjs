/**
 * 伏笔账本
 */

import { genStoryId } from './state.mjs';

export var LEDGER_STATUSES = ['open', 'planted', 'paid', 'dropped'];

export function createLedgerItem(partial) {
  var p = partial || {};
  var status = String(p.status || 'open');
  if (LEDGER_STATUSES.indexOf(status) < 0) status = 'open';
  return {
    id: p.id || genStoryId('pl'),
    title: String(p.title != null ? p.title : '未命名伏笔'),
    note: String(p.note != null ? p.note : ''),
    status: status,
    plantedChapterId: String(p.plantedChapterId || ''),
    paidChapterId: String(p.paidChapterId || ''),
    branchId: String(p.branchId || ''),
    createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
    updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : Date.now(),
  };
}

export function normalizeLedgerItem(raw) {
  return createLedgerItem(raw && typeof raw === 'object' ? raw : {});
}

/**
 * 将 feed-forward 中的 foreshadows 合并进账本
 */
export function mergeForeshadowsIntoLedger(novel, foreshadows, chapter, branchId) {
  var n = novel && typeof novel === 'object' ? novel : {};
  if (!Array.isArray(n.plotLedger)) n.plotLedger = [];
  var list = Array.isArray(foreshadows) ? foreshadows : [];
  var chId = chapter && chapter.id ? String(chapter.id) : '';
  var bid = String(branchId || n.activeBranchId || '');

  list.forEach(function(f) {
    if (!f || !f.title) return;
    var action = String(f.action || 'plant').toLowerCase();
    var existing = n.plotLedger.find(function(x) {
      return x && String(x.title) === String(f.title) && String(x.branchId || '') === bid;
    });
    if (action === 'pay' || action === 'paid') {
      if (existing) {
        existing.status = 'paid';
        existing.paidChapterId = chId;
        existing.updatedAt = Date.now();
        if (f.note) existing.note = f.note;
      } else {
        n.plotLedger.push(createLedgerItem({
          title: f.title,
          note: f.note || '',
          status: 'paid',
          plantedChapterId: chId,
          paidChapterId: chId,
          branchId: bid,
        }));
      }
      return;
    }
    if (action === 'drop' || action === 'dropped') {
      if (existing) {
        existing.status = 'dropped';
        existing.updatedAt = Date.now();
      }
      return;
    }
    // plant / open
    if (existing) {
      if (existing.status === 'open' || existing.status === 'planted') {
        existing.status = 'planted';
        existing.plantedChapterId = existing.plantedChapterId || chId;
        existing.updatedAt = Date.now();
        if (f.note) existing.note = f.note;
      }
    } else {
      n.plotLedger.push(createLedgerItem({
        title: f.title,
        note: f.note || '',
        status: 'planted',
        plantedChapterId: chId,
        branchId: bid,
      }));
    }
  });
  return n;
}

export function ledgerBrief(items, opts) {
  var o = opts || {};
  var max = o.max != null ? o.max : 12;
  var list = (Array.isArray(items) ? items : []).filter(function(x) {
    return x && (x.status === 'open' || x.status === 'planted');
  }).slice(0, max);
  if (!list.length) return '';
  return list.map(function(x) {
    return '- [' + x.status + '] ' + x.title + (x.note ? '：' + String(x.note).slice(0, 60) : '');
  }).join('\n');
}
