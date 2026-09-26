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

  it('NSFW 题材收成同一份，亲密/NTL/NTR 含恶堕，日常不含', function() {
    ['single_nsfw', 'multi_nsfw', 'nsfw'].forEach(function(id) {
      var p = getPresetById(id);
      assert.equal(p.id, 'intimate');
      assert.ok((p.modules || []).indexOf('corruption_stage') >= 0, id);
    });
    assert.ok(getPresetById('single_ntl').modules.indexOf('corruption_stage') >= 0);
    assert.ok(getPresetById('ntr').modules.indexOf('corruption_stage') >= 0);
    assert.ok(getPresetById('daily').modules.indexOf('corruption_stage') < 0);
    assert.ok(STATUS_BAR_PRESETS.every(function(p) { return p.id.indexOf('single_') !== 0 && p.id.indexOf('multi_') !== 0; }));
  });
});
