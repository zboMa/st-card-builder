/**
 * 从卡推定 MVU 候选变量
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  inferMvuCandidatesFromCard,
  mergeCandidatesIntoDesign,
  candidatesToVariables,
  corruptionProgressGap,
  pathLooksLikeCorruptionProgress,
  extractWorldbookPersonNames,
  inferTypeForPath,
  normalizeCardLike,
} from '../src/lib/mvu/inferFromCard.mjs';
import { CORRUPTION_STATUS_LABEL } from '../src/lib/corruptionProgress.mjs';
import { STATUS_BAR_EXT_KEY } from '../src/lib/statusBar.mjs';

describe('mvu inferFromCard', function() {
  it('normalizeCardLike reads extensions and adult corruption', function() {
    var n = normalizeCardLike({
      name: '凌霜',
      extensions: {
        [STATUS_BAR_EXT_KEY]: {
          castMode: 'single',
          presetId: 'single_romance',
          nsfw: true,
          moduleFlags: { affection: true, corruption_stage: true },
          paths: [{ path: '角色.好感度', label: '好感', sample: '10' }],
        },
        zmer_mvu_design: { variables: [{ path: '角色.好感度', type: 'number', default: 10 }] },
      },
      adultConfig: {
        enabled: true,
        corruptionEnabled: true,
        corruptionPreset: '5',
        corruptionSelectedNames: ['秦玥'],
      },
      worldbook: [{ comment: '[小说人物] 秦玥', content: '师姐', keys: ['秦玥'] }],
    });
    assert.equal(n.name, '凌霜');
    assert.ok(n.statusBar);
    assert.ok(n.mvuDesign);
    assert.equal(n.corruption.enabled, true);
    assert.deepEqual(n.corruption.selectedNames, ['秦玥']);
  });

  it('extractWorldbookPersonNames from [小说人物] comments', function() {
    var names = extractWorldbookPersonNames([
      { comment: '[小说人物] 林晚', content: '学妹' },
      { comment: '[人物] 沈知夏', content: '同门' },
      { comment: '地点·青云宗', content: '山门' },
      { comment: '恶堕档案·林晚', content: '勿用' },
    ]);
    assert.deepEqual(names, ['林晚', '沈知夏']);
  });

  it('inferTypeForPath maps affection / corruption / consent', function() {
    var aff = inferTypeForPath('角色.好感度', '好感');
    assert.equal(aff.type, 'number');
    var corr = inferTypeForPath('角色.恶堕进度', '恶堕进度', {
      stageNames: ['未触碰', '动摇', '沉沦'],
      sample: '未触碰',
    });
    assert.equal(corr.type, 'enum');
    assert.deepEqual(corr.options, ['未触碰', '动摇', '沉沦']);
    var consent = inferTypeForPath('角色.同意边界', '同意边界');
    assert.equal(consent.type, 'enum');
    assert.ok(consent.options.indexOf('停止') >= 0);
  });

  it('infers candidates from status bar modules and aligns paths', function() {
    var cands = inferMvuCandidatesFromCard({
      name: '凌霜',
      statusBarDesign: {
        castMode: 'single',
        presetId: 'single_romance',
        nsfw: false,
        moduleFlags: {
          affection: true,
          trust: true,
          relation_stage: true,
          outfit: true,
          attributes: true,
          emotion: true,
        },
        mainName: '凌霜',
        paths: [
          { path: '角色.好感度', label: '好感', sample: '42' },
          { path: '角色.着装', label: '着装', sample: '校服' },
        ],
      },
    });
    var paths = cands.map(function(c) { return c.path; });
    assert.ok(paths.indexOf('角色.好感度') >= 0);
    assert.ok(paths.indexOf('角色.着装') >= 0);
    assert.ok(paths.indexOf('角色.信任') >= 0);
    assert.ok(paths.indexOf('角色.体力') >= 0);
    var aff = cands.find(function(c) { return c.path === '角色.好感度'; });
    assert.equal(aff.type, 'number');
    assert.equal(aff.source.indexOf('statusbar'), 0);
    assert.ok(aff.name);
    assert.ok(aff.updateHint);
  });

  it('corruption enabled adds 恶堕进度; gap when MVU missing it', function() {
    var card = {
      name: '主角',
      adultConfig: {
        enabled: true,
        corruptionEnabled: true,
        corruptionPreset: '5',
      },
      statusBarDesign: {
        castMode: 'single',
        moduleFlags: { affection: true },
        nsfw: true,
        mainName: '主角',
      },
      mvuDesign: {
        variables: [{ path: '角色.好感度', type: 'number', default: 0 }],
      },
    };
    var cands = inferMvuCandidatesFromCard(card);
    var corr = cands.find(function(c) {
      return pathLooksLikeCorruptionProgress(c.path);
    });
    assert.ok(corr, 'should infer corruption_stage');
    assert.equal(corr.name, CORRUPTION_STATUS_LABEL);
    assert.equal(corr.type, 'enum');
    assert.ok(Array.isArray(corr.options) && corr.options.length >= 2);

    var gap = corruptionProgressGap(card);
    assert.equal(gap.gap, true);
    assert.match(gap.message, /恶堕/);

    var filled = corruptionProgressGap({
      adultConfig: { corruptionEnabled: true },
      mvuDesign: {
        variables: [{ path: '角色.恶堕进度', type: 'enum', default: '未触碰' }],
      },
    });
    assert.equal(filled.gap, false);
  });

  it('adult mode adds consent boundary; skips child-sexualization names', function() {
    var cands = inferMvuCandidatesFromCard({
      name: '角色',
      adultConfig: { enabled: true },
      statusBarDesign: {
        castMode: 'single',
        moduleFlags: { emotion: true },
        mainName: '角色',
      },
    });
    assert.ok(cands.some(function(c) { return c.path === '角色.同意边界'; }));
    assert.ok(cands.every(function(c) {
      return !/儿童|幼女|未成年/.test(c.path + c.name);
    }));
  });

  it('multi cast uses NPC.Name paths for selected characters', function() {
    var cands = inferMvuCandidatesFromCard({
      name: '主角',
      statusBarDesign: {
        castMode: 'multi',
        presetId: 'multi_harem',
        mainName: '秦玥',
        moduleFlags: { affection: true, corruption_stage: true },
        nsfw: true,
        characters: [
          { name: '秦玥', selected: true },
          { name: '沈知夏', selected: true },
          { name: '路人甲', selected: false },
        ],
      },
      adultConfig: { enabled: true, corruptionEnabled: true, corruptionPreset: '3' },
    });
    var paths = cands.map(function(c) { return c.path; });
    assert.ok(paths.indexOf('NPC.秦玥.好感度') >= 0);
    assert.ok(paths.indexOf('NPC.沈知夏.好感度') >= 0);
    assert.ok(paths.indexOf('NPC.路人甲.好感度') < 0);
    assert.ok(paths.indexOf('NPC.秦玥.恶堕进度') >= 0);
    assert.ok(paths.indexOf('NPC.秦玥.同意边界') >= 0);
  });

  it('mergeCandidatesIntoDesign upserts by path; onlySelected', function() {
    var existing = {
      summary: '旧',
      variables: [
        { path: '角色.好感度', type: 'number', default: 1, description: '好感' },
      ],
    };
    var cands = [
      {
        name: '好感', path: '角色.好感度', type: 'number', initial: 42,
        updateHint: '互动增减', source: 'statusbar:affection', selected: true,
      },
      {
        name: '恶堕进度', path: '角色.恶堕进度', type: 'enum', initial: '未触碰',
        options: ['未触碰', '动摇'], updateHint: '递进', source: 'statusbar:corruption_stage',
        selected: true,
      },
      {
        name: '信任', path: '角色.信任', type: 'number', initial: 10,
        updateHint: '…', source: 'statusbar:trust', selected: false,
      },
    ];
    var merged = mergeCandidatesIntoDesign(existing, cands);
    assert.equal(merged.updated, 1);
    assert.equal(merged.added, 1);
    assert.equal(merged.variables.length, 2);
    var aff = merged.variables.find(function(v) { return v.path === '角色.好感度'; });
    assert.equal(aff.default, 42);
    assert.ok(merged.variables.some(function(v) { return v.path === '角色.恶堕进度'; }));
    assert.ok(!merged.variables.some(function(v) { return v.path === '角色.信任'; }));

    var vars = candidatesToVariables([cands[1]]);
    assert.equal(vars[0].type, 'enum');
    assert.ok(vars[0].options.length >= 2);
    assert.deepEqual(vars[0].check, ['递进']);
  });

  it('alreadyPresent candidates default unselected', function() {
    var cands = inferMvuCandidatesFromCard({
      name: '凌霜',
      statusBarDesign: {
        castMode: 'single',
        moduleFlags: { affection: true },
        mainName: '凌霜',
        paths: [{ path: '角色.好感度', label: '好感', sample: '5' }],
      },
      mvuDesign: {
        variables: [{ path: '角色.好感度', type: 'number', default: 5 }],
      },
    });
    var aff = cands.find(function(c) { return c.path === '角色.好感度'; });
    assert.ok(aff);
    assert.equal(aff.alreadyPresent, true);
    assert.equal(aff.selected, false);
  });
});
