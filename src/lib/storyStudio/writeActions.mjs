/**
 * Story Studio 图谱/大纲收集与写作流水线（拆自 browserApp）
 */

import {
  normalizeNovel,
  genStoryId,
  syncChaptersFromOutline,
  getActiveChapters,
  getActiveOutline,
} from './state.mjs';
import { seedGraphFromCard, mergeGraphSeed } from './graphSeed.mjs';
import { trySyncAfterChapter } from './mvuHook.mjs';
import {
  buildOutlineUserPrompt,
  graphBriefFromNovel,
  parseOutlineAiText,
  CHILD_SAFETY_RULE,
} from './prompts.mjs';
import {
  forkBranchFromChapter,
  branchBrief,
  getBranch,
  BRANCH_KIND_ENDING,
} from './branch.mjs';
import { runChapterWritePipeline } from './writePipeline.mjs';
import { collectFeedForwardsBefore } from './feedForward.mjs';
import { showSsConfirm, showSsPrompt } from './dialogs.mjs';
import {
  state,
  ui,
  $,
  setStatus,
  getCardSeed,
  promptText,
  callAI,
  runTracked,
  taskSetProgress,
  isAbort,
  persistNovel,
} from './shared.mjs';
import { renderAll, renderGraph, renderOutline, renderRead } from './renderViews.mjs';
import { setWriteProgress, renderWrite, applyStreamContent, syncWriteSessionBar } from './writeBranchUi.mjs';
import { WRITE_STEP_LABELS } from './writePipeline.mjs';
import { engineBegin, engineEnd, engineTryAllowed } from '../actionEngine/helpers.mjs';

export function collectGraphFromDom() {
  // 图谱已改为弹窗编辑，直接改 state.novel.graph；保留空实现兼容旧调用点
}

export function collectOutlineFromDom() {
  if (!state.novel) return;
  var branchId = state.novel.activeBranchId;
  var byId = {};
  (state.novel.outline || []).forEach(function(o) {
    if (o && o.id) byId[o.id] = o;
  });
  document.querySelectorAll('#ssOutlineList .ss-outline-item').forEach(function(row, i) {
    var titleBtn = row.querySelector('.ss-ol-title-btn');
    var titleEl = row.querySelector('.ss-ol-title');
    var sumEl = row.querySelector('.ss-ol-summary');
    var id = row.getAttribute('data-ol-id') || '';
    var prev = (id && byId[id]) || {};
    var titleVal = titleBtn
      ? String(titleBtn.textContent || '').trim()
      : (titleEl ? titleEl.value : '');
    var next = {
      id: prev.id || id || genStoryId('ol'),
      title: titleVal,
      summary: sumEl ? sumEl.value : '',
      order: typeof prev.order === 'number' ? prev.order : i,
      branchId: prev.branchId || branchId,
    };
    // 可见列表下标作为阅读序；写回 order（主线用下标；分支保留原 order 若已有）
    if (!prev.branchId || prev.branchId === branchId) {
      var br = getBranch(state.novel, branchId);
      if (!br.parentBranchId) next.order = i;
      else if (typeof prev.order !== 'number') next.order = i;
    }
    if (id && byId[id]) {
      Object.assign(byId[id], next);
    } else {
      state.novel.outline.push(next);
      byId[next.id] = next;
    }
  });
}

