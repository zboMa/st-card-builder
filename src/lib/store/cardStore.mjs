/**
 * 制卡域单一数据源（Nanostores）。
 *
 * 为什么用 atom 而不是 map：
 * Nanostores 的 `map.setKey` 内部是 `{ ...old, [key]: value }`，会**替换对象引用**，
 * 使 `ctx.state` / `sm.state` 持有的旧引用失效，违背「单一对象」约束。
 * 这里用 `atom` 持有权威对象，写入一律**原地改**再 `notify()`，引用始终不变。
 *
 * 约束：
 * - `cardStore.get()` 就是 `createDefaultCardState()` 那个对象，`ctx.state` / `sm.state` 始终同一引用。
 * - 写入走 `setCardKey` / `setCardKeys` / `replaceCardKeys`（原地改 + 通知）。
 * - 过渡期未迁移面板的裸写 + `ctx.save()` / `card-builder-data-changed` 通过 `markCardDirty()`
 *   的版本信号通知 Vue 岛（Vue 侧比较的是版本号，不是对象引用）。
 */
import { atom } from 'nanostores';

export const cardStore = atom({});

/** 过渡期变更信号：递增数字，Vue 岛订阅它才能在原地写后触发更新。 */
export const stateVersion = atom(0);

var version = 0;

/** 标记 card 域发生变更（供旧代码 / 事件 / save 调用）。 */
export function markCardDirty() {
  version += 1;
  stateVersion.set(version);
  return version;
}

/** 初始化（仅在启动时调用一次），返回权威对象本身。 */
export function initCardStore(initial) {
  cardStore.set(initial || {});
  markCardDirty();
  return cardStore.get();
}

/** 取权威对象（与 ctx.state 同一引用）。 */
export function cardState() {
  return cardStore.get();
}

/** 单字段写入（原地改，保持对象引用）。 */
export function setCardKey(key, value) {
  var state = cardStore.get();
  if (Object.is(state[key], value)) {
    markCardDirty();
    return;
  }
  state[key] = value;
  cardStore.notify();
  markCardDirty();
}

/** 批量字段写入（一次通知）。 */
export function setCardKeys(patch) {
  patch = patch || {};
  var state = cardStore.get();
  Object.keys(patch).forEach(function (k) {
    state[k] = patch[k];
  });
  cardStore.notify();
  markCardDirty();
}

/**
 * 原地整体替换：保留对象引用，只对顶层 key 增删改。
 * 用于重置 / 切换实例时把新快照灌回同一个对象（避免 sm.state 引用失效）。
 */
export function replaceCardKeys(next) {
  next = next || {};
  var state = cardStore.get();
  Object.keys(state).forEach(function (k) {
    if (!Object.prototype.hasOwnProperty.call(next, k)) delete state[k];
  });
  Object.keys(next).forEach(function (k) {
    state[k] = next[k];
  });
  cardStore.notify();
  markCardDirty();
}

/** 订阅变更信号（原生代码 / Vue 岛均可使用）。 */
export function subscribeCardDirty(listener) {
  return stateVersion.subscribe(listener);
}

/**
 * 过渡期兼容垫片（浏览器）：
 * - 旧世界的 `card-builder-data-changed` 事件、`ctx.save()` 都视为一次变更，
 *   统一 bump 版本号，让已迁移的 Vue 岛能感知未迁移面板造成的变更。
 */
export function installCardStoreShim(ctx) {
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('card-builder-data-changed', markCardDirty);
  }
  if (ctx && typeof ctx.save === 'function') {
    var origSave = ctx.save;
    ctx.save = function () {
      var result = origSave.apply(ctx, arguments);
      markCardDirty();
      return result;
    };
  }
}
