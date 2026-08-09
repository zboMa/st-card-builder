/**
 * 角色页卡面 gallery（DOM + IDB manifest）
 */
import {
  loadAvatarManifest,
  setGalleryPrimary,
  removeGalleryAvatar,
  MAX_AVATARS_PER_CARD,
} from '../cardAvatarGallery.mjs';
import { publishedAvatarIds } from '../cardVersions.mjs';
import { feedbackFromKind } from '../../ui/appMessage.mjs';

/** @param {object} ctx */
export function createAvatarGalleryController(ctx) {
  var listEl = null;
  var countEl = null;
  var thumbUrls = [];

  function setTip(text, kind) {
    if (!String(text || '').trim()) return;
    feedbackFromKind(ctx, text, kind);
  }

  function revokeThumbUrls() {
    thumbUrls.forEach(function(u) {
      try { URL.revokeObjectURL(u); } catch (e) { /* ignore */ }
    });
    thumbUrls = [];
  }

  async function refreshMainPreview() {
    var avatarImg = ctx.$('avatarImg');
    var avatarPlaceholder = ctx.$('avatarPlaceholder');
    if (!avatarImg || !avatarPlaceholder) return;
    var cardId = ctx.state.draftId;
    if (!cardId) {
      avatarImg.style.display = 'none';
      avatarPlaceholder.style.display = 'block';
      return;
    }
    try {
      await ensureIdbReady();
      if (!window.__avatarIdb__) return;
      var url = await window.__avatarIdb__.loadAvatarFullDataUrl(cardId, ctx.state.activeAvatarId);
      if (url) {
        avatarImg.src = url;
        avatarImg.style.display = 'block';
        avatarPlaceholder.style.display = 'none';
      } else {
        avatarImg.style.display = 'none';
        avatarPlaceholder.style.display = 'block';
      }
    } catch (e) {
      console.warn('[avatar-gallery] preview', e);
    }
  }

  function ensureIdbReady() {
    if (typeof window.__ensureIdbReady__ === 'function') return window.__ensureIdbReady__();
    return window.__idbReady__ ? window.__idbReady__.catch(function() { return null; }) : Promise.resolve(null);
  }

  function saveDraftAfterAvatarChange() {
    if (ctx.panels.cardManager && ctx.panels.cardManager.saveCurrentDraft) {
      ctx.panels.cardManager.saveCurrentDraft();
    } else {
      ctx.sm.saveDraft({ reason: 'avatar' });
    }
    if (ctx.panels.cardManager && ctx.panels.cardManager.updateCardManagerUI) {
      ctx.panels.cardManager.updateCardManagerUI();
    }
  }

  async function setActiveAvatar(avatarId) {
    var cardId = ctx.state.draftId;
    if (!cardId || !avatarId) return;
    await ensureIdbReady();
    await setGalleryPrimary(cardId, avatarId);
    ctx.state.activeAvatarId = avatarId;
    try {
      ctx.sm.patchDraftRecord(cardId, { activeAvatarId: avatarId }, { notify: true });
    } catch (e) {
      saveDraftAfterAvatarChange();
    }
    await refreshAll();
  }

  async function tryRemoveAvatar(avatarId) {
    var cardId = ctx.state.draftId;
    if (!cardId || !avatarId) return;
    var manifest = await loadAvatarManifest(cardId);
    if (manifest.items.length <= 1) {
      setTip('至少保留一张卡面', 'warn');
      return;
    }
    var blocked = publishedAvatarIds({ versions: ctx.state.versions || [] });
    if (blocked.indexOf(avatarId) >= 0) {
      setTip('该卡面已被已发布版本引用，无法删除', 'warn');
      return;
    }
    var ok = window.confirm ? window.confirm('删除这张卡面？仅影响本地 gallery，已上云 blob 仍保留。') : true;
    if (!ok) return;
    try {
      await removeGalleryAvatar(cardId, avatarId, { blockedIds: blocked });
    } catch (e) {
      setTip(e && e.message ? String(e.message) : '无法删除', 'err');
      return;
    }
    if (ctx.state.activeAvatarId === avatarId) {
      var next = manifest.items.find(function(it) { return it.id !== avatarId; });
      ctx.state.activeAvatarId = next && next.id ? next.id : '';
      if (ctx.state.activeAvatarId) {
        await setGalleryPrimary(cardId, ctx.state.activeAvatarId);
      }
      try {
        ctx.sm.patchDraftRecord(cardId, { activeAvatarId: ctx.state.activeAvatarId }, { notify: false });
      } catch (eP) { /* ignore */ }
    }
    setTip('', null);
    saveDraftAfterAvatarChange();
    await refreshAll();
  }

  async function renderGalleryList() {
    if (!listEl) return;
    revokeThumbUrls();
    var cardId = ctx.state.draftId;
    if (!cardId) {
      listEl.innerHTML = '<p class="avatar-gallery__empty ui-empty-tip">请先选择或新建角色卡</p>';
      if (countEl) countEl.textContent = '0/' + MAX_AVATARS_PER_CARD;
      return;
    }
    await ensureIdbReady();
    if (window.__avatarIdb__ && window.__avatarIdb__.maybeMigrateLegacyAvatarToGallery) {
      await window.__avatarIdb__.maybeMigrateLegacyAvatarToGallery(cardId);
    }
    var manifest = await loadAvatarManifest(cardId);
    var items = manifest.items || [];
    if (countEl) countEl.textContent = items.length + '/' + MAX_AVATARS_PER_CARD;
    if (!items.length) {
      listEl.innerHTML = '<p class="avatar-gallery__empty ui-empty-tip">暂无卡面，请上传或 AI 生成</p>';
      return;
    }
    var activeId = String(ctx.state.activeAvatarId || '').trim();
    var published = publishedAvatarIds({ versions: ctx.state.versions || [] });
    var publishedSet = Object.create(null);
    published.forEach(function(id) { publishedSet[id] = true; });

    listEl.innerHTML = '';
    for (var i = 0; i < items.length; i++) {
      (function(item) {
        var tile = document.createElement('div');
        tile.className = 'avatar-gallery__tile-wrap';
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'avatar-gallery__tile' + (item.id === activeId ? ' is-active' : '');
        btn.setAttribute('data-avatar-id', item.id);
        btn.title = item.label || '卡面';
        btn.setAttribute('aria-pressed', item.id === activeId ? 'true' : 'false');
        var ph = document.createElement('span');
        ph.className = 'avatar-gallery__tile-ph';
        ph.textContent = '…';
        btn.appendChild(ph);
        if (publishedSet[item.id]) {
          var pubBadge = document.createElement('span');
          pubBadge.className = 'avatar-gallery__mark is-published';
          pubBadge.textContent = '已发';
          pubBadge.title = '已发布版本引用';
          btn.appendChild(pubBadge);
        }
        if (item.id === activeId) {
          var curBadge = document.createElement('span');
          curBadge.className = 'avatar-gallery__mark is-current';
          curBadge.textContent = '草稿';
          btn.appendChild(curBadge);
        }
        var del = document.createElement('button');
        del.type = 'button';
        del.className = 'btn-inline avatar-gallery__remove';
        del.setAttribute('data-avatar-remove', item.id);
        del.title = '删除卡面';
        del.setAttribute('aria-label', '删除卡面');
        del.textContent = '×';
        tile.appendChild(btn);
        tile.appendChild(del);
        listEl.appendChild(tile);

        window.__avatarIdb__.loadAvatarThumbObjectUrl(cardId, item.id).then(function(url) {
          if (!url || !btn.isConnected) {
            if (url) URL.revokeObjectURL(url);
            return;
          }
          ph.remove();
          var im = document.createElement('img');
          im.src = url;
          im.alt = '';
          btn.insertBefore(im, btn.firstChild);
          thumbUrls.push(url);
        }).catch(function() { /* keep placeholder */ });
      })(items[i]);
    }
  }

  async function refreshAll() {
    await refreshMainPreview();
    await renderGalleryList();
    var cardId = ctx.state.draftId;
    if (charImageInputDisabled && cardId) {
      var manifest = await loadAvatarManifest(cardId);
      charImageInputDisabled(manifest.items.length >= MAX_AVATARS_PER_CARD);
    }
  }

  var charImageInputDisabled = null;

  function bind() {
    listEl = ctx.$('avatarGalleryList');
    countEl = ctx.$('avatarGalleryCount');
    var uploadLabel = ctx.$('charAvatarUploadLabel');

    charImageInputDisabled = function(full) {
      var input = ctx.$('charImageInput');
      if (input) input.disabled = !!full;
      if (uploadLabel) {
        uploadLabel.classList.toggle('is-disabled', !!full);
        uploadLabel.title = full
          ? ('已达上限 ' + MAX_AVATARS_PER_CARD + ' 张')
          : '添加卡面（将嵌入 PNG 导出）';
      }
    };

    if (listEl) {
      listEl.addEventListener('click', function(ev) {
        var removeBtn = ev.target.closest('[data-avatar-remove]');
        if (removeBtn) {
          ev.preventDefault();
          ev.stopPropagation();
          tryRemoveAvatar(removeBtn.getAttribute('data-avatar-remove'));
          return;
        }
        var tile = ev.target.closest('.avatar-gallery__tile');
        if (!tile) return;
        var aid = tile.getAttribute('data-avatar-id');
        if (!aid || aid === ctx.state.activeAvatarId) return;
        setActiveAvatar(aid);
      });
    }

    window.addEventListener('card-draft-changed', function() {
      refreshAll().catch(function(e) { console.warn('[avatar-gallery] refresh', e); });
    });

    refreshAll().catch(function() { /* ignore */ });
  }

  return {
    bind: bind,
    refreshAll: refreshAll,
    refreshMainPreview: refreshMainPreview,
    revokeThumbUrls: revokeThumbUrls,
    setTip: setTip,
    afterAvatarAdded: async function(avatarId) {
      if (avatarId) ctx.state.activeAvatarId = avatarId;
      setTip('', null);
      await refreshAll();
    },
  };
}
