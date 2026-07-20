/**
 * chatRuntime：ST 1.18.0 对标试聊世界书 / 正则 / 宏 / 组装
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ST_PARITY_VERSION,
  ST_PARITY_DIFFS,
  applyMacros,
  normalizeWorldInfoEntry,
  SELECTIVE_LOGIC,
  scanWorldInfo,
  buildDepthInjections,
  injectWorldInfo,
  applyRegexPipeline,
  applyRegexToMessages,
  buildChatCompletionMessages,
  PLACEMENT_USER,
  PLACEMENT_AI,
  PLACEMENT_WORLD,
} from '../src/lib/chatRuntime/index.mjs';

describe('stCompat', function() {
  it('导出 ST 1.18.0 对标版本与差异说明', function() {
    assert.equal(ST_PARITY_VERSION, '1.18.0');
    assert.ok(Array.isArray(ST_PARITY_DIFFS) && ST_PARITY_DIFFS.length > 0);
  });
});

describe('macros', function() {
  it('替换 {{char}} {{user}} 及常见大小写', function() {
    var out = applyMacros('Hi {{user}}, I am {{char}}. {{Char}}/{{USER}}', {
      charName: 'Alice',
      userName: 'Bob',
    });
    assert.equal(out, 'Hi Bob, I am Alice. Alice/Bob');
  });
});

describe('worldInfo normalize', function() {
  it('映射 strategy / secondary_keys / selectiveLogic 缺省', function() {
    var e = normalizeWorldInfoEntry({
      comment: 't',
      content: 'c',
      keys: ['a'],
      secondary_keys: ['b'],
      strategy: 'constant',
      position: 5,
      role: 2,
      order: 10,
      prob: 50,
    }, 3);
    assert.equal(e.id, 3);
    assert.equal(e.constant, true);
    assert.deepEqual(e.secondaryKeys, ['b']);
    assert.equal(e.selectiveLogic, SELECTIVE_LOGIC.AND_ANY);
    assert.equal(e.position, 5);
    assert.equal(e.role, 2);
  });
});

describe('scanWorldInfo', function() {
  it('scanDepth 只扫最近 N 条', function() {
    var entries = [
      { id: 1, comment: 'hit', content: 'DRAGON', keys: ['dragon'], strategy: 'selective', order: 1 },
    ];
    var history = [
      { role: 'user', content: 'talk about dragon please' },
      { role: 'assistant', content: 'ok' },
      { role: 'user', content: 'how is the weather' },
    ];
    var deep = scanWorldInfo({ entries: entries, history: history, scanDepth: 3 });
    assert.equal(deep.activated.length, 1);
    assert.match(deep.scanBuffer, /dragon/i);

    var shallow = scanWorldInfo({ entries: entries, history: history, scanDepth: 2 });
    assert.equal(shallow.activated.length, 0);
    assert.doesNotMatch(shallow.scanBuffer, /dragon/i);
  });

  it('constant 总激活；selective key 命中', function() {
    var entries = [
      { id: 'c', comment: 'const', content: 'ALWAYS', keys: [], strategy: 'constant', order: 1 },
      { id: 's', comment: 'sel', content: 'HIT', keys: ['sword'], strategy: 'selective', order: 2 },
      { id: 'm', comment: 'miss', content: 'NO', keys: ['missing'], strategy: 'selective', order: 3 },
    ];
    var history = [{ role: 'user', content: 'I draw my sword' }];
    var res = scanWorldInfo({ entries: entries, history: history, scanDepth: 2 });
    var ids = res.activated.map(function(e) { return e.id; });
    assert.deepEqual(ids, ['c', 's']);
  });

  it('支持 /regex/ 形式 key', function() {
    var entries = [
      { id: 1, content: 'RX', keys: ['/drago\\w+/i'], strategy: 'selective', order: 1 },
    ];
    var res = scanWorldInfo({
      entries: entries,
      history: [{ role: 'user', content: 'A Dragons appear' }],
      scanDepth: 1,
    });
    assert.equal(res.activated.length, 1);
  });

  it('secondaryKeys AND_ALL / NOT_ANY', function() {
    var history = [{ role: 'user', content: 'alpha beta gamma' }];
    var andAll = scanWorldInfo({
      entries: [{
        id: 1,
        content: 'ANDALL',
        keys: ['alpha'],
        secondaryKeys: ['beta', 'gamma'],
        selectiveLogic: SELECTIVE_LOGIC.AND_ALL,
        strategy: 'selective',
        order: 1,
      }],
      history: history,
      scanDepth: 1,
    });
    assert.equal(andAll.activated.length, 1);

    var andAllFail = scanWorldInfo({
      entries: [{
        id: 2,
        content: 'FAIL',
        keys: ['alpha'],
        secondaryKeys: ['beta', 'zzz'],
        selectiveLogic: SELECTIVE_LOGIC.AND_ALL,
        strategy: 'selective',
        order: 1,
      }],
      history: history,
      scanDepth: 1,
    });
    assert.equal(andAllFail.activated.length, 0);

    var notAny = scanWorldInfo({
      entries: [{
        id: 3,
        content: 'NOTANY',
        keys: ['alpha'],
        secondaryKeys: ['zzz', 'yyy'],
        selectiveLogic: SELECTIVE_LOGIC.NOT_ANY,
        strategy: 'selective',
        order: 1,
      }],
      history: history,
      scanDepth: 1,
    });
    assert.equal(notAny.activated.length, 1);

    var notAnyFail = scanWorldInfo({
      entries: [{
        id: 4,
        content: 'NOTANYFAIL',
        keys: ['alpha'],
        secondaryKeys: ['beta'],
        selectiveLogic: SELECTIVE_LOGIC.NOT_ANY,
        strategy: 'selective',
        order: 1,
      }],
      history: history,
      scanDepth: 1,
    });
    assert.equal(notAnyFail.activated.length, 0);
  });

  it('probability 用固定 rng', function() {
    var entry = {
      id: 1,
      content: 'P',
      keys: [],
      strategy: 'constant',
      prob: 30,
      useProbability: true,
      order: 1,
    };
    var fail = scanWorldInfo({
      entries: [entry],
      history: [],
      scanDepth: 0,
      rng: function() { return 0.5; },
    });
    assert.equal(fail.activated.length, 0);
    assert.equal(fail.skipped[0].reason, 'probability');

    var ok = scanWorldInfo({
      entries: [entry],
      history: [],
      scanDepth: 0,
      rng: function() { return 0.1; },
    });
    assert.equal(ok.activated.length, 1);
  });

  it('按 order 升序排序；同 order 稳序', function() {
    var entries = [
      { id: 'b', content: 'B', keys: ['x'], strategy: 'selective', order: 20 },
      { id: 'a', content: 'A', keys: ['x'], strategy: 'selective', order: 10 },
      { id: 'c1', content: 'C1', keys: ['x'], strategy: 'selective', order: 15 },
      { id: 'c2', content: 'C2', keys: ['x'], strategy: 'selective', order: 15 },
    ];
    var res = scanWorldInfo({
      entries: entries,
      history: [{ role: 'user', content: 'x' }],
      scanDepth: 1,
    });
    assert.deepEqual(res.activated.map(function(e) { return e.id; }), ['a', 'c1', 'c2', 'b']);
  });

  it('scanDepth=0 仍激活 constant，selective 不扫历史', function() {
    var res = scanWorldInfo({
      entries: [
        { id: 'c', content: 'C', strategy: 'constant', order: 1 },
        { id: 's', content: 'S', keys: ['hello'], strategy: 'selective', order: 2 },
      ],
      history: [{ role: 'user', content: 'hello world' }],
      scanDepth: 0,
    });
    assert.deepEqual(res.activated.map(function(e) { return e.id; }), ['c']);
  });
});

describe('injectWorldInfo @D', function() {
  it('depth 插入角色：depth 0 贴底，depth 1 在末条之前', function() {
    var activated = [
      {
        id: 1,
        content: 'SYS@0',
        position: 4,
        depth: 0,
        role: 0,
        order: 1,
        strategy: 'constant',
      },
      {
        id: 2,
        content: 'USER@1',
        position: 4,
        depth: 1,
        role: 1,
        order: 2,
        strategy: 'constant',
      },
    ];
    var plan = buildDepthInjections(activated);
    assert.equal(plan.length, 2);
    assert.equal(plan[0].depth, 0);
    assert.equal(plan[0].role, 'system');
    assert.equal(plan[1].role, 'user');

    var history = [
      { role: 'user', content: 'u1' },
      { role: 'assistant', content: 'a1' },
    ];
    var out = injectWorldInfo({ messages: history, activated: activated }).messages;
    // depth1 插在末条前；depth0 append
    // 期望大致: u1, USER@1, a1, SYS@0
    assert.equal(out.length, 4);
    assert.equal(out[0].content, 'u1');
    assert.equal(out[1].content, 'USER@1');
    assert.equal(out[1].role, 'user');
    assert.equal(out[2].content, 'a1');
    assert.equal(out[3].content, 'SYS@0');
    assert.equal(out[3].role, 'system');
  });
});

describe('regex pipeline', function() {
  it('markdownOnly vs promptOnly', function() {
    var scripts = [
      {
        scriptName: 'md',
        findRegex: 'foo',
        replaceString: 'MD',
        placement: [PLACEMENT_AI],
        markdownOnly: true,
        promptOnly: false,
      },
      {
        scriptName: 'pr',
        findRegex: 'bar',
        replaceString: 'PR',
        placement: [PLACEMENT_AI],
        markdownOnly: false,
        promptOnly: true,
      },
      {
        scriptName: 'both',
        findRegex: 'baz',
        replaceString: 'BZ',
        placement: [PLACEMENT_AI],
        markdownOnly: false,
        promptOnly: false,
      },
    ];

    var prompt = applyRegexPipeline('foo bar baz', scripts, {
      placement: PLACEMENT_AI,
      ephemerality: 'prompt',
      messageDepth: 0,
    });
    assert.equal(prompt.text, 'foo PR BZ');

    var display = applyRegexPipeline('foo bar baz', scripts, {
      placement: PLACEMENT_AI,
      ephemerality: 'display',
      messageDepth: 0,
    });
    assert.equal(display.text, 'MD bar BZ');
  });

  it('applyRegexToMessages 按末尾 depth 应用 USER/AI', function() {
    var scripts = [
      {
        scriptName: 'u',
        findRegex: 'secret',
        replaceString: 'XXX',
        placement: [PLACEMENT_USER],
        minDepth: 0,
        maxDepth: 0,
      },
    ];
    var msgs = [
      { role: 'user', content: 'old secret' },
      { role: 'assistant', content: 'ok' },
      { role: 'user', content: 'new secret' },
    ];
    var res = applyRegexToMessages(msgs, scripts, 'prompt');
    assert.equal(res.messages[0].content, 'old secret');
    assert.equal(res.messages[2].content, 'new XXX');
  });

  it('WORLD placement 可改条目文本', function() {
    var res = applyRegexPipeline('raw WI', [{
      scriptName: 'w',
      findRegex: 'raw',
      replaceString: 'cooked',
      placement: [PLACEMENT_WORLD],
    }], { placement: PLACEMENT_WORLD, ephemerality: 'prompt' });
    assert.equal(res.text, 'cooked WI');
  });
});

describe('buildChatCompletionMessages', function() {
  it('集成冒烟：宏、世界书、history、AN', function() {
    var built = buildChatCompletionMessages({
      char: {
        name: 'Luna',
        description: '{{char}} lives in the moon.',
        personality: 'calm',
        scenario: 'night',
        mesExample: '<START>\nUser: hi\nLuna: hello\n',
        creatorNotes: 'AN for {{user}}',
      },
      userName: 'Max',
      history: [
        { role: 'user', content: 'I see a crystal' },
        { role: 'assistant', content: 'sparkles' },
      ],
      worldbookEntries: [
        {
          id: 1,
          comment: 'crystal',
          content: 'Crystal lore',
          keys: ['crystal'],
          strategy: 'selective',
          position: 0,
          order: 5,
        },
        {
          id: 2,
          comment: 'depth',
          content: 'Depth note',
          keys: [],
          strategy: 'constant',
          position: 4,
          depth: 0,
          role: 0,
          order: 1,
        },
      ],
      regexScripts: [],
      presetMessages: [{ role: 'system', content: 'Preset sys' }],
      scanDepth: 2,
      rpCoreText: 'RP core for {{char}}',
      rng: function() { return 0; },
    });

    assert.ok(built.messages.length >= 4);
    assert.ok(built.debug.activated.length >= 2);
    var sys = built.messages.filter(function(m) { return m.role === 'system'; });
    assert.ok(sys.some(function(m) { return /RP core for Luna/.test(m.content); }));
    assert.ok(sys.some(function(m) { return /Luna lives in the moon/.test(m.content); }));
    assert.ok(sys.some(function(m) { return /Crystal lore/.test(m.content); }));
    assert.ok(sys.some(function(m) { return /AN for Max/.test(m.content); }));
    assert.ok(built.messages.some(function(m) { return m.content === 'Depth note'; }));
    assert.ok(built.messages.some(function(m) { return m.content === 'Start chat'; }));
  });
});
