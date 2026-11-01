/**
 * 角色卡管理：由 drafts / ctx.state 组装列表视图快照（无 DOM，可单测）。
 */
import { draftDisplayName, normalizeTags } from '../state.mjs';
import { normalizeCharacterVersion } from '../cardRelease.mjs';
import { getCardShareMeta } from '../cardShareClient.mjs';
import { getCardCloudMeta, resolveCardCloudStatus, resolveCardCloudQuickAction } from '../../sync/cardCloudMeta.mjs';

export function draftTags(d) {
  return normalizeTags((d && (d.charTags || d.tags)) || []);
}

export function collectAllTags(dr) {
  var map = Object.create(null);
  Object.keys(dr || {}).forEach(function (id) {
    draftTags(dr[id]).forEach(function (t) {
      map[t] = (map[t] || 0) + 1;
    });
  });
  return Object.keys(map).sort(function (a, b) {
    return map[b] - map[a] || a.localeCompare(b, 'zh');
  });
}

export function draftMatchesFilters(d, filters) {
  filters = filters || {};
  var selected = filters.selectedTags || [];
  var selectedArr = selected instanceof Set ? Array.from(selected) : selected;
  if (selectedArr.length) {
    var tags = draftTags(d);
    var hit = false;
    selectedArr.forEach(function (t) {
      if (tags.indexOf(t) >= 0) hit = true;
    });
    if (!hit) return false;
  }
  var q = String(filters.query || '').trim().toLowerCase();
  if (q) {
    var name = String(draftDisplayName(d) || '').toLowerCase();
    if (name.indexOf(q) < 0) return false;
  }
  return true;
}

export function buildShareMetaLine(d, meta) {
  var work = normalizeCharacterVersion(d && d.characterVersion);
  var pub = meta && meta.publishedCharacterVersion
    ? ('已发布 ' + meta.publishedCharacterVersion)
    : '未发布';
  var stale = meta && meta.publishedCharacterVersion
    && meta.publishedCharacterVersion !== work
    ? ' · 草稿超前'
    : '';
  var share = meta && meta.token ? ' · 分享中' : '';
  var png = meta && meta.token && meta.pngPublic ? ' · PNG直链' : '';
  return pub + stale + share + png;
}

function resolveCloud(d, id) {
  try {
    return resolveCardCloudStatus(d, getCardCloudMeta(id));
  } catch (e) {
    try {
      return resolveCardCloudStatus(d, null);
    } catch (e2) {
      return 'local_only';
    }
  }
}

/**
 * @param {{
 *   drafts: object,
 *   currentId: string,
 *   state: object,
 *   query?: string,
 *   selectedTags?: Set<string>|string[],
 *   lastExportCheck?: object,
 * }} input
 */
export function buildCardListSnapshot(input) {
  input = input || {};
  var drafts = input.drafts || {};
  var currentId = input.currentId || '';
  var state = input.state || {};
  var selectedTags = input.selectedTags instanceof Set
    ? Array.from(input.selectedTags)
    : (Array.isArray(input.selectedTags) ? input.selectedTags.slice() : []);
  var filters = { query: input.query || '', selectedTags: selectedTags };

  var allIds = Object.keys(drafts);
  var allTags = collectAllTags(drafts);
  var ids = allIds.filter(function (id) {
    return draftMatchesFilters(drafts[id] || {}, filters);
  });
  ids.sort(function (a, b) {
    var ta = String((drafts[a] && drafts[a].updatedAt) || '');
    var tb = String((drafts[b] && drafts[b].updatedAt) || '');
    return tb.localeCompare(ta);
  });

  var check = input.lastExportCheck || {};
  var cards = ids.map(function (id) {
    var d = drafts[id] || {};
    var active = id === currentId;
    var shareMeta = getCardShareMeta(id) || {};
    var avatarId = d.activeAvatarId || (active ? (state.activeAvatarId || '') : '');
    var needsThumb = !d.avatarBase64 && !!(d.activeAvatarId || d.avatarInIdb || (active && state.activeAvatarId));
    var cloudStatus = resolveCloud(d, id);
    var cloudQuick = null;
    try {
      cloudQuick = resolveCardCloudQuickAction(cloudStatus) || null;
    } catch (eQuick) {
      cloudQuick = null;
    }
    return {
      id: id,
      name: draftDisplayName(d),
      updatedAt: d.updatedAt || '—',
      active: active,
      versionLabel: 'v' + normalizeCharacterVersion(d.characterVersion),
      avatarBase64: d.avatarBase64 || '',
      avatarId: avatarId,
      needsThumb: needsThumb,
      cloudStatus: cloudStatus,
      cloudQuick: cloudQuick,
      shareLine: buildShareMetaLine(d, shareMeta),
      stubHint: d._cloudStub ? ' · 云端摘要' : '',
      hasShare: !!shareMeta.token,
      checkBadge: active && check && (check.critical || check.warning)
        ? { critical: check.critical || 0, warning: check.warning || 0 }
        : null,
    };
  });

  return {
    cards: cards,
    totalCount: allIds.length,
    empty: allIds.length === 0,
    filteredEmpty: allIds.length > 0 && cards.length === 0,
    query: filters.query,
    allTags: allTags,
    selectedTags: selectedTags,
  };
}
