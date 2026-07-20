import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  CORRUPTION_PRESETS,
  CORRUPTION_ARC_BRIEFS,
  CORRUPTION_ARC_BRIEF_IDS,
  CORRUPTION_RULES_COMMENT,
  CORRUPTION_ARCHIVE_PREFIX,
  CORRUPTION_STATUS_MODULE_ID,
  DEFAULT_CORRUPTION_PRESET,
  STAGE_SECTION_HINTS,
  normalizeCorruptionConfig,
  resolveStageNames,
  parseStageNamesFromText,
  archiveComment,
  isFemaleGender,
  isMaleGender,
  pickCorruptionTargets,
  buildRulesContent,
  buildArchiveContentTemplate,
  buildArchiveUserPrompt,
  upsertWorldbookByComment,
  buildRulesWorldbookEntry,
  buildArchiveWorldbookEntry,
  findCorruptionEntries,
  buildCorruptionExportIssues,
  ensureCorruptionModuleInDesign,
  evaluateArchiveRichness,
  findWorldbookPersonContext,
  CORRUPTION_MIN_CHARS_PER_STAGE,
} from '../src/lib/corruptionProgress.mjs';
import { STATUS_BAR_MODULES, buildPlaceholderPaths } from '../src/lib/statusBar.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('corruptionProgress', function() {
  it('default preset is 5 stages', function() {
    assert.equal(DEFAULT_CORRUPTION_PRESET, '5');
    assert.equal(CORRUPTION_PRESETS['5'].stages.length, 5);
    assert.deepEqual(resolveStageNames('5'), CORRUPTION_PRESETS['5'].stages);
    assert.equal(resolveStageNames('3').length, 3);
    assert.equal(resolveStageNames('7').length, 7);
  });

  it('弧光母题包含三则 brief', function() {
    assert.ok(CORRUPTION_ARC_BRIEF_IDS.length >= 3);
    ['sacred_collapse', 'hero_complicity', 'vengeance_entry'].forEach(function(id) {
      assert.ok(CORRUPTION_ARC_BRIEFS[id], id);
      assert.ok(String(CORRUPTION_ARC_BRIEFS[id].brief || '').length >= 40, id);
    });
  });

  it('custom stages from array or arrow text', function() {
    var a = resolveStageNames('custom', ['A', 'B', 'C']);
    assert.deepEqual(a, ['A', 'B', 'C']);
    var b = parseStageNamesFromText('清白 → 裂痕 → 沉沦 → 定型');
    assert.equal(b.length, 4);
    assert.ok(b.indexOf('沉沦') >= 0);
    var c = parseStageNamesFromText('{"stages":["一","二","三"]}');
    assert.deepEqual(c, ['一', '二', '三']);
  });

  it('normalizeCorruptionConfig defaults', function() {
    var n = normalizeCorruptionConfig({});
    assert.equal(n.enabled, false);
    assert.equal(n.preset, '5');
    assert.equal(n.stageNames.length, 5);
    assert.equal(n.defaultFemaleOnly, true);
    assert.equal(n.extraNotes, '');
    assert.ok(Array.isArray(STAGE_SECTION_HINTS) && STAGE_SECTION_HINTS.length >= 4);
  });

  it('附加设定注入档案生成提示', function() {
    var n = normalizeCorruptionConfig({
      corruptionExtraNotes: '  触发：告解室钥匙  ',
      corruptionCustomBrief: '圣职弧',
    });
    assert.equal(n.extraNotes, '触发：告解室钥匙');
    assert.equal(n.customBrief, '圣职弧');
    var prompt = buildArchiveUserPrompt({
      charName: '林晚',
      stageNames: CORRUPTION_PRESETS['3'].stages,
      worldbookContent: '林晚是成年圣职者。',
      customBrief: n.customBrief,
      extraNotes: n.extraNotes,
    });
    assert.match(prompt, /弧光补充/);
    assert.match(prompt, /圣职弧/);
    assert.match(prompt, /附加设定/);
    assert.match(prompt, /告解室钥匙/);
  });

  it('gender helpers and pick targets', function() {
    assert.equal(isFemaleGender('女'), true);
    assert.equal(isFemaleGender('female'), true);
    assert.equal(isMaleGender('男'), true);
    assert.equal(isFemaleGender('男'), false);
    var picks = pickCorruptionTargets([
      { name: 'Alice', gender: '女' },
      { name: 'Bob', gender: '男' },
      { name: 'Chris', gender: '未提及' },
    ], { defaultFemaleOnly: true });
    assert.equal(picks.find(function(p) { return p.name === 'Alice'; }).selected, true);
    assert.equal(picks.find(function(p) { return p.name === 'Bob'; }).selected, false);
    assert.equal(picks.find(function(p) { return p.name === 'Chris'; }).selected, false);
    var withUnknown = pickCorruptionTargets(
      [{ name: 'Main', gender: '' }],
      { defaultFemaleOnly: true, includeUnknown: true }
    );
    assert.equal(withUnknown[0].selected, true);
  });

  it('rules + archive worldbook upsert by comment', function() {
    var stages = CORRUPTION_PRESETS['5'].stages;
    var rules = buildRulesWorldbookEntry(stages);
    assert.equal(rules.comment, CORRUPTION_RULES_COMMENT);
    assert.equal(rules.strategy, 'constant');
    assert.match(rules.content, /未触碰/);
    assert.match(buildRulesContent(stages), /恶堕进度/);

    var arch = buildArchiveWorldbookEntry('林晚', buildArchiveContentTemplate('林晚', stages), ['晚晚']);
    assert.equal(arch.comment, CORRUPTION_ARCHIVE_PREFIX + '林晚');
    assert.equal(arch.strategy, 'selective');
    assert.ok(arch.keys.indexOf('林晚') >= 0);
    assert.match(arch.content, /## 动摇/);

    var entries = [];
    entries = upsertWorldbookByComment(entries, rules);
    entries = upsertWorldbookByComment(entries, arch);
    entries = upsertWorldbookByComment(entries, Object.assign({}, arch, { content: 'updated' }));
    assert.equal(entries.length, 2);
    assert.equal(entries[1].content, 'updated');
    var found = findCorruptionEntries(entries);
    assert.ok(found.rules);
    assert.equal(found.archives.length, 1);
  });

  it('export issues when enabled without lore', function() {
    var none = buildCorruptionExportIssues({ enabled: false });
    assert.equal(none.length, 0);
    var warn = buildCorruptionExportIssues({ enabled: true, worldbookEntries: [] });
    assert.ok(warn.some(function(i) { return i.code === 'corruption_no_rules'; }));
    assert.ok(warn.some(function(i) { return i.code === 'corruption_no_archive_any'; }));
    var stages = CORRUPTION_PRESETS['5'].stages;
    var entries = [
      buildRulesWorldbookEntry(stages),
      buildArchiveWorldbookEntry('A', buildArchiveContentTemplate('A', stages)),
    ];
    var okSel = buildCorruptionExportIssues({
      enabled: true,
      worldbookEntries: entries,
      selectedNames: ['A'],
    });
    assert.equal(okSel.length, 0);
    var missing = buildCorruptionExportIssues({
      enabled: true,
      worldbookEntries: entries,
      selectedNames: ['A', 'B'],
    });
    assert.ok(missing.some(function(i) { return i.code === 'corruption_no_archive'; }));
  });

  it('status bar module corruption_stage exists and paths', function() {
    assert.ok(STATUS_BAR_MODULES.some(function(m) {
      return m.id === CORRUPTION_STATUS_MODULE_ID && m.nsfw && m.label === '恶堕进度';
    }));
    var paths = buildPlaceholderPaths({
      castMode: 'single',
      mainName: '角色',
      moduleFlags: { corruption_stage: true, relation_stage: true },
      nsfw: true,
    });
    assert.ok(paths.some(function(p) { return /恶堕进度/.test(p.path); }));
  });

  it('ensureCorruptionModuleInDesign toggles flag', function() {
    var d = ensureCorruptionModuleInDesign({ moduleFlags: {}, nsfw: false }, ['未触碰', '沉沦']);
    assert.equal(d.nsfw, true);
    assert.equal(d.moduleFlags.corruption_stage, true);
  });

  it('UI and assistant wiring present on adult-config module', function() {
    var panel = readFileSync(join(root, 'src/components/AdultConfigPanel.astro'), 'utf8');
    assert.match(panel, /adultCorruptionEnabled/);
    assert.match(panel, /btnGenCorruptionLore/);
    var adult = readFileSync(join(root, 'src/lib/card-builder/panels/adultConfig.mjs'), 'utf8');
    assert.match(adult, /runGenerateCorruptionLore/);
    assert.match(adult, /findWorldbookPersonContext/);
    assert.match(adult, /evaluateArchiveRichness/);
    var charPanel = readFileSync(join(root, 'src/components/CharacterPanel.astro'), 'utf8');
    assert.doesNotMatch(charPanel, /adultNsfwEnabled|charNsfwEnabled/);
    assert.match(charPanel, /世界与限定/);
    var tools = readFileSync(join(root, 'src/lib/assistant/tools.mjs'), 'utf8');
    assert.match(tools, /generate_corruption_lore/);
    assert.match(tools, /adult-config/);
    var exec = readFileSync(join(root, 'src/lib/assistant/executor.mjs'), 'utf8');
    assert.match(exec, /generate_corruption_lore/);
  });

  it('archive richness gate and worldbook person lookup', function() {
    var stages = CORRUPTION_PRESETS['5'].stages;
    var thin = '## 未触碰\n短\n## 动摇\n短\n## 越界\n短\n## 沉沦\n短\n## 彻底恶堕\n短';
    var ev = evaluateArchiveRichness(thin, stages);
    assert.equal(ev.ok, false);
    assert.ok(ev.weakStages.length >= 1);
    var fatBody = '这是一段足够长的恶堕阶段正文用来通过字数门禁检查一二三四五六七八九十。'.repeat(8);
    var fat = stages.map(function(s) { return '## ' + s + '\n' + fatBody; }).join('\n');
    assert.equal(evaluateArchiveRichness(fat, stages).ok, true);
    var hit = findWorldbookPersonContext([
      { comment: '[小说人物] 林晚', content: '林晚是学妹', keys: ['林晚'] },
      { comment: '恶堕档案·林晚', content: '勿用' },
    ], '林晚');
    assert.ok(hit);
    assert.match(hit.content, /学妹/);
  });

  it('pipeline docs: adult config separate; worldbook person prefix', function() {
    var adult = readFileSync(join(root, 'src/components/AdultConfigPanel.astro'), 'utf8');
    assert.match(adult, /仅世界书管道|世界书管道/);
    var chars = readFileSync(join(root, 'src/components/novel/NovelCharactersPanel.astro'), 'utf8');
    assert.match(chars, /世界书人物条/);
    assert.doesNotMatch(chars, /同步所选 → 角色设定/);
    var wb = readFileSync(join(root, 'src/components/WorldbookPanel.astro'), 'utf8');
    assert.match(wb, /wbIncludeCharData/);
    assert.doesNotMatch(wb, /id="wbIncludeCharData" checked/);
    var bridge = readFileSync(join(root, 'src/lib/novel/shared/bridge.mjs'), 'utf8');
    assert.match(bridge, /redirectedFrom:\s*'character'|character_worldbook/);
    assert.match(bridge, /asProtagonist/);
  });
});
