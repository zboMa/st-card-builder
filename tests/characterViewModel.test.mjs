import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCharacterView,
  buildCharacterTokens,
  buildAvatarView,
  buildAvatarGenView,
} from '../src/lib/card-builder/panels/characterViewModel.mjs';

describe('characterViewModel', function () {
  it('字段与标签快照保留状态并归一版本', function () {
    var view = buildCharacterView({
      charName: '角色',
      wbName: '世界',
      charDesc: '契约',
      creatorNotes: '注释',
      charTags: [' 标签 ', '标签', '风格'],
      characterVersion: ' 2.1 ',
    }, { versionBaseline: '2.0' });
    assert.equal(view.fields.charName, '角色');
    assert.equal(view.fields.wbName, '世界');
    assert.equal(view.fields.characterVersion, '2.1');
    assert.deepEqual(view.tags, ['标签', '风格']);
    assert.equal(view.version.current, '2.1');
    assert.equal(view.version.baseline, '2.0');
    assert.equal(view.version.canRevert, true);
  });

  it('版本与基线相同不显示回退', function () {
    var view = buildCharacterView({ characterVersion: '1.0' }, { versionBaseline: '1.0' });
    assert.equal(view.version.canRevert, false);
  });

  it('token 快照包含字段与标签', function () {
    var tokens = buildCharacterTokens({
      charName: 'A',
      wbName: 'B',
      charDesc: 'C',
      creatorNotes: 'D',
      charTags: ['E'],
    });
    assert.match(tokens.descText, /tok$/);
    assert.match(tokens.notesText, /tok$/);
    assert.match(tokens.totalText, /tok$/);
    assert.ok(tokens.total >= tokens.desc + tokens.notes);
  });

  it('头像快照归一 object URL 与上限', function () {
    var view = buildAvatarView({
      mainUrl: 'data:image/jpeg;base64,x',
      items: [{ id: 'a', url: 'blob:a', current: true, published: true }],
      count: 1,
      max: 20,
      hasDraft: true,
    });
    assert.equal(view.mainUrl, 'data:image/jpeg;base64,x');
    assert.equal(view.items[0].current, true);
    assert.equal(view.items[0].published, true);
    assert.equal(view.countText, '1/20');
    assert.equal(view.full, false);
  });

  it('头像生成弹窗快照', function () {
    var view = buildAvatarGenView({
      open: true,
      meta: '服务 · 1024x1024 · ×1',
      prompt: '1girl',
      status: '生成中。',
      images: [{ dataUrl: 'data:x' }],
      busyRun: true,
    });
    assert.equal(view.open, true);
    assert.equal(view.meta, '服务 · 1024x1024 · ×1');
    assert.equal(view.images.length, 1);
    assert.equal(view.busyRun, true);
  });
});
