/**
 * Pouch 已退役：保留空壳以免旧动态 import 崩溃。
 * 本地权威在 LS / IndexedDB；云端走 /api/data。
 */

export async function loadPouchDB() {
  throw new Error('pouch_removed_use_cloud_api');
}

export async function getLocalDb() {
  throw new Error('pouch_removed_use_cloud_api');
}

export async function resetLocalDbForTests() {
  return;
}

export async function putDoc() {
  throw new Error('pouch_removed_use_cloud_api');
}

export async function getDoc() {
  return null;
}

export async function removeDoc() {
  return null;
}

export async function getCardIndex() {
  return [];
}

export async function putCardDraft() {
  throw new Error('pouch_removed_use_cloud_api');
}

export async function getCardDraft() {
  return null;
}

export async function replicateWithRemote() {
  throw new Error('pouch_removed_use_cloud_api');
}

export async function replicateDocIdsWithRemote() {
  throw new Error('pouch_removed_use_cloud_api');
}
