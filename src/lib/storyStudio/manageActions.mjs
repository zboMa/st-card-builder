/**
 * Story Studio 管理：CRUD / 增版 / 发布 / 分享（拆自 browserApp）
 */

import {
  normalizeNovel,
  createEmptyNovel,
  upsertCatalogEntry,
  removeCatalogEntry,
} from './state.mjs';
import {
  saveCatalog,
  loadNovel,
  saveNovel,
  deleteNovel,
  saveActiveNovelId,
  saveRelease,
  deleteRelease,
} from './idb.mjs';
import { downloadNovelTxt } from './exportTxt.mjs';
import { buildDisplayVersion, buildReleasePayload } from './version.mjs';
import {
  bumpNovelDraftVersion,
  publishNovelDraft,
  switchNovelDraftVersion,
  listNovelVersions,
  ensureNovelVersions,
  getNovelDisplayVersion,
} from './novelVersions.mjs';
import {
  apiCreateNovelShare,
  apiDeleteNovelShare,
  buildLocalShareUrl,
} from './shareClient.mjs';
import { validatePublishReady } from './branch.mjs';
import { showSsConfirm, showSsPrompt } from './dialogs.mjs';
import {
  state,
  setStatus,
  getCardId,
  getCharacterVersion,
  mirrorStoryDocs,
  persistNovel,
  loadNovelOrPull,
  escapeHtml,
} from './shared.mjs';
import { renderAll } from './renderViews.mjs';

export async function openNovel(novelId) {
  var cardId = getCardId();
  var raw = await loadNovelOrPull(cardId, novelId);
  if (!raw) {
    setStatus('打开失败：找不到小说');
    return;
  }
  state.novel = normalizeNovel(raw);
  await saveActiveNovelId(cardId, novelId);
  setStatus('已打开：' + state.novel.title);
  renderAll();
}

export async function createNovel(opts) {
  opts = opts || {};
  var cardId = getCardId();
  var title = await showSsPrompt({
    icon: '📖',
    title: '新小说标题',
    message: '给这部小说起个名字',
    defaultValue: '未命名小说',
    okText: '创建',
  });
  if (title === null) return;
  var novel = createEmptyNovel({ title: String(title || '').trim() || '未命名小说', cardId: cardId });
  if (opts.wizard) {
    var direction = await showSsPrompt({
      icon: '🧭',
      title: '创作方向',
      message: '向导第一步：写下大致方向（可留空）',
      defaultValue: '',
      select: false,
      okText: '继续',
    });
    if (direction === null) return;
    novel.wizard = {
      step: 'direction',
      direction: String(direction || '').trim(),
      approvedOutline: false,
    };
  }
  state.novel = novel;
  await persistNovel();
  setStatus(opts.wizard ? ('已创建并向导启动：' + novel.title) : ('已创建：' + novel.title));
  renderAll();
  if (opts.wizard) {
    try {
      if (window.__setAppView__) window.__setAppView__('story-outline');
    } catch (e) { /* ignore */ }
  }
}

export async function renameNovel(novelId) {
  var cardId = getCardId();
  var entry = state.catalog.find(function(x) { return x.id === novelId; });
  var next = await showSsPrompt({
    icon: '✏️',
    title: '重命名',
    message: '修改小说标题',
    defaultValue: (entry && entry.title) || '',
    okText: '保存',
  });
  if (next === null) return;
  next = String(next).trim();
  if (!next) return;
  var raw = await loadNovel(cardId, novelId);
  if (!raw) return;
  var novel = normalizeNovel(raw);
  novel.title = next;
  novel.updatedAt = Date.now();
  await saveNovel(cardId, novelId, novel);
  state.catalog = upsertCatalogEntry(state.catalog, novel);
  await saveCatalog(cardId, state.catalog);
  if (state.novel && state.novel.id === novelId) state.novel = novel;
  setStatus('已重命名');
  renderAll();
}

export async function removeNovel(novelId) {
  var okDel = await showSsConfirm({
    icon: '🗑️',
    title: '删除小说？',
    message: '确定删除这部小说？不可恢复。',
    okText: '删除',
    cancelText: '取消',
    danger: true,
  });
  if (!okDel) return;
  var cardId = getCardId();
  var raw = await loadNovel(cardId, novelId);
  var token = raw && raw.shareToken;
  if (token) {
    try { await apiDeleteNovelShare(token); } catch (e) { /* ignore */ }
  }
  await deleteNovel(cardId, novelId);
  try { await deleteRelease(cardId, novelId); } catch (e2) { /* ignore */ }
  try {
    var mod = await import('../sync/storyMirror.mjs');
    await mod.removeStoryNovelFromPouch(cardId, novelId);
  } catch (e3) { /* ignore */ }
  state.catalog = removeCatalogEntry(state.catalog, novelId);
  await saveCatalog(cardId, state.catalog);
  await mirrorStoryDocs(cardId, null, state.catalog);
  if (state.novel && state.novel.id === novelId) {
    state.novel = null;
    await saveActiveNovelId(cardId, '');
  }
  setStatus('已删除');
  renderAll();
}

