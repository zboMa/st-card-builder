/**
 * 旧 Pouch 迁移已退役；本地 LS/IDB 即权威，登录后由 runSync 以 bundle 上传。
 */
export async function isMigrationDone() {
  return true;
}

export async function migrateLegacyToPouch() {
  return { skipped: true, reason: 'pouch_removed' };
}
