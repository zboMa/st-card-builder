/**
 * 跨用户库聚合索引（stcb-admin 库）
 * 把每个用户库的卡 / Story 小说元数据汇入索引条目，供管理端跨库检索。
 * 全量重建走 scheduler 任务 `index.rebuild`；日常写入/删除走增量钩子。
 * 数据模型见 docs/systems/admin.md。
 */
import { getAdmin, ensureAdminDatabase, userDbName } from '../couch.mjs';
import { listUserRegistry, listShareMappings } from '../couch.mjs';
import {
  DOC,
  cardDocId,
  novelDocId,
  storyCatalogDocId,
  storyNovelDocId,
  catalogNovelsList,
} from '../data/docIds.mjs';

export function cardIndexEntryId(userId, cardId) {
  return 'card/' + String(userId || '') + '/' + String(cardId || '');
}

export function novelIndexEntryId(userId, cardId, novelId) {
  return 'novel/' + String(userId || '') + '/' + String(cardId || '') + '/' + String(novelId || '');
}

/** 归一化处置标记 */
export function normalizeModeration(m) {
  if (!m || !m.status) return null;
  return {
    status: String(m.status),
    by: m.by || '',
    at: m.at || null,
    reason: String(m.reason || '').slice(0, 500),
  };
}

/** 从分享映射文档构建 byCard / byNovel 查询表 */
export function buildShareMaps(shares) {
  var byCard = {};
  var byNovel = {};
  (shares || []).forEach(function(s) {
    if (!s || !s.ownerUserId) return;
    var expired = false;
    if (s.expiresAt) {
      var t = Date.parse(s.expiresAt);
      expired = Number.isFinite(t) && Date.now() > t;
    }
    var state = { token: s.token || '', enabled: s.enabled !== false, expired: expired };
    if (s.type === 'card-share' && s.cardId) {
      byCard[s.ownerUserId + '|' + s.cardId] = state;
    } else if (s.type === 'novel-share' && s.cardId && s.novelId) {
      byNovel[s.ownerUserId + '|' + s.cardId + '|' + s.novelId] = state;
    }
  });
  return { byCard: byCard, byNovel: byNovel };
}

/** 索引条目专用：读单文档，404 → null */
export function getOrNull(db, id) {
  return db.get(String(id || '')).then(function(d) { return d; }, function(e) {
    if (e && e.statusCode === 404) return null;
    throw e;
  });
}

/**
 * 构建单张卡的索引条目（纯数据组装，依赖注入便于测试）
 * @param {object} deps { udb, row, cardDoc, catalogDoc, novelExists, share }
 */
export function buildCardEntryFromParts(userId, cardId, deps) {
  deps = deps || {};
  var row = deps.row || null;
  var cardDoc = deps.cardDoc || null;
  var draft = cardDoc && cardDoc.data != null ? cardDoc.data : (cardDoc || {});
  var catalogDoc = deps.catalogDoc || null;
  var novels = catalogNovelsList(catalogDoc);
  var share = deps.share || null;
  return {
    _id: cardIndexEntryId(userId, cardId),
    type: 'card-index-entry',
    userId: String(userId || ''),
    cardId: String(cardId || ''),
    charName: String(((row && row.charName) || draft.charName || draft.name || '')).trim(),
    updatedAt: (row && row.updatedAt) || draft.updatedAt || null,
    createdAt: draft.createdAt || null,
    contentRev: (row && row.contentRev) || null,
    wbCount: Number((row && row.wbCount) || 0) || 0,
    bundleBytes: Number((row && row.bundleBytes) || 0) || 0,
    avatar: !!(row && row.avatarInIdb) || !!draft.avatarInIdb,
    charTags: Array.isArray(draft.charTags) ? draft.charTags.map(String) : [],
    nsfw: !!draft.nsfwEnabled,
    characterVersion: String(draft.characterVersion || '').slice(0, 64),
    novelCount: deps.novelExists ? 1 : 0,
    storyCount: novels.length,
    share: share,
    moderated: normalizeModeration(cardDoc && cardDoc.moderation) || normalizeModeration(draft.moderation),
    updatedAtIndexed: new Date().toISOString(),
  };
}

/**
 * 构建一张卡下的全部 Story 小说索引条目
 * @param {object} deps { catalogDoc, novelDocs }
 */
