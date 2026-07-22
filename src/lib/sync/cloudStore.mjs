/**
 * 云端存储桥：本地权威缓存（LS/IDB）+ 登录后 REST 存取 + 离线 outbox
 * 开卡使用完整 bundle，避免数据拆碎。
 */
import * as api from './cloudApi.mjs';
import { enqueueOutbox, flushOutbox, getOutboxSize } from './outbox.mjs';
import { DOC, buildCardIndexFromDrafts, catalogNovelsList } from './docIds.mjs';
import {
  idbGetJson,
  idbSetJson,
  idbGetBlob,
  idbSetBlob,
  idbNovelKey,
  idbAvatarFullKey,
  idbAvatarThumbKey,
} from '../idbStore.mjs';

var DRAFTS_KEY = 'st_v3_builder_drafts';
var cloudEnabled = false;
var lastCloudAt = null;
var lastCloudError = null;
var syncing = false;
var listeners = [];

export function onCloudEvent(fn) {
  listeners.push(fn);
  return function() {
    listeners = listeners.filter(function(x) { return x !== fn; });
  };
}

function emit(type, detail) {
  listeners.forEach(function(fn) {
    try { fn({ type: type, detail: detail }); } catch (e) { /* ignore */ }
  });
}

export function setCloudEnabled(on) {
  cloudEnabled = !!on;
}

export function isCloudEnabled() {
  return !!cloudEnabled;
}

export function getCloudStatus() {
  return {
    enabled: cloudEnabled,
    syncing: syncing,
    lastCloudAt: lastCloudAt,
    lastCloudError: lastCloudError,
    outboxSize: getOutboxSize(),
  };
}

function readDrafts() {
  try {
    return JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}') || {};
  } catch (e) {
    return {};
  }
}

function writeDrafts(drafts) {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts || {}));
}