export function collectWriteFromDom(opts) {
  opts = opts || {};
  if (!state.novel) return;
  var sel = $('ssWriteChapterSelect');
  var targetId = opts.chapterId
    || (ui.writeChapterId || '')
    || (sel && sel.value)
    || '';
  if (!targetId) return;
  var ch = state.novel.chapters.find(function(c) { return c.id === targetId; });
  if (!ch) return;
  var titleEl = $('ssWriteChapterTitle');
  var summaryEl = $('ssWriteChapterSummary');
  var contentEl = $('ssWriteChapterContent');
  var advEl = $('ssWriteAdvancePrompt');
  var syncEl = $('ssWriteSyncMvu');
  var batchEl = $('ssWriteBatchCount');
  var feedEl = $('ssWriteRunFeed');
  var qaEl = $('ssWriteRunQa');
  var stopEl = $('ssWriteStopOnQa');
  if (titleEl) ch.title = titleEl.value;
  if (summaryEl) ch.summary = summaryEl.value;
  // 生成中禁止用空/旧 textarea 覆盖流式正文
  if (contentEl && !opts.skipContent && !ui.writeBusy) ch.content = contentEl.value;
  if (advEl) ch.advancePrompt = advEl.value;
  if (!state.novel.writeSettings) state.novel.writeSettings = {};
  if (syncEl) state.novel.writeSettings.syncMvuStatusBar = !!syncEl.checked;
  if (batchEl) {
    state.novel.writeSettings.batchCount = Math.max(1, Math.min(20, parseInt(batchEl.value, 10) || 3));
  }
  if (feedEl) state.novel.writeSettings.runFeedForward = !!feedEl.checked;
  if (qaEl) state.novel.writeSettings.runQuality = !!qaEl.checked;
  if (stopEl) state.novel.writeSettings.stopOnQualityFail = !!stopEl.checked;
}

export function collectLedgerFromDom() {
  if (!state.novel) return;
  var byId = {};
  (state.novel.plotLedger || []).forEach(function(it) {
    if (it && it.id) byId[it.id] = it;
  });
  document.querySelectorAll('#ssWriteLedger .ss-ledger-item').forEach(function(row) {
    var id = row.getAttribute('data-ledger-id');
    var it = byId[id];
    if (!it) return;
    var titleEl = row.querySelector('.ss-ledger-title');
    var statusEl = row.querySelector('.ss-ledger-status');
    var noteEl = row.querySelector('.ss-ledger-note');
    if (titleEl) it.title = titleEl.value;
    if (statusEl) it.status = statusEl.value;
    if (noteEl) it.note = noteEl.value;
    it.updatedAt = Date.now();
  });
}

export async function seedGraph() {
  if (!state.novel) {
    setStatus('请先打开小说');
    return;
  }
  var seeded = seedGraphFromCard(getCardSeed());
  state.novel.graph = mergeGraphSeed(state.novel.graph, seeded);
  await persistNovel();
  setStatus('已从卡面种子生成图谱（' + state.novel.graph.nodes.length + ' 节点）');
  renderGraph();
}


