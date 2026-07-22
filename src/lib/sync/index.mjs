/**
 * 云端数据层入口（原 sync）
 */
export * from './docIds.mjs';
export * from './syncEngine.mjs';
export * from './secrets.mjs';
export * from './authClient.mjs';
export { migrateLegacyToPouch, isMigrationDone } from './migrate.mjs';
export {
  getLocalDb,
  putDoc,
  getDoc,
  putCardDraft,
  getCardDraft,
  replicateDocIdsWithRemote,
} from './pouch.mjs';
export { cascadeDeleteCardDocs } from './cascade.mjs';
export {
  mirrorCatalogToPouch,
  mirrorNovelToPouch,
  mirrorActiveToPouch,
  mirrorReleaseToPouch,
  removeStoryNovelFromPouch,
} from './storyMirror.mjs';
export {
  mirrorCardDraftToPouch,
  mirrorCardIndexFromDraftsMap,
  mirrorNovelWorkshopToPouch,
  mirrorRagToPouch,
  mirrorCardReleaseToPouch,
} from './cardMirror.mjs';
export {
  mirrorAvatarToPouch,
  hydrateAvatarFromPouch,
  hydrateAvatarsFromCardIndex,
} from './avatarMirror.mjs';
export {
  setUserPrefsSyncEnabled,
  scheduleUserPrefsCloudPush,
  pullUserPrefsFromCloud,
  pushUserPrefsToCloudNow,
  mirrorPromptsToLocalPouch,
  mirrorUiPrefsToLocalPouch,
} from './userPrefsMirror.mjs';
export {
  collectLocalApiConfigPackage,
  applyLocalApiConfigPackage,
} from './secrets.mjs';
export {
  encryptJsonWithPassphrase,
  decryptJsonWithPassphrase,
  isEncryptedSecretsDoc,
} from './secretCrypto.mjs';
export {
  setCloudEnabled,
  isCloudEnabled,
  ensureCardBundleLocal,
  buildLocalCardBundle,
  hydrateCardBundleToLocal,
  runCloudReconcile,
  pullStoryCatalogToLocal,
  pullStoryNovelToLocal,
} from './cloudStore.mjs';
export { getOutboxSize, peekOutbox, clearOutbox } from './outbox.mjs';
