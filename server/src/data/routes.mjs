/**
 * 产品化云端数据 API：保存 / 获取 / 删卡 / 完整卡包
 * 浏览器经 Session 访问；不再直连 Couch。
 */
import { Router } from 'express';
import { requireUserFlexible } from '../auth/requireUser.mjs';
import { upsertUserRegistry, getUserRegistry } from '../couch.mjs';
import {
  DOC,
  cardDocId,
  novelDocId,
  ragDocId,
  storyCatalogDocId,
  storyNovelDocId,
  storyActiveDocId,
  storyReleaseDocId,
  avatarDocId,
  catalogNovelsList,
} from './docIds.mjs';
import {
  ensureUserDbExists,
  getUserDoc,
  putUserDoc,
  deleteUserDoc,
  getCardIndexDoc,
  upsertCardDraft,
  getCardBundle,
  putCardBundle,
  cascadeDeleteCard,
} from './userDocs.mjs';

export var dataRouter = Router();

dataRouter.use(requireUserFlexible);

function userIdOf(req) {
  return req.user && req.user.id;
}

function sendErr(res, e, fallbackStatus) {
  var code = e && (e.code || e.error);
  var status = (e && e.statusCode) || fallbackStatus || 500;
  if (code === 'conflict') {
    return res.status(409).json({
      ok: false,
      error: 'conflict',
      message: '云端版本冲突',
      server: e.serverDoc ? {
        _id: e.serverDoc._id,
        _rev: e.serverDoc._rev,
        updatedAt: e.serverDoc.updatedAt,
      } : null,
    });
  }
  if (code === 'missing_id' || code === 'missing_card_id') {
    return res.status(400).json({ ok: false, error: code, message: e.message });
  }
  console.error('[data]', e);
  return res.status(status).json({
    ok: false,
    error: code || 'data_failed',
    message: String(e && e.message || e),
  });
}

dataRouter.get('/status', async function(req, res) {
  try {
    var uid = userIdOf(req);
    await ensureUserDbExists(uid);
    try { await upsertUserRegistry(req.user); } catch (e) { /* ignore */ }
    var reg = null;
    try { reg = await getUserRegistry(uid); } catch (e) { /* ignore */ }
    var idx = await getCardIndexDoc(uid);
    res.json({
      ok: true,
      userId: uid,
      cardCount: (idx.cards || []).length,
      disabled: !!(reg && reg.disabled),
      mode: 'rest',
    });
  } catch (e) {
    sendErr(res, e);
  }
});

dataRouter.get('/cards', async function(req, res) {
  try {
    var idx = await getCardIndexDoc(userIdOf(req));
    res.json({
      ok: true,
      cards: idx.cards || [],
      updatedAt: idx.updatedAt || null,
      rev: idx._rev || null,
    });
  } catch (e) {
    sendErr(res, e);
  }
});

dataRouter.get('/cards/:cardId', async function(req, res) {
  try {
    var doc = await getUserDoc(userIdOf(req), cardDocId(req.params.cardId));
    if (!doc) return res.status(404).json({ ok: false, error: 'not_found' });
    res.json({ ok: true, doc: doc, data: doc.data, rev: doc._rev, updatedAt: doc.updatedAt });
  } catch (e) {
    sendErr(res, e);
  }
});

dataRouter.put('/cards/:cardId', async function(req, res) {
  try {
    var body = req.body || {};
    var draft = body.data != null ? body.data : body.draft != null ? body.draft : body;
    if (!draft || typeof draft !== 'object') {
      return res.status(400).json({ ok: false, error: 'invalid_body', message: '需要卡片草稿对象' });
    }
    var saved = await upsertCardDraft(userIdOf(req), req.params.cardId, draft, {
      baseRev: body.baseRev || body._rev,
      force: !!body.force,
    });
    res.json({ ok: true, cardId: String(req.params.cardId), rev: saved.rev, updatedAt: saved.updatedAt });
  } catch (e) {
    sendErr(res, e);
  }
});

/** 完整卡包：开卡所需全部关联数据 */
dataRouter.get('/cards/:cardId/bundle', async function(req, res) {
  try {
    var bundle = await getCardBundle(userIdOf(req), req.params.cardId);
    if (!bundle || !bundle.card) {
      return res.status(404).json({ ok: false, error: 'not_found' });
    }
    res.json({ ok: true, bundle: bundle });
  } catch (e) {
    sendErr(res, e);
  }
});