export async function promptAndGenerateOutline(mode) {
  var isCont = mode === 'continue';
  var hint = await showSsPrompt({
    icon: '✨',
    title: isCont ? '续写大纲' : '分段生成大纲',
    message: '可填写额外提示词（可选），将注入本次生成。',
    defaultValue: '',
    placeholder: '例如：加强感情线，第 3 章高潮…',
    multiline: true,
    rows: 4,
    okText: '开始生成',
    cancelText: '取消',
    select: false,
  });
  if (hint === null) return;
  await generateOutline(mode, hint);
}
export async function generateOutline(mode, extraHint) {
  if (!engineTryAllowed('story.outline.generate').ok) return;
  if (!state.novel) {
    setStatus('请先打开小说');
    return;
  }
  collectOutlineFromDom();
  var directionEl = $('ssOutlineDirection');
  var direction = directionEl ? directionEl.value : '';
  if (state.novel.wizard && state.novel.wizard.direction && !direction) {
    direction = state.novel.wizard.direction;
  }
  var branchId = state.novel.activeBranchId;
  var visible = getActiveOutline(state.novel);
  var existing = visible.map(function(o, i) {
    return (i + 1) + '. ' + o.title + ' — ' + o.summary;
  }).join('\n');
  var chapters = getActiveChapters(state.novel);
  var feeds = collectFeedForwardsBefore(chapters, chapters.length);
  var feedBrief = feeds.slice(0, 6).map(function(f) {
    return (f.order + 1) + '. ' + f.title + ' — ' + String(f.summary || '').slice(0, 100);
  }).join('\n');
  var segmentHint = mode === 'continue'
    ? '在已有大纲之后续写 3～5 章。'
    : '生成完整分段大纲，约 8～12 章。';
  if (mode === 'branch') {
    segmentHint = '这是分支世界的续写大纲，请按分支方向续写 3～6 章，承接分叉前剧情但走向不同。';
  }
  var extra = String(extraHint || '').trim();
  if (extra) segmentHint += '\n额外要求：' + extra;

  var system = promptText(
    'storyOutlineGen',
    '你是长篇小说大纲策划。输出结构化章节大纲（标题+摘要）。' + CHILD_SAFETY_RULE
  );
  var user = buildOutlineUserPrompt({
    title: state.novel.title,
    direction: direction,
    branchHint: branchBrief(state.novel, branchId),
    graphBrief: graphBriefFromNovel(state.novel),
    existingOutline: existing,
    feedForwardBrief: feedBrief,
    segmentHint: segmentHint,
  });

  setStatus('正在生成大纲…');
  try {
    engineBegin('story.outline.generate');
  await runTracked({
      type: 'story_outline',
      typeLabel: '小说创作·大纲',
      title: mode === 'continue' ? '续写大纲' : '生成大纲',
      target: state.novel.title,
    }, async function(task) {
      var text = await callAI(user, system, task.signal);
      var parsed = parseOutlineAiText(text);
      if (!parsed.length) throw new Error('未能解析大纲 JSON');
      var br = getBranch(state.novel, branchId);
      var baseOrder = visible.length
        ? (typeof visible[visible.length - 1].order === 'number'
          ? visible[visible.length - 1].order + 1
          : visible.length)
        : (br.forkOrder >= 0 ? br.forkOrder + 1 : 0);

      if (mode !== 'continue' && mode !== 'branch' && !visible.length) {
        // 主线空大纲：替换写入本分支
        parsed.forEach(function(p, i) {
          state.novel.outline.push({
            id: genStoryId('ol'),
            title: p.title,
            summary: p.summary,
            order: i,
            branchId: branchId,
          });
        });
      } else {
        parsed.forEach(function(p, i) {
          state.novel.outline.push({
            id: genStoryId('ol'),
            title: p.title,
            summary: p.summary,
            order: baseOrder + i,
            branchId: branchId,
          });
        });
      }
      state.novel = syncChaptersFromOutline(state.novel);
      if (state.novel.wizard && state.novel.wizard.step === 'direction') {
        state.novel.wizard.step = 'outline';
      }
      await persistNovel();
    });
    setStatus('大纲已更新');
    renderAll();
  } catch (err) {
    if (isAbort(err)) setStatus('已取消');
    else setStatus('大纲生成失败：' + (err.message || err));
  } finally {
    engineEnd('story.outline.generate');
  }
}

