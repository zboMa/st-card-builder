/**
 * 活跃 store 注册表（纯逻辑，可 Node 单测）
 * 每个域（card / novel / story）按实例 id 各持一份 store；切实例只换活跃引用，
 * 保证「每域单一数据源」，永不共享不同实例的数据。
 */
var stores = new Map();
var active = new Map();

function keyOf(domain, id) {
  return String(domain) + ':' + (id == null ? '' : String(id));
}

export function registerStore(domain, id, store) {
  var k = keyOf(domain, id);
  stores.set(k, store);
  active.set(domain, k);
  return store;
}

export function getActiveStore(domain) {
  var k = active.get(domain);
  return k ? (stores.get(k) || null) : null;
}

export function setActive(domain, id) {
  var k = keyOf(domain, id);
  if (!stores.has(k)) return null;
  active.set(domain, k);
  return stores.get(k);
}

export function hasStore(domain, id) {
  return stores.has(keyOf(domain, id));
}

export function unregisterStore(domain, id) {
  var k = keyOf(domain, id);
  stores.delete(k);
  if (active.get(domain) === k) active.delete(domain);
}

export function resetRegistry() {
  stores.clear();
  active.clear();
}