export async function bumpNovel(novelId) {
  var cardId = getCardId();
  var raw = await loadNovel(cardId, novelId);
  if (!raw) {
    setStatus('增版失败：找不到小说');
    return;
  }
  var novel = normalizeNovel(raw);
  ensureNovelVersions(novel);
  var charVer = getCharacterVersion();
  var r = bumpNovelDraftVersion(novel, charVer);
  await saveNovel(cardId, novelId, novel);
  state.catalog = upsertCatalogEntry(state.catalog, novel);
  await saveCatalog(cardId, state.catalog);
  if (state.novel && state.novel.id === novelId) state.novel = novel;
  await mirrorStoryDocs(cardId, novel, state.catalog);
  setStatus('已增版，草稿现为 ' + r.ver + '（上一版已写入列表，未发布）');
  renderAll();
}

export async function publishNovel(novelId) {
  var cardId = getCardId();
  var raw = await loadNovel(cardId, novelId);
  if (!raw) {
    setStatus('发布失败：找不到小说');
    return;
  }
  var novel = normalizeNovel(raw);
  ensureNovelVersions(novel);
  var check = validatePublishReady(novel);
  if (!check.ok) {
    var okIssues = await showSsConfirm({
      icon: '⚠️',
      title: '发布校验有问题',
      message: '仍要继续发布吗？',
      detail: '- ' + check.issues.join('\n- '),
      okText: '仍要发布',
      cancelText: '取消',
      danger: true,
    });
    if (!okIssues) return;
  }
  var charVer = getCharacterVersion();
  var okPub = await showSsConfirm({
    icon: '📣',
    title: '发布当前草稿？',
    message: '将写入版本列表并标记已发布，随后草稿自动升版。分享 latest 始终指向最新已发版；亦可使用带版本号链接。',
    okText: '发布',
    cancelText: '取消',
  });
  if (!okPub) return;

  var working = JSON.parse(JSON.stringify(novel));
  var pub = publishNovelDraft(working, charVer);
  if (!pub || !pub.ok) {
    setStatus('发布失败：无法写入版本列表');
    return;
  }
  // 用已发布快照的 release（filterReady）再写一份对外
  var release = pub.release;
  if (release && validatePublishReady) {
    try {
      release = buildReleasePayload(Object.assign({}, working, {
        novelVersion: pub.entry.snapshot.novelVersion,
        outline: (pub.entry.snapshot.working && pub.entry.snapshot.working.outline) || working.outline,
        chapters: (pub.entry.snapshot.working && pub.entry.snapshot.working.chapters) || working.chapters,
        branches: (pub.entry.snapshot.working && pub.entry.snapshot.working.branches) || working.branches,
      }), charVer, {
        novelVersion: pub.entry.snapshot.novelVersion || release.novelVersion,
        publishedAt: pub.entry.publishedAt,
        filterReady: true,
      });
      if (pub.entry && pub.entry.snapshot) pub.entry.snapshot.release = release;
    } catch (e) { /* keep unfiltered */ }
  }

  try {
    var mod = await import('../sync/storyMirror.mjs');
    await mod.mirrorReleaseToPouch(cardId, novelId, release);
  } catch (eMirror) {
    setStatus('发布失败（云端）：' + (eMirror.message || eMirror));
    return;
  }

  await saveNovel(cardId, novelId, working);
  await saveRelease(cardId, novelId, release);
  state.catalog = upsertCatalogEntry(state.catalog, working);
  await saveCatalog(cardId, state.catalog);
  if (state.novel && state.novel.id === novelId) state.novel = working;
  await mirrorStoryDocs(cardId, working, state.catalog);
  try {
    var sync = await import('../sync/syncEngine.mjs');
    await sync.runSync({});
    setStatus('已发布 ' + pub.publishedVer + '；草稿现为 ' + pub.draftVer + '（已同步）');
  } catch (e2) {
    setStatus('已发布 ' + pub.publishedVer + '；草稿现为 ' + pub.draftVer + '（同步失败：' + (e2.message || e2) + '）');
  }
  renderAll();
}