export async function writeChapter(autoNext, opts) {
  opts = opts || {};
  if (!opts.skipActionGate && !engineTryAllowed('story.chapter.write').ok) return null;
  if (!state.novel) {
    setStatus('请先打开小说', { panel: 'write' });
    return null;
  }
  if (state.novel.wizard && state.novel.wizard.step && state.novel.wizard.step !== 'ready'
    && !state.novel.wizard.approvedOutline) {
    setStatus('请先在大纲页完成向导审批（或跳过向导）', { panel: 'write' });
    return null;
  }
  collectWriteFromDom();
  collectLedgerFromDom();
  var sel = $('ssWriteChapterSelect');
  if (!sel || !sel.value) {
    setStatus('没有可写章节，请先生成大纲', { panel: 'write' });
    return null;
  }
  var chapters = getActiveChapters(state.novel);
  var idx = chapters.findIndex(function(c) { return c.id === sel.value; });
  if (idx < 0) return null;
  var ch = state.novel.chapters.find(function(c) { return c.id === chapters[idx].id; }) || chapters[idx];

  setStatus('正在撰写：' + ch.title, { panel: 'write' });
  setWriteProgress('plan');
  if (!opts.skipScope) engineBegin('story.chapter.write');
  ui.writeBusy = true;
  var streamHint = $('ssWriteStreamHint');
  if (streamHint) streamHint.hidden = false;
  var contentEl = $('ssWriteChapterContent');
  if (contentEl) contentEl.readOnly = true;
  try {
    var result = null;
    await runTracked({
      type: 'story_chapter',
      typeLabel: '小说创作·章文',
      title: opts.rewriteOnly ? '改写章节' : (opts.skipDraft ? '质检章节' : '撰写章节'),
      target: ch.title,
    }, async function(task) {
      result = await runChapterWritePipeline({
        callAI: callAI,
        promptText: promptText,
        signal: task.signal,
        onStep: function(stepName) {
          setWriteProgress(stepName);
          if (ui.writeSession) {
            ui.writeSession.step = stepName;
            syncWriteSessionBar();
          }
          var label = WRITE_STEP_LABELS[stepName] || stepName;
          var batch = '';
          if (ui.writeSession && ui.writeSession.batchTotal > 1) {
            batch = ' · 第 ' + ui.writeSession.batchIndex + '/' + ui.writeSession.batchTotal + ' 章';
          }
          taskSetProgress(task, null, label + ' · ' + ch.title + batch);
        },
        onDelta: function(text) {
          applyStreamContent(text);
        },
      }, state.novel, idx, {
        skipDraft: !!opts.skipDraft,
        skipFeed: !!opts.skipFeed,
        skipQa: !!opts.skipQa,
        rewriteOnly: !!opts.rewriteOnly,
      });

      var live = state.novel.chapters.find(function(c) { return c.id === ch.id; }) || ch;
      var wantSync = !!(state.novel.writeSettings && state.novel.writeSettings.syncMvuStatusBar);
      var syncResult = trySyncAfterChapter({
        enabled: wantSync,
        getExtension: window.__getCardExtension__,
        setExtension: window.__setCardExtension__,
        chapterTitle: live.title,
        chapterSummary: live.summary,
        chapterContent: live.content,
      });
      if (wantSync && syncResult.skipped && syncResult.reason === 'no_design') {
        setStatus('章节已写完；同步未生效：' + (syncResult.warning || ''), { panel: 'write' });
      }
      await persistNovel();
    });

    setWriteProgress(null);
    var qa = result && result.quality;
    var qaMsg = qa ? ('质检 ' + (qa.ok ? '通过' : '需改') + ' ' + qa.score + '/10') : '';

    if (autoNext) {
      var nextChapters = getActiveChapters(state.novel);
      if (idx + 1 < nextChapters.length) {
        sel.value = nextChapters[idx + 1].id;
        ui.writeChapterId = sel.value;
        renderWrite();
        setStatus('本章完成' + (qaMsg ? '（' + qaMsg + '）' : '') + '，已切到下一章', { panel: 'write' });
      } else {
        setStatus('章节撰写完成' + (qaMsg ? ' · ' + qaMsg : '') + '（已无下一章）', { panel: 'write' });
        renderWrite();
        renderRead();
      }
    } else {
      setStatus('章节撰写完成' + (qaMsg ? ' · ' + qaMsg : ''), { panel: 'write' });
      renderWrite();
      renderRead();
    }
    return result;
  } catch (err) {
    setWriteProgress(null);
    if (isAbort(err)) setStatus('已取消', { panel: 'write' });
    else setStatus('撰写失败：' + (err.message || err), { panel: 'write' });
    return null;
  } finally {
    ui.writeBusy = false;
    if (streamHint) streamHint.hidden = true;
    if (contentEl) contentEl.readOnly = false;
    syncWriteSessionBar();
    if (!opts.skipScope) engineEnd('story.chapter.write');
  }
}

