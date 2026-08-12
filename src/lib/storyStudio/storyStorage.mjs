/**
 * Story L1 存储：Manifest（Spine）+ 按章 Body 分片（storageSchema 2）
 * SoT：docs/architecture/story-scale.md
 */

import {
  idbGetJson,
  idbSetJson,
  idbDeleteJson,
} from '../idbStore.mjs';
import {
  normalizeNovel,
  createEmptyChapter,
  createEmptyFeedForward,
  genStoryId,
} from './state.mjs';
import {
  storyNovelKey,
  storyChapterKey,
  storyNovelBackupKey,
} from './idb.mjs';

export function chapterContentHash(content) {
  var s = String(content || '');
  var h = 5381;
  for (var i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
  return 'h' + (h >>> 0).toString(36);
}

export function storyVersionChapterKey(cardId, novelId, verSlug, chapterId) {
  var base = storyNovelKey(cardId, novelId);
  var ver = encodeURIComponent(String(verSlug || '').trim());
  var ch = String(chapterId || '').trim();
  if (!base || !ver || !ch) return '';
  return base + ':ver:' + ver + ':ch:' + ch;
}

export var STORAGE_SCHEMA_V2 = 2;
/** 章数 ≤ 此值：打开时 eager 加载全部 Body */
export var EAGER_BODY_LIMIT = 80;
export var CHAPTER_CACHE_MAX = 5;

var session = {
  cardId: '',
  novelId: '',
  /** @type {Map<string, object>} */
  bodies: new Map(),
  dirty: Object.create(null),
};

function resetSession(cardId, novelId) {
  session.cardId = String(cardId || '');
  session.novelId = String(novelId || '');
  session.bodies = new Map();
  session.dirty = Object.create(null);
}

export function isStorageV2(raw) {
  return !!(raw && typeof raw === 'object'
    && Number(raw.storageSchema) >= STORAGE_SCHEMA_V2);
}

export function novelNeedsMigration(raw) {
  if (!raw || typeof raw !== 'object') return false;
  if (isStorageV2(raw)) return false;
  var chapters = Array.isArray(raw.chapters) ? raw.chapters : [];
  if (!chapters.length) return false;
  return chapters.some(function(c) {
    return c && (String(c.content || '').length > 0
      || (c.feedForward && String(c.feedForward.summary || '').length > 0)
      || (c.quality && typeof c.quality === 'object')
      || (Array.isArray(c.checkpoints) && c.checkpoints.length > 0)
      || String(c.advancePrompt || '').length > 0);
  });
}

/** @param {object} ch */
export function extractChapterBody(ch) {
  var c = ch || {};
  var ff = c.feedForward && typeof c.feedForward === 'object' ? c.feedForward : createEmptyFeedForward();
  var out = {
    id: String(c.id || ''),
    content: String(c.content != null ? c.content : ''),
    advancePrompt: String(c.advancePrompt != null ? c.advancePrompt : ''),
    feedForward: {
      summary: String(ff.summary || ''),
      openThreads: Array.isArray(ff.openThreads) ? ff.openThreads.slice() : [],
      tension: typeof ff.tension === 'number' ? ff.tension : 5,
      updatedAt: typeof ff.updatedAt === 'number' ? ff.updatedAt : 0,
    },
    quality: c.quality && typeof c.quality === 'object' ? JSON.parse(JSON.stringify(c.quality)) : null,
    checkpoints: Array.isArray(c.checkpoints) ? c.checkpoints.slice(0, 5) : [],
  };
  if (c.sourceMeta && typeof c.sourceMeta === 'object') {
    out.sourceMeta = JSON.parse(JSON.stringify(c.sourceMeta));
  }
  return out;
}

/** @param {object} stub @param {object} body */
export function mergeBodyIntoChapter(stub, body) {
  var ch = createEmptyChapter(stub);
  if (!body || typeof body !== 'object') {
    ch.__bodyLoaded = false;
    return ch;
  }
  ch.content = String(body.content != null ? body.content : '');
  ch.advancePrompt = String(body.advancePrompt != null ? body.advancePrompt : '');
  if (body.feedForward) ch.feedForward = Object.assign(createEmptyFeedForward(), body.feedForward);
  if (body.quality) ch.quality = JSON.parse(JSON.stringify(body.quality));
  if (Array.isArray(body.checkpoints)) ch.checkpoints = body.checkpoints.slice(0, 5);
  if (body.sourceMeta) ch.sourceMeta = JSON.parse(JSON.stringify(body.sourceMeta));
  ch.__bodyLoaded = true;
  return ch;
}

/** @param {object} ch */
export function chapterToStub(ch) {
  var c = ch || {};
  return {
    id: String(c.id || genStoryId('ch')),
    title: String(c.title != null ? c.title : '未命名章节'),
    summary: String(c.summary != null ? c.summary : ''),
    order: typeof c.order === 'number' ? c.order : 0,
    branchId: String(c.branchId || ''),
    contentLen: String(c.content != null ? c.content : '').length,
    content: '',
    advancePrompt: '',
    feedForward: createEmptyFeedForward(),
    quality: null,
    checkpoints: [],
    __bodyLoaded: false,
  };
}

/**
 * 从完整 novel 拆 Manifest（章为 stub）+ bodies 映射
 * @param {object} novel
 */
export function splitNovelToManifestAndBodies(novel) {
  var n = normalizeNovel(novel);
  var bodies = {};
  n.chapters = (n.chapters || []).map(function(ch) {
    bodies[ch.id] = extractChapterBody(ch);
    return chapterToStub(ch);
  });
  n.storageSchema = STORAGE_SCHEMA_V2;
  n.meta = Object.assign({
    chapterCount: n.chapters.length,
    outlineCount: (n.outline || []).length,
    contentRev: typeof n.meta === 'object' && n.meta.contentRev ? n.meta.contentRev : 0,
  }, n.meta || {});
  n.meta.chapterCount = n.chapters.length;
  n.meta.outlineCount = (n.outline || []).length;
  if (!Array.isArray(n.volumes)) n.volumes = [];
  if (!Array.isArray(n.arcSummaries)) n.arcSummaries = [];
  return { manifest: n, bodies: bodies };
}

function touchSessionBody(chapterId, body) {
  session.bodies.set(String(chapterId), body);
  session.dirty[String(chapterId)] = true;
}

export function markChapterDirty(novel, chapterId) {
  if (!novel || !chapterId) return;
  var ch = (novel.chapters || []).find(function(c) { return c && c.id === chapterId; });
  if (!ch || !ch.__bodyLoaded) return;
  touchSessionBody(chapterId, extractChapterBody(ch));
}

export function isChapterBodyLoaded(ch) {
  return !!(ch && ch.__bodyLoaded);
}

/**
 * @param {string} cardId
 * @param {object} novel
 * @param {string} chapterId
 */
export async function ensureChapterBodyLoaded(cardId, novel, chapterId) {
  var id = String(chapterId || '');
  if (!novel || !id) return null;
  var ch = (novel.chapters || []).find(function(c) { return c && c.id === id; });
  if (!ch) return null;
  if (ch.__bodyLoaded) return ch;

  var cid = String(cardId || novel.cardId || '');
  var nid = String(novel.id || '');
  if (session.cardId === cid && session.novelId === nid && session.bodies.has(id)) {
    var mergedCache = mergeBodyIntoChapter(ch, session.bodies.get(id));
    var idxCache = novel.chapters.findIndex(function(c) { return c && c.id === id; });
    if (idxCache >= 0) novel.chapters[idxCache] = mergedCache;
    return mergedCache;
  }

  var key = storyChapterKey(cid, nid, id);
  var body = key ? await idbGetJson(key) : null;
  if (!body && cid && nid) {
    try {
      var cloudShared = await import('../sync/cloudStoreShared.mjs');
      if (cloudShared.isCloudEnabled && cloudShared.isCloudEnabled()) {
        var cloudStory = await import('../sync/cloudStoreStory.mjs');
        body = await cloudStory.pullStoryChapterToLocal(cid, nid, id);
      }
    } catch (eCloud) { /* ignore */ }
  }
  if (!body) {
    ch.__bodyLoaded = true;
    return ch;
  }
  var merged = mergeBodyIntoChapter(ch, body);
  var idx = novel.chapters.findIndex(function(c) { return c && c.id === id; });
  if (idx >= 0) novel.chapters[idx] = merged;
  if (session.cardId === cid && session.novelId === nid) {
    session.bodies.set(id, body);
  }
  return merged;
}

/**
 * Eager 加载全部章 Body 并合并进 novel
 * @param {string} cardId
 * @param {object} novel
 */
export async function hydrateAllChapterBodies(cardId, novel) {
  if (!novel || !Array.isArray(novel.chapters)) return novel;
  var cid = String(cardId || novel.cardId || '');
  var nid = String(novel.id || '');
  await Promise.all(novel.chapters.map(function(ch) {
    if (!ch || !ch.id) return Promise.resolve();
    return ensureChapterBodyLoaded(cid, novel, ch.id);
  }));
  return novel;
}

async function loadBodiesForNovel(cardId, novelId, chapterIds, eager) {
  var ids = chapterIds.filter(Boolean);
  if (!ids.length) return;
  if (eager) {
    await Promise.all(ids.map(function(chId) {
      return idbGetJson(storyChapterKey(cardId, novelId, chId));
    })).then(function(bodies) {
      bodies.forEach(function(body, i) {
        if (body) session.bodies.set(ids[i], body);
      });
    });
    return;
  }
  // lazy：仅 session 缓存，按需再读
}

/**
 * @param {string} cardId
 * @param {string} novelId
 * @param {{ eager?: boolean }} [opts]
 */
export async function loadNovelDocument(cardId, novelId, opts) {
  var o = opts || {};
  var cid = String(cardId || '').trim();
  var nid = String(novelId || '').trim();
  if (!cid || !nid) return null;

  var key = storyNovelKey(cid, nid);
  var raw = await idbGetJson(key);
  if (!raw) return null;

  if (novelNeedsMigration(raw)) {
    raw = await migrateNovelV1ToV2(cid, nid, raw);
  }

  resetSession(cid, nid);

  var manifest = normalizeNovel(raw);
  if (!isStorageV2(manifest)) {
    // 无正文的新书或极旧数据：仍按 v2 存，内存保持完整
    manifest.storageSchema = STORAGE_SCHEMA_V2;
    manifest.chapters = (manifest.chapters || []).map(function(ch) {
      var full = mergeBodyIntoChapter(ch, extractChapterBody(ch));
      full.__bodyLoaded = true;
      return full;
    });
    if (!manifest.meta) manifest.meta = {};
    manifest.meta.chapterCount = manifest.chapters.length;
    manifest.meta.outlineCount = (manifest.outline || []).length;
    return manifest;
  }

  var chapterIds = (manifest.chapters || []).map(function(c) { return c.id; });
  var eager = o.eager != null
    ? !!o.eager
    : chapterIds.length <= EAGER_BODY_LIMIT;

  if (eager) {
    await loadBodiesForNovel(cid, nid, chapterIds, true);
    manifest.chapters = manifest.chapters.map(function(stub) {
      var body = session.bodies.get(stub.id) || null;
      return mergeBodyIntoChapter(stub, body);
    });
  } else {
    manifest.chapters = manifest.chapters.map(function(stub) {
      return mergeBodyIntoChapter(stub, null);
    });
  }

  if (!Array.isArray(manifest.volumes)) manifest.volumes = [];
  if (!Array.isArray(manifest.arcSummaries)) manifest.arcSummaries = [];

  return manifest;
}

/**
 * @param {string} cardId
 * @param {string} novelId
 * @param {object} novel
 */
export async function saveNovelDocument(cardId, novelId, novel) {
  var cid = String(cardId || '').trim();
  var nid = String(novelId || '').trim();
  if (!cid || !nid || !novel) return false;

  if (session.cardId !== cid || session.novelId !== nid) {
    resetSession(cid, nid);
  }

  var full = normalizeNovel(novel);
  full.storageSchema = STORAGE_SCHEMA_V2;
  var split = splitNovelToManifestAndBodies(full);
  var manifest = split.manifest;
  manifest.updatedAt = Date.now();

  await idbSetJson(storyNovelKey(cid, nid), manifest);

  var saveIds = Object.keys(split.bodies);
  // 懒加载模式下只写 dirty + 已加载章
  if (full.chapters.length > EAGER_BODY_LIMIT) {
    saveIds = saveIds.filter(function(chId) {
      if (session.dirty[chId]) return true;
      var ch = full.chapters.find(function(c) { return c && c.id === chId; });
      return ch && ch.__bodyLoaded;
    });
  }

  await Promise.all(saveIds.map(function(chId) {
    var body = split.bodies[chId];
    if (!body) return Promise.resolve();
    return idbSetJson(storyChapterKey(cid, nid, chId), body);
  }));

  Object.keys(session.dirty).forEach(function(k) { delete session.dirty[k]; });
  return true;
}

/**
 * 云端同步包：Manifest + 需上传的章 Body（Phase E）
 * @param {object} full 内存中的 novel（可含 stub 章）
 */
export function buildCloudSyncPack(full) {
  var novel = normalizeNovel(full);
  var syncIds = {};
  (novel.chapters || []).forEach(function(ch) {
    if (ch && ch.id && ch.__bodyLoaded) syncIds[ch.id] = true;
  });
  Object.keys(session.dirty).forEach(function(chId) {
    syncIds[chId] = true;
  });
  var split = splitNovelToManifestAndBodies(novel);
  var saveIds = Object.keys(split.bodies);
  if ((split.manifest.chapters || []).length > EAGER_BODY_LIMIT) {
    saveIds = saveIds.filter(function(chId) {
      return !!syncIds[chId];
    });
  }
  var chapters = saveIds.map(function(chId) {
    return { id: chId, body: split.bodies[chId] };
  }).filter(function(x) { return x.body; });
  return { manifest: split.manifest, chapters: chapters };
}

/**
 * @param {string} cardId
 * @param {string} novelId
 * @param {object} raw v1 monolith
 */
export async function migrateNovelV1ToV2(cardId, novelId, raw) {
  var cid = String(cardId || '').trim();
  var nid = String(novelId || '').trim();
  var key = storyNovelKey(cid, nid);
  var backupKey = storyNovelBackupKey(cid, nid);

  var full = normalizeNovel(raw);
  full.storageSchema = STORAGE_SCHEMA_V2;
  var split = splitNovelToManifestAndBodies(full);

  try {
    await idbCopyJsonSafe(key, backupKey);
  } catch (e) { /* ignore backup failure */ }

  await idbSetJson(key, split.manifest);
  await Promise.all(Object.keys(split.bodies).map(function(chId) {
    return idbSetJson(storyChapterKey(cid, nid, chId), split.bodies[chId]);
  }));

  resetSession(cid, nid);
  Object.keys(split.bodies).forEach(function(chId) {
    session.bodies.set(chId, split.bodies[chId]);
  });

  return loadNovelDocument(cid, nid, { eager: true });
}

async function idbCopyJsonSafe(fromKey, toKey) {
  if (!fromKey || !toKey) return;
  var data = await idbGetJson(fromKey);
  if (data === null) return;
  await idbSetJson(toKey, data);
}

/**
 * 版本快照：按章写入分片（Phase D）
 */
export async function saveVersionChapterShards(cardId, novelId, verSlug, novel) {
  var cid = String(cardId || '').trim();
  var nid = String(novelId || '').trim();
  var ver = String(verSlug || '').trim();
  if (!cid || !nid || !ver || !novel) return false;
  var split = splitNovelToManifestAndBodies(normalizeNovel(novel));
  await Promise.all(Object.keys(split.bodies).map(function(chId) {
    return idbSetJson(storyVersionChapterKey(cid, nid, ver, chId), split.bodies[chId]);
  }));
  return true;
}

/** 切版：从版本分片灌回 stub 章 */
export async function hydrateVersionWorking(cardId, novelId, verSlug, novel) {
  var cid = String(cardId || '').trim();
  var nid = String(novelId || '').trim();
  var ver = String(verSlug || '').trim();
  if (!novel || !Array.isArray(novel.chapters)) return novel;
  for (var i = 0; i < novel.chapters.length; i++) {
    var stub = novel.chapters[i];
    if (!stub || !stub.id) continue;
    var key = storyVersionChapterKey(cid, nid, ver, stub.id);
    var body = key ? await idbGetJson(key) : null;
    novel.chapters[i] = mergeBodyIntoChapter(stub, body);
  }
  return novel;
}

/** 删除一部小说的全部分片键 */
export async function deleteNovelStorage(cardId, novelId) {
  var cid = String(cardId || '').trim();
  var nid = String(novelId || '').trim();
  if (!cid || !nid) return false;

  var raw = await idbGetJson(storyNovelKey(cid, nid));
  if (raw && Array.isArray(raw.chapters)) {
    await Promise.all(raw.chapters.map(function(ch) {
      if (!ch || !ch.id) return Promise.resolve();
      return idbDeleteJson(storyChapterKey(cid, nid, ch.id)).catch(function() {});
    }));
  }
  await idbDeleteJson(storyNovelBackupKey(cid, nid)).catch(function() {});
  await idbDeleteJson(storyNovelKey(cid, nid));
  if (session.cardId === cid && session.novelId === nid) resetSession('', '');
  return true;
}
