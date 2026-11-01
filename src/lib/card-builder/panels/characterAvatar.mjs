/**
 * 角色设定：头像主图 / 画廊 / IDB 生命周期。
 */
import {
  loadAvatarManifest,
  setGalleryPrimary,
  removeGalleryAvatar,
  loadAvatarFullDataUrl,
  loadAvatarThumbObjectUrl,
  MAX_AVATARS_PER_CARD,
} from '../cardAvatarGallery.mjs';
import { publishedAvatarIds } from '../cardVersions.mjs';
import { genId } from '../state.mjs';
import { shouldBlockImplicitCardCreate, ensureCardCloudIndex } from '../../sync/cardCloudIndex.mjs';
import { getDraftsMapSync } from '../../draftsStore.mjs';
import { setCardKey, markCardDirty } from '../../store/cardStore.mjs';
import { patchAvatar } from '../../store/characterStore.mjs';
import { feedbackFromKind } from '../../ui/appMessage.mjs';

var thumbUrls = [];

function ensureIdbReady() {
  if (typeof window.__ensureIdbReady__ === 'function') return window.__ensureIdbReady__();
  return window.__idbReady__ ? window.__idbReady__.catch(function () { return null; }) : Promise.resolve(null);
}

function cardId(ctx) {
  return String((ctx.state && ctx.state.draftId) || '').trim();
}

function revokeThumbUrls() {
  thumbUrls.forEach(function (url) {
    try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
  });
  thumbUrls = [];
}

function setTip(ctx, text, kind) {
  feedbackFromKind(ctx, text, kind);
}

function emptyAvatar(hasDraft) {
  return {
    mainUrl: '',
    items: [],
    count: 0,
    max: MAX_AVATARS_PER_CARD,
    full: false,
    loading: false,
    hasDraft: !!hasDraft,
    emptyText: hasDraft ? '暂无卡面，请上传或 AI 生成' : '请先选择或新建角色卡',
  };
}

export async function refreshAvatars(ctx) {
  revokeThumbUrls();
  var id = cardId(ctx);
  if (!id) {
    patchAvatar(emptyAvatar(false));
    return;
  }
  patchAvatar({ loading: true, hasDraft: true, emptyText: '' });
  try {
    await ensureIdbReady();
    if (window.__avatarIdb__ && window.__avatarIdb__.maybeMigrateLegacyAvatarToGallery) {
      await window.__avatarIdb__.maybeMigrateLegacyAvatarToGallery(id);
    }
    var manifest = await loadAvatarManifest(id);
    var items = manifest.items || [];
    var activeId = String(ctx.state.activeAvatarId || '').trim();
    var published = publishedAvatarIds({ versions: ctx.state.versions || [] });
    var publishedSet = Object.create(null);
    published.forEach(function (aid) { publishedSet[aid] = true; });

    var mainUrl = '';
    if (items.length) {
      mainUrl = await loadAvatarFullDataUrl(id, activeId).catch(function () { return ''; });
    }
    var rows = await Promise.all(items.map(async function (item) {
      var url = await loadAvatarThumbObjectUrl(id, item.id).catch(function () { return ''; });
      if (url) thumbUrls.push(url);
      return {
        id: item.id,
        label: item.label || '',
        url: url,
        current: item.id === activeId,
        published: !!publishedSet[item.id],
        primary: !!item.primary,
      };
    }));
    patchAvatar({
      mainUrl: mainUrl,
      items: rows,
      count: items.length,
      max: MAX_AVATARS_PER_CARD,
      full: items.length >= MAX_AVATARS_PER_CARD,
      loading: false,
      hasDraft: true,
      emptyText: items.length ? '' : '暂无卡面，请上传或 AI 生成',
    });
  } catch (e) {
    console.warn('[avatar-gallery] refresh', e);
    patchAvatar({ loading: false, hasDraft: true, emptyText: '卡面加载失败' });
  }
}

export async function setActiveAvatar(ctx, avatarId) {
  var id = cardId(ctx);
  var aid = String(avatarId || '').trim();
  if (!id || !aid || aid === ctx.state.activeAvatarId) return;
  await ensureIdbReady();
  await setGalleryPrimary(id, aid);
  setCardKey('activeAvatarId', aid);
  try {
    ctx.sm.patchDraftRecord(id, { activeAvatarId: aid }, { notify: true });
  } catch (e) {
    ctx.sm.saveDraft({ reason: 'avatar' });
  }
  await refreshAvatars(ctx);
}