export async function writeBatchChapters() {
  if (!engineTryAllowed('story.chapter.batch').ok) return;
  if (!state.novel) {
    setStatus('请先打开小说', { panel: 'write' });
    return;
  }
  collectWriteFromDom();
  var n = Math.max(1, Math.min(20, (state.novel.writeSettings && state.novel.writeSettings.batchCount) || 3));
  var sel = $('ssWriteChapterSelect');
  if (!sel || !sel.value) {
    setStatus('没有可写章节', { panel: 'write' });
    return;
  }
  var stopOnFail = !!(state.novel.writeSettings && state.novel.writeSettings.stopOnQualityFail);
  setStatus('连写 ' + n + ' 章…', { panel: 'write' });
  engineBegin('story.chapter.batch');
  try {
    for (var i = 0; i < n; i++) {
      if (ui.writeSession) {
        ui.writeSession.batchIndex = i + 1;
        ui.writeSession.batchTotal = n;
        syncWriteSessionBar();
      }
      var chapters = getActiveChapters(state.novel);
      var idx = chapters.findIndex(function(c) { return c.id === sel.value; });
      if (idx < 0) break;
      if (i === 0 && String(chapters[idx].content || '').trim()) {
        var nextEmpty = -1;
        for (var j = idx; j < chapters.length; j++) {
          if (!String(chapters[j].content || '').trim()) { nextEmpty = j; break; }
        }
        if (nextEmpty >= 0) {
          sel.value = chapters[nextEmpty].id;
          ui.writeChapterId = sel.value;
        }
      }
      var result = await writeChapter(true, { skipActionGate: true, skipScope: true });
      if (!result) break;
      if (stopOnFail && result.quality && !result.quality.ok) {
        setStatus('质检未通过，已熔断连写（第 ' + (i + 1) + '/' + n + ' 章）', { panel: 'write' });
        break;
      }
    }
    renderAll();
  } finally {
    engineEnd('story.chapter.batch');
  }
}

export async function forkCurrentChapterBranch() {
  if (!state.novel) {
    setStatus('请先打开小说');
    return;
  }
  collectWriteFromDom();
  var sel = $('ssWriteChapterSelect');
  if (!sel || !sel.value) {
    setStatus('请先选择分叉章节');
    return;
  }
  var name = await showSsPrompt({
    icon: '🌿',
    title: '新分支名称',
    message: '从当前章分叉出一条平行线',
    defaultValue: '平行线',
    okText: '下一步',
  });
  if (name === null) return;
  var choiceLabel = await showSsPrompt({
    icon: '💬',
    title: '读者选项文案',
    message: '选线时显示',
    defaultValue: String(name).trim() || '平行线',
    okText: '下一步',
  });
  if (choiceLabel === null) return;
  var direction = await showSsPrompt({
    icon: '🧭',
    title: '分支方向 / 偏好',
    message: '写入后续生成（可留空）',
    defaultValue: '',
    select: false,
    okText: '下一步',
  });
  if (direction === null) return;
  direction = String(direction || '').trim();
  var asEnding = await showSsConfirm({
    icon: '🏁',
    title: '标为结局支？',
    message: '将此分支标为「结局支」？（可稍后在分支树改）',
    okText: '结局支',
    cancelText: '普通支',
  });
  try {
    var out = forkBranchFromChapter(state.novel, {
      fromChapterId: sel.value,
      name: String(name).trim() || '平行线',
      choiceLabel: String(choiceLabel).trim() || String(name).trim(),
      direction: direction,
      kind: asEnding ? BRANCH_KIND_ENDING : 'path',
      endingTitle: asEnding ? (String(choiceLabel).trim() || String(name).trim()) : '',
      publishReady: true,
    });
    state.novel = normalizeNovel(out.novel);
    await persistNovel();
    setStatus('已开分支「' + out.branch.name + '」，自「' + (out.forkChapter.title || '') + '」分叉');
    renderAll();
    if (direction) {
      var okOutline = await showSsConfirm({
        icon: '📝',
        title: '续写大纲？',
        message: '是否立即按分支方向续写大纲？',
        okText: '续写',
        cancelText: '稍后',
      });
      if (okOutline) {
        await generateOutline('branch');
      }
    }
  } catch (err) {
    setStatus('开分支失败：' + (err.message || err));
  }
}
