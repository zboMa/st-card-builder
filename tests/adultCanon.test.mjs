/**
 * 成人 Canon digest + 上下文预算 + NTL items note
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAdultCanonDigest,
  formatCorruptionArchiveDigests,
} from '../src/lib/novel/adultCanon.mjs';
import {
  ADULT_CANON_BUDGET,
  CONTEXT_HARD_CAP,
  SETUP_ENTITY_SUMMARY,
  PRIOR_WB_EXTRACT_PER,
  PRIOR_CHARS_BUDGET,
  clampBudget,
} from '../src/lib/novel/contextBudgets.mjs';
import {
  buildNtlTabooHintFromTypes,
  normalizeNtlTabooItems,
  setNtlMode,
  setNtlTabooItems,
  buildNtlTabooHint,
  NTL_TABOO_TYPES,
} from '../src/lib/novel/nsfwSupport.mjs';
import { createDefaultNovelState } from '../src/lib/novel/state.mjs';

describe('contextBudgets', function() {
  it('硬顶与默认预算合理', function() {
    assert.equal(CONTEXT_HARD_CAP, 50000);
    assert.equal(ADULT_CANON_BUDGET, 40000);
    assert.ok(SETUP_ENTITY_SUMMARY >= 800);
    assert.ok(PRIOR_WB_EXTRACT_PER >= 600);
    assert.ok(PRIOR_CHARS_BUDGET >= 12000);
    assert.equal(clampBudget(999999), CONTEXT_HARD_CAP);
    assert.equal(clampBudget(0), ADULT_CANON_BUDGET);
  });
});

describe('adultCanon', function() {
  it('digest 含人物 NSFW/NTL 与联动硬约束', function() {
    var digest = buildAdultCanonDigest({
      entities: [{
        type: 'person',
        name: '秦月',
        summary: '冷艳师姐',
        attrs: {
          profile: {
            NSFW_information: {
              sexual_personality: '外冷内热，被信任后会失控',
              contrast: '课堂清冷 / 私下渴求',
              Kinks: ['束缚', '支配'],
              Limits: ['公开暴露'],
            },
          },
          ntl: {
            powerDynamic: '学姐以指导之名掌控节奏',
            tabooThemes: ['师徒越界'],
            coercionHint: '以成绩与推荐信施压',
            moralConflict: '明知不该仍沉溺',
          },
        },
        content: '秦月是学院里最冷的人，却在夜里写下不敢示人的欲望。'.repeat(3),
      }],
      worldbookEntries: [{
        comment: '恶堕档案·秦月',
        content: '## 未触碰\n清冷自持。\n## 动摇\n目光开始躲闪。\n## 沉沦\n主动靠近禁忌。',
      }],
      styleText: '## NSFW 文风指令\n写身体反应时要具体，避免空泛形容词。\n',
      budget: 8000,
    });
    assert.match(digest, /成人 Canon/);
    assert.match(digest, /秦月/);
    assert.match(digest, /情欲性格|外冷内热/);
    assert.match(digest, /NTL|权力|师徒/);
    assert.match(digest, /恶堕档案/);
    assert.match(digest, /联动硬约束/);
    assert.match(digest, /文风 NSFW/);
  });

  it('恶堕互见排除当前角色', function() {
    var entries = [
      { comment: '恶堕档案·甲', content: '## 未触碰\n甲阶段文。'.repeat(20) },
      { comment: '恶堕档案·乙', content: '## 未触碰\n乙阶段文。'.repeat(20) },
    ];
    var all = formatCorruptionArchiveDigests(entries);
    assert.match(all, /甲/);
    assert.match(all, /乙/);
    var excl = formatCorruptionArchiveDigests(entries, { excludeName: '甲' });
    assert.doesNotMatch(excl, /恶堕档案·甲|- 甲/);
    assert.match(excl, /乙/);
  });

  it('预算不超过硬顶', function() {
    var bigPerson = {
      type: 'person',
      name: '长文角色',
      summary: 'x'.repeat(2000),
      attrs: {
        profile: {
          NSFW_information: {
            sexual_personality: 'y'.repeat(5000),
            contrast: 'z'.repeat(5000),
            Kinks: ['a', 'b', 'c'],
            Limits: ['d'],
            inner_erotic_thoughts: 't'.repeat(8000),
          },
        },
      },
      content: '正文'.repeat(5000),
    };
    var digest = buildAdultCanonDigest({
      entities: [bigPerson, Object.assign({}, bigPerson, { name: '角色2' })],
      budget: 60000,
    });
    var compact = digest.replace(/\s+/g, '').length;
    assert.ok(compact <= CONTEXT_HARD_CAP + 50, 'compact=' + compact);
  });
});

describe('ntlTabooItems notes', function() {
  it('normalize 保留 note，hint 注入用户补充', function() {
    var items = normalizeNtlTabooItems(
      [{ id: 'yuri_destruction', note: '侧重破局后的余温与悔恨' }, { id: 'power_coercion' }],
      [],
      Object.keys(NTL_TABOO_TYPES)
    );
    assert.equal(items.length, 2);
    assert.equal(items[0].note, '侧重破局后的余温与悔恨');
    var hint = buildNtlTabooHintFromTypes(items, { tabooTypes: NTL_TABOO_TYPES });
    assert.match(hint, /用户补充/);
    assert.match(hint, /余温与悔恨/);
  });

  it('state setNtlTabooItems 同步 types 与 hint', function() {
    var s = createDefaultNovelState();
    setNtlMode(s, true);
    setNtlTabooItems(s, [
      { id: 'yuri_destruction', note: '百合破坏要写清原纽带残片' },
    ]);
    assert.deepEqual(s.ntlTabooTypes, ['yuri_destruction']);
    var hint = buildNtlTabooHint(s);
    assert.match(hint, /百破|百合/);
    assert.match(hint, /原纽带残片/);
  });
});
