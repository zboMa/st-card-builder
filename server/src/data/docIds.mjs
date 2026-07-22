/**
 * 用户库文档 ID（与前端 src/lib/sync/docIds.mjs 对齐）
 */

export var DOC = {
  cardIndex: 'meta/card-index',
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

export function storyReleaseDocId(cardId, novelId) {
  return 'story/' + String(cardId || '').trim() + '/' + String(novelId || '').trim() + '/release';
}

export function cardReleaseDocId(cardId) {
  return 'card/' + String(cardId || '').trim() + '/release';
}

export function cardReleaseVersionDocId(cardId, characterVersion) {
  var ver = encodeURIComponent(String(characterVersion || '1.0').trim() || '1.0');
  return 'card/' + String(cardId || '').trim() + '/release/' + ver;
}

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

export function catalogNovelsList(catalog) {
  if (Array.isArray(catalog)) return catalog;
  if (catalog && Array.isArray(catalog.novels)) return catalog.novels;
  if (catalog && catalog.data) {
    if (Array.isArray(catalog.data)) return catalog.data;
    if (Array.isArray(catalog.data.novels)) return catalog.data.novels;
  }
  return [];
}