export function buildNovelEntriesFromParts(userId, cardId, deps) {
  deps = deps || {};
  var catalogDoc = deps.catalogDoc || null;
  var novels = catalogNovelsList(catalogDoc);
  var novelDocs = deps.novelDocs || {};
  var shareByNovel = deps.shareByNovel || null;
  return (novels || []).map(function(n) {
    var novelId = n && (n.id || n.novelId);
    if (!novelId) return null;
    var ndoc = novelDocs[novelId] || null;
    var ndata = ndoc && ndoc.data != null ? ndoc.data : (ndoc || {});
    var chapterCount = 0;
    if (Array.isArray(ndata.chapters)) chapterCount = ndata.chapters.length;
    else if (ndata.chapters && typeof ndata.chapters === 'object') {
      chapterCount = Object.keys(ndata.chapters).length;
    }
    var share = shareByNovel ? (shareByNovel[userId + '|' + cardId + '|' + novelId] || null) : null;
    return {
      _id: novelIndexEntryId(userId, cardId, novelId),
      type: 'novel-index-entry',
      userId: String(userId || ''),
      cardId: String(cardId || ''),
      novelId: String(novelId || ''),
      title: String(n.title || ndata.title || novelId).slice(0, 300),
      updatedAt: (ndoc && ndoc.updatedAt) || n.updatedAt || null,
      published: !!(n.published || ndata.published),
      chapterCount: chapterCount,
      share: share,
      moderated: normalizeModeration(ndoc && ndoc.moderation),
      updatedAtIndexed: new Date().toISOString(),
    };
  }).filter(Boolean);
}

function forcePut(db, doc) {
  return db.insert(doc).then(function() { return true; }, function(e) {
    if (!e || e.statusCode !== 409) throw e;
    return db.get(doc._id).then(function(ex) {
      return db.insert(Object.assign({}, doc, { _rev: ex._rev })).then(function() { return true; }, function(e2) {
        if (e2 && e2.statusCode === 404) return db.insert(doc).then(function() { return true; });
        throw e2;
      });
    });
  });
}

function forceDelete(db, id) {
  return db.get(String(id || '')).then(function(d) {
    return db.destroy(d._id, d._rev);
  }, function(e) {
    if (e && e.statusCode === 404) return null;
    throw e;
  });
}

/** 读取某用户库的 meta/card-index 摘要行 */
function readIndexRow(udb, cardId) {
  return getOrNull(udb, DOC.cardIndex).then(function(idxDoc) {
    var cards = (idxDoc && Array.isArray(idxDoc.cards)) ? idxDoc.cards : [];
    for (var i = 0; i < cards.length; i++) {
      if (cards[i] && cards[i].id === cardId) return cards[i];
    }
    return null;
  });
}

/**
 * 收集一个用户的全部索引条目（全量重建用）
 */
export async function collectUserIndex(userId, shareMaps) {
  var maps = shareMaps || { byCard: {}, byNovel: {} };
  var udb = getAdmin().use(userDbName(userId));
  var idxDoc = await getOrNull(udb, DOC.cardIndex);
  var cardIds = (idxDoc && Array.isArray(idxDoc.cards)) ? idxDoc.cards.map(function(c) { return c.id; }) : [];
  var cards = [];
  var novels = [];
  for (var i = 0; i < cardIds.length; i++) {
    var cardId = cardIds[i];
    if (!cardId) continue;
    var row = await readIndexRow(udb, cardId);
    var cardDoc = await getOrNull(udb, cardDocId(cardId));
    if (!row && !cardDoc) continue;
    var catalogDoc = await getOrNull(udb, storyCatalogDocId(cardId));
    var novelExists = !!(await getOrNull(udb, novelDocId(cardId)));
    var cardEntry = buildCardEntryFromParts(userId, cardId, {
      row: row,
      cardDoc: cardDoc,
      catalogDoc: catalogDoc,
      novelExists: novelExists,
      share: maps.byCard[userId + '|' + cardId] || null,
    });
    cards.push(cardEntry);

    var novelDocs = {};
    var catalogNovels = catalogNovelsList(catalogDoc);
    for (var j = 0; j < catalogNovels.length; j++) {
      var nid = catalogNovels[j] && (catalogNovels[j].id || catalogNovels[j].novelId);
      if (!nid) continue;
      novelDocs[nid] = await getOrNull(udb, storyNovelDocId(cardId, nid));
    }
    novels = novels.concat(buildNovelEntriesFromParts(userId, cardId, {
      catalogDoc: catalogDoc,
      novelDocs: novelDocs,
      shareByNovel: maps.byNovel,
    }));
  }
  return { userId: userId, cards: cards, novels: novels };
}

/** 全量重建所有用户索引（低峰执行；scheduler 任务 index.rebuild） */
export async function rebuildIndex() {
  var db = await ensureAdminDatabase();
  var users = await listUserRegistry(2000);
  var shares = await listShareMappings(2000);
  var maps = buildShareMaps(shares);
  var cardCount = 0;
  var novelCount = 0;
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    if (!u || !u.userId) continue;
    try {
      var col = await collectUserIndex(u.userId, maps);
      for (var c = 0; c < col.cards.length; c++) { await forcePut(db, col.cards[c]); cardCount++; }
      for (var n = 0; n < col.novels.length; n++) { await forcePut(db, col.novels[n]); novelCount++; }
    } catch (e) {
      console.error('[aggregate] collect failed for user', u.userId, e);
    }
  }
  return { userCount: users.length, cardCount: cardCount, novelCount: novelCount, at: new Date().toISOString() };
}