export async function switchNovelVersion(novelId, targetVer) {
  var cardId = getCardId();
  var raw = await loadNovel(cardId, novelId);
  if (!raw) return;
  var novel = normalizeNovel(raw);
  var charVer = getCharacterVersion();
  var sw = switchNovelDraftVersion(novel, charVer, targetVer);
  if (!sw.ok) {
    setStatus('切换失败：' + (sw.error || ''));
    return;
  }
  await saveNovel(cardId, novelId, novel);
  state.catalog = upsertCatalogEntry(state.catalog, novel);
  await saveCatalog(cardId, state.catalog);
  if (state.novel && state.novel.id === novelId) state.novel = novel;
  else if (!state.novel || state.novel.id !== novelId) {
    await openNovel(novelId);
    return;
  }
  await mirrorStoryDocs(cardId, novel, state.catalog);
  setStatus('已切换到 ' + targetVer);
  renderAll();
}

export function openNovelVersionMenu(anchorBtn, novelId) {
  document.querySelectorAll('.ss-version-popover').forEach(function(el) { el.remove(); });
  if (!anchorBtn || !novelId) return;
  loadNovel(getCardId(), novelId).then(function(raw) {
    if (!raw) return;
    var novel = normalizeNovel(raw);
    ensureNovelVersions(novel);
    var list = listNovelVersions(novel);
    var charVer = getCharacterVersion();
    var draftVer = getNovelDisplayVersion(novel, charVer);
    var pop = document.createElement('div');
    pop.className = 'ss-version-popover card-version-popover';
    var rows = list.map(function(v) {
      var active = String(v.ver) === String(draftVer);
      return '<button type="button" class="card-version-item' + (active ? ' is-active' : '') + '" data-ss-novel-ver="'
        + escapeHtml(v.ver) + '">'
        + '<span class="card-version-item__ver">v' + escapeHtml(v.ver) + '</span>'
        + '<span class="card-version-item__meta">'
        + (v.published ? '已发布' : '未发布')
        + (active ? ' · 当前草稿' : '')
        + '</span></button>';
    }).join('') || '<div class="card-more-hint">暂无版本。增版或发布后出现。</div>';
    pop.innerHTML = '<div class="card-more-section__title">小说版本</div>' + rows;
    document.body.appendChild(pop);
    var rect = anchorBtn.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.round(rect.right - 280)) + 'px';
    pop.style.top = Math.round(rect.bottom + 6) + 'px';
    pop.addEventListener('click', function(ev) {
      var btn = ev.target.closest('[data-ss-novel-ver]');
      if (!btn) return;
      var ver = btn.getAttribute('data-ss-novel-ver');
      pop.remove();
      switchNovelVersion(novelId, ver);
    });
    setTimeout(function() {
      function close(ev) {
        if (!pop.contains(ev.target) && ev.target !== anchorBtn) {
          pop.remove();
          document.removeEventListener('mousedown', close, true);
        }
      }
      document.addEventListener('mousedown', close, true);
    }, 0);
  });
}

