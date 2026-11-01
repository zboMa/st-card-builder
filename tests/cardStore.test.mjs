/**
 * 制卡域 store 内核：单一数据源、原地写、版本信号、过渡垫片、注册表
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { atom } from 'nanostores';
import {
  cardStore,
  stateVersion,
  initCardStore,
  cardState,
  setCardKey,
  setCardKeys,
  replaceCardKeys,
  markCardDirty,
  subscribeCardDirty,
  installCardStoreShim,
} from '../src/lib/store/cardStore.mjs';
import {
  registerStore,
  getActiveStore,
  setActive,
  unregisterStore,
  resetRegistry,
} from '../src/lib/store/registry.mjs';

describe('cardStore 单一数据源', function() {
  it('initCardStore 返回的对象就是权威对象（ctx.state 同一引用）', function() {
    var initial = { charName: 'a', worldbookEntries: [] };
    var ret = initCardStore(initial);
    assert.equal(ret, initial);
    assert.equal(cardState(), initial);
    assert.equal(cardStore.get(), initial);
  });

  it('setCardKey 原地改、引用不变、版本 +1、订阅收到一次', function() {
    var state = initCardStore({ charName: 'a' });
    var seen = 0;
    var unsub = cardStore.listen(function() { seen += 1; });
    var v0 = stateVersion.get();
    setCardKey('charName', 'b');
    assert.equal(cardState(), state);
    assert.equal(state.charName, 'b');
    assert.equal(stateVersion.get(), v0 + 1);
    assert.equal(seen, 1);
    unsub();
  });

  it('setCardKeys 批量写入只通知一次，仍是同一对象', function() {
    var state = initCardStore({ a: 1, b: 2 });
    var seen = 0;
    var unsub = cardStore.listen(function() { seen += 1; });
    setCardKeys({ a: 3, b: 4 });
    assert.equal(cardState(), state);
    assert.equal(state.a, 3);
    assert.equal(state.b, 4);
    assert.equal(seen, 1);
    unsub();
  });

  it('replaceCardKeys 保留引用，按 key 增删改', function() {
    var state = initCardStore({ a: 1, b: 2 });
    replaceCardKeys({ a: 9, c: 3 });
    assert.equal(cardState(), state);
    assert.equal(state.a, 9);
    assert.equal(state.c, 3);
    assert.equal('b' in state, false);
  });

  it('subscribeCardDirty 在 markCardDirty 时触发', function() {
    initCardStore({});
    var calls = 0;
    var unsub = subscribeCardDirty(function() { calls += 1; });
    var v0 = stateVersion.get();
    markCardDirty();
    assert.equal(stateVersion.get(), v0 + 1);
    assert.ok(calls >= 2); // subscribe 立即调用一次 + 变更一次
    unsub();
  });

  it('installCardStoreShim 把 ctx.save 变成变更信号', function() {
    initCardStore({});
    var saved = 0;
    var ctx = { save: function() { saved += 1; } };
    installCardStoreShim(ctx);
    var v0 = stateVersion.get();
    ctx.save();
    assert.equal(saved, 1);
    assert.equal(stateVersion.get(), v0 + 1);
  });
});

describe('registry 按域 + 实例隔离', function() {
  it('注册、切换活跃、注销与清空', function() {
    resetRegistry();
    var a = atom({ id: 'a' });
    var b = atom({ id: 'b' });
    registerStore('card', 'a', a);
    registerStore('card', 'b', b);
    assert.equal(getActiveStore('card'), b); // 最后注册的成为活跃
    setActive('card', 'a');
    assert.equal(getActiveStore('card'), a);
    unregisterStore('card', 'b');
    assert.equal(getActiveStore('card'), a);
    resetRegistry();
    assert.equal(getActiveStore('card'), null);
  });
});