/** 增量：更新单卡索引（含其下小说），并清掉已不存在条目的残留 */
export async function upsertCardIndex(userId, cardId) {
  var db = await ensureAdminDatabase();
  var shares = await listShareMappings(2000);
  var maps = buildShareMaps(shares);
  var udb = getAdmin().use(userDbName(userId));
  var row = await readIndexRow(udb, cardId);
  var cardDoc = await getOrNull(udb, cardDocId(cardId));
  if (!row && !cardDoc) {
    await deleteCardIndex(userId, cardId);
    return null;
  }
  var catalogDoc = await getOrNull(udb, storyCatalogDocId(cardId));
  var novelExists = !!(await getOrNull(udb, novelDocId(cardId)));
  var entry = buildCardEntryFromParts(userId, cardId, {
    row: row,
    cardDoc: cardDoc,
    catalogDoc: catalogDoc,
    novelExists: novelExists,
    share: maps.byCard[userId + '|' + cardId] || null,
  });
  await forcePut(db, entry);

  // 该卡下小说索引：全量重扫 catalog
  var catalogNovels = catalogNovelsList(catalogDoc);
  var novelDocs = {};
  for (var j = 0; j < catalogNovels.length; j++) {
    var nid = catalogNovels[j] && (catalogNovels[j].id || catalogNovels[j].novelId);
    if (!nid) continue;
    novelDocs[nid] = await getOrNull(udb, storyNovelDocId(cardId, nid));
  }
  var novelEntries = buildNovelEntriesFromParts(userId, cardId, {
    catalogDoc: catalogDoc,
    novelDocs: novelDocs,
    shareByNovel: maps.byNovel,
  });
  for (var k = 0; k < novelEntries.length; k++) await forcePut(db, novelEntries[k]);
  return entry;
}

/** 增量：仅重扫某卡的小说索引（catalog / story-novel 变更时） */
export async function upsertNovelIndexes(userId, cardId) {
  return upsertCardIndex(userId, cardId);
}

/** 增量：删除卡及其小说索引 */
export async function deleteCardIndex(userId, cardId) {
  var db = await ensureAdminDatabase();
  await forceDelete(db, cardIndexEntryId(userId, cardId));
  // 该卡下小说条目：按 novel/{userId}/{cardId}/ 前缀清理
  var prefix = 'novel/' + String(userId || '') + '/' + String(cardId || '') + '/';
  try {
    var list = await db.list({ startkey: prefix, endkey: prefix + '\ufff0' });
    for (var i = 0; i < (list.rows || []).length; i++) {
      var r = list.rows[i];
      if (!r || !r.id) continue;
      await forceDelete(db, r.id);
    }
  } catch (e) { /* ignore */ }
  return { ok: true, userId: userId, cardId: cardId };
}

/** 管理端查询：卡索引（按前缀分页，可选按用户过滤） */
export async function listCardIndex(opts) {
  opts = opts || {};
  var db = await ensureAdminDatabase();
  var prefix = opts.userId
    ? 'card/' + String(opts.userId) + '/'
    : 'card/';
  var limit = Math.min(10000, Math.max(1, Number(opts.limit) || 50));
  var offset = Math.max(0, Number(opts.offset) || 0);
  var res = await db.list({
    include_docs: true,
    startkey: prefix,
    endkey: prefix + '\ufff0',
    limit: limit + offset,
  });
  var rows = (res.rows || []).map(function(r) { return r.doc; }).filter(Boolean).slice(offset, offset + limit);
  var total = (res.rows || []).length - offset;
  return { items: rows, total: total };
}

/** 管理端查询：小说索引 */
export async function listNovelIndex(opts) {
  opts = opts || {};
  var db = await ensureAdminDatabase();
  var prefix = opts.userId
    ? 'novel/' + String(opts.userId) + '/'
    : 'novel/';
  var limit = Math.min(10000, Math.max(1, Number(opts.limit) || 50));
  var offset = Math.max(0, Number(opts.offset) || 0);
  var res = await db.list({
    include_docs: true,
    startkey: prefix,
    endkey: prefix + '\ufff0',
    limit: limit + offset,
  });
  var rows = (res.rows || []).map(function(r) { return r.doc; }).filter(Boolean).slice(offset, offset + limit);
  var total = (res.rows || []).length - offset;
  return { items: rows, total: total };
}
