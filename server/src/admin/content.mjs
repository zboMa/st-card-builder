/**
 * 管理端内容管理：卡 / Story 小说的下架、恢复、删除、导出
 * 处置状态写用户库文档 moderation 字段 + 用户 meta/card-index 标记 + 聚合索引同步。
 * 数据模型见 docs/systems/admin.md。
 */
import { getUserDoc, putUserDoc, getCardBundle, cascadeDeleteCard, getCardIndexDoc, deleteUserDoc } from '../data/userDocs.mjs';
import { DOC, cardDocId, storyNovelDocId, storyCatalogDocId, storyReleaseDocId } from '../data/docIds.mjs';
import { cardIndexEntryId, novelIndexEntryId, upsertCardIndex, deleteCardIndex } from '../index/aggregate.mjs';
import { appendAdminAudit } from '../couch.mjs';
import { getOrNull } from '../index/aggregate.mjs';
import { getAdmin, userDbName } from '../couch.mjs';

/** 判单文档是否已下架 */
export function isRemoved(doc) {
  return !!(doc && doc.moderation && doc.moderation.status === 'removed');
}

export function isRemovedIndexEntry(entry) {
  return !!(entry && entry.moderated && entry.moderated.status === 'removed');
}

/** 用户端读取过滤：从 index.cards 过滤已下架 */
export function filterCardsIndex(idx) {
  var cards = Array.isArray(idx && idx.cards) ? idx.cards : [];
  return cards.filter(function(c) { return !isRemovedIndexEntry(c); });
}

/**
 * 卡处置：下架 / 恢复
 * @param {string} userId
 * @param {string} cardId
 * @param {{status?:string,by?:string,reason?:string}} action  status='removed' 下架，否则恢复
 */
export async function applyCardModeration(userId, cardId, action) {
  var action2 = action || {};
  var removed = action2.status === 'removed';
  var cardDoc = await getUserDoc(userId, cardDocId(cardId));
  if (!cardDoc) throw Object.assign(new Error('card_not_found'), { statusCode: 404 });

  var moderation = removed
    ? { status: 'removed', by: action2.by || '', at: new Date().toISOString(), reason: String(action2.reason || '').slice(0, 500) }
    : null;
  var next = Object.assign({}, cardDoc, { moderation: moderation, updatedAt: new Date().toISOString() });
  await putUserDoc(userId, next, { force: true });

  // 用户 meta/card-index 条目标记（供用户端列表过滤）
  var idx = await getCardIndexDoc(userId);
  var cards = (idx.cards || []).map(function(c) {
    if (c && c.id === cardId) {
      var copy = Object.assign({}, c);
      if (removed) copy.moderated = { status: 'removed', at: moderation.at, by: moderation.by, reason: moderation.reason };
      else delete copy.moderated;
      return copy;
    }
    return c;
  });
  await putUserDoc(userId, { _id: DOC.cardIndex, type: 'card-index', cards: cards, updatedAt: new Date().toISOString() }, { force: true });

  await upsertCardIndex(userId, cardId);
  await appendAdminAudit({
    action: removed ? 'content.card.disable' : 'content.card.restore',
    targetUserId: userId,
    targetCardId: cardId,
    by: action2.by || '',
  });
  return { ok: true, userId: userId, cardId: cardId, removed: removed };
}

/** 硬删除卡（危险，需审批流前置确认） */
export async function hardDeleteCard(userId, cardId, byAdmin) {
  var out = await cascadeDeleteCard(userId, cardId, { deleteStories: true });
  await deleteCardIndex(userId, cardId);
  await appendAdminAudit({
    action: 'content.card.delete',
    targetUserId: userId,
    targetCardId: cardId,
    by: byAdmin || '',
  });
  return out;
}

/** 导出单卡（卡包 JSON 摘要） */
export async function exportCard(userId, cardId) {
  var bundle = await getCardBundle(userId, cardId);
  if (!bundle || !bundle.card) return null;
  return {
    cardId: cardId,
    charName: bundle.card.data && (bundle.card.data.charName || bundle.card.data.name) || '',
    card: bundle.card,
    avatarFullPresent: !!(bundle.avatar && bundle.avatar.full),
    avatarThumbPresent: !!(bundle.avatar && bundle.avatar.thumb),
    novelWorkshop: bundle.novel ? (bundle.novel.data || bundle.novel) : null,
    ragPresent: !!bundle.rag,
    assistantPresent: !!bundle.assistant,
    cardRelease: bundle.cardRelease || null,
    exportedAt: new Date().toISOString(),
  };
}