dataRouter.put('/cards/:cardId/bundle', async function(req, res) {
  try {
    var body = req.body || {};
    var bundle = body.bundle || body;
    var saved = await putCardBundle(userIdOf(req), req.params.cardId, bundle, {
      force: body.force !== false,
    });
    res.json(saved);
  } catch (e) {
    sendErr(res, e);
  }
});

dataRouter.delete('/cards/:cardId', async function(req, res) {
  try {
    var q = req.query || {};
    var body = req.body || {};
    var deleteStories = String(q.deleteStories || '') === '1'
      || String(q.deleteStories || '').toLowerCase() === 'true'
      || !!body.deleteStories;
    var out = await cascadeDeleteCard(userIdOf(req), req.params.cardId, {
      deleteStories: deleteStories,
    });
    res.json(out);
  } catch (e) {
    sendErr(res, e);
  }
});

/** 通用文档：?id=prefs/ui 或 body._id（避免路径含斜杠） */
dataRouter.get('/doc', async function(req, res) {
  try {
    var docId = String((req.query && req.query.id) || '').trim();
    if (!docId || docId.indexOf('..') >= 0) {
      return res.status(400).json({ ok: false, error: 'invalid_doc_id' });
    }
    var doc = await getUserDoc(userIdOf(req), docId);
    if (!doc) return res.status(404).json({ ok: false, error: 'not_found' });
    res.json({ ok: true, doc: doc });
  } catch (e) {
    sendErr(res, e);
  }
});

dataRouter.put('/doc', async function(req, res) {
  try {
    var body = req.body || {};
    var docId = String((body._id || body.id || (req.query && req.query.id) || '')).trim();
    if (!docId || docId.indexOf('..') >= 0) {
      return res.status(400).json({ ok: false, error: 'invalid_doc_id' });
    }
    var doc = body.doc && typeof body.doc === 'object'
      ? Object.assign({}, body.doc, { _id: docId })
      : Object.assign({}, body, { _id: docId });
    delete doc._rev;
    delete doc.id;
    var saved = await putUserDoc(userIdOf(req), doc, {
      baseRev: body.baseRev,
      force: !!body.force,
    });
    res.json({ ok: true, id: docId, rev: saved.rev, updatedAt: saved.updatedAt });
  } catch (e) {
    sendErr(res, e);
  }
});

dataRouter.delete('/doc', async function(req, res) {
  try {
    var docId = String((req.query && req.query.id) || '').trim();
    if (!docId) return res.status(400).json({ ok: false, error: 'invalid_doc_id' });
    var out = await deleteUserDoc(userIdOf(req), docId, {
      baseRev: req.query && req.query.baseRev,
      force: String(req.query && req.query.force) === '1',
    });
    res.json(out);
  } catch (e) {
    sendErr(res, e);
  }
});

// 便捷资源别名
dataRouter.get('/prefs/:kind', async function(req, res) {
  try {
    var kind = String(req.params.kind || '');
    var id = kind === 'prompts' ? DOC.prompts
      : kind === 'ui' ? DOC.ui
        : kind === 'sync' ? DOC.syncPrefs
          : '';
    if (!id) return res.status(400).json({ ok: false, error: 'invalid_pref' });
    var doc = await getUserDoc(userIdOf(req), id);
    res.json({ ok: true, doc: doc, data: doc && doc.data });
  } catch (e) {
    sendErr(res, e);
  }
});

dataRouter.put('/prefs/:kind', async function(req, res) {
  try {
    var kind = String(req.params.kind || '');
    var id = kind === 'prompts' ? DOC.prompts
      : kind === 'ui' ? DOC.ui
        : kind === 'sync' ? DOC.syncPrefs
          : '';
    if (!id) return res.status(400).json({ ok: false, error: 'invalid_pref' });
    var body = req.body || {};
    var type = kind === 'prompts' ? 'user-prefs-prompts'
      : kind === 'ui' ? 'user-prefs-ui'
        : 'sync-prefs';
    var doc = {
      _id: id,
      type: type,
      data: body.data != null ? body.data : body,
      updatedAt: new Date().toISOString(),
    };
    if (kind === 'sync') {
      Object.assign(doc, body.data != null ? body.data : body);
      doc._id = id;
      doc.type = type;
    }
    var saved = await putUserDoc(userIdOf(req), doc, { force: true });
    res.json({ ok: true, id: id, rev: saved.rev });
  } catch (e) {
    sendErr(res, e);
  }
});

