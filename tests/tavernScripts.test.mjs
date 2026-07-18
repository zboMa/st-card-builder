/**
 * 酒馆脚本模块：core 规范化 + wiring 契约（对齐正则交互：实时保存、行内删除）
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  createEmptyTavernScript,
  normalizeTavernScript,
  normalizeTavernScriptList,
  upsertTavernScriptByName,
  removeTavernScriptByName,
  moveTavernScript,
  buildTavernHelperExtension,
} from '../src/lib/tavernScripts.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function sidebarViewPattern(viewId) {
  return new RegExp("view:\\s*'" + viewId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'");
}

describe('tavernScripts core', function() {
  it('createEmpty / normalize 补齐 ScriptTree 字段', function() {
    var s = createEmptyTavernScript({ name: 'demo' });
    assert.equal(s.name, 'demo');
    assert.equal(s.type, 'script');
    assert.equal(s.enabled, true);
    assert.ok(s.id);
    assert.deepEqual(s.button, { enabled: true, buttons: [] });
    assert.deepEqual(s.data, {});
    var n = normalizeTavernScript({ name: 'x', content: '1', button: { enabled: false } });
    assert.equal(n.button.enabled, false);
    assert.deepEqual(n.button.buttons, []);
  });

  it('upsert / remove / move；同名保留 id', function() {
    var list = normalizeTavernScriptList([
      { name: 'A', id: 'id-a', content: '1' },
      { name: 'B', id: 'id-b', content: '2' },
    ]);
    list = upsertTavernScriptByName(list, { name: 'A', content: '1b' });
    assert.equal(list[0].id, 'id-a');
    assert.equal(list[0].content, '1b');
    list = upsertTavernScriptByName(list, { name: 'C', content: '3' });
    assert.equal(list.length, 3);
    list = removeTavernScriptByName(list, 'B');
    assert.equal(list.map(function(x) { return x.name; }).join(','), 'A,C');
    list = moveTavernScript(list, 0, 1);
    assert.equal(list[0].name, 'C');
  });

  it('buildTavernHelperExtension 保留 variables', function() {
    var ext = buildTavernHelperExtension(
      [{ name: 'S', content: 'code' }],
      { variables: { foo: 1 }, extra: true }
    );
    assert.equal(ext.scripts.length, 1);
    assert.equal(ext.scripts[0].name, 'S');
    assert.deepEqual(ext.variables, { foo: 1 });
    assert.equal(ext.extra, true);
  });
});

describe('tavernScripts wiring', function() {
  it('侧栏 / index / VALID_VIEWS / 桥接 / 面板 DOM', function() {
    const sidebar = readFileSync(join(root, 'src/components/AppSidebar.astro'), 'utf8');
    assert.match(sidebar, sidebarViewPattern('tavern-scripts'));
    assert.match(sidebar, /酒馆脚本/);

    const index = readFileSync(join(root, 'src/pages/index.astro'), 'utf8');
    assert.match(index, /TavernScriptsPanel/);
    assert.match(index, /data-view="tavern-scripts"/);
    assert.match(index, /__getTavernHelperScripts__/);
    assert.match(index, /__setTavernHelperScripts__/);
    assert.match(index, /opts\.silent/);
    assert.match(index, /__setTavernHelperScript__/);
    // 导出保留 variables
    assert.match(index, /variables:\s*thVars/);
    assert.match(index, /tavern_helper/);

    const tools = readFileSync(join(root, 'src/lib/assistant/tools.mjs'), 'utf8');
    assert.match(tools, /'tavern-scripts'/);

    const panel = readFileSync(join(root, 'src/components/TavernScriptsPanel.astro'), 'utf8');
    assert.match(panel, /id="tavernScriptsPanel"/);
    assert.match(panel, /id="thList"/);
    assert.match(panel, /id="thBtnAdd"/);
    assert.match(panel, />新建</);
    assert.match(panel, /名称/);
    assert.match(panel, /说明/);
    assert.match(panel, /脚本内容/);
    assert.match(panel, /基本选项/);
    assert.match(panel, /启用按钮/);
    assert.match(panel, /按钮列表/);
    assert.match(panel, /附加数据/);
    assert.match(panel, /schedulePersist|persistEditor/);
    assert.match(panel, /data-del/);
    assert.match(panel, /type="hidden"[^>]*id="thId"|id="thId"[^>]*type="hidden"/);
    assert.doesNotMatch(panel, /thBtnSave/);
    assert.doesNotMatch(panel, /保存到角色卡/);
    assert.doesNotMatch(panel, /id="thBtnTest"|id="thTestModal"/);
    assert.match(panel, /__setTavernHelperScripts__/);
    assert.match(panel, /lastRefreshFp/);
    assert.match(panel, /refreshFingerprint/);
    assert.match(panel, /createElement\('div'\)/);
    assert.match(panel, /addEventListener\('change'/);
  });

  it('MVU/状态栏仍走 __setTavernHelperScript__ 注入', function() {
    const mvu = readFileSync(join(root, 'src/components/VariableCardPanel.astro'), 'utf8');
    assert.match(mvu, /__setTavernHelperScript__/);
    const sb = readFileSync(join(root, 'src/components/StatusBarPanel.astro'), 'utf8');
    assert.match(sb, /__setTavernHelperScript__/);
    const lib = readFileSync(join(root, 'src/lib/statusBar.mjs'), 'utf8');
    assert.match(lib, /STATUS_BAR_SCRIPT_NAME/);
  });
});
