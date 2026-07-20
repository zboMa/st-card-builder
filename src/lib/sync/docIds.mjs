/**
 * 同步文档 ID 约定（前后端共用语义）
 */
export var SYNC_INTERVAL_MS = 5 * 60 * 1000;

export var DOC = {
  cardIndex: 'meta/card-index',
  migration: 'meta/migration-v1',
  aiSecrets: 'secrets/ai-config',
  syncPrefs: 'prefs/sync',
  prompts: 'prefs/prompts',
  ui: 'prefs/ui',
};

export function cardDocId(cardId) {
  return 'card/' + String(cardId || '').trim();
}

export function avatarDocId(cardId, kind) {
  return 'avatar/' + String(cardId || '').trim() + '/' + (kind === 'thumb' ? 'thumb' : 'full');
}

export function novelDocId(cardId) {
  return 'novel/' + String(cardId || '').trim();
}

export function ragDocId(cardId) {
  return 'rag/' + String(cardId || '').trim();
}

export function storyCatalogDocId(cardId) {
  return 'story/' + String(cardId || '').trim() + '/catalog';
}

export function storyNovelDocId(cardId, novelId) {
  return 'story/' + String(cardId || '').trim() + '/' + String(novelId || '').trim();
}

export function storyActiveDocId(cardId) {
  return 'story/' + String(cardId || '').trim() + '/active';
}

/** 默认同步过滤器：排除 secrets（除非用户显式开启密钥同步） */
export function buildSyncSelector(includeSecrets) {
  return {
    includeSecrets: !!includeSecrets,
  };
}

export function shouldReplicateDocId(id, includeSecrets) {
  var s = String(id || '');
  if (s.indexOf('secrets/') === 0) return !!includeSecrets;
  return true;
}

/**
 * 从卡草稿 map 构建云端列表摘要
 * @param {Record<string, object>} drafts
 */
export function buildCardIndexFromDrafts(drafts) {
  var map = drafts && typeof drafts === 'object' ? drafts : {};
  var cards = Object.keys(map).map(function(id) {
    var d = map[id] || {};
    return {
      id: id,
      charName: String(d.charName || d.name || '').trim(),
      updatedAt: d.updatedAt || null,
      avatarInIdb: !!d.avatarInIdb,
    };
  }).sort(function(a, b) {
    return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
  });
  return {
    _id: DOC.cardIndex,
    type: 'card-index',
    cards: cards,
    updatedAt: new Date().toISOString(),
  };
}
