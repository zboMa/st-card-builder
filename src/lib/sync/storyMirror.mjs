/**
 * Story Studio → Pouch 镜像（工作稿 / 目录 / release）
 */
import {
  storyCatalogDocId,
  storyNovelDocId,
  storyActiveDocId,
  storyReleaseDocId,
} from './docIds.mjs';
import { putDoc, removeDoc } from './pouch.mjs';

function catalogNovelsList(catalog) {
  if (Array.isArray(catalog)) return catalog;
  if (catalog && Array.isArray(catalog.novels)) return catalog.novels;
  if (catalog && catalog.data) {
    if (Array.isArray(catalog.data)) return catalog.data;
    if (Array.isArray(catalog.data.novels)) return catalog.data.novels;
  }
  return [];
}

export async function mirrorCatalogToPouch(cardId, catalog) {
  var id = String(cardId || '').trim();
  if (!id) return;
  var list = catalogNovelsList(catalog);
  await putDoc({
    _id: storyCatalogDocId(id),
    type: 'story-catalog',
    cardId: id,
    data: list,
    updatedAt: new Date().toISOString(),
  });
}

export async function mirrorNovelToPouch(cardId, novel) {
  var c = String(cardId || '').trim();
  var n = novel && typeof novel === 'object' ? novel : null;
  if (!c || !n || !n.id) return;
  await putDoc({
    _id: storyNovelDocId(c, n.id),
    type: 'story-novel',
    cardId: c,
    novelId: String(n.id),
    data: n,
    updatedAt: new Date().toISOString(),
  });
}

export async function mirrorActiveToPouch(cardId, novelId) {
  var c = String(cardId || '').trim();
  if (!c) return;
  await putDoc({
    _id: storyActiveDocId(c),
    type: 'story-active',
    cardId: c,
    data: { novelId: String(novelId || ''), updatedAt: Date.now() },
    updatedAt: new Date().toISOString(),
  });
}

export async function mirrorReleaseToPouch(cardId, novelId, release) {
  var c = String(cardId || '').trim();
  var nid = String(novelId || '').trim();
  if (!c || !nid || !release) return;
  await putDoc({
    _id: storyReleaseDocId(c, nid),
    type: 'story-release',
    cardId: c,
    novelId: nid,
    characterVersion: release.characterVersion,
    novelVersion: release.novelVersion,
    displayVersion: release.displayVersion,
    publishedAt: release.publishedAt,
    data: release,
    updatedAt: new Date().toISOString(),
  });
}

export async function removeStoryNovelFromPouch(cardId, novelId) {
  var c = String(cardId || '').trim();
  var nid = String(novelId || '').trim();
  if (!c || !nid) return;
  try { await removeDoc(storyNovelDocId(c, nid)); } catch (e) { /* ignore */ }
  try { await removeDoc(storyReleaseDocId(c, nid)); } catch (e) { /* ignore */ }
}

export { catalogNovelsList };
