/**
 * 云端角色卡索引就绪门闩。
 * 避免「本地暂空 → 隐式建空卡 → 云端列表回来后多一张」的竞态。
 * 合并仍只按 id upsert，绝不因「像空卡」删除本地草稿。
 */
import { apiFetch } from '../publicConfig.mjs';
import { setCloudEnabled, isCloudEnabled, emit } from './cloudStoreShared.mjs';
import { pullCloudCardIndexAndMerge } from './cloudStoreCard.mjs';

export var CARD_INDEX_STATUS = {
  idle: 'idle',
  pending: 'pending',
  ready: 'ready',
  error: 'error',
  disabled: 'disabled',
};

var indexStatus = CARD_INDEX_STATUS.idle;
var lastIndexError = null;
var inflight = null;

export function getCardCloudIndexState() {
  return {
    status: indexStatus,
    lastError: lastIndexError,
    cloudEnabled: isCloudEnabled(),
  };
}

export function resetCardCloudIndexForTests() {
  indexStatus = CARD_INDEX_STATUS.idle;
  lastIndexError = null;
  inflight = null;
}

/** @private 测试或内部设置 */
export function setCardCloudIndexStatusForTests(status, err) {
  indexStatus = status || CARD_INDEX_STATUS.idle;
  lastIndexError = err != null ? String(err) : null;
}

/**
 * 禁止隐式 genId 落盘的条件：
 * - 索引 pending 且本地 drafts 为空（等云端列表）
 * - 或本地已有卡但当前无 draftId（由 saveDraft 另行判断）
 * ready / error / disabled 且本地空时放行隐式首卡；显式新建不走此门闩。
 */
export function shouldBlockImplicitCardCreate(draftsMap) {
  var keys = Object.keys(draftsMap || {});
  if (keys.length > 0) return false;
  if (indexStatus === CARD_INDEX_STATUS.pending) return true;
  return false;
}

/** 外部已成功拉取索引时标记 ready（如 runCloudReconcile） */
export function markCardCloudIndexReady() {
  indexStatus = CARD_INDEX_STATUS.ready;
  lastIndexError = null;
  emit('card-index', { status: indexStatus });
}

/**
 * 探测登录态并拉云端卡索引（去重 inflight）。
 * 未登录 → disabled；成功 → ready；拉取失败 → error（允许本地建卡）。
 */
export async function ensureCardCloudIndex(opts) {
  opts = opts || {};
  if (inflight) {
    if (!opts.force) return inflight;
    try { await inflight; } catch (eWait) { /* ignore */ }
  }
  if (!opts.force) {
    if (
      indexStatus === CARD_INDEX_STATUS.ready
      || indexStatus === CARD_INDEX_STATUS.disabled
    ) {
      return { status: indexStatus, cards: null, skipped: true };
    }
  }

  indexStatus = CARD_INDEX_STATUS.pending;
  lastIndexError = null;
  emit('card-index', { status: indexStatus });

  inflight = (async function() {
    try {
      var res = await apiFetch('/api/auth/status');
      var st = await res.json().catch(function() { return null; });
      if (!st || !st.user || !st.user.id) {
        setCloudEnabled(false);
        indexStatus = CARD_INDEX_STATUS.disabled;
        emit('card-index', { status: indexStatus });
        return { status: indexStatus, cards: null };
      }
      setCloudEnabled(true);
      var cards = await pullCloudCardIndexAndMerge();
      indexStatus = CARD_INDEX_STATUS.ready;
      lastIndexError = null;
      emit('card-index', { status: indexStatus, count: (cards && cards.length) || 0 });
      return { status: indexStatus, cards: cards };
    } catch (e) {
      var msg = String(e && e.message || e);
      lastIndexError = msg;
      if (msg === 'unauthorized' || (e && e.status === 401)) {
        setCloudEnabled(false);
        indexStatus = CARD_INDEX_STATUS.disabled;
      } else {
        indexStatus = CARD_INDEX_STATUS.error;
      }
      emit('card-index', { status: indexStatus, error: msg });
      return { status: indexStatus, cards: null, error: msg };
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
