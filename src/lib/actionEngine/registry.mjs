/**
 * Action 注册表
 */

export function createRegistry() {
  /** @type {Map<string, object>} */
  var byId = new Map();

  function register(entry) {
    if (!entry || !entry.id) throw new Error('actionEngine.register: 缺少 id');
    var prev = byId.get(entry.id);
    var next = Object.assign({}, prev || {}, entry);
    if (!next.els) next.els = [];
    if (entry.el) {
      if (next.els.indexOf(entry.el) < 0) next.els.push(entry.el);
    }
    if (entry.selector && typeof document !== 'undefined') {
      next.selector = entry.selector;
    }
    byId.set(entry.id, next);
    return next;
  }

  function unregister(id) {
    byId.delete(id);
  }

  function get(id) {
    return byId.get(id) || null;
  }

  function all() {
    return Array.from(byId.values());
  }

  function resolveEls(entry) {
    var els = (entry.els || []).slice();
    if (entry.selector && typeof document !== 'undefined') {
      try {
        document.querySelectorAll(entry.selector).forEach(function(el) {
          if (els.indexOf(el) < 0) els.push(el);
        });
      } catch (e) { /* ignore bad selector */ }
    }
    return els;
  }

  return {
    register: register,
    unregister: unregister,
    get: get,
    all: all,
    resolveEls: resolveEls,
  };
}
