/**
 * Story Studio → 云端保存
 */
import {
  cloudSaveStoryCatalog,
  cloudSaveStoryNovel,
  cloudSaveStoryActive,
  cloudSaveStoryRelease,
  cloudRemoveStoryNovel,
} from './cloudStore.mjs';
import { catalogNovelsList } from './docIds.mjs';

export async function mirrorCatalogToPouch(cardId, catalog) {
  return cloudSaveStoryCatalog(cardId, catalog);
}

export async function mirrorNovelToPouch(cardId, novel) {
  return cloudSaveStoryNovel(cardId, novel);
}

export async function mirrorActiveToPouch(cardId, novelId) {
  return cloudSaveStoryActive(cardId, novelId);
}

export async function mirrorReleaseToPouch(cardId, novelId, release) {
  return cloudSaveStoryRelease(cardId, novelId, release);
}

export async function removeStoryNovelFromPouch(cardId, novelId) {
  return cloudRemoveStoryNovel(cardId, novelId);
}

export { catalogNovelsList };
