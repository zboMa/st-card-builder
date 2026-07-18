/**
 * 正则模块：core 规范化 + wiring 契约 + 测试解析
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  createEmptyRegexScript,
  normalizeRegexScript,
  normalizeRegexList,
  normalizePlacement,
  upsertRegexByName,
  removeRegexByName,
  moveRegex,
  compileFindRegex,
  applyRegexScript,
  placementLabel,
  PLACEMENT_AI,
  PLACEMENT_USER,
  PLACEMENT_SLASH,
  PLACEMENT_WORLD,
  PLACEMENT_REASONING,
} from '../src/lib/regexScripts.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function sidebarViewPattern(viewId) {
  return new RegExp("view:\\s*'" + viewId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'");
}

describe('regexScripts core', function() {
  it('createEmpty / normalize 补齐 ST 字段', function() {
    var rx = createEmptyRegexScript({ scriptName: '测试' });
    assert.equal(rx.scriptName, '测试');
    assert.ok(rx.id);
    assert.equal(rx.disabled, false);
    assert.deepEqual(rx.placement, [PLACEMENT_AI]);
    assert.equal(rx.runOnEdit, true);
    var n = normalizeRegexScript({ scriptName: 'a', findRegex: 'x', placement: [1, 9, 2, 3, 5, 6] });
    assert.deepEqual(n.placement, [
      PLACEMENT_USER,
      PLACEMENT_AI,
      PLACEMENT_SLASH,
      PLACEMENT_WORLD,
      PLACEMENT_REASONING,
    ]);
  });

  it('normalizePlacement 保留空数组、过滤非法值', function() {
    assert.deepEqual(normalizePlacement([]), []);
    assert.deepEqual(normalizePlacement([3, 4, 5]), [PLACEMENT_SLASH, PLACEMENT_WORLD]);
    assert.deepEqual(normalizePlacement(null), [PLACEMENT_AI]);
  });

  it('upsert / remove / move 按 scriptName', function() {
    var list = normalizeRegexList([
      { scriptName: 'A', findRegex: '1' },
      { scriptName: 'B', findRegex: '2' },
    ]);
    list = upsertRegexByName(list, { scriptName: 'A', findRegex: '1b', replaceString: 'r' });
    assert.equal(list.length, 2);
    assert.equal(list[0].findRegex, '1b');
    list = upsertRegexByName(list, { scriptName: 'C', findRegex: '3' });
    assert.equal(list.length, 3);
    list = removeRegexByName(list, 'B');
    assert.equal(list.map(function(x) { return x.scriptName; }).join(','), 'A,C');
    list = moveRegex(list, 1, 0);
    assert.equal(list[0].scriptName, 'C');
  });

  it('compileFindRegex / applyRegexScript 解析替换', function() {
    assert.ok(compileFindRegex('foo(\\d+)'));
    assert.ok(compileFindRegex('/bar/gi'));
    assert.equal(compileFindRegex('('), null);

    var res = applyRegexScript(
      { findRegex: 'a(\\d+)', replaceString: 'X$1' },
      'a12-a3'
    );
    assert.equal(res.ok, true);
    assert.equal(res.result, 'X12-a3');

    var res2 = applyRegexScript(
      { findRegex: '/a(\\d+)/g', replaceString: 'X$1' },
      'a12-a3'
    );
    assert.equal(res2.ok, true);
    assert.equal(res2.result, 'X12-X3');

    var bad = applyRegexScript({ findRegex: '(', replaceString: '' }, 'x');
    assert.equal(bad.ok, false);
  });

  it('placementLabel 中文摘要', function() {
    assert.match(placementLabel([1, 2]), /用户/);
    assert.match(placementLabel([]), /命令触发/);
  });
});

describe('regex wiring', function() {
  it('侧栏 / index / VALID_VIEWS / 桥接 / 面板 DOM', function() {
    const sidebar = readFileSync(join(root, 'src/components/AppSidebar.astro'), 'utf8');
    assert.match(sidebar, sidebarViewPattern('regex'));
    assert.match(sidebar, /正则/);
    const sbIdx = sidebar.search(sidebarViewPattern('statusbar'));
    const mvuIdx = sidebar.search(sidebarViewPattern('mvu'));
    const rxIdx = sidebar.search(sidebarViewPattern('regex'));
    const thIdx = sidebar.search(sidebarViewPattern('tavern-scripts'));
    assert.ok(mvuIdx > sbIdx, 'mvu after statusbar');
    assert.ok(rxIdx > mvuIdx, 'regex after mvu');
    assert.ok(thIdx > rxIdx, 'tavern-scripts after regex');

    const index = readFileSync(join(root, 'src/pages/index.astro'), 'utf8');
    assert.match(index, /RegexPanel/);
    assert.match(index, /data-view="regex"/);
    assert.match(index, /__getRegexScripts__/);
    assert.match(index, /__setRegexScripts__/);
    assert.match(index, /opts\.silent/);
    assert.match(index, /regex_scripts/);

    const tools = readFileSync(join(root, 'src/lib/assistant/tools.mjs'), 'utf8');
    assert.match(tools, /'regex'/);

    const panel = readFileSync(join(root, 'src/components/RegexPanel.astro'), 'utf8');
    assert.match(panel, /id="regexPanel"/);
    assert.match(panel, /id="rxList"/);
    assert.match(panel, /id="rxBtnAdd"/);
    assert.match(panel, /id="rxBtnTest"/);
    assert.match(panel, /id="rxTestModal"/);
    assert.match(panel, /id="rxBtnParse"/);
    // 真弹窗：挂 body + Esc/遮罩/取消关闭
    assert.match(panel, /document\.body\.appendChild\(testModal\)/);
    assert.match(panel, /rx-modal-open/);
    assert.match(panel, /data-rx-modal-close/);
    assert.match(panel, /Escape/);
    assert.match(panel, /取消/);
    assert.match(panel, /用户输入/);
    assert.match(panel, /快捷命令/);
    assert.match(panel, /世界书/);
    assert.match(panel, /推理/);
    assert.match(panel, /已禁用/);
    assert.match(panel, /编辑时运行/);
    assert.match(panel, /宏查找替换/);
    assert.match(panel, /仅显示/);
    assert.match(panel, /仅后端提示词/);
    assert.match(panel, /schedulePersist|persistEditor/);
    assert.doesNotMatch(panel, /rxBtnSave/);
    assert.doesNotMatch(panel, /保存到角色卡/);
    assert.match(panel, /type="hidden"[^>]*id="rxId"|id="rxId"[^>]*type="hidden"/);
    assert.match(panel, /__getRegexScripts__/);
    assert.match(panel, /__setRegexScripts__/);
    assert.match(panel, /silent: silent/);
    assert.match(panel, /lastRefreshFp/);
    assert.match(panel, /refreshFingerprint/);
    assert.match(panel, /data-del/);
    // 列表行须为 div，禁止 button 嵌套 checkbox/子 button
    assert.match(panel, /createElement\('div'\)/);
    assert.match(panel, /role', 'button'/);
    assert.match(panel, /addEventListener\('change'/);
  });

  it('MVU/状态栏注入路径仍按 scriptName upsert', function() {
    const index = readFileSync(join(root, 'src/pages/index.astro'), 'utf8');
    assert.match(index, /__injectMvuEntries__/);
    assert.match(index, /scriptName === rx\.scriptName/);
    const mvu = readFileSync(join(root, 'src/components/VariableCardPanel.astro'), 'utf8');
    assert.match(mvu, /REGEX_SCRIPTS/);
    assert.match(mvu, /scheduleRefreshSync\(false\)/);
    assert.match(mvu, /extChanged/);
    assert.match(mvu, /silent: true/);
    const sb = readFileSync(join(root, 'src/lib/statusBar.mjs'), 'utf8');
    assert.match(sb, /STATUS_BAR_REGEX_NAME/);
  });
});
