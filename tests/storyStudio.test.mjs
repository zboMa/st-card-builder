/**
 * 小说创作模块：normalize / exportTxt / id / mvu / graphSeed
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  genStoryId,
  createEmptyNovel,
  normalizeNovel,
  discardOutlineFrom,
  syncChaptersFromOutline,
  toCatalogEntry,
  upsertCatalogEntry,
  removeCatalogEntry,
  STORY_VIEWS,
} from '../src/lib/storyStudio/state.mjs';
import { novelToTxt, novelTxtFilename } from '../src/lib/storyStudio/exportTxt.mjs';
import { storyNovelKey, storyCatalogKey } from '../src/lib/storyStudio/idb.mjs';
import { seedGraphFromCard, mergeGraphSeed } from '../src/lib/storyStudio/graphSeed.mjs';
import { detectMvuStatusBarDesign, trySyncAfterChapter } from '../src/lib/storyStudio/mvuHook.mjs';
import {
  parseOutlineAiText,
  CHILD_SAFETY_RULE,
  buildChapterUserPrompt,
} from '../src/lib/storyStudio/prompts.mjs';
import { DEFAULT_PROMPTS } from '../src/lib/promptCanon.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('storyStudio state', function() {
  it('genStoryId 带前缀且唯一', function() {
    var a = genStoryId('novel');
    var b = genStoryId('novel');
    assert.match(a, /^novel_/);
    assert.notEqual(a, b);
  });

  it('normalizeNovel 填充缺省并清洗章节顺序', function() {
    var n = normalizeNovel({
      title: '测试',
      outline: [{ title: '一', summary: 's1' }, { title: '二' }],
      chapters: [{ title: '一', content: '正文', order: 5 }],
    });
    assert.equal(n.title, '测试');
    assert.equal(n.outline.length, 2);
    assert.equal(n.outline[0].order, 0);
    assert.equal(n.chapters[0].order, 0);
    assert.ok(n.id);
    assert.equal(n.readState.mode, 'swipe');
  });

  it('discardOutlineFrom 裁剪大纲与章节', function() {
    var n = createEmptyNovel({ title: 'x' });
    n.outline = [
      { id: 'a', title: '1', summary: '', order: 0 },
      { id: 'b', title: '2', summary: '', order: 1 },
      { id: 'c', title: '3', summary: '', order: 2 },
    ];
    n.chapters = [
      { id: 'c1', title: '1', summary: '', content: 'a', advancePrompt: '', order: 0 },
      { id: 'c2', title: '2', summary: '', content: 'b', advancePrompt: '', order: 1 },
      { id: 'c3', title: '3', summary: '', content: 'c', advancePrompt: '', order: 2 },
    ];
    var out = discardOutlineFrom(n, 1);
    assert.equal(out.outline.length, 1);
    assert.equal(out.chapters.length, 1);
    assert.equal(out.outline[0].title, '1');
  });

  it('syncChaptersFromOutline 按大纲补空章', function() {
    var n = createEmptyNovel();
    n.outline = [
      { id: 'o1', title: '开端', summary: 's', order: 0 },
      { id: 'o2', title: '发展', summary: 't', order: 1 },
    ];
    var out = syncChaptersFromOutline(n);
    assert.equal(out.chapters.length, 2);
    assert.equal(out.chapters[0].title, '开端');
    assert.equal(out.chapters[1].summary, 't');
  });

  it('catalog upsert / remove', function() {
    var n = createEmptyNovel({ id: 'n1', title: '甲' });
    var list = upsertCatalogEntry([], n);
    assert.equal(list.length, 1);
    assert.equal(toCatalogEntry(n).id, 'n1');
    list = removeCatalogEntry(list, 'n1');
    assert.equal(list.length, 0);
  });

  it('STORY_VIEWS 五视图齐全', function() {
    assert.deepEqual(STORY_VIEWS, [
      'story-manage',
      'story-graph',
      'story-outline',
      'story-write',
      'story-read',
    ]);
  });
});

describe('storyStudio idb keys', function() {
  it('storyNovelKey / catalogKey 格式', function() {
    assert.equal(storyNovelKey('cardA', 'novelB'), 'storyStudioV1:card:cardA:novelB');
    assert.equal(storyCatalogKey('cardA'), 'storyStudioV1:catalog:card:cardA');
    assert.equal(storyNovelKey('', 'x'), '');
  });
});

describe('storyStudio exportTxt', function() {
  it('novelToTxt 含标题与章节，无正文时回退摘要', function() {
    var txt = novelToTxt({
      title: '夜航船',
      chapters: [
        { title: '第一章', content: '正文甲', summary: '概要' },
        { title: '第二章', content: '', summary: '只有摘要' },
      ],
    });
    assert.match(txt, /夜航船/);
    assert.match(txt, /第一章/);
    assert.match(txt, /正文甲/);
    assert.match(txt, /【摘要】/);
    assert.match(txt, /只有摘要/);
    assert.match(novelTxtFilename({ title: 'a/b:c' }), /\.txt$/);
  });
});

describe('storyStudio graphSeed', function() {
  it('从角色与世界书生成节点', function() {
    var g = seedGraphFromCard({
      charName: '林深',
      charDesc: '主角',
      worldbookEntries: [
        { comment: '[人物] 苏晚', content: '女主', enabled: true },
        { comment: '[地点] 江城', content: '城市', enabled: true },
        { comment: '已禁用', enabled: false },
      ],
    });
    assert.ok(g.nodes.length >= 3);
    assert.ok(g.nodes.some(function(n) { return n.name === '林深' && n.type === 'character'; }));
    assert.ok(g.nodes.some(function(n) { return n.name === '苏晚'; }));
    assert.ok(g.nodes.some(function(n) { return n.type === 'location'; }));
    var merged = mergeGraphSeed(g, seedGraphFromCard({ charName: '林深', worldbookEntries: [] }));
    assert.equal(merged.nodes.filter(function(n) { return n.name === '林深'; }).length, 1);
  });
});

describe('storyStudio mvuHook', function() {
  it('无 design 时 canSync=false 且警告', function() {
    var d = detectMvuStatusBarDesign({});
    assert.equal(d.ok, false);
    assert.equal(d.canSync, false);
    assert.match(d.warning, /MVU|状态栏/);
  });

  it('有 MVU + 状态栏 design 时可同步', function() {
    var d = detectMvuStatusBarDesign({
      zmer_mvu_design: { variables: [{ path: '世界.时间' }] },
      zmer_statusbar_design: { bodyHtml: '<div></div>', css: '.x{}' },
    });
    assert.equal(d.ok, true);
    var r = trySyncAfterChapter({
      enabled: true,
      getExtension: function(k) {
        if (k === 'zmer_mvu_design') return { variables: [{ path: 'a' }] };
        if (k === 'zmer_statusbar_design') return { bodyHtml: '<div/>' };
        return null;
      },
      chapterTitle: '一',
      chapterContent: '正文',
    });
    assert.equal(r.synced, true);
  });

  it('勾选但无 design 时 skipped', function() {
    var r = trySyncAfterChapter({
      enabled: true,
      getExtension: function() { return null; },
    });
    assert.equal(r.skipped, true);
    assert.equal(r.reason, 'no_design');
  });
});

describe('storyStudio prompts', function() {
  it('解析大纲 JSON；章文提示含禁止儿童性化', function() {
    var list = parseOutlineAiText('```json\n{"chapters":[{"title":"起","summary":"开场"}]}\n```');
    assert.equal(list.length, 1);
    assert.equal(list[0].title, '起');
    var user = buildChapterUserPrompt({ title: 't', chapterTitle: 'c' });
    assert.match(user, /禁止儿童性化/);
    assert.match(CHILD_SAFETY_RULE, /禁止儿童性化/);
    assert.match(DEFAULT_PROMPTS.storyOutlineGen, /禁止儿童性化/);
    assert.match(DEFAULT_PROMPTS.storyChapterWrite, /禁止儿童性化/);
  });
});

describe('storyStudio UI mount', function() {
  it('面板与入口 DOM id 存在', function() {
    const manage = readFileSync(join(root, 'src/components/storyStudio/StoryManagePanel.astro'), 'utf8');
    assert.match(manage, /id="btnSsNewNovel"/);
    assert.match(manage, /id="btnSsNewNovelWizard"/);
    assert.match(manage, /id="ssNovelList"/);
    assert.match(manage, /ss-manage-header/);
    assert.match(manage, /id="ssManageStatus"/);
    const app = readFileSync(join(root, 'src/lib/storyStudio/browserApp.mjs'), 'utf8');
    assert.match(app, /导出 TXT/);
    assert.match(app, /btn-icon btn-icon--sm ss-novel-icon/);
    assert.match(app, /ss-novel-item__main/);
    assert.match(app, /btn-inline/);
    assert.match(app, /data-ss-act="rename"/);
    assert.doesNotMatch(app, /iconBtn\('rename'/);
    assert.match(app, /ui-empty-tip/);
    const styles = readFileSync(join(root, 'src/components/storyStudio/StoryStudioStyles.astro'), 'utf8');
    assert.match(styles, /max-width:\s*none/);
    assert.doesNotMatch(styles, /max-width:\s*960px/);
    const graph = readFileSync(join(root, 'src/components/storyStudio/StoryGraphPanel.astro'), 'utf8');
    assert.match(graph, /btn-inline/);
    assert.doesNotMatch(graph, /btn-fetch(?!-)/);
    const outline = readFileSync(join(root, 'src/components/storyStudio/StoryOutlinePanel.astro'), 'utf8');
    assert.match(outline, /btn-inline/);
    assert.match(outline, /ss-outline-list/);
    const write = readFileSync(join(root, 'src/components/storyStudio/StoryWritePanel.astro'), 'utf8');
    assert.match(write, /id="ssWriteSyncMvu"/);
    assert.match(write, /写完同步变量与状态栏/);
    assert.match(write, /id="btnSsWriteAutoNext"/);
    assert.match(write, /id="btnSsForkBranch"/);
    assert.match(write, /id="ssWriteLedger"/);
    const read = readFileSync(join(root, 'src/components/storyStudio/StoryReadPanel.astro'), 'utf8');
    assert.match(read, /id="btnSsReadFullscreen"/);
    assert.match(read, /id="ssReadMode"/);
    const index = readFileSync(join(root, 'src/pages/index.astro'), 'utf8');
    assert.match(index, /StoryStudioApp/);
    assert.match(index, /data-view="story-manage"/);
    assert.match(index, /data-view="story-read"/);
  });
});
