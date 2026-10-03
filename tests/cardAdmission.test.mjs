import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildCardJSONFromDraft } from '../src/lib/card-builder/state.mjs';
import { fromStImportEntry, fromAiJsonEntry } from '../src/lib/worldbook/worldbookEntryBridge.mjs';
import { resolveEntryPosition } from '../src/lib/worldbook/entryPosition.mjs';
import { normalizeWorldInfoEntry } from '../src/lib/chatRuntime/worldInfo/normalize.mjs';
import { auditWorldbookAdmission, suggestContractLift } from '../src/lib/card-builder/worldbookAdmissionAudit.mjs';
import { DEFAULT_PROMPTS } from '../src/lib/promptCanon.mjs';
import { buildNovelEntryPatch } from '../src/lib/worldbook/worldbookEntryBridge.mjs';

function draftEntry(extra) {
  return Object.assign({
    id: 'e1',
    kind: 'user',
    owner: 'user',
    ownerSlot: 'e1',
    displayName: '规则',
    content: '不许替用户行动。',
    keys: [],
    strategy: 'constant',
    position: 0,
    enabled: true,
  }, extra || {});
}

describe('写卡准入与导出', function() {
  it('常驻带触发词会报，缺势力不会报', function() {
    var issues = auditWorldbookAdmission({
      description: '两人。不许替用户行动。',
      entries: [
        draftEntry({ keys: ['禁令'], content: '不许替用户行动。' }),
        draftEntry({
          id: 'e2', ownerSlot: 'e2', displayName: '甲',
          strategy: 'selective', keys: ['甲'], content: '在场。',
        }),
      ],
    });
    assert.ok(issues.some(function(i) { return i.code === 'constant-keys'; }));
    assert.ok(!issues.some(function(i) { return /势力|物品|能力|覆盖/.test(i.code + i.message); }));
  });

  it('没有脚本时，开着且无触发词是死条目；有脚本只提示', function() {
    var entry = draftEntry({
      strategy: 'selective', keys: [], content: '调色盘', displayName: '调色盘',
    });
    var dead = auditWorldbookAdmission({ description: '有契约', entries: [entry] });
    assert.ok(dead.some(function(i) { return i.code === 'dead-selective'; }));
    var hinted = auditWorldbookAdmission({
      description: '有契约', entries: [entry], hasScripts: true,
    });
    assert.ok(hinted.some(function(i) { return i.code === 'maybe-script' && i.level === 'hint'; }));
  });

  it('同组只报告开了几条，不要求只能开一条', function() {
    var issues = auditWorldbookAdmission({
      description: '有契约',
      entries: [
        draftEntry({ displayName: '难', group: '难度', strategy: 'constant', keys: [], content: '难。' }),
        draftEntry({ id: 'e2', ownerSlot: 'e2', displayName: '易', group: '难度', strategy: 'constant', keys: [], content: '易。' }),
      ],
    });
    var group = issues.find(function(i) { return i.code === 'group-count'; });
    assert.ok(group);
    assert.match(group.message, /开着 2 条/);
  });

  it('简单卡不要求职责、调色盘或脚本', function() {
    var issues = auditWorldbookAdmission({
      description: '夜里两人。不许替用户行动。',
      entries: [
        draftEntry({ content: '不许替用户行动。' }),
      ],
    });
    assert.ok(!issues.some(function(i) { return i.code === 'dead-selective' || i.code === 'empty-description'; }));
  });

  it('前插和后插在导出、导入、试聊里是同一个位置', function() {
    var json = buildCardJSONFromDraft({
      charName: '甲',
      charDesc: '契约',
      worldbookEntries: [
        draftEntry({
          displayName: '前', position: 0, content: '前规则',
          job: '总在场的禁令', group: '难度', reads: '世界.当前地点',
          preventRecursion: true,
        }),
        draftEntry({ id: 'e2', ownerSlot: 'e2', displayName: '后', position: 1, strategy: 'selective', keys: ['后'], content: '后文' }),
      ],
      regexScripts: [{ id: 'rx', find: 'a', replace: 'b' }],
      tavernHelperScripts: [{ name: 'helper', content: 'return 1' }],
    });
    var book = json.data.character_book.entries;
    assert.equal(book[0].position, 'before_char');
    assert.equal(book[0].extensions.position, 0);
    assert.equal(book[0].extensions.group, '难度');
    assert.equal(book[0].extensions.stcb.job, '总在场的禁令');
    assert.equal(book[0].extensions.stcb.reads, '世界.当前地点');
    assert.doesNotMatch(book[0].content, /总在场的禁令/);
    var lifted = fromStImportEntry(book[0]);
    assert.equal(lifted.job, '总在场的禁令');
    assert.equal(lifted.group, '难度');
    assert.equal(lifted.reads, '世界.当前地点');
    assert.equal(book[0].extensions.prevent_recursion, true);
    assert.equal(lifted.preventRecursion, true);
    var missingPath = auditWorldbookAdmission({
      description: '有契约',
      entries: [draftEntry({ reads: '世界.不存在', content: '读一条不存在的路径。', strategy: 'constant', keys: [] })],
      variablePaths: ['世界.当前地点'],
    });
    assert.ok(missingPath.some(function(i) { return i.code === 'reads-missing'; }));
    assert.equal(book[1].position, 'after_char');
    assert.equal(book[1].extensions.position, 1);
    assert.equal(json.data.extensions.regex_scripts[0].id, 'rx');
    assert.equal(json.data.extensions.tavern_helper.scripts[0].name, 'helper');

    var imported = fromStImportEntry(book[1]);
    assert.equal(imported.position, 1);
    var chat = normalizeWorldInfoEntry(book[1], 1);
    assert.equal(chat.position, 1);
    var before = normalizeWorldInfoEntry({ comment: '前', content: 'c', position: 'before_char', keys: [] }, 0);
    assert.equal(before.position, 0);
    assert.equal(resolveEntryPosition({
      position: 'before_char',
      extensions: { position: 4 },
    }), 4);
  });

  it('模板语法在导出和重写合并里都还在', function() {
    var content = '开场 <% if (true) { %>在<% } %> {{getvar::世界.当前地点}}';
    var json = buildCardJSONFromDraft({
      charName: '甲',
      worldbookEntries: [draftEntry({ content: content, position: 1, strategy: 'selective', keys: ['甲'] })],
    });
    assert.equal(json.data.character_book.entries[0].content, content);
    var merged = fromAiJsonEntry({
      comment: '规则',
      content: '模型改写成了散文',
      keys: ['甲'],
      strategy: 'selective',
    }, draftEntry({ content: content }));
    assert.equal(merged.content, content);
  });

  it('开场和契约提示词不再规定条数和字数下限', function() {
    assert.doesNotMatch(DEFAULT_PROMPTS.greetingGen, /固定 2|≥150|至少 150/);
    assert.doesNotMatch(DEFAULT_PROMPTS.assistantCharField, /至少 400/);
    assert.doesNotMatch(DEFAULT_PROMPTS.wbEnrichFromOutline, /content≥150|至少 150/);
    assert.match(DEFAULT_PROMPTS.wbEnrichFromOutline, /<% %>|原样保留/);
  });

  it('空描述只提示可抬的契约，已有描述或过长常驻不抬', function() {
    assert.equal(suggestContractLift({
      description: '已有契约',
      systemPrompt: '系统里的另一段契约说明',
    }), null);
    var fromSystem = suggestContractLift({
      description: '',
      systemPrompt: '你是店员。不许替用户行动。',
    });
    assert.equal(fromSystem.source, 'system_prompt');
    assert.match(fromSystem.text, /不许替用户行动/);
    var fromConstant = suggestContractLift({
      description: '  ',
      entries: [draftEntry({ displayName: '总则', content: '夜里两人。不许替用户行动。' })],
    });
    assert.equal(fromConstant.source, 'constant');
    assert.equal(fromConstant.name, '总则');
    assert.equal(suggestContractLift({
      description: '',
      entries: [draftEntry({ content: '很长'.repeat(500) })],
    }), null);
  });

  it('工坊人物仍是一条，职责默认是身份与经历', function() {
    var entry = buildNovelEntryPatch('novel_person', '阿岚', { content: '她在青城长大。', keys: ['阿岚'] });
    assert.equal(entry.kind, 'novel_person');
    assert.equal(entry.job, '身份与经历');
    assert.equal(entry.content, '她在青城长大。');
  });

  it('快速检查不再读取已删除的维度覆盖', function() {
    var src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/lib/card-builder/worldbookAuditorBoot.mjs'), 'utf8');
    assert.doesNotMatch(src, /dimensions:\s*dimensions/);
    assert.doesNotMatch(src, /function detectDimensionCoverage/);
  });
});
