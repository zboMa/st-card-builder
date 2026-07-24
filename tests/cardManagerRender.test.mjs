import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createDefaultCardState, CURRENT_KEY } from '../src/lib/card-builder/state.mjs';
import { createCardStateMachine } from '../src/lib/card-builder/stateMachine.mjs';
import { createCardBuilderContext } from '../src/lib/card-builder/shared/context.mjs';
import { registerCardManager } from '../src/lib/card-builder/panels/cardManager.mjs';
import { resetDraftsStoreForTests } from '../src/lib/draftsStore.mjs';

function createDomStub() {
  var nodes = Object.create(null);
  function makeEl(extra) {
    return Object.assign({
      className: '',
      innerHTML: '',
      textContent: '',
      style: {},
      children: [],
      classList: { add() {}, remove() {}, toggle() {} },
      setAttribute() {},
      getAttribute() { return null; },
      appendChild(child) {
        this.children.push(child);
        child.parentNode = this;
        return child;
      },
      insertAdjacentHTML(_pos, html) {
        this.innerHTML += html;
      },
      addEventListener() {},
      removeEventListener() {},
      contains() { return false; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      parentNode: null,
      isConnected: true,
    }, extra || {});
  }
  function ensure(id) {
    if (!nodes[id]) nodes[id] = makeEl({ id: id, value: '' });
    return nodes[id];
  }
  return {
    nodes: nodes,
    document: {
      querySelector(sel) {
        if (sel === '.app-view.is-active') {
          var view = ensure('appViewCardManager');
          view.getAttribute = function() { return 'card-manager'; };
          return view;
        }
        return null;
      },
      querySelectorAll() { return []; },
      createElement(tag) {
        return makeEl({ tagName: tag });
      },
      body: makeEl(),
      addEventListener() {},
      removeEventListener() {},
    },
    ensure: ensure,
  };
}

describe('cardManager render after split', function() {
  it('cardManagerRender 导入 draftDisplayName / 版本函数（无 DRAFTS_KEY）', function() {
    var src = readFileSync(join(process.cwd(), 'src/lib/card-builder/panels/cardManagerRender.mjs'), 'utf8');
    assert.match(src, /import \{[^}]+\bdraftDisplayName\b[^}]+\} from '\.\.\/state\.mjs'/);
    assert.doesNotMatch(src, /\bDRAFTS_KEY\b/);
    assert.match(src, /import \{[^}]+\bbumpCardDraftVersion\b[^}]+\} from '\.\.\/cardVersions\.mjs'/);
    assert.match(src, /import \{[^}]+\bswitchCardDraftVersion\b[^}]+\} from '\.\.\/cardVersions\.mjs'/);
  });

  it('cardManagerBind 通过 panel 调用菜单/弹窗方法', function() {
    var src = readFileSync(join(process.cwd(), 'src/lib/card-builder/panels/cardManagerBind.mjs'), 'utf8');
    assert.doesNotMatch(src, /(?<!\.)\bcloseCardMoreMenu\(\)/);
    assert.match(src, /panel\.closeCardMoreMenu\(\)/);
    assert.match(src, /panel\.openExportChecklistModal\(\)/);
    assert.match(src, /panel\.openCardMoreMenu\(/);
    assert.match(src, /panel\.openCardVersionMenu\(/);
  });

  it('updateCardManagerUI 渲染草稿卡片到 #cardManagerList', function() {
    resetDraftsStoreForTests();
    var dom = createDomStub();
    var listEl = dom.ensure('cardManagerList');
    global.document = dom.document;
    global.window = {
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {},
      innerWidth: 1280,
      innerHeight: 800,
    };
    global.location = { hash: '#card-manager' };
    global.localStorage = {
      store: Object.create(null),
      getItem(key) { return this.store[key] || null; },
      setItem(key, val) { this.store[key] = String(val); },
    };

    try {
      var state = createDefaultCardState();
      state.draftId = 'draft-test-1';
      state.charName = '测试角色';
      state.updatedAt = '12:00:00';
      var sm = createCardStateMachine(state);
      sm.saveDraft();
      global.localStorage.setItem(CURRENT_KEY, state.draftId);

      var ctx = createCardBuilderContext(sm);
      ctx.$ = function(id) { return dom.ensure(id); };
      ctx.escapeHtml = function(v) { return String(v || ''); };
      dom.ensure('charName').value = '测试角色';

      registerCardManager(ctx);
      assert.equal(typeof ctx.panels.cardManager.render, 'function');
      assert.equal(typeof ctx.panels.cardManager.closeCardMoreMenu, 'function');

      ctx.panels.cardManager.bind();
      ctx.panels.cardManager.render();

      assert.equal(listEl.children.length, 1);
      assert.match(listEl.children[0].className, /card-manager-item/);
      var html = '';
      (function walk(el) {
        html += el.innerHTML || '';
        el.children.forEach(walk);
      })(listEl.children[0]);
      assert.match(html, /测试角色/);
    } finally {
      resetDraftsStoreForTests();
    }
  });

  it('getDraftsForDisplay 渲染前同步 DOM 字段到当前卡快照', function() {
    resetDraftsStoreForTests();
    var dom = createDomStub();
    global.document = dom.document;
    global.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
    global.location = { hash: '#card-manager' };
    global.localStorage = {
      store: Object.create(null),
      getItem(key) { return this.store[key] || null; },
      setItem(key, val) { this.store[key] = String(val); },
    };

    try {
      var state = createDefaultCardState();
      state.draftId = 'draft-live-1';
      state.charName = '旧名字';
      var sm = createCardStateMachine(state);
      sm.saveDraft();

      var ctx = createCardBuilderContext(sm);
      ctx.$ = function(id) {
        if (id === 'charName') return dom.ensure('charName');
        return dom.ensure(id);
      };
      ctx.escapeHtml = function(v) { return String(v || ''); };
      dom.ensure('charName').value = '新名字';

      registerCardManager(ctx);
      ctx.panels.cardManager.render();

      var html = '';
      (function walk(el) {
        html += el.innerHTML || '';
        el.children.forEach(walk);
      })(dom.ensure('cardManagerList').children[0]);
      assert.match(html, /新名字/);
      assert.doesNotMatch(html, /旧名字/);
    } finally {
      resetDraftsStoreForTests();
    }
  });

  it('角色设定 input 走 debouncedUpdateAndSave 而非裸 ctx.save', function() {
    var src = readFileSync(join(process.cwd(), 'src/lib/card-builder/panels/character.mjs'), 'utf8');
    assert.match(src, /debouncedUpdateAndSave/);
    assert.doesNotMatch(src, /addEventListener\('input', ctx\.save\)/);
  });
});
