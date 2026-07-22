/**
 * 全局 AI 任务中心契约测试
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readLayoutSources, readAssistantPanelSources, readVariableCardPanelSources, readWorldbookPanelSources, readAiEnginePanelSources } from './helpers/uiSources.mjs';
import {
  createAiTaskCenter,
  AI_TASK_TYPES,
  isAbortError,
} from '../src/lib/aiTaskCenter.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('aiTaskCenter core', function() {
  it('登记任务并统计已完成/全部', function() {
    const center = createAiTaskCenter();
    const t1 = center.create({ type: 'wb_single', title: '单条', target: 'A', autoStart: false });
    assert.equal(t1.status, 'queued');
    center.start(t1.id);
    assert.equal(center.snapshot().label, '0/1');
    center.succeed(t1.id);
    assert.equal(center.snapshot().completed, 1);
    assert.equal(center.snapshot().label, '1/1');
  });

  it('AbortController 可取消进行中任务', function() {
    const center = createAiTaskCenter();
    const t = center.create({ type: 'engine_generate', title: '引擎' });
    assert.ok(t.signal);
    assert.equal(t.status, 'running');
    const ok = center.cancel(t.id);
    assert.equal(ok, true);
    assert.equal(t.status, 'cancelled');
    assert.equal(t.signal.aborted, true);
  });

  it('run 成功/失败/取消路径', async function() {
    const center = createAiTaskCenter();
    const r = await center.run({ type: 'other', title: 'ok' }, async function() { return 42; });
    assert.equal(r, 42);
    assert.equal(center.snapshot().tasks[0].status, 'success');

    await assert.rejects(function() {
      return center.run({ type: 'other', title: 'fail' }, async function() {
        throw new Error('boom');
      });
    }, /boom/);
    assert.equal(center.snapshot().tasks.some(function(t) { return t.status === 'failed'; }), true);

    const p = center.run({ type: 'other', title: 'cancel-me' }, async function(task) {
      center.cancel(task.id);
      const err = new Error('abort');
      err.name = 'AbortError';
      throw err;
    });
    await assert.rejects(p);
    assert.equal(center.snapshot().tasks.some(function(t) { return t.status === 'cancelled'; }), true);
  });

  it('停止全部与清除已完成', function() {
    const center = createAiTaskCenter();
    center.create({ type: 'chat_reply', title: 'a' });
    center.create({ type: 'auditor', title: 'b' });
    const n = center.cancelAllRunning();
    assert.equal(n, 2);
    const removed = center.clearFinished();
    assert.equal(removed, 2);
    assert.equal(center.snapshot().total, 0);
  });

  it('进行中任务置顶排序', function() {
    const center = createAiTaskCenter();
    const a = center.create({ type: 'other', title: 'done', autoStart: false });
    center.start(a.id);
    center.succeed(a.id);
    center.create({ type: 'other', title: 'run' });
    const list = center.snapshot().tasks;
    assert.equal(list[0].status, 'running');
    assert.equal(list[1].status, 'success');
  });

  it('isAbortError 识别取消', function() {
    const e = new Error('The user aborted a request.');
    e.name = 'AbortError';
    assert.equal(isAbortError(e), true);
    assert.equal(isAbortError(new Error('已取消')), true);
    assert.equal(isAbortError(new Error('其它')), false);
  });

  it('覆盖主要 AI 任务类型常量', function() {
    [
      'wb_single', 'wb_organize', 'wb_keygen', 'wb_rewrite', 'wb_expand',
      'engine_generate', 'char_tags_generate', 'assistant_react',
      'novel_char_scan', 'novel_char_expand', 'novel_wb_extract', 'novel_wb_expand',
      'novel_rag_index', 'novel_analyze_skeleton', 'novel_analyze_enrich', 'novel_analyze_relations',
      'novel_style', 'novel_char_setup', 'novel_greetings',
      'chat_reply', 'auditor', 'mvu_generate', 'statusbar_generate', 'statusbar_char_scan',
    ].forEach(function(k) {
      assert.ok(AI_TASK_TYPES[k], 'missing type ' + k);
    });
  });
});

describe('aiTaskCenter UI wiring', function() {
  it('侧栏标题旁有任务进度徽章', function() {
    const src = readFileSync(join(root, 'src/components/AppSidebar.astro'), 'utf8');
    assert.match(src, /app-title-row/);
    assert.match(src, /id="aiTaskBadge"/);
    assert.match(src, /啊哈哈哈制卡器/);
  });

  it('任务中心 UI 组件含弹窗与停止/清除', function() {
    const src = readFileSync(join(root, 'src/components/AiTaskCenterUI.astro'), 'utf8');
    assert.match(src, /id="aiTaskModal"/);
    assert.match(src, /id="aiTaskStopAll"/);
    assert.match(src, /id="aiTaskClearDone"/);
    assert.match(src, /createAiTaskCenter/);
    assert.match(src, /__aiTaskCenter__/);
  });

  it('index 注入 AiTaskCenterUI 且 fetch 支持 signal', function() {
    const src = readFileSync(join(root, 'src/pages/index.astro'), 'utf8');
    assert.match(src, /AiTaskCenterUI/);
    assert.match(src, /initCardBuilder/);
    const boot = readFileSync(join(root, 'src/lib/card-builder/browserApp.mjs'), 'utf8');
    assert.match(boot, /__runAiTask__/);
    assert.match(boot, /tagContextChars/);
    const ctxSrc = readFileSync(join(root, 'src/lib/card-builder/shared/context.mjs'), 'utf8');
    assert.match(ctxSrc, /signal:\s*opts\.signal/);
    const aiSrc = readAiEnginePanelSources(root);
    assert.match(aiSrc, /engine_generate/);
    assert.match(aiSrc, /char_tags_generate/);
    assert.match(aiSrc, /btnAiGenCharTags/);
    const wbSrc = readWorldbookPanelSources(root);
    assert.match(wbSrc, /wb_single|wb_organize|wb_keygen/);
  });

  it('小说与助手接入任务中心', function() {
    const novel = readFileSync(join(root, 'src/lib/novel/browserApp.mjs'), 'utf8');
    assert.match(novel, /runTracked/);
    const novelChars = readFileSync(join(root, 'src/lib/novel/panels/characters.mjs'), 'utf8');
    assert.match(novelChars, /novel_char_expand/);
    assert.match(novelChars, /novel_char_scan/);
    const novelWb = readFileSync(join(root, 'src/lib/novel/panels/worldbook.mjs'), 'utf8');
    assert.match(novelWb, /novel_wb_extract/);
    assert.match(novelWb, /novel_wb_expand/);
    const novelStyle = readFileSync(join(root, 'src/lib/novel/panels/style.mjs'), 'utf8');
    assert.match(novelStyle, /novel_style/);
    const novelCtx = readFileSync(join(root, 'src/lib/novel/shared/context.mjs'), 'utf8');
    assert.match(novelCtx, /confirmExpandRecall|novelModalExpandConfirm/);
    assert.match(novel, /signal:\s*signal/);
    // 长任务：loading + Abort；取消不弹失败 alert
    assert.match(novel, /setBtnBusy|busyFlags/);
    assert.match(novel, /mapPool\([\s\S]*task\.signal/);
    assert.match(novel, /callAI\(user,\s*null,\s*task\.signal\)/);
    assert.match(novel, /isTrackedAbort\(e\)/);
    // 取消文案在各 panel 中
    assert.match(novelChars, /已取消扫描/);
    assert.match(novelWb, /已取消抽取/);
    assert.match(novelStyle, /已取消蒸馏/);
    const asst = readAssistantPanelSources(root);
    assert.match(asst, /assistant_react/);
    assert.match(asst, /callChat\(messages,\s*0\.35,\s*reactSignal\)/);
  });
});
