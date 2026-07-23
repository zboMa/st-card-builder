/**
 * 角色卡分享 API
 */
import crypto from 'node:crypto';
import { Router } from 'express';
import { requireUserFlexible } from '../auth/requireUser.mjs';
import {
  ensureSharesDatabase,
  getShareMapping,
  putShareMapping,
  deleteShareMapping,
  getUserRegistry,
  readOwnerCardRelease,
  readOwnerCardReleaseVersion,
  listOwnerCardReleaseVersions,
  putOwnerCardRelease,
  getOwnerCardPng,
} from '../couch.mjs';
import { config } from '../config.mjs';
import { hashSharePassword, verifySharePassword } from './password.mjs';
import { assertQuota } from '../quota/quotaService.mjs';

export var cardShareRouter = Router();

function genToken() {
  return crypto.randomBytes(18).toString('base64url');
}

function apiBase() {
  return String(config.publicApiUrl || '').replace(/\/$/, '')
    || ('http://127.0.0.1:' + config.port);
}

function infoUrl(token) {
  return apiBase() + '/api/share/cards/' + encodeURIComponent(token);
}

function pngUrl(token) {
  return apiBase() + '/api/share/cards/' + encodeURIComponent(token) + '/png';
}

function versionJsonUrl(token, ver) {
  return apiBase() + '/api/share/cards/' + encodeURIComponent(token)
    + '/versions/' + encodeURIComponent(ver) + '/json';
}

function versionPngUrl(token, ver) {
  return apiBase() + '/api/share/cards/' + encodeURIComponent(token)
    + '/versions/' + encodeURIComponent(ver) + '/png';
}

function isExpired(mapping) {
  if (!mapping || !mapping.expiresAt) return false;
  var t = Date.parse(mapping.expiresAt);
  return Number.isFinite(t) && Date.now() > t;
}

async function assertShareAccess(req, mapping) {
  if (!mapping || mapping.enabled === false || mapping.type !== 'card-share') {
    return { ok: false, status: 404, error: 'not_found' };
  }
  if (isExpired(mapping)) {
    return { ok: false, status: 410, error: 'expired' };
  }
  if (mapping.passwordHash) {
    var pass = String(
      (req.headers['x-share-password'] || '')
      || (req.query && req.query.password)
      || (req.body && req.body.password)
      || ''
    );
    var ok = await verifySharePassword(pass, mapping.passwordHash);
    if (!ok) return { ok: false, status: 403, error: 'bad_password' };
  }
  return { ok: true };
}

/** 作者：发布当前卡到 release（JSON + 可选 PNG） */
cardShareRouter.post('/publish', requireUserFlexible, async function(req, res) {
  try {
    var body = req.body || {};
    var cardId = String(body.cardId || '').trim();
    var cardJson = body.cardJson;
    var characterVersion = String(body.characterVersion || (cardJson && cardJson.data && cardJson.data.character_version) || '1.0').trim() || '1.0';
    var title = String(body.title || (cardJson && cardJson.data && cardJson.data.name) || '未命名');
    var pngEnabled = !!body.pngEnabled;
    var pngBase64 = body.pngBase64 ? String(body.pngBase64) : null;
    if (!cardId || !cardJson) {
      return res.status(400).json({ error: 'missing_payload' });
    }
    var publishedAt = Date.now();
    await putOwnerCardRelease(req.user.id, cardId, {
      characterVersion: characterVersion,
      title: title,
      publishedAt: publishedAt,
      cardJson: cardJson,
      pngEnabled: pngEnabled,
    }, pngEnabled ? pngBase64 : null);
    res.json({
      ok: true,
      cardId: cardId,
      characterVersion: characterVersion,
      publishedAt: publishedAt,
      pngStored: !!(pngEnabled && pngBase64),
    });
  } catch (e) {
    console.error('[share/cards/publish]', e);
    res.status(500).json({ error: 'publish_failed', message: String(e && e.message || e) });
  }
});

