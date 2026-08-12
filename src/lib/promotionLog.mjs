/**
 * 跨层 Promote 摘要 log（§3.8.1 · D16）
 * IDB: promotionLogV1:card:{draftId} — append-only，cap 200，不上云
 */

import { idbGetJson, idbSetJson, idbDeleteJson } from './idbStore.mjs';

export var PROMOTION_LOG_CAP = 200;
export var PROMOTION_LOG_PREFIX = 'promotionLogV1:card:';

export function promotionLogKey(draftId) {
  var id = String(draftId || '').trim();
  if (!id) return '';
  return PROMOTION_LOG_PREFIX + id;
}

function genLogId() {
  return 'plg_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/** @param {object[]} list */
export function normalizePromotionLogList(list) {
  return Array.isArray(list) ? list.filter(function(x) { return x && x.id; }) : [];
}

/**
 * @param {object} partial
 * @returns {object}
 */
export function createPromotionLogEntry(partial) {
  var p = partial && typeof partial === 'object' ? partial : {};
  return {
    id: p.id || genLogId(),
    at: typeof p.at === 'number' ? p.at : Date.now(),
    cardId: String(p.cardId || ''),
    kind: String(p.kind || 'unknown'),
    source: p.source && typeof p.source === 'object' ? p.source : {},
    target: p.target && typeof p.target === 'object' ? p.target : {},
    policy: p.policy != null ? String(p.policy) : '',
    actor: String(p.actor || 'user'),
    summary: String(p.summary || ''),
  };
}

export async function loadPromotionLog(draftId) {
  var key = promotionLogKey(draftId);
  if (!key) return [];
  var raw = await idbGetJson(key);
  return normalizePromotionLogList(raw);
}

/**
 * @param {string} draftId
 * @param {object} entry partial
 */
export async function appendPromotionLog(draftId, entry) {
  var key = promotionLogKey(draftId);
  if (!key) return null;
  var list = await loadPromotionLog(draftId);
  var row = createPromotionLogEntry(Object.assign({}, entry, { cardId: draftId }));
  list.push(row);
  if (list.length > PROMOTION_LOG_CAP) {
    list = list.slice(list.length - PROMOTION_LOG_CAP);
  }
  await idbSetJson(key, list);
  return row;
}

/** @param {{ limit?: number }} [opts] */
export async function listPromotions(draftId, opts) {
  var o = opts || {};
  var limit = o.limit != null ? Math.max(1, Math.min(PROMOTION_LOG_CAP, Math.floor(Number(o.limit) || 20))) : 20;
  var list = await loadPromotionLog(draftId);
  return list.slice(-limit).reverse();
}

export async function deletePromotionLogForCard(draftId) {
  var key = promotionLogKey(draftId);
  if (!key) return false;
  await idbDeleteJson(key);
  return true;
}