export async function removeAvatar(ctx, avatarId) {
  var id = cardId(ctx);
  var aid = String(avatarId || '').trim();
  if (!id || !aid) return;
  var manifest = await loadAvatarManifest(id);
  if (manifest.items.length <= 1) {
    setTip(ctx, '至少保留一张卡面', 'warn');
    return;
  }
  var blocked = publishedAvatarIds({ versions: ctx.state.versions || [] });
  if (blocked.indexOf(aid) >= 0) {
    setTip(ctx, '该卡面已被已发布版本引用，无法删除', 'warn');
    return;
  }
  var ok = window.confirm ? window.confirm('删除这张卡面？不影响本卡画廊以外的 blob 引用。') : true;
  if (!ok) return;
  try {
    await removeGalleryAvatar(id, aid, { blockedIds: blocked });
  } catch (e) {
    setTip(ctx, e && e.message ? String(e.message) : '无法删除', 'err');
    return;
  }
  if (ctx.state.activeAvatarId === aid) {
    var next = manifest.items.find(function (it) { return it.id !== aid; });
    var nextId = next && next.id ? next.id : '';
    setCardKey('activeAvatarId', nextId);
    if (nextId) await setGalleryPrimary(id, nextId);
    try {
      ctx.sm.patchDraftRecord(id, { activeAvatarId: nextId }, { notify: false });
    } catch (eP) { /* ignore */ }
  }
  saveAfterAvatarChange(ctx);
  await refreshAvatars(ctx);
}

function saveAfterAvatarChange(ctx) {
  if (ctx.panels.cardManager && ctx.panels.cardManager.saveCurrentDraft) {
    ctx.panels.cardManager.saveCurrentDraft({ reason: 'avatar' });
  } else {
    ctx.sm.saveDraft({ reason: 'avatar' });
  }
  if (ctx.panels.cardManager && ctx.panels.cardManager.updateCardManagerUI) {
    ctx.panels.cardManager.updateCardManagerUI();
  }
}

async function ensureDraftForAvatar(ctx) {
  if (ctx.state.draftId) return;
  var drafts0 = getDraftsMapSync() || {};
  if (shouldBlockImplicitCardCreate(drafts0)) {
    try { await ensureCardCloudIndex(); } catch (e) { /* ignore */ }
    drafts0 = getDraftsMapSync() || {};
    var keys0 = Object.keys(drafts0);
    if (keys0.length > 0) {
      var pick = keys0[0];
      ctx.sm.loadDraftIntoState(pick);
      if (drafts0[pick] && drafts0[pick]._cloudStub) {
        try {
          var syncAv = await import('../../sync/index.mjs');
          if (syncAv.ensureCardBundleLocal) {
            await syncAv.ensureCardBundleLocal(pick, { force: true });
            ctx.sm.loadDraftIntoState(pick);
          }
        } catch (eBundle) { /* ignore */ }
      }
    }
  }
  if (!ctx.state.draftId) {
    if (shouldBlockImplicitCardCreate(getDraftsMapSync() || {})) {
      setTip(ctx, '移动卡列表加载中，请稍后重试上传头像', 'warn');
      return false;
    }
    setCardKey('draftId', genId());
  }
  return !!ctx.state.draftId;
}

export async function applyAvatarFromImage(ctx, img) {
  if (!(await ensureDraftForAvatar(ctx))) return false;
  try {
    await ensureIdbReady();
    if (!window.__avatarIdb__) throw new Error('IndexedDB 不可用');
  } catch (eReady) {
    setTip(ctx, '头像保存失败：' + (eReady && eReady.message ? eReady.message : eReady), 'err');
    return false;
  }
  try {
    var avatarId = await window.__avatarIdb__.saveAvatarFromImage(ctx.state.draftId, img);
    if (avatarId) setCardKey('activeAvatarId', avatarId);
    ctx.sm.saveDraft({ reason: 'avatar' });
    markCardDirty();
    await refreshAvatars(ctx);
    return true;
  } catch (e) {
    if (e && e.message === 'avatar_gallery_full') {
      setTip(ctx, '已超过 ' + MAX_AVATARS_PER_CARD + ' 张', 'warn');
      return false;
    }
    setTip(ctx, '头像保存失败：' + (e && e.message ? e.message : e), 'err');
    return false;
  }
}

export function applyAvatarDataUrl(ctx, dataUrl) {
  return new Promise(function (resolve, reject) {
    var img = new Image();
    img.onload = function () {
      applyAvatarFromImage(ctx, img).then(resolve, reject);
    };
    img.onerror = function () { reject(new Error('图片解码失败')); };
    img.src = dataUrl;
  });
}

export function uploadAvatarFile(ctx, file) {
  return new Promise(function (resolve, reject) {
    if (!file) { resolve(false); return; }
    var reader = new FileReader();
    reader.onload = function (ev) {
      var img = new Image();
      img.onload = function () {
        applyAvatarFromImage(ctx, img).then(resolve, reject);
      };
      img.onerror = function () { reject(new Error('图片解码失败')); };
      img.src = ev.target.result;
    };
    reader.onerror = function () { reject(reader.error || new Error('读取文件失败')); };
    reader.readAsDataURL(file);
  });
}

export function revokeAvatarUrls() {
  revokeThumbUrls();
}
