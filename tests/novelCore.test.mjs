/**
 * 小说工坊核心：拆章 / 召回 / 同步 / schema
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  CHARACTER_PROFILE_FIELDS,
  emptyCharacterProfile,
  normalizeCharacterProfile,
  formatProfileYaml,
  profileContentDigest,
  UNMENTIONED,
} from '../src/lib/novel/schema.mjs';
import {
  splitIntoChapters,
  mergeChapters,
  splitChapterAt,
  moveChapter,
  joinEnabledChapters,
  exportSelectedChapters,
  buildChapterShards,
  buildChapterGroupShards,
  buildExtractShards,
  estimateShardCalls,
  estimateExtractCalls,
  buildSetupCorpus,
  chaptersSourceFingerprint,
} from '../src/lib/novel/chapters.mjs';
import {
  DEFAULT_EXPAND_BUDGET,
  buildMatchTerms,
  findNameHits,
  sampleHitsByCoverage,
  buildRecallPayload,
} from '../src/lib/novel/recall.mjs';
import {
  profileToCharacterFields,
  applyDraftsToWorldbook,
  profileToWorldbookDraft,
  entityPersonToCharacterFields,
  entityPersonToWorldbookDraft,
  entitiesToWorldbookDrafts,
  mergeStyleText,
  styleToWorldbookDraft,
  STYLE_WB_COMMENT,
} from '../src/lib/novel/sync.mjs';
import {
  createDefaultNovelState,
  hydrateNovelState,
  getPipelineGates,
  getFullSourceText,
  NOVEL_VIEWS,
  CHUNK_SIZE_OPTIONS,
  summarizeNovelState,
  NOVEL_STORAGE_KEY,
  NOVEL_BUCKET_PREFIX,
  novelBucketKey,
  novelStateHasContent,
  readNovelBucket,
  writeNovelBucket,
  loadNovelStateForCard,
  copyNovelBucket,
  removeNovelBucket,
} from '../src/lib/novel/state.mjs';

const novelRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const NOVEL_PANEL_FILES = [
  'NovelSourcePanel.astro',
  'NovelChaptersPanel.astro',
  'NovelCharacterSetupPanel.astro',
  'NovelGreetingsPanel.astro',
  'NovelAnalyzePanel.astro',
  'NovelCharactersPanel.astro',
  'NovelWorldbookPanel.astro',
  'NovelStylePanel.astro',
];

describe('novel schema', function() {
  it('附录1字段全集齐全', function() {
    assert.equal(CHARACTER_PROFILE_FIELDS.length, 22);
    assert.ok(CHARACTER_PROFILE_FIELDS.includes('NSFW_information'));
    assert.ok(CHARACTER_PROFILE_FIELDS.includes('Chinese name'));
    var p = emptyCharacterProfile('小龙女');
    CHARACTER_PROFILE_FIELDS.forEach(function(f) {
      assert.ok(p[f] !== undefined, 'missing ' + f);
    });
  });

  it('normalize 补全缺失字段且不丢字段', function() {
    var n = normalizeCharacterProfile({ 'Chinese name': '小龙女', age: '18' }, '小龙女');
    assert.equal(n['Chinese name'], '小龙女');
    assert.equal(n.age, '18');
    assert.equal(n.Nickname, UNMENTIONED);
    assert.ok(n.NSFW_information);
    assert.ok(n.NSFW_information.body);
    assert.ok(n.NSFW_information.Sex_related_traits);
  });

  it('NSFW 深合并保留骨架并覆盖 AI 字段', function() {
    var n = normalizeCharacterProfile({
      'Chinese name': '甲',
      NSFW_information: {
        body: { breasts: '丰满' },
        xp_kinks: ['耳语'],
        contrast: '外冷内欲',
      },
    }, '甲');
    assert.equal(n.NSFW_information.body.breasts, '丰满');
    assert.equal(n.NSFW_information.body.overall, UNMENTIONED);
    assert.deepEqual(n.NSFW_information.xp_kinks, ['耳语']);
    assert.equal(n.NSFW_information.contrast, '外冷内欲');
    assert.ok(n.NSFW_information.erogenous_zones);
  });

  it('formatProfileYaml 跳过未提及/空字段', function() {
    var emptyYaml = formatProfileYaml(emptyCharacterProfile('测试'), '测试');
    assert.match(emptyYaml, /^测试:/);
    assert.doesNotMatch(emptyYaml, /原文未提及/);
    assert.doesNotMatch(emptyYaml, /NSFW_information/);
    var filled = normalizeCharacterProfile({
      'Chinese name': '小龙女',
      gender: '女',
      identity: ['古墓传人'],
    }, '小龙女');
    var yaml = formatProfileYaml(filled, '小龙女');
    assert.match(yaml, /gender: 女/);
    assert.match(yaml, /古墓传人/);
    assert.doesNotMatch(yaml, /原文未提及/);
    assert.doesNotMatch(yaml, /Nickname:/);
  });

  it('profileContentDigest 为可读摘要而非 JSON', function() {
    var p = normalizeCharacterProfile({ 'Chinese name': '甲', gender: '女' }, '甲');
    var dig = profileContentDigest(p, '甲', 200);
    assert.match(dig, /甲/);
    assert.doesNotMatch(dig, /^\{/);
    assert.ok(dig.length <= 200);
  });
});

describe('novel chapters', function() {
  it('按标题拆章', function() {
    var text = '第一章 开端\n你好\n\n第二章 发展\n世界';
    var chs = splitIntoChapters(text, { mode: 'title', chunkSize: 8000 });
    assert.ok(chs.length >= 2);
    assert.ok(chs[0].title.includes('第'));
  });

  it('空行拆章与合并 / 拆分 / 调序', function() {
    var blank = splitIntoChapters(
      '第一段内容足够长一些啦啊啊啊啊啊啊啊\n\n第二段内容也要足够长一些啦啊啊啊啊啊\n\n第三段内容继续拉长文本啦啊啊啊啊啊啊',
      { mode: 'blank', chunkSize: 50 }
    );
    assert.ok(blank.length >= 2, 'blank got ' + blank.length);

    var chs = [
      { id: 'a', title: 'A', text: 'hello world content here', enabled: true, selected: true },
      { id: 'b', title: 'B', text: 'second chapter text body', enabled: true, selected: true },
      { id: 'c', title: 'C', text: 'third', enabled: true, selected: false },
    ];
    var merged = mergeChapters(chs, ['a', 'b']);
    assert.equal(merged.length, 2);
    var mid = Math.floor(merged[0].text.length / 2);
    var split = splitChapterAt(merged, merged[0].id, mid);
    assert.ok(split.length >= merged.length);
    var moved = moveChapter(split, split[0].id, 1);
    assert.equal(moved[1].id, split[0].id);
  });

  it('启用章拼接与导出', function() {
    var chs = [
      { id: 'a', title: 'A', text: '甲', enabled: true, selected: true },
      { id: 'b', title: 'B', text: '乙', enabled: false, selected: false },
    ];
    assert.equal(joinEnabledChapters(chs), '甲');
    assert.match(exportSelectedChapters(chs, ['a']), /## A/);
  });

  it('分片预估：按字数跨章 packing；超长章切开；禁用/空章不计', function() {
    var chs = [
      { id: 'a', title: 'A', text: 'x'.repeat(10000), enabled: true },
      { id: 'b', title: 'B', text: 'y'.repeat(3000), enabled: true },
      { id: 'c', title: 'C', text: 'z'.repeat(9000), enabled: false },
    ];
    // 长章 10000/4000 → 3 片；短章 3000 单独 1 片；禁用不计 → 4
    assert.equal(estimateShardCalls(chs, 4000), 4);
    var shards = buildChapterShards(chs, 4000);
    assert.equal(shards.length, 4);
    assert.ok(shards.every(function(s) { return s.chapterId !== 'c'; }));
    // 10000+3000 ≤ 16000 → 跨章合成 1 片
    assert.equal(estimateShardCalls(chs, 16000), 1);
    assert.equal(estimateExtractCalls(chs, { mode: 'chars', chunkSize: 4000 }), 4);

    // 短章贪心跨章：2000+2000≤5000，再加 2000 超预算 → 2 片
    var short = [
      { id: 's1', title: 'S1', text: 'a'.repeat(2000), enabled: true },
      { id: 's2', title: 'S2', text: 'b'.repeat(2000), enabled: true },
      { id: 's3', title: 'S3', text: 'c'.repeat(2000), enabled: true },
    ];
    var packed = buildChapterShards(short, 5000);
    assert.equal(packed.length, 2);
    assert.match(packed[0].chapterId, /s1/);
    assert.match(packed[0].chapterId, /s2/);
    assert.equal(packed[1].chapterId, 's3');
    assert.equal(estimateExtractCalls(short, { mode: 'chars', chunkSize: 5000 }), 2);
  });

  it('按章节分片：每 N 章一次；空章不计；预估=实际片数', function() {
    var chs = [
      { id: 'a', title: 'A', text: '甲', enabled: true },
      { id: 'b', title: 'B', text: '乙', enabled: true },
      { id: 'c', title: 'C', text: '丙', enabled: true },
      { id: 'd', title: 'D', text: '', enabled: true },
      { id: 'e', title: 'E', text: '戊', enabled: false },
    ];
    // 有文本启用章 3；N=2 → ceil(3/2)=2
    assert.equal(estimateExtractCalls(chs, { mode: 'chapters', chaptersPerShard: 2 }), 2);
    var groups = buildChapterGroupShards(chs, 2);
    assert.equal(groups.length, 2);
    assert.match(groups[0].text, /甲/);
    assert.match(groups[0].text, /乙/);
    assert.match(groups[1].text, /丙/);
    assert.equal(buildExtractShards(chs, { mode: 'chapters', chaptersPerShard: 1 }).length, 3);
    assert.equal(buildExtractShards(chs, { mode: 'chapters', chaptersPerShard: 10 }).length, 1);
  });
});

describe('novel recall', function() {
  it('默认预算 30000', function() {
    assert.equal(DEFAULT_EXPAND_BUDGET, 30000);
  });

  it('仅匹配人名别名，不吞全书', function() {
    var chapters = [
      { id: '1', title: '一', text: '小龙女走在古墓。杨过跟随。', enabled: true },
      { id: '2', title: '二', text: '这里没有目标人物。', enabled: true },
      { id: '3', title: '三', text: '姑姑对过儿说了一句话。', enabled: true },
    ];
    var terms = buildMatchTerms('小龙女', ['姑姑', '龙儿']);
    assert.ok(terms.includes('小龙女'));
    var hits = findNameHits(chapters, '小龙女', ['姑姑']);
    assert.ok(hits.length >= 2);
    assert.ok(hits.every(function(h) { return h.text.indexOf('没有目标') < 0 || h.chapterId === '1' || h.chapterId === '3'; }));
    var payload = buildRecallPayload(chapters, '小龙女', ['姑姑'], 500, 20);
    assert.ok(payload.totalChars <= 500);
    assert.ok(payload.body.indexOf('小龙女') >= 0 || payload.body.indexOf('姑姑') >= 0);
    assert.ok(payload.body.indexOf(chapters[1].text) < 0);
  });

  it('超预算覆盖度抽样', function() {
    var long = '小龙女'.repeat(100);
    var chapters = [];
    for (var i = 0; i < 5; i++) {
      chapters.push({ id: String(i), title: '章' + i, text: long + '旁白' + i, enabled: true });
    }
    var hits = findNameHits(chapters, '小龙女', [], 50);
    var sampled = sampleHitsByCoverage(hits, 800);
    assert.ok(sampled.totalChars <= 800);
    assert.ok(sampled.truncated);
    assert.ok(sampled.snippets.length >= 1);
  });
});

describe('novel sync', function() {
  it('角色同步 overwrite/merge/skip', function() {
    var profile = normalizeCharacterProfile({ 'Chinese name': '小龙女', gender: '女' }, '小龙女');
    var ow = profileToCharacterFields(profile, '小龙女', 'overwrite', '旧描述');
    assert.equal(ow.skipped, false);
    assert.match(ow.fields.charDesc, /小龙女/);
    assert.equal(ow.fields.charName, '小龙女');

    var sk = profileToCharacterFields(profile, '小龙女', 'skip', '已有');
    assert.equal(sk.skipped, true);

    var mg = profileToCharacterFields(profile, '小龙女', 'merge', '前言');
    assert.match(mg.fields.charDesc, /前言/);
    assert.match(mg.fields.charDesc, /小说人物/);
  });

  it('多人落卡：后续人物不覆盖 charName，特殊字符名可 merge', function() {
    var a = normalizeCharacterProfile({ 'Chinese name': '甲', gender: '女' }, '甲');
    var b = normalizeCharacterProfile({ 'Chinese name': '乙(副)', gender: '男' }, '乙(副)');
    var r1 = profileToCharacterFields(a, '甲', 'overwrite', '', { setCharName: true });
    assert.equal(r1.fields.charName, '甲');
    var r2 = profileToCharacterFields(b, '乙(副)', 'merge', r1.fields.charDesc, { setCharName: false });
    assert.equal(r2.fields.charName, undefined);
    assert.match(r2.fields.charDesc, /甲/);
    assert.match(r2.fields.charDesc, /乙\(副\)/);
    // 再次 merge 同名特殊字符应替换区块而非叠两份
    var r3 = profileToCharacterFields(b, '乙(副)', 'merge', r2.fields.charDesc, { setCharName: false });
    assert.equal((r3.fields.charDesc.match(/【小说人物·乙\(副\)】/g) || []).length, 1);
  });

  it('世界书草稿冲突策略', function() {
    var draft = profileToWorldbookDraft(emptyCharacterProfile('甲'), '甲');
    var r1 = applyDraftsToWorldbook([], [draft], 'merge');
    assert.equal(r1.added, 1);
    var r2 = applyDraftsToWorldbook(r1.entries, [Object.assign({}, draft, { content: '新内容' })], 'skip');
    assert.equal(r2.skipped, 1);
    var r3 = applyDraftsToWorldbook(r1.entries, [Object.assign({}, draft, { content: '追加段' })], 'merge');
    assert.ok(r3.entries[0].content.indexOf('追加段') >= 0);
  });

  it('同步 merge：有 provenance 的新内容优先', function() {
    var old = { comment: '[小说event] 夜宴', content: '旧短', keys: ['夜宴'] };
    var neu = {
      comment: '[小说event] 夜宴',
      content: '带溯源的更完整事件正文，应覆盖旧短内容。',
      keys: ['夜宴', '长安'],
      hasProvenance: true,
    };
    var r = applyDraftsToWorldbook([old], [neu], 'merge');
    assert.equal(r.updated, 1);
    assert.match(r.entries[0].content, /带溯源/);
    assert.ok(r.entries[0].keys.indexOf('长安') >= 0);
  });

  it('person 实体无 profile 也可同步角色设定与世界书草稿', function() {
    var e = {
      type: 'person',
      name: '秦月',
      aliases: ['月儿'],
      content: '女主，足够长的正文用于同步到角色设定与世界书。',
      provenance: [{ quote: '原文' }],
    };
    var fields = entityPersonToCharacterFields(e, 'overwrite', '');
    assert.equal(fields.skipped, false);
    assert.match(fields.fields.charDesc, /女主/);
    var d = entityPersonToWorldbookDraft(e);
    assert.equal(d.comment, '[小说人物] 秦月');
    assert.equal(d.hasProvenance, true);
    var drafts = entitiesToWorldbookDrafts([
      e,
      { type: 'event', name: '夜宴', content: '宴会', provenance: [{ quote: 'x' }] },
    ], { includePersons: true });
    assert.ok(drafts.some(function(x) { return x.comment.indexOf('小说人物') >= 0; }));
    assert.ok(drafts.some(function(x) { return x.category === 'event'; }));
  });

  it('文风合并', function() {
    assert.equal(mergeStyleText('A', 'B', 'overwrite').text, 'B');
    assert.equal(mergeStyleText('A', 'B', 'skip').skipped, true);
    assert.match(mergeStyleText('A', 'B', 'merge').text, /A[\s\S]*B/);
  });

  it('文风同步为固定标题「文风」世界书条目', function() {
    assert.equal(STYLE_WB_COMMENT, '文风');
    var d = styleToWorldbookDraft('冷淡克制');
    assert.equal(d.comment, '文风');
    assert.equal(d.strategy, 'constant');
    var r1 = applyDraftsToWorldbook([], [d], 'overwrite');
    assert.equal(r1.added, 1);
    assert.equal(r1.entries[0].comment, '文风');
    var r2 = applyDraftsToWorldbook(r1.entries, [styleToWorldbookDraft('更新后的文风')], 'overwrite');
    assert.equal(r2.updated, 1);
    assert.equal(r2.entries.length, 1);
    assert.match(r2.entries[0].content, /更新后的文风/);
  });
});

describe('novel state pipeline', function() {
  it('八视图 id 与门控（分析含图谱 + 人物/世界书列表）', function() {
    assert.deepEqual(NOVEL_VIEWS, [
      'novel-source', 'novel-chapters', 'novel-character-setup', 'novel-greetings',
      'novel-analyze', 'novel-characters', 'novel-worldbook', 'novel-style',
    ]);
    assert.ok(CHUNK_SIZE_OPTIONS.length >= 8);
    assert.ok(CHUNK_SIZE_OPTIONS.some(function(o) { return o.value === 64000; }));
    var s = createDefaultNovelState();
    assert.equal(s.charChunkSize, 8000);
    assert.equal(s.wbChunkSize, 8000);
    assert.equal(s.graphChunkSize, 8000);
    assert.equal(s.graphShardMode, 'chars');
    assert.equal(s.styleChunkSize, 16000);
    assert.equal(s.setupRangeMode, 'chars');
    assert.equal(s.setupCharLimit, 16000);
    assert.equal(s.greetCount, 3);
    assert.ok(s.knowledgeGraph);
    assert.deepEqual(s.knowledgeGraph.nodes, []);
    assert.ok(Array.isArray(s.failedShards));
    assert.equal(s.rag.sourceFingerprint, '');
    var g0 = getPipelineGates(s);
    assert.equal(g0.canExtract, false);
    s.fileText = '第一章\n正文很长足够';
    s.chapters = [{ id: '1', title: '一', text: '正文', enabled: true }];
    assert.ok(getFullSourceText(s).length > 0);
    assert.equal(getPipelineGates(s).canExtract, true);
    assert.equal(summarizeNovelState(s).available, true);
    assert.equal(summarizeNovelState(s).graphNodeCount, 0);
    s.entities = [{ type: 'person', name: '甲' }, { type: 'event', name: '乙' }];
    var sum = summarizeNovelState(s);
    assert.equal(sum.entityCounts.person, 1);
    assert.equal(sum.entityCounts.event, 1);
    assert.equal(sum.failedShardCount, 0);
  });

  it('chaptersSourceFingerprint 随正文变化', function() {
    var a = [{ id: '1', title: '一', text: '甲乙丙', enabled: true }];
    var b = [{ id: '1', title: '一', text: '甲乙丙丁', enabled: true }];
    assert.notEqual(chaptersSourceFingerprint(a), chaptersSourceFingerprint(b));
    assert.equal(chaptersSourceFingerprint(a), chaptersSourceFingerprint(a.slice()));
  });

  it('buildSetupCorpus 按字数 / 前 N 启用章截取', function() {
    var chapters = [
      { id: '1', title: '一', text: '甲甲甲甲', enabled: true },
      { id: '2', title: '二', text: '乙乙乙乙', enabled: true },
      { id: '3', title: '三', text: '丙丙丙丙', enabled: false },
      { id: '4', title: '四', text: '丁丁丁丁', enabled: true },
    ];
    var byCh = buildSetupCorpus(chapters, { mode: 'chapters', chapterCount: 2 });
    assert.equal(byCh.chapterCount, 2);
    assert.match(byCh.text, /甲甲甲甲/);
    assert.match(byCh.text, /乙乙乙乙/);
    assert.doesNotMatch(byCh.text, /丁丁丁丁/);
    assert.doesNotMatch(byCh.text, /丙丙丙丙/);
    var byChars = buildSetupCorpus(chapters, { mode: 'chars', charLimit: 6 });
    assert.equal(byChars.bodyCharCount, 6);
    assert.ok(byChars.text.indexOf('甲') >= 0);
    assert.ok(byChars.chapterCount >= 1);
    // 6 字只能覆盖第一章正文（4）+ 第二章正文截断 2
    assert.match(byChars.text, /乙乙/);
    assert.doesNotMatch(byChars.text, /丁/);
  });

  it('hydrate 兼容 V2 focus 与旧全局 chunkSize', function() {
    var s = hydrateNovelState({ sourceText: 'x', focus: ['character', 'location', 'rule'] });
    assert.equal(s.sourceText, 'x');
    assert.ok(s.wbFocus.includes('location'));
    assert.ok(!s.wbFocus.includes('character'));
    assert.equal(s.expandBudget, DEFAULT_EXPAND_BUDGET);
    var s2 = hydrateNovelState({ chunkSize: 12000 });
    assert.equal(s2.charChunkSize, 12000);
    assert.equal(s2.wbChunkSize, 12000);
    assert.ok(s2.styleChunkSize >= 12000);
  });
});

describe('novel cardId buckets', function() {
  function memStorage(init) {
    var map = Object.assign({}, init || {});
    return {
      getItem: function(k) { return map[k] != null ? map[k] : null; },
      setItem: function(k, v) { map[k] = String(v); },
      removeItem: function(k) { delete map[k]; },
      _map: map,
    };
  }

  it('桶键格式为 novelWorkshopV3:card:{cardId}', function() {
    assert.equal(NOVEL_BUCKET_PREFIX, 'novelWorkshopV3:card:');
    assert.equal(novelBucketKey('draft_1'), 'novelWorkshopV3:card:draft_1');
    assert.equal(novelBucketKey(''), '');
  });

  it('旧全局 V3 迁入当前卡并删除全局键', function() {
    var storage = memStorage();
    storage.setItem(NOVEL_STORAGE_KEY, JSON.stringify({ sourceText: '旧全局小说', chapters: [{ id: '1', title: '一', text: 't', enabled: true }] }));
    var r = loadNovelStateForCard(storage, 'draft_a');
    assert.equal(r.migrated, true);
    assert.equal(r.from, NOVEL_STORAGE_KEY);
    assert.match(r.state.sourceText, /旧全局小说/);
    assert.equal(storage.getItem(NOVEL_STORAGE_KEY), null);
    assert.ok(novelStateHasContent(readNovelBucket(storage, 'draft_a')));
  });

  it('已有桶不误吃全局；另一卡为空', function() {
    var storage = memStorage();
    writeNovelBucket(storage, 'draft_a', hydrateNovelState({ sourceText: '卡A资料' }));
    storage.setItem(NOVEL_STORAGE_KEY, JSON.stringify({ sourceText: '残留全局' }));
    var a = loadNovelStateForCard(storage, 'draft_a');
    assert.equal(a.migrated, false);
    assert.equal(a.state.sourceText, '卡A资料');
    // 全局仍在，但 draft_b 无桶时应迁到 b（合理首次绑定）
    var b = loadNovelStateForCard(storage, 'draft_b');
    assert.equal(b.migrated, true);
    assert.equal(b.state.sourceText, '残留全局');
    assert.equal(storage.getItem(NOVEL_STORAGE_KEY), null);
  });

  it('新建卡空桶；复制/删除桶', function() {
    var storage = memStorage();
    var empty = loadNovelStateForCard(storage, 'draft_new');
    assert.equal(empty.migrated, false);
    assert.equal(getFullSourceText(empty.state).trim(), '');
    writeNovelBucket(storage, 'draft_src', hydrateNovelState({ sourceText: '源卡小说' }));
    assert.equal(copyNovelBucket(storage, 'draft_src', 'draft_dst'), true);
    assert.equal(readNovelBucket(storage, 'draft_dst').sourceText, '源卡小说');
    removeNovelBucket(storage, 'draft_dst');
    assert.equal(readNovelBucket(storage, 'draft_dst'), null);
  });

  it('browserApp 按卡分桶且导出路径不含小说键', function() {
    const stateSrc = readFileSync(join(novelRoot, 'src/lib/novel/state.mjs'), 'utf8');
    assert.match(stateSrc, /loadNovelStateForCardIdb/);
    assert.match(stateSrc, /writeNovelBucketIdb/);
    const browserSrc = readFileSync(join(novelRoot, 'src/lib/novel/browserApp.mjs'), 'utf8');
    assert.match(browserSrc, /card-draft-changed/);
    assert.match(browserSrc, /bindCard/);
    const cardMgrSrc = readFileSync(join(novelRoot, 'src/lib/card-builder/panels/cardManager.mjs'), 'utf8');
    assert.match(cardMgrSrc, /emitCardDraftChanged/);
    assert.match(cardMgrSrc, /buildCardJSONFromDraft/);
    const mgrPanelAstro = readFileSync(join(novelRoot, 'src/components/CardManagerPanel.astro'), 'utf8');
    assert.match(mgrPanelAstro, /不含小说/);
    // 导出函数体不应拼接小说桶字段
    const exportFn = cardMgrSrc.match(/panel\.exportDraftAsJson\s*=\s*function[\s\S]*?panel\.exportDraftAsPng/);
    assert.ok(exportFn, 'exportDraftAsJson missing');
    assert.doesNotMatch(exportFn[0], /novelWorkshop/);
  });
});

describe('novel panel visual contract', function() {
  it('共用样式去掉金色主题色', function() {
    const css = readFileSync(join(novelRoot, 'src/components/novel/NovelWorkshopStyles.astro'), 'utf8');
    assert.match(css, /与主工作区/);
    assert.doesNotMatch(css, /#c9a227|#e8c872|#a8841a|rgba\(212,\s*175,\s*55/);
    assert.doesNotMatch(css, /深色 \+ 金色/);
  });

  it('小说面板对齐系统 panel/form-group，无 sb-panel/hero', function() {
    NOVEL_PANEL_FILES.forEach(function(name) {
      const src = readFileSync(join(novelRoot, 'src/components/novel/' + name), 'utf8');
      assert.match(src, /class="panel novel-workshop-panel/, name + ' missing system panel');
      assert.doesNotMatch(src, /sb-panel/, name + ' still uses sb-panel');
      assert.doesNotMatch(src, /novel-hero|novel-gold-btn/, name + ' still uses gold/hero');
      assert.match(src, /<h2>/, name + ' missing h2');
      assert.match(src, /novel-panel-tip/, name + ' missing tip');
    });
  });

  it('原始资料重置：危险按钮文案与 tip，确认弹窗同步', function() {
    const src = readFileSync(join(novelRoot, 'src/components/novel/NovelSourcePanel.astro'), 'utf8');
    assert.match(src, /btnNovelResetAll[\s\S]*btn-delete/);
    assert.match(src, /重置并清空结果/);
    assert.match(src, /清空章节\/人物\/世界书草稿\/知识图谱\/文风等产出，保留原文与分片等配置/);
    assert.doesNotMatch(src, /重置工坊任务/);
    const srcPanel = readFileSync(join(novelRoot, 'src/lib/novel/panels/source.mjs'), 'utf8');
    assert.match(srcPanel, /重置并清空结果：清空章节\/人物\/世界书草稿\/知识图谱\/文风等产出/);
    assert.doesNotMatch(srcPanel, /重置人物\/世界书\/文风任务与章节/);
  });

  it('分片配置下沉：原始资料无全局分片，拆章/人物/世界书/文风各自有', function() {
    const src = readFileSync(join(novelRoot, 'src/components/novel/NovelSourcePanel.astro'), 'utf8');
    assert.doesNotMatch(src, /novelChunkSize|单片字数/);
    const ch = readFileSync(join(novelRoot, 'src/components/novel/NovelChaptersPanel.astro'), 'utf8');
    assert.match(ch, /id="novelChunkSize"/);
    assert.match(ch, /64000/);
    const chars = readFileSync(join(novelRoot, 'src/components/novel/NovelCharactersPanel.astro'), 'utf8');
    assert.match(chars, /id="novelCharShardMode"/);
    assert.match(chars, /id="novelCharChunkSize"/);
    assert.match(chars, /id="novelCharChaptersPerShard"/);
    assert.match(chars, /btnSyncCharsSelected|btnSyncCharsWb/);
    assert.match(chars, /novel-extract-panel/);
    const wb = readFileSync(join(novelRoot, 'src/components/novel/NovelWorldbookPanel.astro'), 'utf8');
    assert.match(wb, /id="novelWbShardMode"/);
    assert.match(wb, /id="novelWbChunkSize"/);
    assert.match(wb, /id="novelWbChaptersPerShard"/);
    assert.match(wb, /btnSyncWbSelected/);
    assert.match(wb, /novel-extract-panel/);
    assert.doesNotMatch(wb, /novelWbName/);
    const analyze = readFileSync(join(novelRoot, 'src/components/novel/NovelAnalyzePanel.astro'), 'utf8');
    assert.match(analyze, /id="novelGraphCy"/);
    assert.match(analyze, /id="novelGraphStats"/);
    assert.match(analyze, /id="novelAnalyzeSummary"/);
    assert.match(analyze, /novel-graph-footer/);
    assert.match(analyze, /btnGraphRelayout/);
    assert.match(analyze, /btnGraphClear/);
    assert.match(analyze, /btnNovelRetryFailed/);
    assert.match(analyze, /novelFailedShardsInfo/);
    assert.doesNotMatch(analyze, /btnGraphUnifiedExtract/);
    assert.match(analyze, /关系图谱|G6|知识图谱/);
    const style = readFileSync(join(novelRoot, 'src/components/novel/NovelStylePanel.astro'), 'utf8');
    assert.match(style, /id="novelStyleChunkSize"/);
    assert.match(style, /btnSyncStyle/);
    assert.match(style, /文风/);
    assert.match(style, /novel-style-panel/);
    assert.match(style, /novel-style-body/);
    assert.match(style, /novel-style-controls/);
    assert.match(style, /novel-style-content/);
    assert.doesNotMatch(style, /class="[^"]*novel-card/);
  });

  it('文风蒸馏：配置固定 + 内容区占满主区高度', function() {
    const style = readFileSync(join(novelRoot, 'src/components/novel/NovelStylePanel.astro'), 'utf8');
    assert.match(style, /novel-style-panel/);
    assert.match(style, /novel-style-controls[\s\S]*novelStyleChunkSize/);
    assert.match(style, /novel-style-content[\s\S]*novelStyleText/);
    const css = readFileSync(join(novelRoot, 'src/components/novel/NovelWorkshopStyles.astro'), 'utf8');
    assert.match(css, /\.novel-style-panel/);
    assert.match(css, /\.novel-style-body/);
    assert.match(css, /\.novel-style-content\s+#novelStyleText[\s\S]*flex:\s*1/s);
    const layout = readFileSync(join(novelRoot, 'src/layouts/Layout.astro'), 'utf8');
    assert.match(layout, /\[data-view="novel-style"\]\.is-active/);
    assert.match(layout, /\.panel\.novel-style-panel/);
  });

  it('角色设定/开场白生成：配置+预览 DOM、写卡与任务类型', function() {
    const setup = readFileSync(join(novelRoot, 'src/components/novel/NovelCharacterSetupPanel.astro'), 'utf8');
    assert.match(setup, /novel-character-setup-panel/);
    assert.match(setup, /id="novelSetupEntityPick"/);
    assert.match(setup, /id="novelSetupCharName"/);
    assert.match(setup, /id="novelSetupRangeMode"/);
    assert.match(setup, /id="btnNovelGenCharSetup"/);
    assert.match(setup, /id="novelSetupPreview"/);
    assert.match(setup, /生成角色设定/);
    assert.match(setup, /实体库|RAG/);
    const greet = readFileSync(join(novelRoot, 'src/components/novel/NovelGreetingsPanel.astro'), 'utf8');
    assert.match(greet, /novel-greetings-gen-panel/);
    assert.match(greet, /id="novelGreetEntityPick"/);
    assert.match(greet, /id="novelGreetCharName"/);
    assert.match(greet, /id="novelGreetCount"/);
    assert.match(greet, /id="btnNovelGenGreetings"/);
    assert.match(greet, /id="novelGreetPreview"/);
    assert.match(greet, /生成开场白/);
    const css = readFileSync(join(novelRoot, 'src/components/novel/NovelWorkshopStyles.astro'), 'utf8');
    assert.match(css, /\.novel-setup-panel/);
    assert.match(css, /\.novel-setup-preview/);
    const layout = readFileSync(join(novelRoot, 'src/layouts/Layout.astro'), 'utf8');
    assert.match(layout, /\[data-view="novel-character-setup"\]\.is-active/);
    assert.match(layout, /\[data-view="novel-greetings"\]\.is-active/);
    assert.match(layout, /\.panel\.novel-setup-panel/);
    const app = readFileSync(join(novelRoot, 'src/lib/novel/browserApp.mjs'), 'utf8');
    assert.match(app, /buildSetupCorpus|resolveSetupCorpus/);
    assert.match(app, /resolveSetupCorpus/);
    assert.match(app, /novel_char_setup/);
    assert.match(app, /novel_greetings/);
    assert.match(app, /setGreetingFields/);
    assert.match(app, /creatorNotes/);
    assert.match(app, /__altGreetings__/);
    const index = readFileSync(join(novelRoot, 'src/pages/index.astro'), 'utf8');
    assert.match(index, /NovelCharacterSetupPanel/);
    assert.match(index, /data-view="novel-character-setup"/);
    assert.match(index, /data-view="novel-greetings"/);
  });

  it('拆章：顶栏批量 + 行内图标 + 居中弹窗预览 + 禁用样式 + 列表内滚', function() {
    const panel = readFileSync(join(novelRoot, 'src/components/novel/NovelChaptersPanel.astro'), 'utf8');
    // 顶栏仅保留真正批量项
    assert.match(panel, /btnChMerge/);
    assert.match(panel, /btnChEnable/);
    assert.match(panel, /btnChDisable/);
    assert.match(panel, /btnChExport/);
    assert.match(panel, /btnChDelete/);
    assert.doesNotMatch(panel, /btnChSplit|btnChRename|btnChUp|btnChDown|btnChPreview/);
    assert.doesNotMatch(panel, /novelChapterPreview/); // 禁止列表内嵌预览框
    assert.match(panel, /novelModalChapter/);
    assert.match(panel, /novel-chapters-controls/);
    assert.match(panel, /novel-chapter-list/);
    assert.match(panel, /novel-chapters-body/);
    // 去掉卡套卡：配置/列表不再包在 novel-card class 内
    assert.doesNotMatch(panel, /class="[^"]*novel-card/);
    assert.doesNotMatch(panel, /novel-chapters-card|novel-card-head|novel-card-body/);

    const css = readFileSync(join(novelRoot, 'src/components/novel/NovelWorkshopStyles.astro'), 'utf8');
    assert.match(css, /\.novel-chapter-row\.is-disabled/);
    assert.match(css, /\.novel-chapter-list[\s\S]*overflow-y:\s*auto/);
    assert.match(css, /\.novel-chapters-controls/);
    assert.match(css, /\.novel-chapters-body/);
    assert.match(css, /\.novel-chapters-meta/);
    assert.doesNotMatch(css, /\.novel-chapters-card\b/);
    assert.match(css, /\.novel-modal\b/);
    assert.match(css, /\.novel-icon-btn/);
    assert.match(css, /\.novel-list-actions|\.novel-chapter-actions/);

    const app = [
      readFileSync(join(novelRoot, 'src/lib/novel/panels/chapters.mjs'), 'utf8'),
      readFileSync(join(novelRoot, 'src/lib/novel/shared/context.mjs'), 'utf8'),
    ].join('');
    assert.match(app, /data-ch-preview/);
    assert.match(app, /data-ch-split/);
    assert.match(app, /data-ch-rename/);
    assert.match(app, /data-ch-up/);
    assert.match(app, /data-ch-down/);
    assert.match(app, /data-ch-toggle/);
    assert.match(app, /data-ch-export/);
    assert.match(app, /data-ch-delete/);
    assert.match(app, /showChapterPreview/);
    assert.match(app, /openNovelModal\('novelModalChapter'\)/);
    assert.match(app, /novel-icon-btn/);
    assert.match(app, /is-disabled/);
    // 操作在右侧横排，不塞进 novel-chapter-main 内部
    assert.match(app, /novel-chapter-main[\s\S]*?<\/div>'[\s\S]*novel-chapter-actions/);
  });

  it('人物档案弹窗；世界书弹窗编辑；无产出浏览面板', function() {
    const chars = readFileSync(join(novelRoot, 'src/components/novel/NovelCharactersPanel.astro'), 'utf8');
    assert.match(chars, /novelModalProfile/);
    assert.match(chars, /novelModalExpandConfirm/);
    assert.doesNotMatch(chars, /novelCharProfileEditor/);
    assert.match(chars, /novel-entity-list|novelCharGrid/);

    const wb = readFileSync(join(novelRoot, 'src/components/novel/NovelWorldbookPanel.astro'), 'utf8');
    assert.match(wb, /novelModalWb/);
    assert.match(wb, /novelWbSearchInput|novel-wb-toolbar/);
    assert.match(wb, /novel-entity-list|wb-entries-list/);
    assert.match(wb, /btnNovelWbModalSave/);

    assert.throws(function() {
      readFileSync(join(novelRoot, 'src/components/novel/NovelOutputsPanel.astro'), 'utf8');
    }, /ENOENT/);

    const app = [
      readFileSync(join(novelRoot, 'src/lib/novel/browserApp.mjs'), 'utf8'),
      readFileSync(join(novelRoot, 'src/lib/novel/panels/characters.mjs'), 'utf8'),
      readFileSync(join(novelRoot, 'src/lib/novel/panels/worldbook.mjs'), 'utf8'),
      readFileSync(join(novelRoot, 'src/lib/novel/shared/context.mjs'), 'utf8'),
      readFileSync(join(novelRoot, 'src/lib/novel/shared/bridge.mjs'), 'utf8'),
      readFileSync(join(novelRoot, 'src/lib/novel/graphViz.mjs'), 'utf8'),
      readFileSync(join(novelRoot, 'src/lib/novel/sync.mjs'), 'utf8'),
    ].join('');
    assert.match(app, /openNovelModal\('novelModalProfile'\)/);
    assert.match(app, /confirmExpandRecall|novelModalExpandConfirm/);
    assert.match(app, /expandWbEntry|data-wb-expand/);
    assert.match(app, /updateExtractCallEstimates|estimateExtractCalls|buildExtractShards/);
    assert.match(app, /charShardOpts|wbShardOpts|syncShardModeUi/);
    assert.match(app, /openWbEditModal|editWbEntry|saveWbInline/);
    assert.match(app, /novel-list-title[\s\S]*data-wb-edit/);
    assert.match(app, /truncatePreviewLine|entry-preview-line/);
    assert.doesNotMatch(app, /data-wb-toggle|entry-expand-hint|expandedWbEntries/);
    assert.match(app, /renderStrategyTag|wb-strategy-tag/);
    assert.match(app, /openNovelModal\('novelModalWb'\)/);
    assert.match(app, /styleToWorldbookDraft/);
    assert.doesNotMatch(app, /openNovelModal\('novelModalStyle'\)/);
    assert.doesNotMatch(app, /renderOutputs|bindOutputs/);
    assert.doesNotMatch(app, /renderWbInlineEditor/);
    assert.match(app, /closeNovelModal/);
    assert.match(app, /novel-modal-open/);
    assert.match(app, /Escape/);
    assert.doesNotMatch(app, /formatProfileYaml\(c\.profile/);
    assert.match(app, /novel-list-row/);
    assert.match(app, /novel-list-actions|entry-item/);
    assert.match(app, /charChunkSize|wbChunkSize|styleChunkSize|charShardMode|wbShardMode/);
    assert.match(app, /renderGraph|bindGraphControls/);
    assert.match(app, /mountOrUpdateGraph|relayoutGraph/);
    assert.doesNotMatch(app, /runUnifiedGraphExtract|novel_graph_extract|btnGraphUnifiedExtract/);
    // 知识库已并入人物/世界书列表
    assert.doesNotMatch(app, /function bindKnowledge|function renderKnowledge/);
    assert.match(app, /btnCharEnrichSelected|btnWbEnrichSelected/);
    assert.doesNotMatch(app, /btnCharExpandSelected/);
    assert.match(app, /btnNovelProfileSave/);
    assert.match(app, /failedShards|runRetryFailedShards|isRagIndexStale|chaptersSourceFingerprint/);
    assert.match(app, /getRagOptions|setRagOptions/);
  });

  it('世界书条目含实体编辑弹窗（novel-modal-dialog）', function() {
    const wb = readFileSync(join(novelRoot, 'src/components/novel/NovelWorldbookPanel.astro'), 'utf8');
    assert.match(wb, /id="novelModalEntity"/);
    assert.match(wb, /novel-modal-dialog/);
    assert.doesNotMatch(wb, /novel-modal-panel/);
    assert.match(wb, /id="novelEntityName"/);
    assert.match(wb, /id="novelEntityContent"/);
    assert.match(wb, /id="btnNovelEntitySave"/);
    assert.match(wb, /novel-modal-body/);
    assert.match(wb, /novel-modal-actions/);
    assert.match(wb, /人物列表|世界书条目/);
    assert.match(wb, /btnWbEnrichSelected/);
    assert.match(wb, /novelWbTypeFilter/);
  });

  it('人物列表面板：标题/丰满/档案保存按钮', function() {
    const ch = readFileSync(join(novelRoot, 'src/components/novel/NovelCharactersPanel.astro'), 'utf8');
    assert.match(ch, /人物列表/);
    assert.match(ch, /btnCharEnrichSelected/);
    assert.match(ch, /id="btnNovelProfileSave"/);
    assert.doesNotMatch(ch, /btnCharExpandSelected|AI 扩展所选/);
    assert.match(ch, /有实体走丰满|行内仍可用 AI 扩展/);
    assert.doesNotMatch(ch, /人物抽取/);
  });

  it('小说分析含 G6 图谱；无独立图谱侧栏/一体分析', function() {
    const analyze = readFileSync(join(novelRoot, 'src/components/novel/NovelAnalyzePanel.astro'), 'utf8');
    assert.match(analyze, /novel-analyze-panel/);
    assert.match(analyze, /id="novelGraphCy"/);
    assert.match(analyze, /id="novelGraphStats"/);
    assert.match(analyze, /id="novelGraphDetail"/);
    assert.match(analyze, /btnGraphClear/);
    assert.match(analyze, /btnGraphRelayout/);
    assert.match(analyze, /btnNovelRetryFailed|novelFailedShardsInfo/);
    assert.doesNotMatch(analyze, /btnGraphUnifiedExtract/);
    const css = readFileSync(join(novelRoot, 'src/components/novel/NovelWorkshopStyles.astro'), 'utf8');
    assert.match(css, /\.novel-graph-cy/);
    assert.match(css, /\.novel-graph-footer/);
    assert.match(css, /\.novel-analyze-body/);
    assert.match(css, /min-height:\s*min\(58vh/);
    assert.match(css, /\.novel-analyze-controls|\.novel-analyze-status-row/);
    const viz = readFileSync(join(novelRoot, 'src/lib/novel/graphViz.mjs'), 'utf8');
    assert.match(viz, /type:\s*'d3-force'/);
    assert.match(viz, /manyBody|collide|nodeSpacing/);
    assert.match(viz, /seedNodePositions|deoverlapGraphNodes/);
    assert.match(viz, /ResizeObserver|attachResizeRelayout/);
    const layout = readFileSync(join(novelRoot, 'src/layouts/Layout.astro'), 'utf8');
    assert.doesNotMatch(layout, /data-view="novel-graph"/);
    const sidebar = readFileSync(join(novelRoot, 'src/components/AppSidebar.astro'), 'utf8');
    assert.doesNotMatch(sidebar, /novel-graph/);
    assert.doesNotMatch(sidebar, /知识图谱/);
    const wbNav = sidebar.indexOf("view: 'novel-worldbook'");
    const styleNav = sidebar.indexOf("view: 'novel-style'");
    assert.ok(wbNav > 0 && styleNav > wbNav, '侧栏：世界书条目 → 文风');
    const index = readFileSync(join(novelRoot, 'src/pages/index.astro'), 'utf8');
    assert.doesNotMatch(index, /NovelGraphPanel/);
    assert.doesNotMatch(index, /data-view="novel-graph"/);
    const pkg = JSON.parse(readFileSync(join(novelRoot, 'package.json'), 'utf8'));
    assert.ok(pkg.dependencies && pkg.dependencies['@antv/g6'], '依赖 @antv/g6');
    assert.ok(!pkg.dependencies.cytoscape, '已移除 cytoscape');
    assert.match(viz, /relayoutGraph|mountOrUpdateGraph|@antv\/g6/);
    const analyzePanel = readFileSync(join(novelRoot, 'src/lib/novel/panels/analyze.mjs'), 'utf8');
    assert.doesNotMatch(analyzePanel, /runUnifiedGraphExtract|novelUnifiedShard/);
    assert.match(analyzePanel, /mode === 'analyze'|runAnalyzeAll/);
  });

  it('世界书条目：操作行 AI/新建/丰满/清空/同步；类型筛选+搜索；列表内滚', function() {
    const wb = readFileSync(join(novelRoot, 'src/components/novel/NovelWorldbookPanel.astro'), 'utf8');
    assert.doesNotMatch(wb, /id="novelWbName"|for="novelWbName"/);
    assert.match(wb, /novel-extract-panel|novel-worldbook-panel/);
    assert.match(wb, /novel-extract-controls/);
    assert.match(wb, /novel-extract-body/);
    assert.match(wb, /<h2>世界书条目<\/h2>/);
    // 分片方式/数值与冲突策略同在配置行
    assert.match(wb, /novelWbShardMode/);
    assert.match(wb, /novelWbChunkSize[\s\S]*novelWbConflictPolicy|novelWbConflictPolicy[\s\S]*novelWbChunkSize/);
    // 操作行：AI 抽取 → 新建 → 丰满 → 清空 → 同步；成人勾选已迁至原始资料全局配置
    const extractIdx = wb.indexOf('btnWbExtract');
    const createIdx = wb.indexOf('btnWbCreateEntry');
    const enrichIdx = wb.indexOf('btnWbEnrichSelected');
    const clearIdx = wb.indexOf('btnWbClear');
    const syncIdx = wb.indexOf('btnSyncWbSelected');
    const typeIdx = wb.indexOf('novelWbTypeFilter');
    const searchIdx = wb.indexOf('novelWbSearchInput');
    const listIdx = wb.indexOf('novelWbPreview');
    assert.ok(extractIdx > 0 && createIdx > extractIdx && enrichIdx > createIdx && clearIdx > enrichIdx);
    assert.ok(syncIdx > clearIdx, '同步应在清空之后');
    assert.doesNotMatch(wb, /novelIncludeAdult/);
    assert.ok(typeIdx > syncIdx && searchIdx > typeIdx, '类型筛选与搜索应在操作行之后');
    assert.ok(listIdx > searchIdx, '列表应紧跟搜索之后');
    assert.match(wb, /novel-wb-search-only/);
    assert.doesNotMatch(wb, /class="[^"]*novel-card/);

    const source = readFileSync(join(novelRoot, 'src/components/novel/NovelSourcePanel.astro'), 'utf8');
    assert.doesNotMatch(source, /novelGlobalAdult|novelGlobalNtl/);

    const chars = readFileSync(join(novelRoot, 'src/components/novel/NovelCharactersPanel.astro'), 'utf8');
    assert.match(chars, /novel-extract-panel|novel-characters-panel/);
    assert.match(chars, /novel-extract-controls|novelCharGrid/);
    assert.match(chars, /novelCharShardMode|novelCharChaptersPerShard/);
    assert.match(chars, /novelModalExpandConfirm/);
    assert.doesNotMatch(chars, /class="[^"]*novel-card/);

    const css = readFileSync(join(novelRoot, 'src/components/novel/NovelWorkshopStyles.astro'), 'utf8');
    assert.match(css, /\.novel-extract-panel/);
    assert.match(css, /\.novel-extract-controls/);
    assert.match(css, /\.novel-entity-list[\s\S]*overflow-y:\s*auto/);

    const layout = readFileSync(join(novelRoot, 'src/layouts/Layout.astro'), 'utf8');
    assert.match(layout, /data-view="novel-characters"\]\.is-active/);
    assert.match(layout, /data-view="novel-worldbook"\]\.is-active/);
    assert.doesNotMatch(layout, /data-view="novel-knowledge"/);
    assert.match(layout, /novel-extract-panel/);

    const app = [
      readFileSync(join(novelRoot, 'src/lib/novel/browserApp.mjs'), 'utf8'),
      readFileSync(join(novelRoot, 'src/lib/novel/panels/characters.mjs'), 'utf8'),
      readFileSync(join(novelRoot, 'src/lib/novel/panels/worldbook.mjs'), 'utf8'),
    ].join('');
    assert.doesNotMatch(app, /novelWbName/);
    assert.match(app, /约 ' \+ charN \+ ' 次 · 扫描全书/);
    assert.match(app, /约 ' \+ wbN \+ ' 次 · AI 抽取/);
    // 改方式/字数/章节数均触发即时重算
    assert.match(app, /novelCharShardMode[\s\S]*updateExtractCallEstimates/);
    assert.match(app, /novelWbShardMode[\s\S]*updateExtractCallEstimates/);
    assert.match(app, /novelCharChaptersPerShard[\s\S]*updateExtractCallEstimates/);
    assert.match(app, /novelWbChaptersPerShard[\s\S]*updateExtractCallEstimates/);
  });

  it('hydrate 默认分片方式为按字数，并规范化章节数', function() {
    var d = createDefaultNovelState();
    assert.equal(d.charShardMode, 'chars');
    assert.equal(d.wbShardMode, 'chars');
    assert.equal(d.graphShardMode, 'chars');
    assert.equal(d.charChaptersPerShard, 1);
    var h = hydrateNovelState({
      charShardMode: 'chapters', charChaptersPerShard: 0, wbShardMode: 'oops',
      graphShardMode: 'chapters', graphChaptersPerShard: -2, knowledgeGraph: { nodes: [{ id: 'a' }] },
    });
    assert.equal(h.charShardMode, 'chapters');
    assert.equal(h.charChaptersPerShard, 1);
    assert.equal(h.wbShardMode, 'chars');
    assert.equal(h.graphShardMode, 'chapters');
    assert.equal(h.graphChaptersPerShard, 1);
    assert.equal(h.knowledgeGraph.nodes.length, 1);
  });

  it('mapPool 在 signal 取消后不再领取新分片', async function() {
    const { mapPool } = await import('../src/lib/novel/browserApp.mjs');
    const ac = new AbortController();
    let started = 0;
    const items = [1, 2, 3, 4, 5, 6];
    const p = mapPool(items, 2, async function(item) {
      started++;
      if (started === 2) ac.abort();
      await new Promise(function(r) { setTimeout(r, 30); });
      return item;
    }, ac.signal);
    await assert.rejects(p, function(err) {
      return err && (err.name === 'AbortError' || /取消|abort/i.test(String(err.message || '')));
    });
    // 取消后不应跑完全部 6 片
    assert.ok(started < items.length, 'started=' + started);
  });

  it('扫描/抽取/分析/蒸馏：任务中心 + busy + 取消提示接线', function() {
    const app = [
      readFileSync(join(novelRoot, 'src/lib/novel/browserApp.mjs'), 'utf8'),
      readFileSync(join(novelRoot, 'src/lib/novel/panels/characters.mjs'), 'utf8'),
      readFileSync(join(novelRoot, 'src/lib/novel/panels/worldbook.mjs'), 'utf8'),
      readFileSync(join(novelRoot, 'src/lib/novel/panels/analyze.mjs'), 'utf8'),
      readFileSync(join(novelRoot, 'src/lib/novel/panels/style.mjs'), 'utf8'),
    ].join('');
    assert.match(app, /type:\s*'novel_char_scan'/);
    assert.match(app, /type:\s*'novel_wb_extract'/);
    assert.match(app, /type:\s*'novel_analyze_skeleton'/);
    assert.match(app, /type:\s*'novel_style'/);
    assert.match(app, /busyFlags\.charScan|setBtnBusy\(scanBtn/);
    assert.match(app, /busyFlags\.wbExtract|setBtnBusy\(extractBtn/);
    assert.match(app, /busyFlags\.analyzeSkeleton|busyFlags\.analyzeAll/);
    assert.match(app, /busyFlags\.styleDistill|setBtnBusy\(styleBtn/);
    assert.match(app, /callAI\([\s\S]*task\.signal/);
    assert.match(app, /isTrackedAbort/);
    // 取消不覆盖为失败弹窗
    assert.match(app, /if\s*\(\s*!isTrackedAbort\(e\)\s*\)/);
  });

  it('世界书抽取：逐步执行并累积前序参考', async function() {
    const { formatPriorWbExtractRef, mergeWbExtractEntry, normalizeNameList } = await import('../src/lib/novel/browserApp.mjs');
    var all = [];
    mergeWbExtractEntry(all, { category: 'location', name: '废都', content: '短', keys: ['废都'] });
    mergeWbExtractEntry(all, { category: 'location', name: '废都', content: '更长的废都描述', keys: ['废墟'] });
    assert.equal(all.length, 1);
    assert.match(all[0].content, /更长的/);
    assert.ok(all[0].keys.indexOf('废墟') >= 0);
    var ref = formatPriorWbExtractRef(all);
    assert.match(ref, /已抽取条目/);
    assert.match(ref, /废都/);
    assert.deepEqual(normalizeNameList('秦月', ['月儿', '秦月', ' 月儿 ']), ['月儿']);

    const app = readFileSync(join(novelRoot, 'src/lib/novel/panels/worldbook.mjs'), 'utf8');
    const fnBlock = app.slice(app.indexOf('panel.runExtractWorldbook ='), app.indexOf('shardsScanned'));
    assert.match(fnBlock, /formatPriorWbExtractRef\(all\)/);
    assert.match(fnBlock, /for \(var idx = 0; idx < shards\.length; idx\+\+\)/);
    assert.match(fnBlock, /flushWbPreview/);
    assert.doesNotMatch(fnBlock, /mapPool\(shards/);
  });

  it('人物扫描：逐步执行并累积前序参考', async function() {
    const { formatPriorCharScanRef } = await import('../src/lib/novel/browserApp.mjs');
    var ref = formatPriorCharScanRef([
      { name: '秦月', aliases: ['月儿'], note: '女主' },
    ]);
    assert.match(ref, /已扫描人物/);
    assert.match(ref, /秦月/);
    assert.match(ref, /月儿/);

    const app = readFileSync(join(novelRoot, 'src/lib/novel/panels/characters.mjs'), 'utf8');
    const fnBlock = app.slice(app.indexOf('panel.runScan ='), app.indexOf('shardsScanned'));
    assert.match(fnBlock, /formatPriorCharScanRef/);
    assert.match(fnBlock, /for \(var idx = 0; idx < shards\.length; idx\+\+\)/);
    assert.match(fnBlock, /flushScanPreview/);
    assert.match(fnBlock, /normalizeNameList/);
    assert.doesNotMatch(fnBlock, /mapPool\(shards/);
  });
});

describe('graphMerge + graphViz', function() {
  it('mergeGraphDelta + G6 data 转换', async function() {
    const {
      emptyKnowledgeGraph,
      mergeGraphDelta,
      formatPriorGraphRef,
      graphNodeId,
      applyUnifiedShardResult,
    } = await import('../src/lib/novel/graphMerge.mjs');
    const { graphToG6Data, seedNodePositions } = await import('../src/lib/novel/graphViz.mjs');
    const { formatPriorRelationsRef, buildSkeletonPriorBlock } = await import('../src/lib/novel/analyzePipeline.mjs');

    assert.equal(graphNodeId('person', '秦月'), 'person:秦月');
    var state = {
      characters: [],
      wbEntries: [],
      knowledgeGraph: emptyKnowledgeGraph(),
    };
    // 库内仍保留一体合并函数供兼容测试；主路径已改用分析管线
    var stats = applyUnifiedShardResult(state, {
      characters: [{ name: '秦月', aliases: ['月儿'], profile: { age: '19' } }],
      worldbook: [{ category: 'location', name: '长安', content: '帝都', keys: ['长安', '京城'] }],
      graph: {
        nodes: [{ id: 'person:秦月', type: 'person', label: '秦月' }],
        edges: [{ from: 'person:秦月', to: 'place:长安', rel: '居于' }],
      },
    }, function(p) { return p + '_1'; });
    assert.equal(stats.charStats.add, 1);
    assert.equal(stats.wbStats.add, 1);

    var g2 = mergeGraphDelta(state.knowledgeGraph, {
      nodes: [{ id: 'place:长安', type: 'place', label: '长安' }],
      edges: [{ from: 'person:秦月', to: 'place:长安', rel: '居于', evidence: ['卷一'] }],
    });
    assert.equal(g2.nodes.length, 2);
    assert.equal(g2.edges.length, 1);
    var data = graphToG6Data(g2);
    assert.equal(data.nodes.length, 2);
    assert.equal(data.edges.length, 1);
    assert.ok(data.nodes[0].data.label);
    // 孤立点预散开：外环坐标应与有边节点不同
    data.nodes.push({
      id: 'concept:孤岛',
      data: { label: '孤岛', type: 'concept' },
      style: {},
    });
    seedNodePositions(data, 800, 600);
    var linked = data.nodes.find(function(n) { return n.id === 'person:秦月'; });
    var isolate = data.nodes.find(function(n) { return n.id === 'concept:孤岛'; });
    assert.ok(linked.style && typeof linked.style.x === 'number');
    assert.ok(isolate.style && typeof isolate.style.x === 'number');
    var dLink = Math.hypot(linked.style.x - 400, linked.style.y - 300);
    var dIso = Math.hypot(isolate.style.x - 400, isolate.style.y - 300);
    assert.ok(dIso > dLink, '孤立点应在更外环');
    var pref = formatPriorGraphRef(g2);
    assert.match(pref, /已有知识图谱/);

    var prior = formatPriorRelationsRef(
      [{ fromId: 'a', toId: 'b', rel: '师徒', evidence: ['卷一'] }],
      [{ id: 'a', name: '甲' }, { id: 'b', name: '乙' }]
    );
    assert.match(prior, /已有关系/);
    assert.match(prior, /甲/);
    var sk = buildSkeletonPriorBlock({
      entities: [{ id: 'a', type: 'person', name: '甲', aliases: [], summary: 'x' }],
      relations: [{ fromId: 'a', toId: 'a', rel: '自述' }],
    });
    assert.match(sk, /已有实体/);
    assert.match(sk, /已有关系/);
  });
});

