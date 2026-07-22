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
  readOwnerReleaseVersion,
  ensureSharesDatabase,
  getUserRegistry,
} from '../couch.mjs';
import { config } from '../config.mjs';
import { sanitizeReleaseDoc } from './logic.mjs';

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

function shareUrl(token) {
  return config.publicAppUrl + '/#share/' + encodeURIComponent(token);
}

function isExpired(mapping) {
  if (!mapping || !mapping.expiresAt) return false;
  var t = Date.parse(mapping.expiresAt);
  if (!Number.isFinite(t)) return false;
  return Date.now() > t;
}

function parseExpiresAt(body) {
  if (!body) return null;
  if (body.expiresAt) {
    var d = new Date(body.expiresAt);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }
  if (body.expiresInDays != null && body.expiresInDays !== '') {
    var days = Number(body.expiresInDays);
    if (!Number.isFinite(days) || days <= 0) return null;
    return new Date(Date.now() + days * 86400000).toISOString();
  }
  return undefined; // undefined = 不改；null = 清除
}

/** 创建或复用分享（需已有 release） */
shareRouter.post('/novels', requireUser, async function(req, res) {
  try {
    await ensureSharesDatabase();
    var body = req.body || {};
    var cardId = String(body.cardId || '').trim();
    var novelId = String(body.novelId || '').trim();
    var existingToken = String(body.token || '').trim();
    var resetToken = !!body.resetToken;
    if (!cardId || !novelId) {
      return res.status(400).json({ error: 'missing_ids' });
    }

    var ownerId = req.session.user.id;
    var reg = await getUserRegistry(ownerId);
    if (reg && reg.disabled) {
      return res.status(403).json({ error: 'user_disabled' });
    }

    var release = await readOwnerRelease(ownerId, cardId, novelId);
    if (!release) {
      return res.status(409).json({
        error: 'no_release',
        message: '请先「增版」发布后再分享',
      });
    }

    var token = existingToken;
    var mapping = token && !resetToken ? await getShareMapping(token) : null;
    if (mapping && mapping.ownerUserId !== ownerId) {
      return res.status(403).json({ error: 'forbidden' });
    }
    if (resetToken && existingToken) {
      try { await deleteShareMapping(existingToken); } catch (e) { /* ignore */ }
      mapping = null;
      token = '';
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
    var exp = parseExpiresAt(body);
    if (exp === null) mapping.expiresAt = null;
    else if (typeof exp === 'string') mapping.expiresAt = exp;

    await putShareMapping(mapping);
    var publicPayload = sanitizeReleaseDoc(release);
    var dver = publicPayload.displayVersion;
    res.json({
      ok: true,
      token: token,
      url: shareUrl(token),
      latestUrl: shareUrl(token),
      versionUrl: dver ? (shareUrl(token) + '/v/' + encodeURIComponent(dver)) : null,
      displayVersion: dver,
      title: publicPayload.title,
      expiresAt: mapping.expiresAt || null,
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
    if (isExpired(mapping)) {
      return res.status(410).json({ error: 'expired', message: '分享链接已过期' });
    }
    var release = await readOwnerRelease(mapping.ownerUserId, mapping.cardId, mapping.novelId);
    if (!release) {
      return res.status(404).json({ error: 'release_missing', message: '已分享但尚无发布版' });
    }
    res.json({
      ok: true,
      token: token,
      expiresAt: mapping.expiresAt || null,
      novel: sanitizeReleaseDoc(release),
    });
  } catch (e) {
    console.error('[share/get]', e);
    res.status(500).json({ error: 'share_get_failed', message: String(e && e.message || e) });
  }
});


function versionShareUrl(token, ver) {
  return shareUrl(token) + '/v/' + encodeURIComponent(ver);
}

/** 公开只读：指定已发布版本 */
shareRouter.get('/novels/:token/versions/:ver', async function(req, res) {
  try {
    var token = String(req.params.token || '').trim();
    var ver = String(req.params.ver || '').trim();
    if (!token || !ver) return res.status(400).json({ error: 'missing_token' });
    var mapping = await getShareMapping(token);
    if (!mapping || mapping.enabled === false) {
      return res.status(404).json({ error: 'not_found' });
    }
    if (isExpired(mapping)) {
      return res.status(410).json({ error: 'expired', message: '分享链接已过期' });
    }
    var release = await readOwnerReleaseVersion(mapping.ownerUserId, mapping.cardId, mapping.novelId, ver);
    if (!release) {
      return res.status(404).json({ error: 'release_missing', message: '该版本不存在或未发布' });
    }
    var publicPayload = sanitizeReleaseDoc(release);
    res.json({
      ok: true,
      token: token,
      pinnedVersion: ver,
      expiresAt: mapping.expiresAt || null,
      novel: publicPayload,
    });
  } catch (e) {
    console.error('[share/novel-version]', e);
    res.status(500).json({ error: 'share_read_failed', message: String(e && e.message || e) });
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