/** 作者：创建/更新分享映射 */
cardShareRouter.post('/', requireUserFlexible, async function(req, res) {
  try {
    await ensureSharesDatabase();
    var body = req.body || {};
    var cardId = String(body.cardId || '').trim();
    var existingToken = String(body.token || '').trim();
    var resetToken = !!body.resetToken;
    if (!cardId) return res.status(400).json({ error: 'missing_ids' });

    var reg = await getUserRegistry(req.user.id);
    if (reg && reg.disabled) return res.status(403).json({ error: 'user_disabled' });

    var release = await readOwnerCardRelease(req.user.id, cardId);
    if (!release) {
      return res.status(409).json({ error: 'no_release', message: '请先发布角色卡版本' });
    }

    var token = existingToken;
    var mapping = token && !resetToken ? await getShareMapping(token) : null;
    if (mapping && mapping.ownerUserId !== req.user.id) {
      return res.status(403).json({ error: 'forbidden' });
    }
    if (resetToken && existingToken) {
      try { await deleteShareMapping(existingToken); } catch (e) { /* ignore */ }
      mapping = null;
      token = '';
    }
    if (!mapping) {
      await assertQuota(req.user, 'create_share');
      token = genToken();
      mapping = {
        _id: 'share/' + token,
        type: 'card-share',
        token: token,
        ownerUserId: req.user.id,
        cardId: cardId,
        enabled: true,
        createdAt: new Date().toISOString(),
        passwordHash: null,
        pngPublic: false,
      };
    }
    mapping.cardId = cardId;
    mapping.enabled = true;
    mapping.titleHint = String(release.title || (release.data && release.data.title) || '');
    mapping.characterVersionHint = String(release.characterVersion || '');
    mapping.pngPublic = body.pngPublic != null ? !!body.pngPublic : !!mapping.pngPublic;
    mapping.updatedAt = new Date().toISOString();

    if (body.clearPassword) mapping.passwordHash = null;
    else if (body.password) {
      mapping.passwordHash = await hashSharePassword(body.password);
    }

    if (body.expiresInDays != null && body.expiresInDays !== '') {
      var days = Number(body.expiresInDays);
      if (Number.isFinite(days) && days > 0) {
        mapping.expiresAt = new Date(Date.now() + days * 86400000).toISOString();
      }
    } else if (body.expiresAt === null) {
      mapping.expiresAt = null;
    }

    await putShareMapping(mapping);
    res.json({
      ok: true,
      token: token,
      infoUrl: infoUrl(token),
      pngUrl: mapping.pngPublic ? pngUrl(token) : null,
      pngPublic: !!mapping.pngPublic,
      hasPassword: !!mapping.passwordHash,
      characterVersion: mapping.characterVersionHint,
      title: mapping.titleHint,
      expiresAt: mapping.expiresAt || null,
    });
  } catch (e) {
    console.error('[share/cards/create]', e);
    res.status(500).json({ error: 'share_create_failed', message: String(e && e.message || e) });
  }
});

cardShareRouter.delete('/:token', requireUserFlexible, async function(req, res) {
  try {
    var token = String(req.params.token || '').trim();
    var mapping = await getShareMapping(token);
    if (!mapping) return res.status(404).json({ error: 'not_found' });
    if (mapping.ownerUserId !== req.user.id) return res.status(403).json({ error: 'forbidden' });
    await deleteShareMapping(token);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'share_delete_failed', message: String(e && e.message || e) });
  }
});

/** 信息：登录 + 可选密码 */
cardShareRouter.get('/:token', requireUserFlexible, async function(req, res) {
  try {
    var token = String(req.params.token || '').trim();
    var mapping = await getShareMapping(token);
    var gate = await assertShareAccess(req, mapping);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error });

    var release = await readOwnerCardRelease(mapping.ownerUserId, mapping.cardId);
    if (!release) return res.status(404).json({ error: 'release_missing' });

    var versions = await listOwnerCardReleaseVersions(mapping.ownerUserId, mapping.cardId);
    var versionList = versions.map(function(v) {
      var ver = String(v.characterVersion || '1.0');
      return {
        version: ver,
        title: v.title || '',
        publishedAt: v.publishedAt || null,
        jsonUrl: versionJsonUrl(token, ver),
        pngUrl: mapping.pngPublic ? versionPngUrl(token, ver) : null,
      };
    }).sort(function(a, b) {
      return String(b.publishedAt || '').localeCompare(String(a.publishedAt || ''));
    });

    var latestVer = String(release.characterVersion || '1.0');
    res.json({
      ok: true,
      token: token,
      type: 'card-share',
      title: release.title || '',
      characterVersion: latestVer,
      publishedAt: release.publishedAt || null,
      pngPublic: !!mapping.pngPublic,
      hasPassword: !!mapping.passwordHash,
      latest: {
        version: latestVer,
        jsonUrl: versionJsonUrl(token, latestVer),
        pngUrl: mapping.pngPublic ? pngUrl(token) : null,
      },
      versions: versionList.length ? versionList : [{
        version: latestVer,
        title: release.title || '',
        publishedAt: release.publishedAt || null,
        jsonUrl: versionJsonUrl(token, latestVer),
        pngUrl: mapping.pngPublic ? pngUrl(token) : null,
      }],
    });
  } catch (e) {
    console.error('[share/cards/info]', e);
    res.status(500).json({ error: 'share_info_failed', message: String(e && e.message || e) });
  }
});

