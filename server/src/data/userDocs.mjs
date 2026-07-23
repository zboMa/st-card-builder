/**
 * 用户库文档 CRUD（仅服务端 Nano；浏览器不直连 Couch）
 */
import {
  getAdmin,
  userDbName,
  publicUserDbUrl,
  ensureUserDatabase,
} from '../couch.mjs';
import {
  DOC,
  cardDocId,
  avatarDocId,
  novelDocId,
  ragDocId,
  storyCatalogDocId,
  storyNovelDocId,
  storyActiveDocId,
  storyReleaseDocId,
  catalogNovelsList,
  buildCardIndexFromDrafts,
  cardReleaseDocId,
} from './docIds.mjs';
import { computeDraftContentRev, estimateBundleBytes } from '../quota/draftContentRev.mjs';
import { assertQuota } from '../quota/quotaService.mjs';

/** 确保用户库存在（不再轮换浏览器同步密码） */
export async function ensureUserDbExists(userId) {
  var n = getAdmin();
  var dbName = userDbName(userId);
  try {
    await n.db.create(dbName);
  } catch (e) {
    if (!e || e.statusCode !== 412) throw e;
  }
  return {
    dbName: dbName,
    dbUrl: publicUserDbUrl(dbName),
  };
}

export function getUserDb(userId) {
  return getAdmin().use(userDbName(userId));
}

export async function getUserDoc(userId, docId) {
  await ensureUserDbExists(userId);
  var db = getUserDb(userId);
  try {
    return await db.get(String(docId || ''));
  } catch (e) {
    if (e && e.statusCode === 404) return null;
    throw e;
  }
}

/**
 * @param {string} userId
 * @param {object} doc 必须含 _id
 * @param {{ baseRev?: string, force?: boolean }} [opts]
 */
export async function putUserDoc(userId, doc, opts) {
  opts = opts || {};
  if (!doc || !doc._id) {
    var err = new Error('missing_id');
    err.code = 'missing_id';
    throw err;
  }
  await ensureUserDbExists(userId);
  var db = getUserDb(userId);
  var id = String(doc._id);
  var existing = null;
  try {
    existing = await db.get(id);
  } catch (e) {
    if (!e || e.statusCode !== 404) throw e;
  }

  if (existing && opts.baseRev && existing._rev !== opts.baseRev && !opts.force) {
    var conflict = new Error('conflict');
    conflict.code = 'conflict';
    conflict.statusCode = 409;
    conflict.serverDoc = existing;
    throw conflict;
  }

  var next = Object.assign({}, doc);
  delete next._rev;
  if (existing && existing._rev) next._rev = existing._rev;
  if (!next.updatedAt) next.updatedAt = new Date().toISOString();

  var saved = await db.insert(next);
  return {
    ok: true,
    id: id,
    rev: saved.rev,
    updatedAt: next.updatedAt,
  };
}

export async function deleteUserDoc(userId, docId, opts) {
  opts = opts || {};
  await ensureUserDbExists(userId);
  var db = getUserDb(userId);
  var id = String(docId || '');
  try {
    var existing = await db.get(id);
    if (opts.baseRev && existing._rev !== opts.baseRev && !opts.force) {
      var conflict = new Error('conflict');
      conflict.code = 'conflict';
      conflict.statusCode = 409;
      conflict.serverDoc = existing;
      throw conflict;
    }
    await db.destroy(id, existing._rev);
    return { ok: true, id: id };
  } catch (e) {
    if (e && e.statusCode === 404) return { ok: true, id: id, missing: true };
    throw e;
  }
}

export async function listUserDocsByPrefix(userId, prefix, opts) {
  opts = opts || {};
  await ensureUserDbExists(userId);
  var db = getUserDb(userId);
  var p = String(prefix || '');
  var res = await db.list({
    include_docs: !!opts.includeDocs,
    startkey: p,
    endkey: p + '\ufff0',
  });
  return (res.rows || []).map(function(r) {
    return opts.includeDocs ? r.doc : { id: r.id, key: r.key };
  }).filter(Boolean);
}

export async function getCardIndexDoc(userId) {
  var doc = await getUserDoc(userId, DOC.cardIndex);
  return doc && Array.isArray(doc.cards) ? doc : { _id: DOC.cardIndex, type: 'card-index', cards: [], updatedAt: null };
}

export async function putCardIndexFromMap(userId, draftsMap) {
  return putUserDoc(userId, buildCardIndexFromDrafts(draftsMap || {}), { force: true });
}

