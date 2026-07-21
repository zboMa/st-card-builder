/**
 * 小说版号：displayVersion = {character_version}-{novelVersion}
 * 仅用户主动增版；不用时间/同步时间当版本。
 */

export function normalizeCharacterVersion(raw) {
  var s = String(raw == null ? '' : raw).trim();
  return s || '1.0';
}

export function normalizeNovelVersion(raw) {
  var s = String(raw == null ? '' : raw).trim();
  if (!s) return '1';
  return s;
}

/** 完整展示版号：卡版本-小说版本，如 1.2-3 */
export function buildDisplayVersion(characterVersion, novelVersion) {
  return normalizeCharacterVersion(characterVersion) + '-' + normalizeNovelVersion(novelVersion);
}

/**
 * 主动增版：整数后缀 +1；非纯数字则规范为 1 再 +1（得到 2）
 * @returns {string}
 */
export function bumpNovelVersion(current) {
  var s = normalizeNovelVersion(current);
  if (/^\d+$/.test(s)) {
    return String(parseInt(s, 10) + 1);
  }
  var n = parseInt(s, 10);
  if (Number.isFinite(n) && n > 0) return String(n + 1);
  return '2';
}

/**
 * 从工作稿打一份可分享的 release 快照（不含书签/写作设置等）
 */
export function buildReleasePayload(novel, characterVersion, opts) {
  opts = opts || {};
  var n = novel && typeof novel === 'object' ? novel : {};
  var charVer = normalizeCharacterVersion(characterVersion);
  var novelVer = normalizeNovelVersion(
    opts.novelVersion != null ? opts.novelVersion : n.novelVersion
  );
  var displayVersion = buildDisplayVersion(charVer, novelVer);
  var publishedAt = typeof opts.publishedAt === 'number' ? opts.publishedAt : Date.now();

  var outline = Array.isArray(n.outline)
    ? n.outline.map(function(o, i) {
        return {
          id: String(o && o.id || ''),
          title: String(o && o.title != null ? o.title : ''),
          summary: String(o && o.summary != null ? o.summary : ''),
          order: typeof (o && o.order) === 'number' ? o.order : i,
        };
      })
    : [];

  var chapters = Array.isArray(n.chapters)
    ? n.chapters.map(function(c, i) {
        return {
          id: String(c && c.id || ''),
          title: String(c && c.title != null ? c.title : ''),
          summary: String(c && c.summary != null ? c.summary : ''),
          content: String(c && c.content != null ? c.content : ''),
          order: typeof (c && c.order) === 'number' ? c.order : i,
        };
      })
    : [];

  return {
    type: 'story-release',
    cardId: String(n.cardId || ''),
    novelId: String(n.id || ''),
    title: String(n.title != null ? n.title : '未命名小说'),
    characterVersion: charVer,
    novelVersion: novelVer,
    displayVersion: displayVersion,
    publishedAt: publishedAt,
    outline: outline,
    chapters: chapters,
  };
}

/** 公开 API 返回体（再剥一层） */
export function sanitizeReleaseForPublic(release) {
  var r = release && typeof release === 'object' ? release : {};
  var data = r.data && typeof r.data === 'object' ? r.data : r;
  return {
    title: String(data.title || r.title || '未命名小说'),
    displayVersion: String(r.displayVersion || data.displayVersion || ''),
    characterVersion: String(r.characterVersion || data.characterVersion || ''),
    novelVersion: String(r.novelVersion || data.novelVersion || ''),
    publishedAt: typeof r.publishedAt === 'number'
      ? r.publishedAt
      : (typeof data.publishedAt === 'number' ? data.publishedAt : null),
    outline: Array.isArray(data.outline) ? data.outline : [],
    chapters: Array.isArray(data.chapters) ? data.chapters : [],
  };
}