/** 版本 JSON：登录 + 可选密码 */
cardShareRouter.get('/:token/versions/:ver/json', requireUserFlexible, async function(req, res) {
  try {
    var token = String(req.params.token || '').trim();
    var ver = decodeURIComponent(String(req.params.ver || ''));
    var mapping = await getShareMapping(token);
    var gate = await assertShareAccess(req, mapping);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error });

    var doc = await readOwnerCardReleaseVersion(mapping.ownerUserId, mapping.cardId, ver);
    if (!doc) {
      var cur = await readOwnerCardRelease(mapping.ownerUserId, mapping.cardId);
      if (cur && String(cur.characterVersion || '') === String(ver)) doc = cur;
    }
    if (!doc) return res.status(404).json({ error: 'version_missing' });
    var cardJson = (doc.data && doc.data.cardJson) || null;
    if (!cardJson) return res.status(404).json({ error: 'json_missing' });
    res.json({ ok: true, version: doc.characterVersion, card: cardJson });
  } catch (e) {
    console.error('[share/cards/json]', e);
    res.status(500).json({ error: 'json_failed', message: String(e && e.message || e) });
  }
});

/** 最新 PNG 直链：可匿名（需开启 pngPublic） */
cardShareRouter.get('/:token/png', async function(req, res) {
  try {
    var token = String(req.params.token || '').trim();
    var mapping = await getShareMapping(token);
    if (!mapping || mapping.type !== 'card-share' || mapping.enabled === false) {
      return res.status(404).json({ error: 'not_found' });
    }
    if (isExpired(mapping)) return res.status(410).json({ error: 'expired' });
    if (!mapping.pngPublic) return res.status(404).json({ error: 'png_disabled' });
    var buf = await getOwnerCardPng(mapping.ownerUserId, mapping.cardId, null);
    if (!buf) return res.status(404).json({ error: 'png_missing' });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=120');
    res.send(buf);
  } catch (e) {
    console.error('[share/cards/png]', e);
    res.status(500).json({ error: 'png_failed' });
  }
});

/** 指定版本 PNG：开启 pngPublic 时可匿名；否则需登录+密码 */
cardShareRouter.get('/:token/versions/:ver/png', async function(req, res, next) {
  try {
    var token = String(req.params.token || '').trim();
    var ver = decodeURIComponent(String(req.params.ver || ''));
    var mapping = await getShareMapping(token);
    if (!mapping || mapping.type !== 'card-share' || mapping.enabled === false) {
      return res.status(404).json({ error: 'not_found' });
    }
    if (isExpired(mapping)) return res.status(410).json({ error: 'expired' });
    if (!mapping.pngPublic) {
      return requireUserFlexible(req, res, async function() {
        var gate = await assertShareAccess(req, mapping);
        if (!gate.ok) return res.status(gate.status).json({ error: gate.error });
        var buf = await getOwnerCardPng(mapping.ownerUserId, mapping.cardId, ver);
        if (!buf) return res.status(404).json({ error: 'png_missing' });
        res.setHeader('Content-Type', 'image/png');
        res.send(buf);
      });
    }
    var buf = await getOwnerCardPng(mapping.ownerUserId, mapping.cardId, ver);
    if (!buf) return res.status(404).json({ error: 'png_missing' });
    res.setHeader('Content-Type', 'image/png');
    res.send(buf);
  } catch (e) {
    console.error('[share/cards/ver-png]', e);
    res.status(500).json({ error: 'png_failed' });
  }
});