export async function shareNovel(novelId, opts) {
  opts = opts || {};
  var cardId = getCardId();
  var raw = await loadNovel(cardId, novelId);
  if (!raw) {
    setStatus('分享失败：找不到小说');
    return;
  }
  var novel = normalizeNovel(raw);
  if (!novel.publishedDisplayVersion) {
    setStatus('请先「发布」后再分享');
    return;
  }
  var charVer = getCharacterVersion();
  var workVer = buildDisplayVersion(charVer, novel.novelVersion);
  if (novel.publishedDisplayVersion !== workVer) {
    var okAhead = await showSsConfirm({
      icon: '🔗',
      title: '草稿已超前于已发布版',
      message: '当前草稿版号 ' + workVer + ' 已超前于已发布 ' + novel.publishedDisplayVersion
        + '。分享仍只展示已发布版。继续？',
      okText: '继续分享',
      cancelText: '取消',
    });
    if (!okAhead) return;
  }
  var expiresInDays = undefined;
  if (!opts.skipExpirePrompt) {
    var expRaw = await showSsPrompt({
      icon: '⏳',
      title: '链接有效期',
      message: '可选：链接有效天数（留空=不修改过期设置；填 0=永不过期）',
      defaultValue: '',
      select: false,
      okText: '继续',
    });
    if (expRaw === null) return;
    expRaw = String(expRaw).trim();
    if (expRaw === '0') expiresInDays = 0;
    else if (expRaw) {
      expiresInDays = parseInt(expRaw, 10);
      if (!Number.isFinite(expiresInDays) || expiresInDays < 0) {
        setStatus('有效天数无效');
        return;
      }
    }
  }
  setStatus(opts.resetToken ? '重置分享链接…' : '创建分享链接…');
  try {
    try {
      var sync = await import('../sync/syncEngine.mjs');
      await sync.runSync({});
    } catch (e) { /* may be offline login */ }

    var payload = {
      cardId: cardId,
      novelId: novelId,
      token: novel.shareToken || '',
      resetToken: !!opts.resetToken,
    };
    if (expiresInDays === 0) payload.expiresAt = null;
    else if (typeof expiresInDays === 'number' && expiresInDays > 0) {
      payload.expiresInDays = expiresInDays;
    }

    var data = await apiCreateNovelShare(payload);
    novel.shareToken = data.token;
    await saveNovel(cardId, novelId, novel);
    state.catalog = upsertCatalogEntry(state.catalog, novel);
    await saveCatalog(cardId, state.catalog);
    if (state.novel && state.novel.id === novelId) state.novel = novel;
    await mirrorStoryDocs(cardId, novel, state.catalog);

    var url = data.url || data.latestUrl || buildLocalShareUrl(data.token);
    var versionUrl = data.versionUrl
      || (data.displayVersion ? buildLocalShareUrl(data.token, data.displayVersion) : '');
    var copyText = versionUrl && versionUrl !== url
      ? ('最新：' + url + '\n本版：' + versionUrl)
      : url;
    var expireHint = data.expiresAt ? '（到期 ' + data.expiresAt + '）' : '';
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(copyText);
        setStatus(
          versionUrl && versionUrl !== url
            ? ('分享链接已复制 — 最新：' + url + '；本版：' + versionUrl + expireHint)
            : ('分享链接已复制：' + url + expireHint)
        );
      } else {
        await showSsPrompt({
          icon: '🔗',
          title: '复制分享链接',
          message: versionUrl && versionUrl !== url
            ? '请复制下方链接（含最新与本版）'
            : '请复制下方链接',
          defaultValue: copyText,
          multiline: !!(versionUrl && versionUrl !== url),
          rows: 3,
          okText: '关闭',
          cancelText: '关闭',
        });
        setStatus('请复制分享链接');
      }
    } catch (e2) {
      await showSsPrompt({
        icon: '🔗',
        title: '复制分享链接',
        message: versionUrl && versionUrl !== url
          ? '请复制下方链接（含最新与本版）'
          : '请复制下方链接',
        defaultValue: copyText,
        multiline: !!(versionUrl && versionUrl !== url),
        rows: 3,
        okText: '关闭',
        cancelText: '关闭',
      });
      setStatus('请复制分享链接');
    }
    renderAll();
  } catch (err) {
    if (err && err.code === 'no_release') {
      setStatus('云端尚无发布版：请先发布并确保已登录同步');
    } else if (err && err.status === 401) {
      setStatus('请先在「账户与同步」登录后再分享');
    } else {
      setStatus('分享失败：' + (err.message || err));
    }
  }
}

export async function unshareNovel(novelId) {
  var cardId = getCardId();
  var raw = await loadNovel(cardId, novelId);
  if (!raw) return;
  var novel = normalizeNovel(raw);
  if (!novel.shareToken) {
    setStatus('未在分享');
    return;
  }
  var okUnshare = await showSsConfirm({
    icon: '🔗',
    title: '停止分享？',
    message: '停止分享后链接将失效，确定？',
    okText: '停止分享',
    cancelText: '取消',
    danger: true,
  });
  if (!okUnshare) return;
  try {
    await apiDeleteNovelShare(novel.shareToken);
  } catch (e) {
    if (!(e && e.status === 401)) {
      setStatus('停分享失败：' + (e.message || e));
      return;
    }
  }
  novel.shareToken = '';
  await saveNovel(cardId, novelId, novel);
  state.catalog = upsertCatalogEntry(state.catalog, novel);
  await saveCatalog(cardId, state.catalog);
  if (state.novel && state.novel.id === novelId) state.novel = novel;
  await mirrorStoryDocs(cardId, novel, state.catalog);
  setStatus('已停止分享');
  renderAll();
}

export async function exportNovel(novelId) {
  var cardId = getCardId();
  var raw = await loadNovel(cardId, novelId);
  if (!raw) {
    setStatus('导出失败');
    return;
  }
  downloadNovelTxt(normalizeNovel(raw));
  setStatus('已导出 TXT');
}
