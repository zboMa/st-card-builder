/**
 * 写章流水线：起草 → Feed-forward → 质检（可供 browserApp 调用）
 */

import {
  buildChapterUserPrompt,
  graphBriefFromNovel,
  outlineBriefFromNovel,
  CHILD_SAFETY_RULE,
} from './prompts.mjs';
import {
  parseFeedForwardAiText,
  applyFeedForwardToChapter,
  collectFeedForwardsBefore,
  buildFeedForwardUserPrompt,
} from './feedForward.mjs';
import {
  scanClicheHeuristics,
  parseQualityAiText,
  mergeQualityResult,
  buildQualityUserPrompt,
  buildRewriteUserPrompt,
} from './quality.mjs';
import { pushChapterCheckpoint } from './checkpoint.mjs';
import { mergeForeshadowsIntoLedger, ledgerBrief } from './plotLedger.mjs';
import { resolveBranchLedger, branchBrief, getBranch } from './branch.mjs';
import { getActiveChapters, getActiveOutline } from './state.mjs';

export var WRITE_STEPS = ['plan', 'draft', 'feed', 'qa'];

/**
 * @param {object} deps
 * @param {function} deps.callAI
 * @param {function} deps.promptText
 * @param {function} [deps.onStep]
 * @param {AbortSignal} [deps.signal]
 * @param {object} novel
 * @param {number} chapterIndex 可见章节下标
 * @param {{ skipDraft?: boolean, skipFeed?: boolean, skipQa?: boolean, rewriteOnly?: boolean }} [opts]
 */
export async function runChapterWritePipeline(deps, novel, chapterIndex, opts) {
  var d = deps || {};
  var o = opts || {};
  var n = novel;
  var chapters = getActiveChapters(n);
  var outline = getActiveOutline(n);
  var idx = Math.max(0, Number(chapterIndex) || 0);
  var ch = chapters[idx];
  if (!ch) throw new Error('章节不存在');

  function step(name) {
    if (typeof d.onStep === 'function') d.onStep(name);
  }

  var ws = n.writeSettings || {};
  var runFeed = o.skipFeed ? false : (ws.runFeedForward !== false);
  var runQa = o.skipQa ? false : (ws.runQuality !== false);
  var branch = getBranch(n, n.activeBranchId);
  var ledgerItems = resolveBranchLedger(n, n.activeBranchId);
  var prev = idx > 0 ? chapters[idx - 1] : null;
  var feeds = collectFeedForwardsBefore(chapters, idx);

  if (o.rewriteOnly) {
    step('draft');
    if (String(ch.content || '').trim()) pushChapterCheckpoint(ch, '改写前');
    var q = ch.quality || {};
    var rewriteUser = buildRewriteUserPrompt({
      chapterTitle: ch.title,
      content: ch.content,
      rewriteHint: q.rewriteHint || '',
      issues: q.issues || [],
    });
    var rewriteSys = d.promptText(
      'storyChapterRewrite',
      '你是长篇小说改写编辑。按要求修正正文。' + CHILD_SAFETY_RULE
    );
    ch.content = await d.callAI(rewriteUser, rewriteSys, d.signal);
  } else if (!o.skipDraft) {
    step('plan');
    if (String(ch.content || '').trim()) pushChapterCheckpoint(ch, '重写前');
    step('draft');
    var system = d.promptText(
      'storyChapterWrite',
      '你是长篇小说写手。根据大纲与推进提示撰写章节正文。' + CHILD_SAFETY_RULE
    );
    var user = buildChapterUserPrompt({
      title: n.title,
      chapterTitle: ch.title,
      chapterSummary: ch.summary,
      advancePrompt: ch.advancePrompt,
      prevContent: prev ? prev.content : '',
      outlineBrief: outlineBriefFromNovel(n, idx, outline),
      graphBrief: graphBriefFromNovel(n),
      ledgerBrief: ledgerBrief(ledgerItems),
      feedForwards: feeds,
      branchHint: branchBrief(n, n.activeBranchId),
    });
    ch.content = await d.callAI(user, system, d.signal);
  }

  if (runFeed && String(ch.content || '').trim()) {
    step('feed');
    try {
      var ffSys = d.promptText(
        'storyFeedForward',
        '你是连续性编辑，提取章后记忆。只输出 JSON。' + CHILD_SAFETY_RULE
      );
      var ffUser = buildFeedForwardUserPrompt({
        title: n.title,
        chapterTitle: ch.title,
        chapterSummary: ch.summary,
        content: ch.content,
        ledgerBrief: ledgerBrief(ledgerItems),
      });
      var ffText = await d.callAI(ffUser, ffSys, d.signal);
      var ff = parseFeedForwardAiText(ffText);
      applyFeedForwardToChapter(ch, ff);
      mergeForeshadowsIntoLedger(n, ff.foreshadows, ch, n.activeBranchId);
    } catch (e) {
      // Feed-forward 失败不阻断正文
      if (d.signal && d.signal.aborted) throw e;
      console.warn('[storyStudio] feed-forward', e);
    }
  }

  var qualityResult = null;
  if (runQa && String(ch.content || '').trim()) {
    step('qa');
    var heuristic = scanClicheHeuristics(ch.content);
    var aiQa = { ok: true, score: 7, issues: [], rewriteHint: '' };
    try {
      var qaSys = d.promptText('storyChapterQuality', '你是小说质检编辑。只输出 JSON。');
      var qaUser = buildQualityUserPrompt({ chapterTitle: ch.title, content: ch.content });
      var qaText = await d.callAI(qaUser, qaSys, d.signal);
      aiQa = parseQualityAiText(qaText);
    } catch (e2) {
      if (d.signal && d.signal.aborted) throw e2;
      console.warn('[storyStudio] quality', e2);
    }
    qualityResult = mergeQualityResult(heuristic, aiQa);
    ch.quality = qualityResult;
  }

  return {
    chapter: ch,
    index: idx,
    quality: qualityResult,
    branch: branch,
  };
}
