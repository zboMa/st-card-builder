import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isAutoTavernName,
  tavernAutoBadge,
  buildTavernEditor,
  buildTavernScriptsView,
} from '../src/lib/card-builder/panels/tavernViewModel.mjs';

describe('tavernViewModel', function () {
  it('自动脚本名识别与徽标', function () {
    assert.equal(isAutoTavernName('MVU'), true);
    assert.equal(isAutoTavernName('[状态栏]前置展示'), true);
    assert.equal(isAutoTavernName('demoZod'), true);
    assert.equal(isAutoTavernName('普通脚本'), false);
    assert.equal(tavernAutoBadge('MVU'), 'MVU');
    assert.equal(tavernAutoBadge('[状态栏]前置展示'), '状态栏');
    assert.equal(tavernAutoBadge('demoZod'), 'MVU');
  });

  it('编辑器快照格式化 button / data JSON', function () {
    var editor = buildTavernEditor({
      id: 's1',
      name: '脚本',
      button: { enabled: false, buttons: [{ name: 'run' }] },
      data: { foo: 1 },
    });
    assert.equal(editor.id, 's1');
    assert.equal(editor.buttonEnabled, false);
    assert.match(editor.buttonJson, /"run"/);
    assert.match(editor.dataJson, /"foo": 1/);
  });

  it('列表快照保留选中项与计数', function () {
    var view = buildTavernScriptsView({
      tavernHelperScripts: [
        { id: 'a', name: 'MVU', enabled: true, type: 'script' },
        { id: 'b', name: '普通脚本', enabled: false, type: 'script' },
      ],
    }, { selectedId: 'b', editor: { id: 'b' } });
    assert.equal(view.count, 2);
    assert.equal(view.countText, '2 条');
    assert.equal(view.selectedIndex, 1);
    assert.equal(view.items[0].badge, 'MVU');
    assert.equal(view.items[1].selected, true);
    assert.equal(view.items[1].enabled, false);
    assert.equal(view.items[1].name, '普通脚本');
  });

  it('无选择项时返回空选中', function () {
    var view = buildTavernScriptsView({ tavernHelperScripts: [] }, {});
    assert.equal(view.count, 0);
    assert.equal(view.selectedIndex, -1);
    assert.equal(view.selected, null);
  });
});