export async function upsertCardDraft(userId, cardId, draft, opts) {
  opts = opts || {};
  var id = String(cardId || '').trim();
  if (!id) {
    var err = new Error('missing_card_id');
    err.code = 'missing_card_id';
    throw err;
  }
  var doc = {
    _id: cardDocId(id),
    type: 'card',
    cardId: id,
    data: draft,
    updatedAt: (draft && draft.updatedAt) || new Date().toISOString(),
  };
  var saved = await putUserDoc(userId, doc, opts);

  // 维护索引摘要
  var idx = await getCardIndexDoc(userId);
  var cards = Array.isArray(idx.cards) ? idx.cards.slice() : [];
  var found = false;
  for (var i = 0; i < cards.length; i++) {
    if (cards[i] && cards[i].id === id) {
      var wbCount = 0;
      try {
        wbCount = Array.isArray(draft && draft.worldbookEntries) ? draft.worldbookEntries.length : 0;
      } catch (eWb) { /* ignore */ }
      cards[i] = {
        id: id,
        charName: String((draft && (draft.charName || draft.name)) || cards[i].charName || '').trim(),
        updatedAt: doc.updatedAt,
        avatarInIdb: !!(draft && draft.avatarInIdb),
        contentRev: computeDraftContentRev(draft),
        wbCount: wbCount,
        bundleBytes: opts.bundleBytes != null ? Number(opts.bundleBytes) : (cards[i].bundleBytes || 0),
      };
      found = true;
      break;
    }
  }
  if (!found) {
    var wbCountNew = Array.isArray(draft && draft.worldbookEntries) ? draft.worldbookEntries.length : 0;
    cards.unshift({
      id: id,
      charName: String((draft && (draft.charName || draft.name)) || '').trim(),
      updatedAt: doc.updatedAt,
      avatarInIdb: !!(draft && draft.avatarInIdb),
      contentRev: computeDraftContentRev(draft),
      wbCount: wbCountNew,
      bundleBytes: opts.bundleBytes != null ? Number(opts.bundleBytes) : 0,
    });
  }
  cards.sort(function(a, b) {
    return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
  });
  await putUserDoc(userId, {
    _id: DOC.cardIndex,
    type: 'card-index',
    cards: cards,
    updatedAt: new Date().toISOString(),
  }, { force: true });

  return saved;
}

/**
 * 完整卡包：开卡所需的绑卡数据（卡+头像+小说工坊+RAG）
 * 写出的小说（Story Studio）不在此列，独立拉取。
 */
export async function getCardBundle(userId, cardId) {
  var id = String(cardId || '').trim();
  if (!id) return null;

  var card = await getUserDoc(userId, cardDocId(id));
  var avatarFull = await getUserDoc(userId, avatarDocId(id, 'full'));
  var avatarThumb = await getUserDoc(userId, avatarDocId(id, 'thumb'));
  var novel = await getUserDoc(userId, novelDocId(id));
  var rag = await getUserDoc(userId, ragDocId(id));
  var releaseCurrent = await getUserDoc(userId, cardReleaseDocId(id));

  return {
    cardId: id,
    card: card,
    avatar: {
      full: avatarFull,
      thumb: avatarThumb,
    },
    novel: novel,
    rag: rag,
    cardRelease: releaseCurrent,
  };
}

/**
 * 写入完整卡包（用于登录后本地→云端导入 / 整卡保存）
 */