dataRouter.get('/secrets/ai-config', async function(req, res) {
  try {
    var doc = await getUserDoc(userIdOf(req), DOC.aiSecrets);
    if (!doc) return res.status(404).json({ ok: false, error: 'not_found' });
    res.json({ ok: true, doc: doc });
  } catch (e) {
    sendErr(res, e);
  }
});

dataRouter.put('/secrets/ai-config', async function(req, res) {
  try {
    var body = req.body || {};
    if (!body.enc || typeof body.enc !== 'object') {
      return res.status(400).json({ ok: false, error: 'enc_required', message: '需要客户端加密后的 enc 字段' });
    }
    var doc = {
      _id: DOC.aiSecrets,
      type: 'ai-secrets',
      enc: body.enc,
      data: null,
      encrypted: true,
      packageVersion: body.packageVersion || 2,
      updatedAt: new Date().toISOString(),
    };
    var saved = await putUserDoc(userIdOf(req), doc, { force: true });
    res.json({ ok: true, rev: saved.rev });
  } catch (e) {
    sendErr(res, e);
  }
});

dataRouter.delete('/secrets/ai-config', async function(req, res) {
  try {
    var out = await deleteUserDoc(userIdOf(req), DOC.aiSecrets, { force: true });
    res.json(out);
  } catch (e) {
    sendErr(res, e);
  }
});

// 小说工坊 / RAG / Story 单资源
dataRouter.put('/novels/:cardId', async function(req, res) {
  try {
    var body = req.body || {};
    var cardId = String(req.params.cardId || '').trim();
    var saved = await putUserDoc(userIdOf(req), {
      _id: novelDocId(cardId),
      type: 'novel',
      cardId: cardId,
      data: body.data != null ? body.data : body,
      updatedAt: body.updatedAt || new Date().toISOString(),
    }, { force: true });
    res.json({ ok: true, rev: saved.rev });
  } catch (e) {
    sendErr(res, e);
  }
});

dataRouter.put('/rag/:cardId', async function(req, res) {
  try {
    var body = req.body || {};
    var cardId = String(req.params.cardId || '').trim();
    var saved = await putUserDoc(userIdOf(req), {
      _id: ragDocId(cardId),
      type: 'rag',
      cardId: cardId,
      data: body.data != null ? body.data : body,
      updatedAt: body.updatedAt || new Date().toISOString(),
    }, { force: true });
    res.json({ ok: true, rev: saved.rev });
  } catch (e) {
    sendErr(res, e);
  }
});

dataRouter.put('/avatars/:cardId/:kind', async function(req, res) {
  try {
    var kind = req.params.kind === 'thumb' ? 'thumb' : 'full';
    var cardId = String(req.params.cardId || '').trim();
    var body = req.body || {};
    if (!body.data) return res.status(400).json({ ok: false, error: 'data_required' });
    var saved = await putUserDoc(userIdOf(req), {
      _id: avatarDocId(cardId, kind),
      type: 'avatar',
      cardId: cardId,
      kind: kind,
      contentType: body.contentType || 'image/jpeg',
      encoding: 'base64',
      data: body.data,
      updatedAt: new Date().toISOString(),
    }, { force: true });
    res.json({ ok: true, rev: saved.rev });
  } catch (e) {
    sendErr(res, e);
  }
});

dataRouter.get('/stories/:cardId/catalog', async function(req, res) {
  try {
    var cardId = String(req.params.cardId || '').trim();
    var doc = await getUserDoc(userIdOf(req), storyCatalogDocId(cardId));
    res.json({
      ok: true,
      doc: doc,
      data: doc ? (Array.isArray(doc.data) ? doc.data : catalogNovelsList(doc)) : [],
    });
  } catch (e) {
    sendErr(res, e);
  }
});

