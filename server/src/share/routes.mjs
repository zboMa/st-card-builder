/**
 * 分享：映射 token → 用户库 release 快照
 */
import crypto from 'node:crypto';
import { Router } from 'express';
import {
  getShareMapping,
  putShareMapping,
  deleteShareMapping,
  readOwnerRelease,
  ensureSharesDatabase,
} from '../couch.mjs';
import { config } from '../config.mjs';

export var shareRouter = Router();

function requireUser(req, res, next) {
  if (!req.session || !req.session.user || !req.session.user.id) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

function genToken() {
  return crypto.randomBytes(18).toString('base64url');
}

function sanitizeReleaseDoc(doc) {
  if (!doc) return null;
  var data = doc.data && typeof doc.data === 'object' ? doc.data : doc;
  return {
    title: String(data.title || doc.title || '未命名小说'),
    displayVersion: String(doc.displayVersion || data.displayVersion || ''),
    characterVersion: String(doc.characterVersion || data.characterVersion || ''),
    novelVersion: String(doc.novelVersion || data.novelVersion || ''),
    publishedAt: typeof doc.publishedAt === 'number'
      ? doc.publishedAt
      : (typeof data.publishedAt === 'number' ? data.publishedAt : null),
    outline: Array.isArray(data.outline) ? data.outline : [],
    chapters: Array.isArray(data.chapters) ? data.chapters : [],
  };
}

function shareUrl(token) {
  return config.publicAppUrl + '/#share/' + encodeURIComponent(token);
}

/** 创建或复用分享（需已有 release） */
shareRouter.post('/novels', requireUser, async function(req, res) {
  try {
    await ensureSharesDatabase();
    var body = req.body || {};
    var cardId = String(body.cardId || '').trim();
    var novelId = String(body.novelId || '').trim();
    var existingToken = String(body.token || '').trim();
    if (!cardId || !novelId) {
      return res.status(400).json({ error: 'missing_ids' });
    }

    var ownerId = req.session.user.id;
    var release = await readOwnerRelease(ownerId, cardId, novelId);
    if (!release) {
      return res.status(409).json({
        error: 'no_release',
        message: '请先「增版」发布后再分享',
      });
    }

    var token = existingToken;
    var mapping = token ? await getShareMapping(token) : null;
    if (mapping && mapping.ownerUserId !== ownerId) {
      return res.status(403).json({ error: 'forbidden' });
    }
    if (!mapping) {
      token = genToken();
      mapping = {
        _id: 'share/' + token,
        type: 'novel-share',
        token: token,
        ownerUserId: ownerId,
        cardId: cardId,
        novelId: novelId,
        enabled: true,
        createdAt: new Date().toISOString(),
      };
    } else {
      mapping.cardId = cardId;
      mapping.novelId = novelId;
      mapping.enabled = true;
    }
    mapping.titleHint = String(
      (release.data && release.data.title) || release.title || ''
    );
    mapping.displayVersionHint = String(release.displayVersion || '');
    mapping.updatedAt = new Date().toISOString();

    await putShareMapping(mapping);
    var publicPayload = sanitizeReleaseDoc(release);
    res.json({
      ok: true,
      token: token,
      url: shareUrl(token),
      displayVersion: publicPayload.displayVersion,
      title: publicPayload.title,
    });
  } catch (e) {
    console.error('[share/create]', e);
    res.status(500).json({ error: 'share_create_failed', message: String(e && e.message || e) });
  }
});

/** 公开只读：永远读当前 release（主动增版后的快照） */
shareRouter.get('/novels/:token', async function(req, res) {
  try {
    var token = String(req.params.token || '').trim();
    if (!token) return res.status(400).json({ error: 'missing_token' });
    var mapping = await getShareMapping(token);
    if (!mapping || mapping.enabled === false) {
      return res.status(404).json({ error: 'not_found' });
    }
    var release = await readOwnerRelease(mapping.ownerUserId, mapping.cardId, mapping.novelId);
    if (!release) {
      return res.status(404).json({ error: 'release_missing', message: '已分享但尚无发布版' });
    }
    res.json({
      ok: true,
      token: token,
      novel: sanitizeReleaseDoc(release),
    });
  } catch (e) {
    console.error('[share/get]', e);
    res.status(500).json({ error: 'share_get_failed', message: String(e && e.message || e) });
  }
});

shareRouter.delete('/novels/:token', requireUser, async function(req, res) {
  try {
    var token = String(req.params.token || '').trim();
    var mapping = await getShareMapping(token);
    if (!mapping) return res.status(404).json({ error: 'not_found' });
    if (mapping.ownerUserId !== req.session.user.id) {
      return res.status(403).json({ error: 'forbidden' });
    }
    await deleteShareMapping(token);
    res.json({ ok: true });
  } catch (e) {
    console.error('[share/delete]', e);
    res.status(500).json({ error: 'share_delete_failed', message: String(e && e.message || e) });
  }
});
