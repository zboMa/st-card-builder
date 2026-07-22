/**
 * 卡片管理：PublishShare（拆自 cardManager）
 */

import { DRAFTS_KEY, buildDraftSnapshot, buildCardJSONFromDraft, draftDisplayName } from '../state.mjs';
import { createTextChunk, deepCopy } from '../../utils.mjs';
import { normalizeCharacterVersion } from '../cardRelease.mjs';
import { apiPublishCard, apiCreateCardShare, apiDeleteCardShare, getCardShareMeta, setCardShareMeta, clearCardShareToken } from '../cardShareClient.mjs';
import { publishCardDraft, bumpCardDraftVersion, switchCardDraftVersion, listCardVersions, ensureCardVersions } from '../cardVersions.mjs';

/** @param {object} ctx @param {object} s @param {object} panel */
export function attachCardManagerPublishShare(ctx, s, panel) {
  // ---- PNG bytes for publish ----
  /** @param {string} id
   *  @param {{ cardJson?: object }} [opts] 若给 cardJson 则嵌入该 JSON（用于已发版，避免草稿版号污染）
   */
  panel.buildPngBase64ForDraft = async function (id, opts) {
    opts = opts || {};
    var json = opts.cardJson || null;
    var avatar;
    var currentId = s.getCurrentDraftId();
    if (id === currentId) {
      if (!json) {
        panel.saveCurrentDraft();
        json = buildCardJSONFromDraft(ctx.state);
      }
      if (ctx.state.avatarInIdb) {
        await s.ensureIdbReady();
        avatar = window.__avatarIdb__
          ? await window.__avatarIdb__.loadAvatarFullDataUrl(id)
          : '';
      } else {
        avatar = ctx.state.avatarBase64;
      }
    } else {
      var d = s.getAllDrafts()[id];
      if (!d) return null;
      if (!json) json = buildCardJSONFromDraft(d);
      if (d.avatarInIdb) {
        await s.ensureIdbReady();
        avatar = window.__avatarIdb__
          ? await window.__avatarIdb__.loadAvatarFullDataUrl(id)
          : '';
      } else {
        avatar = d.avatarBase64 || '';
      }
    }
    if (!avatar || !json) return null;
    var ch = createTextChunk('chara', JSON.stringify(json));
    var raw = atob(avatar.split(',')[1]);
    var bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    var io = bytes.length - 12;
    var bef = bytes.slice(0, io);
    var ie = bytes.slice(io);
    var fin = new Uint8Array(bef.length + ch.length + ie.length);
    fin.set(bef, 0);
    fin.set(ch, bef.length);
    fin.set(ie, bef.length + ch.length);
    var bin = '';
    for (var j = 0; j < fin.length; j++) bin += String.fromCharCode(fin[j]);
    return btoa(bin);
  };

  // ---- Publish / Share ----
  panel.publishDraft = async function (id) {
    if (!id) return;
    var currentId = s.getCurrentDraftId();
    if (id === currentId) panel.saveCurrentDraft();
    var all = s.getAllDrafts();
    var stored = all[id];
    if (id !== currentId && !stored) {
      s.setCardManagerStatus('找不到该角色卡', true);
      return;
    }
    var d = id === currentId
      ? Object.assign({}, buildDraftSnapshot(ctx.state), { draftId: id })
      : Object.assign({}, stored, { draftId: id });
    ensureCardVersions(d);

    var okPublish = await ctx.showConfirmDialog({
      icon: '📣',
      title: '发布角色卡？',
      message: '将把当前草稿写入版本列表并标记为已发布，然后草稿自动升小版本。',
      detail: '分享 latest 指向最新已发版；亦可使用带版本号的链接。保存草稿不会写入版本列表。',
      okText: '发布',
      cancelText: '取消',
    });
    if (!okPublish) return;

    var withPng = false;
    if (d.avatarInIdb || d.avatarBase64 || (id === currentId && (ctx.state.avatarInIdb || ctx.state.avatarBase64))) {
      withPng = !!(await ctx.showConfirmDialog({
        icon: '🖼️',
        title: '同时上传 PNG？',
        message: '上传嵌入角色数据的 PNG（开启「PNG 直链」分享时需要）。',
        okText: '上传 PNG',
        cancelText: '仅 JSON',
      }));
    }

    // 发布事务：先算结果，云成功后再落盘；失败回滚本地
    var before = deepCopy(stored || (id === currentId ? buildDraftSnapshot(ctx.state) : null) || d);
    var working = deepCopy(d);
    var pub = publishCardDraft(working);
    if (!pub || !pub.ok) {
      s.setCardManagerStatus('发布失败：无法写入版本列表', true);
      return;
    }

    s.setCardManagerStatus('正在发布 v' + pub.publishedVer + '…');
    try {
      var pngBase64 = null;
      if (withPng) {
        pngBase64 = await panel.buildPngBase64ForDraft(id, { cardJson: pub.cardJson });
        if (!pngBase64) {
          s.setCardManagerStatus('无头像，已跳过 PNG；仍发布 JSON', true);
        }
      }
      var data = await apiPublishCard({
        cardId: id,
        cardJson: pub.cardJson,
        characterVersion: pub.publishedVer,
        title: pub.title,
        pngEnabled: !!(withPng && pngBase64),
        pngBase64: pngBase64,
      });
      // 云成功后再写本地
      all[id] = working;
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(all));
      if (id === currentId) {
        ctx.state.characterVersion = working.characterVersion;
        ctx.state.versions = working.versions;
        ctx.state.updatedAt = working.updatedAt || ctx.state.updatedAt;
        var verEl = ctx.$('characterVersion');
        if (verEl) verEl.value = working.characterVersion;
      }
      try {
        var mirror = await import('../../sync/cardMirror.mjs');
        await mirror.mirrorCardReleaseToPouch(id, {
          characterVersion: data.characterVersion,
          title: pub.title,
          publishedAt: data.publishedAt,
          pngEnabled: !!(withPng && pngBase64),
          cardJson: pub.cardJson,
        });
      } catch (e) { console.warn('[cardShare] mirror', e); }
      setCardShareMeta(id, {
        publishedCharacterVersion: data.characterVersion,
        publishedAt: data.publishedAt,
        title: pub.title,
      });
      s.setCardManagerStatus('已发布 v' + data.characterVersion
        + '；草稿现为 v' + pub.draftVer
        + (data.pngStored ? '（含 PNG）' : ''));
      panel.updateCardManagerUI();
    } catch (err) {
      // 回滚：不保留本地假「已发」
      all[id] = before;
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(all));
      if (id === currentId) {
        ctx.state.characterVersion = before.characterVersion;
        ctx.state.versions = before.versions || [];
        var verEl2 = ctx.$('characterVersion');
        if (verEl2) verEl2.value = before.characterVersion || '1.0';
      }
      if (err && err.status === 401) {
        s.setCardManagerStatus('请先在「账户与同步」登录后再发布', true);
      } else {
        s.setCardManagerStatus('发布失败：' + (err.message || err), true);
      }
      panel.updateCardManagerUI();
    }
  };

  panel.shareDraft = async function (id, opts) {
    opts = opts || {};
    if (!id) return;
    var meta = getCardShareMeta(id) || {};
    if (!meta.publishedCharacterVersion) {
      s.setCardManagerStatus('请先「发布」角色卡版本后再分享', true);
      return;
    }
    var currentId = s.getCurrentDraftId();
    if (id === currentId) panel.saveCurrentDraft();
    var d = id === currentId ? buildDraftSnapshot(ctx.state, id) : s.getAllDrafts()[id];
    var work = s.draftWorkVersion(d || {});
    if (meta.publishedCharacterVersion !== work) {
      var cont = await ctx.showConfirmDialog({
        icon: '⚠️',
        title: '工作版已超前',
        message: '当前工作版 ' + work + ' 已超前于已发布 ' + meta.publishedCharacterVersion + '。',
        detail: '分享仍只展示已发布版。是否继续？',
        okText: '继续分享',
        cancelText: '取消',
      });
      if (!cont) return;
    }

    var passRaw = await ctx.showPromptDialog({
      icon: '🔒',
      title: '分享访问密码',
      message: '可选。留空=不修改；填 clear=清除密码。查看信息/JSON 需登录同账号并校验此密码。',
      defaultValue: '',
      placeholder: '留空不修改',
      okText: '下一步',
      cancelText: '取消',
      select: false,
    });
    if (passRaw === null) return;

    var pngAns = await ctx.showConfirmDialog({
      icon: '🖼️',
      title: '开启 PNG 直链？',
      message: '开启后：持链接可不登录直接下载最新 PNG（内含完整卡数据）。信息页与 JSON 仍需登录。',
      okText: '开启',
      cancelText: '不开',
    });

    var expRaw = await ctx.showPromptDialog({
      icon: '⏳',
      title: '链接有效天数',
      message: '可选。留空=不修改；填 0=永不过期。',
      defaultValue: '',
      placeholder: '留空不修改',
      okText: '创建分享',
      cancelText: '取消',
      select: false,
    });
    if (expRaw === null) return;

    s.setCardManagerStatus(opts.resetToken ? '重置分享链接…' : '创建分享链接…');
    try {
      var payload = {
        cardId: id,
        token: meta.token || '',
        resetToken: !!opts.resetToken,
        pngPublic: !!pngAns,
      };
      var pass = String(passRaw).trim();
      if (pass.toLowerCase() === 'clear') payload.clearPassword = true;
      else if (pass) payload.password = pass;

      expRaw = String(expRaw).trim();
      if (expRaw === '0') payload.expiresAt = null;
      else if (expRaw) {
        var days = parseInt(expRaw, 10);
        if (!Number.isFinite(days) || days < 0) {
          s.setCardManagerStatus('有效天数无效', true);
          return;
        }
        if (days > 0) payload.expiresInDays = days;
      }

      var data = await apiCreateCardShare(payload);
      setCardShareMeta(id, {
        token: data.token,
        infoUrl: data.infoUrl,
        pngUrl: data.pngUrl || null,
        pngPublic: !!data.pngPublic,
        hasPassword: !!data.hasPassword,
        publishedCharacterVersion: data.characterVersion || meta.publishedCharacterVersion,
        title: data.title || meta.title,
      });
      var url = data.infoUrl || '';
      if (url) {
        var okCopy = await s.copyTextWithFallback(url, '复制分享信息链接');
        if (okCopy) {
          s.setCardManagerStatus('分享信息链接已复制：' + url
            + (data.pngPublic && data.pngUrl ? '；PNG：' + data.pngUrl : '')
            + (data.hasPassword ? '（需密码）' : ''));
        } else {
          s.setCardManagerStatus('请复制分享链接');
        }
      } else {
        s.setCardManagerStatus('请复制分享链接');
      }
      panel.updateCardManagerUI();
    } catch (err) {
      if (err && err.code === 'no_release') {
        s.setCardManagerStatus('云端尚无发布版：请先发布并确保已登录', true);
      } else if (err && err.status === 401) {
        s.setCardManagerStatus('请先在「账户与同步」登录后再分享', true);
      } else {
        s.setCardManagerStatus('分享失败：' + (err.message || err), true);
      }
    }
  };

  panel.copyShareLink = async function (id) {
    var meta = getCardShareMeta(id) || {};
    if (!meta.token || !meta.infoUrl) {
      s.setCardManagerStatus('尚未创建分享链接', true);
      return;
    }
    var okCopy = await s.copyTextWithFallback(meta.infoUrl, '复制分享信息链接');
    if (okCopy) {
      s.setCardManagerStatus('已复制：' + meta.infoUrl
        + (meta.pngUrl ? '（另有 PNG 直链）' : ''));
    }
  };

  panel.unshareDraft = async function (id) {
    var meta = getCardShareMeta(id) || {};
    if (!meta.token) {
      s.setCardManagerStatus('未在分享', true);
      return;
    }
    var okUnshare = await ctx.showConfirmDialog({
      icon: '🔗',
      title: '停止分享？',
      message: '停止分享后链接将失效。',
      okText: '停分享',
      cancelText: '取消',
    });
    if (!okUnshare) return;
    try {
      await apiDeleteCardShare(meta.token);
    } catch (e) {
      if (!(e && e.status === 401)) {
        s.setCardManagerStatus('停分享失败：' + (e.message || e), true);
        return;
      }
    }
    clearCardShareToken(id);
    s.setCardManagerStatus('已停止分享');
    panel.updateCardManagerUI();
  };
  return panel;
}
