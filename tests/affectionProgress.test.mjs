import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AFFECTION_PRESETS,
  AFFECTION_ANCHOR_LINES,
  AFFECTION_STATUS_LABEL,
  AFFECTION_RULES_COMMENT,
  AFFECTION_ARCHIVE_PREFIX,
  AFFECTION_GENERAL_ARCHIVE_COMMENT,
  AFFECTION_STATUS_MODULE_ID,
  AFFECTION_STAGE_MIN,
  DEFAULT_AFFECTION_PRESET,
  normalizeAffectionConfig,
  resolveAffectionStageNames,
  parseAffectionStageNamesFromText,
  pickAffectionTargets,
  buildRulesContent,
  buildRulesWorldbookEntry,
  buildGeneralArchiveEntry,
  buildGeneralArchiveContent,
  buildArchiveContentTemplate,
  buildArchiveWorldbookEntry,
  findAffectionEntries,
  buildAffectionExportIssues,
  ensureAffectionModuleInDesign,
  getAffectionStatusSample,
  upsertWorldbookByComment,
} from '../src/lib/affectionProgress.mjs';
import { buildTrackRulesContent, valueToStageName, valueToStageIndex } from '../src/lib/progressTrack.mjs';

describe('affectionProgress', function() {
  it('presets / defaults', function() {
    assert.equal(DEFAULT_AFFECTION_PRESET, '6');
    assert.equal(AFFECTION_PRESETS['6'].stages.length, 6);
    assert.equal(AFFECTION_PRESETS['6'].stages[AFFECTION_PRESETS['6'].stages.length - 1], '灵魂伴侣');
    assert.deepEqual(resolveAffectionStageNames('6'), AFFECTION_PRESETS['6'].stages);
    assert.ok(AFFECTION_PRESETS['6'].stages.indexOf(AFFECTION_STATUS_LABEL) < 0);
  });

  it('normalizeAffectionConfig defaults', function() {
    var n = normalizeAffectionConfig({});
    assert.equal(n.enabled, false);
    assert.equal(n.preset, '6');
    assert.ok(Array.isArray(n.stageNames) && n.stageNames.length >= AFFECTION_STAGE_MIN);
    assert.deepEqual(n.selectedNames, []);
  });

  it('parseAffectionStageNamesFromText', function() {
    var b = parseAffectionStageNamesFromText('陌生 → 相识 → 亲近 → 信赖 → 亲密 → 灵魂伴侣');
    assert.ok(b.indexOf('亲近') >= 0);
    assert.ok(b.indexOf('灵魂伴侣') >= 0);
  });

  it('pickAffectionTargets 不限性别（男女均可入选）', function() {
    var picks = pickAffectionTargets([
      { name: '林晚', gender: '女', selected: true },
      { name: '陆沉', gender: '男', selected: true },
      { name: '林晚' },
    ]);
    assert.equal(picks.length, 2);
    assert.ok(picks.some(function(p) { return p.name === '林晚'; }));
    assert.ok(picks.some(function(p) { return p.name === '陆沉'; }));
  });

  it('rules 含 0-100 档位映射与事件锚点；strategy constant', function() {
    var stages = AFFECTION_PRESETS['6'].stages;
    var rules = buildRulesWorldbookEntry(stages);
    assert.equal(rules.comment, AFFECTION_RULES_COMMENT);
    assert.equal(rules.strategy, 'constant');
    assert.match(rules.content, /亲密度/);
    assert.match(rules.content, /0-100/);
    assert.match(rules.content, /双向|波动/);
    assert.match(rules.content, /突破|里程碑|锚点/);
    assert.match(buildRulesContent(stages), /事件锚点表/);
    assert.match(buildRulesContent(stages), /禁止凭空增减/);
  });

  it('通用档案：不绑名字、常驻、按档位含通用演绎框架与 NPC 变量说明', function() {
    var stages = AFFECTION_PRESETS['6'].stages;
    var gen = buildGeneralArchiveEntry(stages);
    assert.equal(gen.comment, AFFECTION_GENERAL_ARCHIVE_COMMENT);
    assert.equal(gen.strategy, 'constant');
    var content = buildGeneralArchiveContent(stages);
    assert.ok(content.indexOf('NPC.{角色名}.' + AFFECTION_STATUS_LABEL) >= 0, '动态变量说明缺失');
    assert.match(content, /## 亲近/);
    assert.match(content, /突破条件/);
  });

  it('逐人档案模板：按档位分节 + 突破条件占位', function() {
    var stages = AFFECTION_PRESETS['6'].stages;
    var tpl = buildArchiveContentTemplate('苏晚', stages);
    assert.match(tpl, /## 信赖/);
    assert.match(tpl, /突破条件/);
    assert.match(tpl, /0-100/);
    var arch = buildArchiveWorldbookEntry('苏晚', tpl, ['晚晚']);
    assert.equal(arch.comment, AFFECTION_ARCHIVE_PREFIX + '苏晚');
    assert.ok(arch.keys.indexOf('苏晚') >= 0);
  });

  it('export issues', function() {
    var none = buildAffectionExportIssues({ enabled: false });
    assert.equal(none.length, 0);
    var warn = buildAffectionExportIssues({ enabled: true, worldbookEntries: [] });
    assert.ok(warn.some(function(i) { return i.code === 'affection_no_rules'; }));
    assert.ok(warn.some(function(i) { return i.code === 'affection_no_archive_any'; }));
    var stages = AFFECTION_PRESETS['6'].stages;
    var okSel = buildAffectionExportIssues({
      enabled: true,
      worldbookEntries: [
        buildRulesWorldbookEntry(stages),
        buildArchiveWorldbookEntry('苏晚', buildArchiveContentTemplate('苏晚', stages), []),
      ],
      selectedNames: ['苏晚'],
    });
    assert.equal(okSel.length, 0);
  });

  it('ensureAffectionModuleInDesign toggles flag and numeric sample', function() {
    var d = ensureAffectionModuleInDesign({ moduleFlags: {}, nsfw: false }, AFFECTION_PRESETS['6'].stages);
    assert.equal(d.moduleFlags[AFFECTION_STATUS_MODULE_ID], true);
    assert.equal(getAffectionStatusSample(AFFECTION_PRESETS['6'].stages), '30');
  });

  it('upsert by comment 复用', function() {
    var stages = AFFECTION_PRESETS['6'].stages;
    var entries = upsertWorldbookByComment([], buildRulesWorldbookEntry(stages));
    var found = findAffectionEntries(entries);
    assert.ok(found.rules);
  });
});

describe('progressTrack shared math', function() {
  it('valueToStageName 0-100 → 档位', function() {
    var names = ['未触碰', '动摇', '越界', '沉沦', '彻底恶堕'];
    assert.equal(valueToStageName(0, names), '未触碰');
    assert.equal(valueToStageName(100, names), '彻底恶堕');
    assert.equal(valueToStageName(30, names), '动摇');
    assert.equal(valueToStageName(45, names), '越界');
    assert.equal(valueToStageIndex(100, names.length), names.length - 1);
  });

  it('buildTrackRulesContent 含档位映射与增长规则', function() {
    var text = buildTrackRulesContent({
      title: '亲密度总则',
      statusLabel: '亲密度',
      archivePrefix: '亲密档案·',
      stageNames: ['陌生', '相识', '亲密'],
      direction: 'fluctuate',
    });
    assert.match(text, /0-100/);
    assert.match(text, /单向递增|双向/);
    assert.match(text, /0-32 陌生|陌生/);
  });
});
