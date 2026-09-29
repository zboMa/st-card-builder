import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyGreetingInitChange,
  applyGreetingTexts,
  buildGreetingInitUserPrompt,
  composeGreetingText,
  interpretGreetingInitDraft,
  splitGreetingText,
} from '../src/lib/mvu/greetingInit.mjs';
import { buildCardJSONFromDraft } from '../src/lib/card-builder/state.mjs';

var BASE_ENTRIES = [{
  comment: '[initvar]变量初始化勿开',
  content: '世界:\n  当前时间: 08:00\n  当前地点: 大厅\n',
}];

describe('greeting init', function() {
  it('没有差异时不往开场白里写初始值块', function() {
    var text = composeGreetingText('夜色刚落。', {}, { '世界.当前时间': '08:00' });
    assert.equal(text, '夜色刚落。');
    assert.equal(splitGreetingText(text).hadBlock, false);
  });

  it('导出时用保底补全，只把差异写进开场', function() {
    var text = composeGreetingText('夜色刚落。', { '世界.当前时间': '亥时' }, {
      '世界.当前时间': '08:00',
      '世界.当前地点': '大厅',
    });
    assert.match(text, /夜色刚落。/);
    assert.match(text, /<UpdateVariable>\s*<initvar>/);
    assert.match(text, /当前时间: 亥时/);
    assert.match(text, /当前地点: 大厅/);
    var back = splitGreetingText(text);
    assert.equal(back.failed, false);
    assert.equal(back.prose, '夜色刚落。');
    assert.equal(back.leaves['世界.当前时间'], '亥时');
    assert.equal(back.leaves['世界.当前地点'], '大厅');
  });

  it('导入时对照世界书保底，只留下不同的路径', function() {
    var raw = composeGreetingText('湖上。', { '世界.当前地点': '水榭' }, {
      '世界.当前时间': '08:00',
      '世界.当前地点': '大厅',
    });
    var out = applyGreetingTexts({
      firstMes: raw,
      altGreetings: ['另一处。'],
      entries: BASE_ENTRIES,
      resetMissing: true,
    });
    assert.equal(out.firstMes, '湖上。');
    assert.deepEqual(out.greetingInitMain, { '世界.当前地点': '水榭' });
    assert.equal(out.altGreetings[0], '另一处。');
    assert.deepEqual(out.greetingInitAlts[0], {});
    assert.equal(out.baselineInstalled, false);
  });

  it('没有世界书保底时，用主开场的完整树补一条禁用保底', function() {
    var raw = '<UpdateVariable>\n<initvar>\n世界:\n  当前时间: 亥时\n</initvar>\n</UpdateVariable>\n\n开局正文';
    var alt = '<UpdateVariable>\n<initvar>\n世界:\n  当前时间: 午时\n</initvar>\n</UpdateVariable>\n\n备选';
    var out = applyGreetingTexts({
      firstMes: raw,
      altGreetings: [alt],
      entries: [],
      resetMissing: true,
    });
    assert.equal(out.baselineInstalled, true);
    assert.equal(out.firstMes, '开局正文');
    assert.deepEqual(out.greetingInitMain, {});
    assert.deepEqual(out.greetingInitAlts[0], { '世界.当前时间': '午时' });
    var entry = out.entries.find(function(e) { return e.ownerSlot === 'initvar'; });
    assert.ok(entry);
    assert.equal(entry.enabled, false);
    assert.match(entry.content, /当前时间: 亥时/);
  });

  it('初始值块解析失败时保留原文', function() {
    var raw = '正文\n<UpdateVariable><initvar>\n这不是yaml\n</initvar></UpdateVariable>';
    var split = splitGreetingText(raw);
    assert.equal(split.failed, true);
    assert.equal(split.prose, raw);
    var out = applyGreetingTexts({
      firstMes: raw,
      altGreetings: [],
      entries: BASE_ENTRIES,
      resetMissing: true,
    });
    assert.equal(out.firstMes, raw);
    assert.deepEqual(out.greetingInitMain, {});
  });

  it('角色卡 JSON 在导出时才拼上初始值', function() {
    var json = buildCardJSONFromDraft({
      charName: '甲',
      firstMes: '夜色刚落。',
      greetingInitMain: { '世界.当前时间': '亥时' },
      altGreetings: ['清晨。'],
      greetingInitAlts: [{}],
      worldbookEntries: BASE_ENTRIES,
    });
    assert.match(json.data.first_mes, /<initvar>/);
    assert.match(json.data.first_mes, /亥时/);
    assert.doesNotMatch(json.data.alternate_greetings[0], /<initvar>/);
    assert.match(json.first_mes, /亥时/);
  });

  var BASELINE = { '世界.当前时间': '08:00', '世界.当前地点': '大厅' };

  function initState(extra) {
    return Object.assign({
      greetingInitMain: { '世界.当前地点': '水榭' },
      greetingInitAlts: [{ '世界.当前时间': '卯时' }],
      altCount: 1,
      baseline: BASELINE,
    }, extra || {});
  }

  it('设置开场初始值按 target 合并，相同于保底的值不留下', function() {
    var main = applyGreetingInitChange(initState(), {
      target: 'main',
      overrides: { '世界.当前时间': '亥时' },
    });
    assert.equal(main.ok, true);
    assert.equal(main.target, 'main');
    assert.deepEqual(main.overrides, { '世界.当前地点': '水榭', '世界.当前时间': '亥时' });
    assert.deepEqual(main.greetingInitAlts[0], { '世界.当前时间': '卯时' });

    var back = applyGreetingInitChange(initState(), {
      target: 'main',
      overrides: { '世界.当前地点': '大厅' },
    });
    assert.deepEqual(back.overrides, {});

    var alt = applyGreetingInitChange(initState(), {
      target: { alternate: 0 },
      overrides: { '世界': { '当前地点': '后山' } },
    });
    assert.equal(alt.ok, true);
    assert.deepEqual(alt.target, { alternate: 0 });
    assert.deepEqual(alt.overrides, { '世界.当前时间': '卯时', '世界.当前地点': '后山' });
    assert.deepEqual(alt.greetingInitMain, { '世界.当前地点': '水榭' });
  });

  it('清空后重写，null 删路径，没有保底时拒绝写入', function() {
    var cleared = applyGreetingInitChange(initState(), {
      target: { index: 0 },
      clear: true,
      overrides: { '世界.当前地点': '江心' },
    });
    assert.equal(cleared.ok, true);
    assert.equal(cleared.cleared, true);
    assert.deepEqual(cleared.overrides, { '世界.当前地点': '江心' });

    var dropped = applyGreetingInitChange(initState(), {
      target: 'main',
      overrides: { '世界.当前地点': null },
    });
    assert.deepEqual(dropped.overrides, {});

    var bare = applyGreetingInitChange(initState({ baseline: {} }), {
      target: 'main',
      clear: true,
    });
    assert.equal(bare.ok, true);
    assert.deepEqual(bare.overrides, {});

    var refused = applyGreetingInitChange(initState({ baseline: {} }), {
      target: 'main',
      overrides: { '世界.当前时间': '亥时' },
    });
    assert.equal(refused.ok, false);
    assert.match(refused.error, /请先生成变量/);
    assert.equal(applyGreetingInitChange(initState(), {}).ok, false);
    assert.match(applyGreetingInitChange(initState(), { overrides: { '世界.当前时间': '亥时' } }).error, /缺少 target/);
    assert.match(applyGreetingInitChange(initState(), { target: { alternate: 3 }, overrides: { '世界.当前时间': '亥时' } }).error, /序号越界/);
  });

  it('生成结果只留下保底里真正不同的路径', function() {
    var baseline = { '世界.当前时间': '08:00', '世界.当前地点': '大厅' };
    var draft = interpretGreetingInitDraft(
      '说明如下：\n```\n- 世界.当前时间=亥时\n世界.当前地点=大厅\n世界.心情=平静\n```',
      baseline
    );
    assert.deepEqual(draft.overrides, { '世界.当前时间': '亥时' });
    assert.deepEqual(draft.dropped, ['世界.心情']);
    assert.equal(draft.empty, false);

    var same = interpretGreetingInitDraft('世界.当前时间=08:00', baseline);
    assert.equal(same.empty, true);
    assert.deepEqual(same.dropped, []);
    assert.match(buildGreetingInitUserPrompt('夜色刚落。', baseline), /世界\.当前时间="08:00"/);
    assert.match(buildGreetingInitUserPrompt('夜色刚落。', baseline), /夜色刚落。/);
    assert.match(buildGreetingInitUserPrompt('夜色刚落。', baseline), /这场相对保底真正改掉的路径/);
    assert.match(buildGreetingInitUserPrompt('夜色刚落。', baseline), /不超过一句/);
    var long = interpretGreetingInitDraft('世界.当前地点=' + '夜'.repeat(100), baseline);
    assert.equal(long.overrides['世界.当前地点'].length, 80);
  });
});
