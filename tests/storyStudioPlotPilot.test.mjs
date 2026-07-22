/**
 * Story Studio：分支 / Feed-forward / Token / 质检 / checkpoint
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyNovel,
  normalizeNovel,
  syncChaptersFromOutline,
  getActiveChapters,
  getActiveOutline,
  discardOutlineFrom,
} from '../src/lib/storyStudio/state.mjs';
import {
  forkBranchFromChapter,
  resolveBranchChapters,
  setActiveBranch,
  branchBrief,
} from '../src/lib/storyStudio/branch.mjs';
import { packChapterContext, truncateChars } from '../src/lib/storyStudio/tokenBudget.mjs';
import {
  parseFeedForwardAiText,
  applyFeedForwardToChapter,
  collectFeedForwardsBefore,
} from '../src/lib/storyStudio/feedForward.mjs';
import {
  scanClicheHeuristics,
  parseQualityAiText,
  mergeQualityResult,
  tensionCurveFromChapters,
} from '../src/lib/storyStudio/quality.mjs';
import { pushChapterCheckpoint, restoreChapterCheckpoint } from '../src/lib/storyStudio/checkpoint.mjs';
import { mergeForeshadowsIntoLedger, ledgerBrief } from '../src/lib/storyStudio/plotLedger.mjs';
import { buildChapterUserPrompt } from '../src/lib/storyStudio/prompts.mjs';
import { novelToTxt } from '../src/lib/storyStudio/exportTxt.mjs';
import { DEFAULT_PROMPTS } from '../src/lib/promptCanon.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function seedNovel() {
  var n = createEmptyNovel({ title: '枝世界' });
  n = normalizeNovel(n);
  var bid = n.activeBranchId;
  n.outline = [
    { id: 'o1', title: '一', summary: '起', order: 0, branchId: bid },
    { id: 'o2', title: '二', summary: '承', order: 1, branchId: bid },
    { id: 'o3', title: '三', summary: '转', order: 2, branchId: bid },
  ];
  n = syncChaptersFromOutline(n);
  n.chapters[0].content = '第一章正文';
  n.chapters[1].content = '第二章正文';
  return n;
}

describe('storyStudio branch worlds', function() {
  it('从第 2 章开分支后可见章 = 继承 + 新章', function() {
    var n = seedNovel();
    var ch2 = getActiveChapters(n)[1];
    var out = forkBranchFromChapter(n, {
      fromChapterId: ch2.id,
      name: '暗线',
      direction: '反派胜利',
    });
    n = normalizeNovel(out.novel);
    assert.equal(n.branches.length, 2);
    assert.equal(n.activeBranchId, out.branch.id);
    var visible = resolveBranchChapters(n, out.branch.id);
    assert.ok(visible.length >= 3);
    assert.equal(visible[0].title, '一');
    assert.equal(visible[1].title, '二');
    assert.match(branchBrief(n, out.branch.id), /暗线|反派/);
  });

  it('切回主线看不到分支私有章', function() {
    var n = seedNovel();
    var ch2 = getActiveChapters(n)[1];
    var out = forkBranchFromChapter(n, { fromChapterId: ch2.id, name: 'B' });
    n = normalizeNovel(out.novel);
    var mainId = n.branches[0].id;
    n = setActiveBranch(n, mainId);
    var mainCh = getActiveChapters(n);
    assert.equal(mainCh.length, 3);
    assert.ok(!mainCh.some(function(c) { return c.branchId === out.branch.id; }));
  });

  it('废弃后续只裁当前分支私有段', function() {
    var n = seedNovel();
    var out = forkBranchFromChapter(n, {
      fromChapterId: getActiveChapters(n)[0].id,
      name: '旁支',
    });
    n = normalizeNovel(out.novel);
    // 分支可见：第1章继承 + 至少1章私有
    var before = getActiveOutline(n).length;
    assert.ok(before >= 2);
    n = discardOutlineFrom(n, 1);
    assert.equal(getActiveOutline(n).length, 1);
  });
});

describe('storyStudio feed-forward & token', function() {
  it('parseFeedForwardAiText 解析 JSON', function() {
    var ff = parseFeedForwardAiText('{"summary":"甲乙","openThreads":["线1"],"tension":8,"foreshadows":[{"title":"刀","action":"plant"}]}');
    assert.equal(ff.summary, '甲乙');
    assert.equal(ff.tension, 8);
    assert.equal(ff.foreshadows[0].title, '刀');
  });

  it('洋葱预算截断且含近章记忆', function() {
    assert.equal(truncateChars('abcd', 3).length, 3);
    var packed = packChapterContext({
      graphBrief: '角色很多'.repeat(200),
      feedForwards: [
        { order: 1, title: '近', summary: '近摘要', openThreads: ['a'], tension: 7 },
        { order: 0, title: '远', summary: '远摘要很长'.repeat(40), openThreads: ['b'], tension: 3 },
      ],
      prevContent: '上文'.repeat(3000),
      budget: { totalChars: 2000, graphChars: 200, feedForwardRecentChars: 400, feedForwardOlderChars: 200, prevContentChars: 300 },
    });
    assert.ok(packed.usedChars <= 2000);
    assert.ok(packed.blocks.some(function(b) { return /近章记忆|远章压缩|人物/.test(b); }));
  });

  it('buildChapterUserPrompt 注入 feed-forward 与账本', function() {
    var user = buildChapterUserPrompt({
      title: 't',
      chapterTitle: 'c',
      ledgerBrief: '- [open] 剑',
      feedForwards: [{ order: 0, title: '前', summary: '发生了战斗', openThreads: ['谁赢了'], tension: 6 }],
      branchHint: '分支：暗线',
    });
    assert.match(user, /伏笔|剑/);
    assert.match(user, /近章记忆|发生了战斗/);
    assert.match(user, /暗线/);
    assert.match(user, /禁止儿童性化/);
  });

  it('章后记忆可落到章节与账本', function() {
    var n = seedNovel();
    var ch = n.chapters[0];
    applyFeedForwardToChapter(ch, parseFeedForwardAiText('{"summary":"回","openThreads":["x"],"tension":4,"foreshadows":[{"title":"信物","action":"plant"}]}'));
    assert.equal(ch.feedForward.tension, 4);
    mergeForeshadowsIntoLedger(n, [{ title: '信物', action: 'plant', note: '玉佩' }], ch, n.activeBranchId);
    assert.ok(ledgerBrief(n.plotLedger).indexOf('信物') >= 0);
    var feeds = collectFeedForwardsBefore(n.chapters, 1);
    assert.ok(feeds.length >= 1);
  });
});

describe('storyStudio quality & checkpoint', function() {
  it('俗套扫描命中降分', function() {
    var r = scanClicheHeuristics('他眼中闪过一丝惊讶，不知为何心跳漏了一拍。');
    assert.ok(r.hitCount >= 2);
    assert.ok(r.score < 10);
  });

  it('合并质检结果', function() {
    var m = mergeQualityResult(
      scanClicheHeuristics('正常叙述，有动作与对白。'),
      parseQualityAiText('{"ok":true,"score":8,"issues":[],"rewriteHint":""}')
    );
    assert.equal(m.ok, true);
    assert.ok(m.score >= 6);
  });

  it('checkpoint 可恢复', function() {
    var ch = { content: '旧文', summary: 's', advancePrompt: '', checkpoints: [] };
    pushChapterCheckpoint(ch, '测');
    ch.content = '新文';
    assert.equal(ch.checkpoints.length, 1);
    assert.equal(restoreChapterCheckpoint(ch, ch.checkpoints[0].id), true);
    assert.equal(ch.content, '旧文');
  });

  it('张力曲线', function() {
    var curve = tensionCurveFromChapters([
      { title: 'a', content: 'x', feedForward: { tension: 3 } },
      { title: 'b', content: 'y', feedForward: { tension: 9 } },
    ]);
    assert.equal(curve[1].tension, 9);
  });
});

describe('storyStudio prompts canon', function() {
  it('含 feed-forward / quality / rewrite 默认提示', function() {
    assert.match(DEFAULT_PROMPTS.storyFeedForward, /JSON/);
    assert.match(DEFAULT_PROMPTS.storyChapterQuality, /质检/);
    assert.match(DEFAULT_PROMPTS.storyChapterRewrite, /改写/);
  });
});

describe('storyStudio export branch label', function() {
  it('TXT 含分支名', function() {
    var n = seedNovel();
    var txt = novelToTxt(n);
    assert.match(txt, /枝世界/);
    assert.match(txt, /主线|分支/);
  });
});

describe('storyStudio UI ids for plotpilot', function() {
  it('写作面板含分支/连写/账本入口', function() {
    const write = readFileSync(join(root, 'src/components/storyStudio/StoryWritePanel.astro'), 'utf8');
    assert.match(write, /id="ssWriteBranchSelect"/);
    assert.match(write, /id="btnSsForkBranch"/);
    assert.match(write, /id="btnSsWriteBatch"/);
    assert.match(write, /id="ssWriteLedger"/);
    assert.match(write, /id="btnSsWriteRewrite"/);
    const manage = readFileSync(join(root, 'src/components/storyStudio/StoryManagePanel.astro'), 'utf8');
    assert.match(manage, /id="btnSsNewNovelWizard"/);
    const outline = readFileSync(join(root, 'src/components/storyStudio/StoryOutlinePanel.astro'), 'utf8');
    assert.match(outline, /id="ssWizardBox"/);
    const app = readFileSync(join(root, 'src/lib/storyStudio/browserApp.mjs'), 'utf8');
    assert.match(app, /runChapterWritePipeline/);
    assert.match(app, /forkBranchFromChapter/);
  });
});
