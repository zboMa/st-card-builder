/**
 * 云端存储桥：本地权威缓存（LS/IDB）+ 登录后 REST 存取 + 离线 outbox
 * 卡 / Story / 偏好实现已拆至 cloudStoreCard / cloudStoreStory / cloudStorePrefs。
 */
import { flushOutbox, enqueueOutbox } from './outbox.mjs';
import * as api from './cloudApi.mjs';
import {
  onCloudEvent,
  setCloudEnabled,
  isCloudEnabled,
  getCloudStatus,
  emit,
  readDrafts,
  handleOutboxItem,
  markCloudSyncedAt,
  setCloudError,
  setSyncing,
} from './cloudStoreShared.mjs';
import {
  buildLocalCardBundle,
  hydrateCardBundleToLocal,
  pullCloudCardIndexAndMerge,
  ensureCardBundleLocal,
} from './cloudStoreCard.mjs';

export {
  onCloudEvent,
  setCloudEnabled,
  isCloudEnabled,
  getCloudStatus,
} from './cloudStoreShared.mjs';

export {
  buildLocalCardBundle,
  hydrateCardBundleToLocal,
  cloudSaveCard,
  cloudSaveCardBundle,
  cloudDeleteCard,
  cloudDeleteRemoteOnly,
  cloudUploadOverwrite,
  cloudDownloadOverwrite,
  cloudSaveNovel,
  cloudSaveRag,
  cloudSaveAvatar,
  pullCloudCardIndexAndMerge,
  ensureCardBundleLocal,
} from './cloudStoreCard.mjs';

export {
  cloudSaveStoryCatalog,
  cloudSaveStoryNovel,
  cloudSaveStoryActive,
  cloudSaveStoryRelease,
  cloudRemoveStoryNovel,
  pullStoryCatalogToLocal,
  pullStoryNovelToLocal,
} from './cloudStoreStory.mjs';

export { cloudSavePrefs } from './cloudStorePrefs.mjs';

export { buildCardIndexFromDrafts, DOC } from './cloudStoreShared.mjs';

/**
 * 全量云端对齐：flush + 索引 +（可选）把本地有而云端无的卡以 bundle 上传
 */
export async function runCloudReconcile(opts) {
  opts = opts || {};
  var status = getCloudStatus();
  if (status.syncing) return { skipped: true, reason: 'busy' };
  setSyncing(true);
  setCloudError(null);
  emit('start', {});
  try {
    if (!isCloudEnabled() && !opts.forceEnable) {
      throw new Error('unauthorized');
    }
    setCloudEnabled(true);

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

    var at = new Date().toISOString();
    markCloudSyncedAt(at);
    emit('complete', { at: at, cards: cards.length, flush: flushResult });
    return { ok: true, at: at, cards: cards, flush: flushResult };
  } catch (e) {
    setCloudError(String(e && e.message || e));
    emit('error', { message: String(e && e.message || e) });
    throw e;
  } finally {
    setSyncing(false);
  }
}