function blobToBase64(blob) {
  return new Promise(function(resolve, reject) {
    if (!blob) {
      resolve('');
      return;
    }
    var reader = new FileReader();
    reader.onload = function() {
      var s = String(reader.result || '');
      var i = s.indexOf(',');
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    reader.onerror = function() {
      reject(reader.error || new Error('blob_read_failed'));
    };
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(b64, contentType) {
  var bin = atob(String(b64 || ''));
  var len = bin.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: contentType || 'image/jpeg' });
}

async function readLocalAvatarParts(cardId) {
  var full = await idbGetBlob(idbAvatarFullKey(cardId)).catch(function() { return null; });
  var thumb = await idbGetBlob(idbAvatarThumbKey(cardId)).catch(function() { return null; });
  var out = { full: null, thumb: null };
  if (full && full.blob) {
    out.full = {
      data: await blobToBase64(full.blob),
      contentType: full.mime || full.blob.type || 'image/jpeg',
    };
  }
  if (thumb && thumb.blob) {
    out.thumb = {
      data: await blobToBase64(thumb.blob),
      contentType: thumb.mime || thumb.blob.type || 'image/jpeg',
    };
  }
  return out;
}

/**
 * 组装本地完整卡包（用于上传 / 导入）
 */
export async function buildLocalCardBundle(cardId) {
  var id = String(cardId || '').trim();
  var drafts = readDrafts();
  var draft = drafts[id] || null;
  var novelRec = await idbGetJson(idbNovelKey(id)).catch(function() { return null; });
  var ragRec = await idbGetJson('novelRagV1:card:' + id).catch(function() { return null; });
  var catalog = await idbGetJson('storyStudioV1:catalog:card:' + id).catch(function() { return null; });
  var active = await idbGetJson('storyStudioV1:active:card:' + id).catch(function() { return null; });
  var list = catalogNovelsList(catalog);
  var novels = [];
  var releases = [];
  for (var i = 0; i < list.length; i++) {
    var meta = list[i];
    var nid = meta && (meta.id || meta.novelId);
    if (!nid) continue;
    var sn = await idbGetJson('storyStudioV1:card:' + id + ':' + nid).catch(function() { return null; });
    if (sn) novels.push({ novelId: nid, data: sn });
    var rel = await idbGetJson('storyStudioV1:release:card:' + id + ':' + nid).catch(function() { return null; });
    if (rel) releases.push({ novelId: nid, data: rel });
  }
  var avatar = await readLocalAvatarParts(id);
  return {
    card: draft,
    avatar: avatar,
    novel: novelRec,
    rag: ragRec,
    story: {
      catalog: list,
      active: active,
      novels: novels,
      releases: releases,
    },
  };
}

/**
 * 将云端完整卡包灌回 LS + IDB（开卡可直接用）
 */
export async function hydrateCardBundleToLocal(bundle) {
  if (!bundle || !bundle.cardId) return false;
  var id = String(bundle.cardId);
  var drafts = readDrafts();
  if (bundle.card && bundle.card.data) {
    drafts[id] = Object.assign({}, bundle.card.data, { _cloudStub: false });
    writeDrafts(drafts);
  } else if (bundle.card && typeof bundle.card === 'object' && !bundle.card._id) {
    drafts[id] = Object.assign({}, bundle.card, { _cloudStub: false });
    writeDrafts(drafts);
  }

  async function hydrateAvatar(kind, doc) {
    if (!doc || !doc.data) return;
    var blob = base64ToBlob(doc.data, doc.contentType || 'image/jpeg');
    var key = kind === 'thumb' ? idbAvatarThumbKey(id) : idbAvatarFullKey(id);
    await idbSetBlob(key, blob, doc.contentType || 'image/jpeg');
  }
  if (bundle.avatar) {
    await hydrateAvatar('full', bundle.avatar.full);
    await hydrateAvatar('thumb', bundle.avatar.thumb);
  }

  if (bundle.novel) {
    var novelData = bundle.novel.data != null ? bundle.novel.data : bundle.novel;
    await idbSetJson(idbNovelKey(id), novelData);
  }
  if (bundle.rag) {
    var ragData = bundle.rag.data != null ? bundle.rag.data : bundle.rag;
    await idbSetJson('novelRagV1:card:' + id, ragData);
  }

  if (bundle.story) {
    var catList = catalogNovelsList(bundle.story.catalog);
    await idbSetJson('storyStudioV1:catalog:card:' + id, catList);
    if (bundle.story.active) {
      var act = bundle.story.active.data != null ? bundle.story.active.data : bundle.story.active;
      await idbSetJson('storyStudioV1:active:card:' + id, act);
    }
    var novels = Array.isArray(bundle.story.novels) ? bundle.story.novels : [];
    for (var i = 0; i < novels.length; i++) {
      var n = novels[i];
      var ndata = n.data != null ? n.data : n;
      var nid = n.novelId || (ndata && ndata.id);
      if (!nid || !ndata) continue;
      await idbSetJson('storyStudioV1:card:' + id + ':' + nid, ndata);
    }
    var releases = Array.isArray(bundle.story.releases) ? bundle.story.releases : [];
    for (var j = 0; j < releases.length; j++) {
      var r = releases[j];
      var rdata = r.data != null ? r.data : r;
      var rnid = r.novelId || (rdata && rdata.novelId);
      if (!rnid || !rdata) continue;
      await idbSetJson('storyStudioV1:release:card:' + id + ':' + rnid, rdata);
    }
  }

  emit('bundle-hydrated', { cardId: id });
  return true;
}

async function withCloudOrOutbox(op, runner, outboxItem) {
  if (!cloudEnabled) {
    if (outboxItem) enqueueOutbox(outboxItem);
    return { queued: true, offline: true };
  }
  try {
    var result = await runner();
    lastCloudAt = new Date().toISOString();
    lastCloudError = null;
    return result;
  } catch (e) {
    lastCloudError = String(e && e.message || e);
    if (e && e.status === 401) {
      cloudEnabled = false;
      throw e;
    }
    if (outboxItem) enqueueOutbox(outboxItem);
    emit('queued', { op: op, error: lastCloudError });
    return { queued: true, error: lastCloudError };
  }
}

/** 保存卡草稿到云端（本地已由 stateMachine 写好） */
export async function cloudSaveCard(cardId, draft) {
  var id = String(cardId || '').trim();
  if (!id || !draft) return;
  return withCloudOrOutbox('putCard', function() {
    return api.putCardDraft(id, draft);
  }, {
    op: 'putCard',
    cardId: id,
    body: { data: draft },
    dedupeKey: 'putCard:' + id,
  });
}

export async function cloudSaveCardBundle(cardId) {
  var id = String(cardId || '').trim();
  if (!id) return;
  var bundle = await buildLocalCardBundle(id);
  return withCloudOrOutbox('putBundle', function() {
    return api.putCardBundle(id, bundle);
  }, {
    op: 'putBundle',
    cardId: id,
    body: { bundle: bundle },
    dedupeKey: 'putBundle:' + id,
  });
}

export async function cloudDeleteCard(cardId) {
  var id = String(cardId || '').trim();
  if (!id) return;
  return withCloudOrOutbox('deleteCard', function() {
    return api.deleteCloudCard(id);
  }, {
    op: 'deleteCard',
    cardId: id,
    dedupeKey: 'deleteCard:' + id,
  });
}

export async function cloudSaveNovel(cardId, bucket) {
  var id = String(cardId || '').trim();
  var data = bucket && (bucket.data != null ? bucket.data : bucket);
  return withCloudOrOutbox('putNovel', function() {
    return api.putNovel(id, data);
  }, {
    op: 'putNovel',
    cardId: id,
    body: { data: data },
    dedupeKey: 'putNovel:' + id,
  });
}

export async function cloudSaveRag(cardId, rag) {
  var id = String(cardId || '').trim();
  var data = rag && (rag.data != null ? rag.data : rag);
  return withCloudOrOutbox('putRag', function() {
    return api.putRag(id, data);
  }, {
    op: 'putRag',
    cardId: id,
    body: { data: data },
    dedupeKey: 'putRag:' + id,
  });
}

export async function cloudSaveAvatar(cardId) {
  var id = String(cardId || '').trim();
  var parts = await readLocalAvatarParts(id);
  if (parts.full) {
    await withCloudOrOutbox('putAvatarFull', function() {
      return api.putAvatar(id, 'full', parts.full.data, parts.full.contentType);
    }, {
      op: 'putAvatar',
      cardId: id,
      body: { kind: 'full', data: parts.full.data, contentType: parts.full.contentType },
      dedupeKey: 'putAvatar:full:' + id,
    });
  }
  if (parts.thumb) {
    await withCloudOrOutbox('putAvatarThumb', function() {
      return api.putAvatar(id, 'thumb', parts.thumb.data, parts.thumb.contentType);
    }, {
      op: 'putAvatar',
      cardId: id,
      body: { kind: 'thumb', data: parts.thumb.data, contentType: parts.thumb.contentType },
      dedupeKey: 'putAvatar:thumb:' + id,
    });
  }
}

export async function cloudSaveStoryCatalog(cardId, catalog) {
  var id = String(cardId || '').trim();
  var list = catalogNovelsList(catalog);
  return withCloudOrOutbox('putStoryCatalog', function() {
    return api.putStoryCatalog(id, list);
  }, {
    op: 'putStoryCatalog',
    cardId: id,
    body: { data: list },
    dedupeKey: 'putStoryCatalog:' + id,
  });
}

export async function cloudSaveStoryNovel(cardId, novel) {
  var id = String(cardId || '').trim();
  if (!novel || !novel.id) return;
  return withCloudOrOutbox('putStoryNovel', function() {
    return api.putStoryNovel(id, novel);
  }, {
    op: 'putStoryNovel',
    cardId: id,
    body: { data: novel },
    dedupeKey: 'putStoryNovel:' + id + ':' + novel.id,
  });
}

export async function cloudSaveStoryActive(cardId, novelId) {
  var id = String(cardId || '').trim();
  return withCloudOrOutbox('putStoryActive', function() {
    return api.putStoryActive(id, novelId);
  }, {
    op: 'putStoryActive',
    cardId: id,
    body: { novelId: novelId },
    dedupeKey: 'putStoryActive:' + id,
  });
}

export async function cloudSaveStoryRelease(cardId, novelId, release) {
  var id = String(cardId || '').trim();
  var nid = String(novelId || '').trim();
  return withCloudOrOutbox('putStoryRelease', function() {
    return api.putStoryRelease(id, nid, release);
  }, {
    op: 'putStoryRelease',
    cardId: id,
    body: { novelId: nid, data: release },
    dedupeKey: 'putStoryRelease:' + id + ':' + nid,
  });
}

export async function cloudRemoveStoryNovel(cardId, novelId) {
  var id = String(cardId || '').trim();
  var nid = String(novelId || '').trim();
  return withCloudOrOutbox('deleteStoryNovel', function() {
    return api.deleteStoryNovel(id, nid);
  }, {
    op: 'deleteStoryNovel',
    cardId: id,
    body: { novelId: nid },
    dedupeKey: 'deleteStoryNovel:' + id + ':' + nid,
  });
}

export async function cloudSavePrefs(kind, data) {
  return withCloudOrOutbox('putPrefs', function() {
    return api.putPrefs(kind, data);
  }, {
    op: 'putPrefs',
    body: { kind: kind, data: data },
    dedupeKey: 'putPrefs:' + kind,
  });
}

async function handleOutboxItem(item) {
  switch (item.op) {
    case 'putCard':
      return api.putCardDraft(item.cardId, item.body && item.body.data);
    case 'putBundle':
      return api.putCardBundle(item.cardId, item.body && item.body.bundle);
    case 'deleteCard':
      return api.deleteCloudCard(item.cardId);
    case 'putNovel':
      return api.putNovel(item.cardId, item.body && item.body.data);
    case 'putRag':
      return api.putRag(item.cardId, item.body && item.body.data);
    case 'putAvatar':
      return api.putAvatar(item.cardId, item.body.kind, item.body.data, item.body.contentType);
    case 'putStoryCatalog':
      return api.putStoryCatalog(item.cardId, item.body && item.body.data);
    case 'putStoryNovel':
      return api.putStoryNovel(item.cardId, item.body && item.body.data);
    case 'putStoryActive':
      return api.putStoryActive(item.cardId, item.body && item.body.novelId);
    case 'putStoryRelease':
      return api.putStoryRelease(item.cardId, item.body && item.body.novelId, item.body && item.body.data);
    case 'deleteStoryNovel':
      return api.deleteStoryNovel(item.cardId, item.body && item.body.novelId);
    case 'putPrefs':
      return api.putPrefs(item.body.kind, item.body.data);
    case 'putDoc':
      return api.putCloudDoc(item.body);
    case 'putSecrets':
      return api.putAiSecretsEnc(item.body.enc, item.body.packageVersion);
    case 'deleteSecrets':
      return api.deleteAiSecretsEnc();
    default:
      console.warn('[cloud] unknown outbox op', item.op);
  }
}

/**
 * 登录后：flush outbox → 拉列表 → 合并本地 → 对仅云端卡写 stub
 * 点开卡时再拉完整 bundle
 */
export async function pullCloudCardIndexAndMerge() {
  var remote = await api.fetchCloudCards();
  var cards = (remote && remote.cards) || [];
  var drafts = readDrafts();
  var changed = false;
  for (var i = 0; i < cards.length; i++) {
    var meta = cards[i];
    if (!meta || !meta.id) continue;
    var existing = drafts[meta.id];
    if (!existing) {
      drafts[meta.id] = {
        draftId: meta.id,
        charName: meta.charName || '（云端）',
        updatedAt: meta.updatedAt || '',
        avatarInIdb: !!meta.avatarInIdb,
        _cloudStub: true,
      };
      changed = true;
    } else if (existing._cloudStub) {
      existing.charName = meta.charName || existing.charName;
      existing.updatedAt = meta.updatedAt || existing.updatedAt;
      changed = true;
    }
  }
  if (changed) writeDrafts(drafts);
  emit('index-merged', { count: cards.length });
  return cards;
}

/** 确保某卡完整数据在本地（stub 或缺失关联时拉 bundle） */
export async function ensureCardBundleLocal(cardId, opts) {
  opts = opts || {};
  var id = String(cardId || '').trim();
  if (!id) return null;
  var drafts = readDrafts();
  var local = drafts[id];
  var need = opts.force || !local || local._cloudStub;
  if (!need && opts.includeRelated) {
    // 轻量探测：无小说桶也不强制；由调用方 force
  }
  if (!need) return local;
  if (!cloudEnabled) return local || null;
  var res = await api.fetchCardBundle(id);
  if (!res || !res.bundle) return local || null;
  await hydrateCardBundleToLocal(res.bundle);
  return readDrafts()[id] || null;
}

/**
 * 全量云端对齐：flush + 索引 +（可选）把本地有而云端无的卡以 bundle 上传
 */
export async function runCloudReconcile(opts) {
  opts = opts || {};
  if (syncing) return { skipped: true, reason: 'busy' };
  syncing = true;
  lastCloudError = null;
  emit('start', {});
  try {
    if (!cloudEnabled && !opts.forceEnable) {
      throw new Error('unauthorized');
    }
    cloudEnabled = true;

    var flushResult = await flushOutbox(handleOutboxItem);

    if (opts.uploadLocal !== false) {
      var drafts = readDrafts();
      var ids = Object.keys(drafts);
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        if (!id || (drafts[id] && drafts[id]._cloudStub)) continue;
        try {
          await api.putCardBundle(id, await buildLocalCardBundle(id));
        } catch (e) {
          console.warn('[cloud] upload local card', id, e);
          enqueueOutbox({
            op: 'putBundle',
            cardId: id,
            body: { bundle: await buildLocalCardBundle(id) },
            dedupeKey: 'putBundle:' + id,
          });
        }
      }
    }

    var cards = await pullCloudCardIndexAndMerge();

    // 对 stub 卡预拉完整 bundle（保证列表点开即可用）；量大时仍可按需
    if (opts.hydrateAll) {
      var drafts2 = readDrafts();
      var keys = Object.keys(drafts2);
      for (var j = 0; j < keys.length; j++) {
        var d = drafts2[keys[j]];
        if (d && d._cloudStub) {
          try {
            await ensureCardBundleLocal(keys[j], { force: true });
          } catch (e) {
            console.warn('[cloud] hydrate', keys[j], e);
          }
        }
      }
    }

    lastCloudAt = new Date().toISOString();
    emit('complete', { at: lastCloudAt, cards: cards.length, flush: flushResult });
    return { ok: true, at: lastCloudAt, cards: cards, flush: flushResult };
  } catch (e) {
    lastCloudError = String(e && e.message || e);
    emit('error', { message: lastCloudError });
    throw e;
  } finally {
    syncing = false;
  }
}

export { buildCardIndexFromDrafts, DOC };
