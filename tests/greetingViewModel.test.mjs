import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildGreetingView } from '../src/lib/card-builder/panels/greetingViewModel.mjs';

var BASE_ENTRIES = [{
  comment: '[initvar] variables',
  content: 'world:\n  time: 08:00\n  place: hall\n',
}];

function baseState() {
  return {
    firstMes: 'Hello main',
    altGreetings: ['Alt one', 'Alt two'],
    greetingInitMain: { 'world.time': 'morning' },
    greetingInitAlts: [{ 'world.time': 'noon' }, {}],
    worldbookEntries: BASE_ENTRIES,
  };
}

describe('greeting view model', function() {
  it('builds main, alternate rows and init hints from card state', function() {
    var view = buildGreetingView(baseState(), {
      mainInitOpen: true,
      openAlts: [false, true],
      initDrafts: { main: null, alts: {} },
    }, { flavorTip: 'adult tip' });

    assert.equal(view.firstMes, 'Hello main');
    assert.match(view.firstMesTokenText, /tok$/);
    assert.match(view.totalTokenText, /tok$/);
    assert.equal(view.showFlavorTip, true);
    assert.equal(view.flavorTip, 'adult tip');

    assert.equal(view.main.initOpen, true);
    assert.equal(view.main.initText, 'world.time=morning');
    assert.equal(view.main.initHint, '1 项和保底不同');
    assert.equal(view.main.generateLabel, '按正文重填');
    assert.equal(view.main.generateDisabled, false);

    assert.equal(view.alts.length, 2);
    assert.equal(view.alts[0].label, '开场白 #2');
    assert.equal(view.alts[0].text, 'Alt one');
    assert.equal(view.alts[0].initText, 'world.time=noon');
    assert.equal(view.alts[0].initOpen, false);
    assert.equal(view.alts[0].canUp, false);
    assert.equal(view.alts[0].canDown, true);
    assert.equal(view.alts[1].label, '开场白 #3');
    assert.equal(view.alts[1].initHint, '沿用世界书保底');
    assert.equal(view.alts[1].initOpen, true);
    assert.equal(view.alts[1].canUp, true);
    assert.equal(view.alts[1].canDown, false);
  });

  it('keeps raw init draft text and exposes busy target', function() {
    var view = buildGreetingView(baseState(), {
      mainInitOpen: false,
      openAlts: [false, true],
      initDrafts: { main: 'world.time=evening', alts: { 1: 'world.place=forest' } },
      busyTarget: 'alt:1',
    });

    assert.equal(view.main.initText, 'world.time=evening');
    assert.equal(view.alts[1].initText, 'world.place=forest');
    assert.equal(view.alts[1].busy, true);
    assert.equal(view.alts[0].busy, false);
  });

  it('can publish text without recomputing token snapshots', function() {
    var view = buildGreetingView(baseState(), {
      firstMesTokenText: 'cached main',
      totalTokenText: 'cached total',
      alts: [{ tokenText: 'cached alt', tokenTitle: 'cached alt title' }],
      mainInitOpen: false,
      openAlts: [],
      initDrafts: { main: null, alts: {} },
    }, { withTokens: false });

    assert.equal(view.firstMesTokenText, 'cached main');
    assert.equal(view.totalTokenText, 'cached total');
    assert.equal(view.alts[0].tokenText, 'cached alt');
    assert.equal(view.alts[0].tokenTitle, 'cached alt title');
  });

  it('disables generation without baseline or prose', function() {
    var view = buildGreetingView({
      firstMes: '',
      altGreetings: ['Only alt'],
      greetingInitMain: {},
      greetingInitAlts: [{}],
      worldbookEntries: [],
    }, {
      mainInitOpen: false,
      openAlts: [],
      initDrafts: { main: null, alts: {} },
    });

    assert.equal(view.main.generateDisabled, true);
    assert.equal(view.main.generateTitle, '先到状态栏生成变量');
    assert.equal(view.main.initHint, '还没有保底，先到状态栏生成变量');
    assert.equal(view.alts[0].generateDisabled, true);
    assert.equal(view.alts[0].initHint, '还没有保底，先到状态栏生成变量');
  });
});
