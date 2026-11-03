/**
 * 正则面板视图快照（纯函数）。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRegexEditor,
  buildRegexView,
  regexAutoBadge,
} from '../src/lib/card-builder/panels/regexViewModel.mjs';
import {
  PLACEMENT_AI,
  PLACEMENT_USER,
} from '../src/lib/regexScripts.mjs';

describe('regexViewModel', function() {
  it('buildRegexEditor 规范化字段并保留空深度', function() {
    var editor = buildRegexEditor({
      id: 'rx-1',
      scriptName: 'A',
      findRegex: 'x',
      replaceString: 'y',
      placement: [PLACEMENT_USER, 9, PLACEMENT_AI],
      disabled: true,
      runOnEdit: false,
      substituteRegex: 1,
      minDepth: null,
      maxDepth: 4,
    });
    assert.equal(editor.id, 'rx-1');
    assert.equal(editor.scriptName, 'A');
    assert.deepEqual(editor.placement, [PLACEMENT_USER, PLACEMENT_AI]);
    assert.equal(editor.disabled, true);
    assert.equal(editor.runOnEdit, false);
    assert.equal(editor.substituteRegex, true);
    assert.equal(editor.minDepth, '');
    assert.equal(editor.maxDepth, '4');
  });

  it('自动注入名只给已知 MVU / 状态栏条目加徽标', function() {
    assert.equal(regexAutoBadge('[不发送]去除变量更新'), 'MVU');
    assert.equal(regexAutoBadge('[美化]状态栏展示'), '状态栏');
    assert.equal(regexAutoBadge('普通正则'), '');
  });

  it('buildRegexView 生成条数、选中态与 placement 摘要', function() {
    var view = buildRegexView({
      regexScripts: [
        { id: 'a', scriptName: '[不发送]去除变量更新', disabled: true, placement: [2] },
        { id: 'b', scriptName: '普通正则', placement: [1, 3] },
      ],
    }, { selectedId: 'b', editor: null, status: 'ok', statusKind: 'ok' });
    assert.equal(view.count, 2);
    assert.equal(view.countText, '2 条');
    assert.equal(view.items[0].badge, 'MVU');
    assert.equal(view.items[0].disabled, true);
    assert.equal(view.items[1].selected, true);
    assert.match(view.items[1].placementLabel, /用户/);
    assert.equal(view.selectedId, 'b');
    assert.equal(view.status, 'ok');
  });

  it('未选中时 selected 为空', function() {
    var view = buildRegexView({ regexScripts: [] }, { selectedId: '' });
    assert.equal(view.count, 0);
    assert.equal(view.selected, null);
    assert.equal(view.selectedIndex, -1);
  });
});