dataRouter.get('/stories/:cardId/active', async function(req, res) {
  try {
    var cardId = String(req.params.cardId || '').trim();
    var doc = await getUserDoc(userIdOf(req), storyActiveDocId(cardId));
    res.json({ ok: true, doc: doc, data: doc && doc.data });
  } catch (e) {
    sendErr(res, e);
  }
});

dataRouter.get('/stories/:cardId/:novelId', async function(req, res) {
  try {
    var cardId = String(req.params.cardId || '').trim();
    var novelId = String(req.params.novelId || '').trim();
    if (novelId === 'catalog' || novelId === 'active') {
      return res.status(404).json({ ok: false, error: 'not_found' });
    }
    var doc = await getUserDoc(userIdOf(req), storyNovelDocId(cardId, novelId));
    if (!doc) return res.status(404).json({ ok: false, error: 'not_found' });
    res.json({ ok: true, doc: doc, data: doc.data });
  } catch (e) {
    sendErr(res, e);
  }
});

dataRouter.put('/stories/:cardId/catalog', async function(req, res) {
  try {
    var cardId = String(req.params.cardId || '').trim();
    var body = req.body || {};
    var list = Array.isArray(body.data) ? body.data
      : Array.isArray(body.novels) ? body.novels
        : Array.isArray(body) ? body : [];
    var saved = await putUserDoc(userIdOf(req), {
      _id: storyCatalogDocId(cardId),
      type: 'story-catalog',
      cardId: cardId,
      data: list,
      updatedAt: new Date().toISOString(),
    }, { force: true });
    res.json({ ok: true, rev: saved.rev });
  } catch (e) {
    sendErr(res, e);
  }
});

dataRouter.put('/stories/:cardId/active', async function(req, res) {
  try {
    var cardId = String(req.params.cardId || '').trim();
    var body = req.body || {};
    var saved = await putUserDoc(userIdOf(req), {
      _id: storyActiveDocId(cardId),
      type: 'story-active',
      cardId: cardId,
      data: body.data != null ? body.data : { novelId: body.novelId || '', updatedAt: Date.now() },
      updatedAt: new Date().toISOString(),
    }, { force: true });
    res.json({ ok: true, rev: saved.rev });
  } catch (e) {
    sendErr(res, e);
  }
});

dataRouter.put('/stories/:cardId/:novelId', async function(req, res) {
  try {
    var cardId = String(req.params.cardId || '').trim();
    var novelId = String(req.params.novelId || '').trim();
    var body = req.body || {};
    var data = body.data != null ? body.data : body;
    var saved = await putUserDoc(userIdOf(req), {
      _id: storyNovelDocId(cardId, novelId),
      type: 'story-novel',
      cardId: cardId,
      novelId: novelId,
      data: data,
      updatedAt: new Date().toISOString(),
    }, { force: true });
    res.json({ ok: true, rev: saved.rev });
  } catch (e) {
    sendErr(res, e);
  }
});

dataRouter.put('/stories/:cardId/:novelId/release', async function(req, res) {
  try {
    var cardId = String(req.params.cardId || '').trim();
    var novelId = String(req.params.novelId || '').trim();
    var body = req.body || {};
    var data = body.data != null ? body.data : body;
    var saved = await putUserDoc(userIdOf(req), {
      _id: storyReleaseDocId(cardId, novelId),
      type: 'story-release',
      cardId: cardId,
      novelId: novelId,
      characterVersion: data.characterVersion,
      novelVersion: data.novelVersion,
      displayVersion: data.displayVersion,
      publishedAt: data.publishedAt,
      data: data,
      updatedAt: new Date().toISOString(),
    }, { force: true });
    res.json({ ok: true, rev: saved.rev });
  } catch (e) {
    sendErr(res, e);
  }
});

dataRouter.delete('/stories/:cardId/:novelId', async function(req, res) {
  try {
    var cardId = String(req.params.cardId || '').trim();
    var novelId = String(req.params.novelId || '').trim();
    await deleteUserDoc(userIdOf(req), storyNovelDocId(cardId, novelId), { force: true });
    await deleteUserDoc(userIdOf(req), storyReleaseDocId(cardId, novelId), { force: true });
    res.json({ ok: true });
  } catch (e) {
    sendErr(res, e);
  }
});