export async function putCardBundle(userId, cardId, bundle, opts) {
  opts = opts || {};
  var id = String(cardId || '').trim();
  if (!id) {
    var err = new Error('missing_card_id');
    err.code = 'missing_card_id';
    throw err;
  }
  bundle = bundle || {};
  var results = {};
  var bundleBytes = estimateBundleBytes(bundle);

  await assertQuota({ id: userId }, 'upload_bundle', {
    cardId: id,
    addBytes: bundleBytes,
  });

  if (bundle.card != null) {
    var draft = bundle.card.data != null ? bundle.card.data : bundle.card;
    results.card = await upsertCardDraft(userId, id, draft, {
      force: !!opts.force,
      bundleBytes: bundleBytes,
    });
  } else if (opts.bundleBytesOnly) {
    var idxOnly = await getCardIndexDoc(userId);
    var cardsOnly = Array.isArray(idxOnly.cards) ? idxOnly.cards.slice() : [];
    for (var bi = 0; bi < cardsOnly.length; bi++) {
      if (cardsOnly[bi] && cardsOnly[bi].id === id) {
        cardsOnly[bi].bundleBytes = bundleBytes;
        break;
      }
    }
    await putUserDoc(userId, {
      _id: DOC.cardIndex,
      type: 'card-index',
      cards: cardsOnly,
      updatedAt: new Date().toISOString(),
    }, { force: true });
  }

  async function putMaybe(docOrData, build) {
    if (docOrData == null) return null;
    var doc = build(docOrData);
    return putUserDoc(userId, doc, { force: true });
  }

  if (bundle.avatar && bundle.avatar.full) {
    results.avatarFull = await putMaybe(bundle.avatar.full, function(d) {
      return {
        _id: avatarDocId(id, 'full'),
        type: 'avatar',
        cardId: id,
        kind: 'full',
        contentType: d.contentType || 'image/jpeg',
        encoding: 'base64',
        data: d.data != null ? d.data : d,
        updatedAt: d.updatedAt || new Date().toISOString(),
      };
    });
  }
  if (bundle.avatar && bundle.avatar.thumb) {
    results.avatarThumb = await putMaybe(bundle.avatar.thumb, function(d) {
      return {
        _id: avatarDocId(id, 'thumb'),
        type: 'avatar',
        cardId: id,
        kind: 'thumb',
        contentType: d.contentType || 'image/jpeg',
        encoding: 'base64',
        data: d.data != null ? d.data : d,
        updatedAt: d.updatedAt || new Date().toISOString(),
      };
    });
  }

  if (bundle.novel != null) {
    results.novel = await putMaybe(bundle.novel, function(d) {
      return {
        _id: novelDocId(id),
        type: 'novel',
        cardId: id,
        data: d.data != null ? d.data : d,
        updatedAt: d.updatedAt || new Date().toISOString(),
      };
    });
  }
  if (bundle.rag != null) {
    results.rag = await putMaybe(bundle.rag, function(d) {
      return {
        _id: ragDocId(id),
        type: 'rag',
        cardId: id,
        data: d.data != null ? d.data : d,
        updatedAt: d.updatedAt || new Date().toISOString(),
      };
    });
  }

  // Story 写出的小说不进卡包；请走 /api/data/stories/*

  return { ok: true, cardId: id, results: results };
}

/**
 * 删卡：始终删除绑卡套件（草稿/头像/工坊/RAG/卡 release）
 * @param {{ deleteStories?: boolean }} [opts] 勾选后才级联删 Story 小说
 */
export async function cascadeDeleteCard(userId, cardId, opts) {
  opts = opts || {};
  var deleteStories = !!opts.deleteStories;
  var id = String(cardId || '').trim();
  if (!id) return { ok: false };
  var ids = [
    cardDocId(id),
    avatarDocId(id, 'full'),
    avatarDocId(id, 'thumb'),
    novelDocId(id),
    ragDocId(id),
    cardReleaseDocId(id),
  ];
  // 历史钉版本 release/{ver}
  try {
    var cardReleaseRows = await listUserDocsByPrefix(userId, 'card/' + id + '/release/');
    (cardReleaseRows || []).forEach(function(r) {
      var rid = r && (r.id || r._id);
      if (rid && ids.indexOf(rid) < 0) ids.push(rid);
    });
  } catch (eListCard) { /* ignore */ }

  if (deleteStories) {
    var catalog = await getUserDoc(userId, storyCatalogDocId(id));
    var novels = catalogNovelsList(catalog);
    ids.push(storyCatalogDocId(id), storyActiveDocId(id));
    for (var ni = 0; ni < novels.length; ni++) {
      var n = novels[ni];
      var nid = n && (n.id || n.novelId);
      if (!nid) continue;
      ids.push(storyNovelDocId(id, nid));
      ids.push(storyReleaseDocId(id, nid));
      try {
        var storyRelRows = await listUserDocsByPrefix(userId, storyReleaseDocId(id, nid) + '/');
        (storyRelRows || []).forEach(function(r) {
          var rid = r && (r.id || r._id);
          if (rid && ids.indexOf(rid) < 0) ids.push(rid);
        });
      } catch (eListStory) { /* ignore */ }
    }
  }
  for (var i = 0; i < ids.length; i++) {
    try { await deleteUserDoc(userId, ids[i], { force: true }); } catch (e) { /* ignore */ }
  }

  var idx = await getCardIndexDoc(userId);
  var cards = (idx.cards || []).filter(function(c) { return c && c.id !== id; });
  await putUserDoc(userId, {
    _id: DOC.cardIndex,
    type: 'card-index',
    cards: cards,
    updatedAt: new Date().toISOString(),
  }, { force: true });

  return { ok: true, deleted: ids.length, deleteStories: deleteStories };
}

/** 禁用用户时仍可轮换旧同步账号密码（兼容） */
export async function revokeLegacySyncAccess(userId) {
  try {
    return await ensureUserDatabase(userId);
  } catch (e) {
    return null;
  }
}
