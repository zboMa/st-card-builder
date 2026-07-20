import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  CORRUPTION_PRESETS,
  CORRUPTION_RULES_COMMENT,
  CORRUPTION_ARCHIVE_PREFIX,
  CORRUPTION_STATUS_MODULE_ID,
  DEFAULT_CORRUPTION_PRESET,
  normalizeCorruptionConfig,
  resolveStageNames,
  parseStageNamesFromText,
  archiveComment,
  isFemaleGender,
  isMaleGender,
  pickCorruptionTargets,
  buildRulesContent,
  buildArchiveContentTemplate,
  upsertWorldbookByComment,
  buildRulesWorldbookEntry,
  buildArchiveWorldbookEntry,
  findCorruptionEntries,
  buildCorruptionExportIssues,
  ensureCorruptionModuleInDesign,
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

  it('UI and assistant wiring present', function() {
    var panel = readFileSync(join(root, 'src/components/CharacterPanel.astro'), 'utf8');
    assert.match(panel, /charCorruptionEnabled/);
    assert.match(panel, /btnGenCorruptionLore/);
    var char = readFileSync(join(root, 'src/lib/card-builder/panels/character.mjs'), 'utf8');
    assert.match(char, /runGenerateCorruptionLore/);
    assert.match(char, /corruptionProgress/);
    var tools = readFileSync(join(root, 'src/lib/assistant/tools.mjs'), 'utf8');
    assert.match(tools, /generate_corruption_lore/);
    var exec = readFileSync(join(root, 'src/lib/assistant/executor.mjs'), 'utf8');
    assert.match(exec, /generate_corruption_lore/);
  });
});
