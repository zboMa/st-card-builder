/**
 * 本地 Pouch 自上次成功全量同步后是否有写入。
 * 供自动同步 skipIfClean 使用；不依赖 syncEngine，避免与 pouch 循环引用。
 */
var localDirty = false;

export function markLocalDirty() {
  localDirty = true;
}

export function clearLocalDirty() {
  localDirty = false;
}

export function isLocalDirty() {
  return !!localDirty;
}

/** 测试用 */
export function resetLocalDirtyForTests(value) {
  localDirty = value === undefined ? false : !!value;
}
