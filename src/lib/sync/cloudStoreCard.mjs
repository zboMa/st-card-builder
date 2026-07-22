/**
 * 云端存储：卡包 / 草稿 / 头像 / 工坊（拆自 cloudStore）
 */
import * as api from './cloudApi.mjs';
import { enqueueOutbox } from './outbox.mjs';
import {
  idbGetJson,
  idbSetJson,
  idbSetBlob,
  idbNovelKey,
  idbAvatarFullKey,
  idbAvatarThumbKey,
} from '../idbStore.mjs';
import {
  emit,
  withCloudOrOutbox,
  readDrafts,
  writeDrafts,
  base64ToBlob,
  readLocalAvatarParts,
  isCloudEnabled,
} from './cloudStoreShared.mjs';

export async function buildLocalCardBundle(cardId) {
  var id = String(cardId || '').trim();
  var drafts = readDrafts();
  var draft = drafts[id] || null;
  var novelRec = await idbGetJson(idbNovelKey(id)).catch(function() { return null; });
  var ragRec = await idbGetJson('novelRagV1:card:' + id).catch(function() { return null; });
  var avatar = await readLocalAvatarParts(id);
  return {
    card: draft,
    avatar: avatar,
    novel: novelRec,
    rag: ragRec,
  };
}

/**
 * 将云端卡包灌回 LS + IDB（开卡：工坊与卡一套）
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

  emit('bundle-hydrated', { cardId: id });
  return true;
}
export async function cloudSaveCard(cardId, draft) {
  var id = String(cardId || '').trim();
  if (!id || !draft) return;
  var out = await withCloudOrOutbox('putCard', function() {
    return api.putCardDraft(id, draft);
  }, {
    op: 'putCard',
    cardId: id,
    body: { data: draft },
    dedupeKey: 'putCard:' + id,
  });
  if (out && !out.queued) {
    try {
      var { markCardSynced } = await import('./cardCloudMeta.mjs');
      markCardSynced(id, draft.updatedAt, draft.updatedAt);
    } catch (e) { /* ignore */ }
  } else if (out && out.queued) {
    try {
      var metaMod = await import('./cardCloudMeta.mjs');
      metaMod.setCardCloudMeta(id, { pendingUpload: true, onCloud: !!(metaMod.getCardCloudMeta(id) || {}).onCloud });
    } catch (e2) { /* ignore */ }
  }
  return out;
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

export async function cloudDeleteCard(cardId, opts) {
  opts = opts || {};
  var id = String(cardId || '').trim();
  if (!id) return;
  var deleteStories = !!opts.deleteStories;
  return withCloudOrOutbox('deleteCard', function() {
    return api.deleteCloudCard(id, { deleteStories: deleteStories });
  }, {
    op: 'deleteCard',
    cardId: id,
    body: { deleteStories: deleteStories },
    dedupeKey: 'deleteCard:' + id,
  });
}

/** 仅删云端（默认不删 Story）；保留本地草稿 */
export async function cloudDeleteRemoteOnly(cardId, opts) {
  opts = opts || {};
  var id = String(cardId || '').trim();
  if (!id) return;
  if (!isCloudEnabled()) throw new Error('unauthorized');
  await api.deleteCloudCard(id, {
    deleteStories: opts.deleteStories === true,
  });
  var { markCardLocalOnly } = await import('./cardCloudMeta.mjs');
  markCardLocalOnly(id);
  emit('cloud-deleted', { cardId: id });
  return { ok: true, cardId: id };
}

/** 上传本地卡包覆盖云端 */
export async function cloudUploadOverwrite(cardId) {
  var id = String(cardId || '').trim();
  if (!id) return;
  if (!isCloudEnabled()) throw new Error('unauthorized');
  var bundle = await buildLocalCardBundle(id);
  if (!bundle.card) throw new Error('no_local_card');
  await api.putCardBundle(id, bundle);
  var { markCardSynced } = await import('./cardCloudMeta.mjs');
  var localAt = bundle.card && bundle.card.updatedAt;
  markCardSynced(id, localAt, localAt);
  emit('cloud-uploaded', { cardId: id });
  return { ok: true, cardId: id };
}

/** 拉取云端卡包覆盖本地 */
export async function cloudDownloadOverwrite(cardId) {
  var id = String(cardId || '').trim();
  if (!id) return;
  if (!isCloudEnabled()) throw new Error('unauthorized');
  var res = await api.fetchCardBundle(id);
  if (!res || !res.bundle || !res.bundle.card) throw new Error('not_found');
  await hydrateCardBundleToLocal(res.bundle);
  var { markCardSynced } = await import('./cardCloudMeta.mjs');
  var cloudAt = res.bundle.card.updatedAt
    || (res.bundle.card.data && res.bundle.card.data.updatedAt)
    || null;
  var drafts = readDrafts();
  var localAt = drafts[id] && drafts[id].updatedAt;
  markCardSynced(id, cloudAt, localAt);
  emit('cloud-downloaded', { cardId: id });
  return { ok: true, cardId: id, draft: drafts[id] };
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
  try {
    var { mergeCloudIndexIntoMeta } = await import('./cardCloudMeta.mjs');
    mergeCloudIndexIntoMeta(cards);
  } catch (e) { /* ignore */ }
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
  if (!need) return local;
  if (!isCloudEnabled()) return local || null;
  var res = await api.fetchCardBundle(id);
  if (!res || !res.bundle) return local || null;
  await hydrateCardBundleToLocal(res.bundle);
  try {
    var { markCardSynced } = await import('./cardCloudMeta.mjs');
    var cloudAt = res.bundle.card && (res.bundle.card.updatedAt
      || (res.bundle.card.data && res.bundle.card.data.updatedAt));
    var after = readDrafts()[id];
    markCardSynced(id, cloudAt, after && after.updatedAt);
  } catch (e) { /* ignore */ }
  return readDrafts()[id] || null;
}
