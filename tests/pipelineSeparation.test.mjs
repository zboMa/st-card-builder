/**
 * 主角管道 vs 世界书管道隔离
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPersonWorldbookComment,
  personNameFromWorldbookComment,
  protagonistDescLooksContaminated,
  PERSON_WB_COMMENT_PREFIX,
} from '../src/lib/novel/sync.mjs';
import { STATUS_BAR_PRESETS, getPresetById } from '../src/lib/statusBar.mjs';

describe('pipeline separation', function() {
  it('person worldbook comment helpers', function() {
    assert.equal(isPersonWorldbookComment('[小说人物] 林晚'), true);
    assert.equal(isPersonWorldbookComment('[人物] 林晚'), true);
    assert.equal(isPersonWorldbookComment('恶堕档案·林晚'), false);
    assert.equal(isPersonWorldbookComment('青云宗'), false);
    assert.equal(personNameFromWorldbookComment(PERSON_WB_COMMENT_PREFIX + '林晚'), '林晚');
  });

  it('protagonist contamination detector', function() {
    assert.equal(protagonistDescLooksContaminated('普通人设一二三'), false);
    assert.equal(protagonistDescLooksContaminated('x\nNSFW_information:\n  a'), true);
    assert.equal(protagonistDescLooksContaminated('【小说人物·甲】\n档案'), true);
  });

  it('single NSFW presets do not include corruption_stage by default', function() {
    ['single_nsfw', 'single_ntl', 'single_ntr'].forEach(function(id) {
      var p = getPresetById(id);
      assert.ok(p, id);
      assert.ok((p.modules || []).indexOf('corruption_stage') < 0, id + ' should not default corruption on protagonist');
    });
    var multi = getPresetById('multi_nsfw');
    assert.ok((multi.modules || []).indexOf('corruption_stage') >= 0);
    assert.ok(STATUS_BAR_PRESETS.some(function(p) { return p.id === 'multi_ntl'; }));
  });
});