/** 卡详情：索引条目 + 文档（去大字段）+ 关联元数据 */
export async function cardDetail(userId, cardId) {
  var db = getAdmin().use(userDbName(userId));
  var entry = await getOrNull(db, cardIndexEntryId(userId, cardId));
  var cardDoc = await getUserDoc(userId, cardDocId(cardId));
  if (!cardDoc && !entry) return null;
  var draft = cardDoc && cardDoc.data != null ? cardDoc.data : {};
  var avatarFull = await getUserDoc(userId, 'avatar/' + cardId + '/full');
  var catalogDoc = await getUserDoc(userId, storyCatalogDocId(cardId));
  var novelDoc = await getUserDoc(userId, 'novel/' + cardId);
  return {
    entry: entry || null,
    doc: cardDoc ? {
      _id: cardDoc._id,
      cardId: cardDoc.cardId,
      type: cardDoc.type,
      updatedAt: cardDoc.updatedAt,
      moderation: cardDoc.moderation || null,
      draftMeta: {
        charName: String(draft.charName || draft.name || ''),
        charTags: Array.isArray(draft.charTags) ? draft.charTags : [],
        nsfw: !!draft.nsfwEnabled,
        characterVersion: draft.characterVersion || '',
        worldbookEntries: Array.isArray(draft.worldbookEntries) ? draft.worldbookEntries.length : 0,
        createdAt: draft.createdAt || null,
      },
    } : null,
    avatarFullPresent: !!avatarFull,
    novelWorkshopPresent: !!novelDoc,
    storyCount: catalogDoc && Array.isArray(catalogDoc.data) ? catalogDoc.data.length
      : (catalogDoc && Array.isArray(catalogDoc.novels) ? catalogDoc.novels.length : 0),
  };
}

/** Story 小说处置（下架 / 恢复） */
export async function applyNovelModeration(userId, cardId, novelId, action) {
  var action2 = action || {};
  var removed = action2.status === 'removed';
  var doc = await getUserDoc(userId, storyNovelDocId(cardId, novelId));
  if (!doc) throw Object.assign(new Error('novel_not_found'), { statusCode: 404 });
  var moderation = removed
    ? { status: 'removed', by: action2.by || '', at: new Date().toISOString(), reason: String(action2.reason || '').slice(0, 500) }
    : null;
  await putUserDoc(userId, Object.assign({}, doc, { moderation: moderation, updatedAt: new Date().toISOString() }), { force: true });
  await upsertCardIndex(userId, cardId);
  await appendAdminAudit({
    action: removed ? 'content.novel.disable' : 'content.novel.restore',
    targetUserId: userId,
    targetCardId: cardId,
    targetNovelId: novelId,
    by: action2.by || '',
  });
  return { ok: true, removed: removed };
}

/** Story 小说硬删除 */
export async function hardDeleteNovel(userId, cardId, novelId, byAdmin) {
  await deleteUserDoc(userId, storyNovelDocId(cardId, novelId), { force: true });
  await deleteUserDoc(userId, storyReleaseDocId(cardId, novelId), { force: true });
  await upsertCardIndex(userId, cardId);
  await appendAdminAudit({
    action: 'content.novel.delete',
    targetUserId: userId,
    targetCardId: cardId,
    targetNovelId: novelId,
    by: byAdmin || '',
  });
  return { ok: true };
}

/** 用户档案：卡 / 小说 / 分享 / token / 配额 概览（在 admin routes 组合） */
export async function userOverview(userId) {
  var idx = await getCardIndexDoc(userId);
  var db = getAdmin().use(userDbName(userId));
  var cards = filterCardsIndex(idx);
  var novelRows = await db.list({ startkey: 'novel/', endkey: 'novel/\ufff0' }).catch(function() { return { rows: [] }; });
  return {
    userId: userId,
    cardCount: cards.length,
    cardTotalIndexed: (idx.cards || []).length,
    moderatedCardCount: (idx.cards || []).filter(isRemovedIndexEntry).length,
    bundleBytes: cards.reduce(function(a, c) { return a + (Number(c.bundleBytes) || 0); }, 0),
    cards: cards,
    novelWorkshopCount: (novelRows.rows || []).length,
  };
}
