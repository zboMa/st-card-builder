/**
 * 小说 NSFW/NTL：模板 / 质量门 / 全局开关 / 状态栏草案
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { UNMENTIONED } from '../src/lib/novel/schema.mjs';
import { createDefaultNovelState, hydrateNovelState, summarizeNovelState } from '../src/lib/novel/state.mjs';
import { isEntityEnriched, upsertEntity } from '../src/lib/novel/entityStore.mjs';
import {
  setAdultMode,
  getAdultMode,
  setNtlMode,
  getNtlMode,
  emptyNsfwEntityAttrs,
  normalizeNsfwEntityAttrs,
  isNsfwProfileFilled,
  isNsfwEntityFilled,
  boostAdultSearchQuery,
  formatPersonNsfwDigest,
  formatNsfwEntityDigest,
  formatAdultSideDigest,
  extractStyleNsfwSection,
  buildStatusBarNsfwDraftFromEntities,
  buildAdultAnalyzeHintBlock,
  buildAdultProgressiveHint,
  buildNtlHintBlock,
  buildModeHintBlocks,
  buildContentModeFlags,
  emptyAdultAttrs,
  normalizeAdultAttrs,
  mergeAdultAttrs,
  isAdultAttrsFilled,
  adultEnrichPriority,
  buildAdultContextDigests,
} from '../src/lib/novel/nsfwSupport.mjs';
import { listEntitiesNeedingEnrich } from '../src/lib/novel/analyzePipeline.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('novel nsfwSupport', function() {
  it('NSFW 全局开关联动兼容字段；NTL 独立', function() {
    var s = createDefaultNovelState();
    assert.equal(getAdultMode(s), false);
    assert.equal(getNtlMode(s), false);
    setAdultMode(s, true);
    assert.equal(s.adultMode, true);
    assert.equal(s.analyzeIncludeAdult, true);
    assert.equal(s.includeAdult, true);
    assert.equal(s.styleIncludeNSFW, true);
    setNtlMode(s, true);
    assert.equal(s.ntlMode, true);
    assert.equal(getAdultMode(s), true);
    setAdultMode(s, false);
    assert.equal(getNtlMode(s), true);
    var h = hydrateNovelState({ analyzeIncludeAdult: true, includeAdult: false, styleIncludeNSFW: false, ntlMode: true });
    assert.equal(h.adultMode, true);
    assert.equal(h.ntlMode, true);
    assert.equal(summarizeNovelState(h).adultMode, true);
    assert.equal(summarizeNovelState(h).ntlMode, true);
  });

  it('nsfw attrs 规范化与实体丰满判定', function() {
    var a = normalizeNsfwEntityAttrs({ kind: 'taboo', limits: ['禁止公开'], rules: '口头同意' });
    assert.equal(a.kind, 'taboo');
    assert.ok(a.limits.indexOf('禁止公开') >= 0);
    assert.ok(a.rules.length);
    var ent = {
      type: 'nsfw',
      content: '这是足够长的成人世界书正文用于通过字数门槛检查一二三四五六七八九十。'.repeat(5),
      attrs: a,
      provenance: [{ quote: '规矩原文' }],
    };
    assert.ok(isNsfwEntityFilled(ent));
    assert.ok(isEntityEnriched(ent, true, true));
  });

  it('人物 NSFW 占位不算成人丰满', function() {
    var profile = {
      NSFW_information: {
        body: { overall: UNMENTIONED },
        sexual_personality: UNMENTIONED,
        Kinks: [],
        xp_kinks: [],
        Limits: [],
      },
    };
    assert.equal(isNsfwProfileFilled(profile), false);
    profile.NSFW_information.body.overall = '纤细柔韧';
    profile.NSFW_information.sexual_personality = '外冷内热';
    profile.NSFW_information.Kinks = ['口令'];
    profile.NSFW_information.Limits = ['公开'];
    assert.ok(isNsfwProfileFilled(profile));
    var person = {
      type: 'person',
      content: '足够长的人物正文用于通过字数门槛检查一二三四五六七八九十十一十二十三。'.repeat(5),
      provenance: [{ quote: 'x' }],
      attrs: { profile: profile },
    };
    assert.ok(isEntityEnriched(person, true, true));
    person.attrs.profile.NSFW_information.Limits = [];
    assert.equal(isEntityEnriched(person, true, true), false);
  });

  it('attrs.adult 规范化 / 合并不抹 Limits / 门槛', function() {
    var a = normalizeAdultAttrs({
      eroticRole: '束缚道具',
      limits: ['出血'],
      playIdeas: '轻缚',
      inferred: true,
      lastPass: 'skeleton',
    });
    assert.equal(a.eroticRole, '束缚道具');
    assert.ok(a.playIdeas.indexOf('轻缚') >= 0);
    assert.ok(isAdultAttrsFilled(a));
    var merged = mergeAdultAttrs(a, {
      atmosphere: '昏暗厢房',
      limits: ['公开'],
      inferred: false,
      lastPass: 'enrich',
    });
    assert.ok(merged.limits.indexOf('出血') >= 0);
    assert.ok(merged.limits.indexOf('公开') >= 0);
    assert.equal(merged.inferred, false);
    assert.equal(merged.lastPass, 'enrich');
    assert.equal(isAdultAttrsFilled(emptyAdultAttrs()), false);
  });

  it('成人质量门：item 缺 adult 不算丰满；丰满队列优先 NSFW 缺口', function() {
    var item = {
      type: 'item',
      content: '足够长的物品正文用于通过字数门槛检查一二三四五六七八九十十一十二十三。'.repeat(5),
      provenance: [{ quote: 'x' }],
      attrs: {},
    };
    assert.ok(isEntityEnriched(item, true, false));
    assert.equal(isEntityEnriched(item, true, true), false);
    item.attrs.adult = normalizeAdultAttrs({
      eroticRole: '私密信物',
      atmosphere: '贴身',
      triggers: ['触碰'],
      limits: ['外借'],
      playIdeas: ['贴耳低语时把玩'],
    });
    assert.ok(isEntityEnriched(item, true, true));

    var personThin = {
      type: 'person',
      name: '甲',
      content: item.content,
      provenance: [{ quote: 'y' }],
      attrs: { profile: { NSFW_information: { body: { overall: '' }, Kinks: [], Limits: [] } } },
    };
    var nsfwOk = {
      type: 'nsfw',
      name: '规矩',
      content: item.content,
      provenance: [{ quote: 'z' }],
      attrs: normalizeNsfwEntityAttrs({ kind: 'rule', rules: ['先问'], limits: ['公开'], consent: '口头' }),
    };
    var queue = listEntitiesNeedingEnrich([item, personThin, nsfwOk], true, true);
    assert.ok(queue.length >= 1);
    assert.equal(queue[0].type, 'person');
    assert.ok(adultEnrichPriority(personThin) < adultEnrichPriority(item));
  });

  it('RAG 增强 / 互喂摘要 / 分步推断与 NTL 提示', function() {
    assert.match(boostAdultSearchQuery('秦月', true), /身体|亲密/);
    assert.equal(boostAdultSearchQuery('秦月', false), '秦月');
    assert.match(boostAdultSearchQuery('秦月', false, true), /禁忌|权力|服从|胁迫|背德/);
    assert.match(boostAdultSearchQuery('秦月', true, true), /身体|禁忌/);
    var ents = [{
      type: 'person',
      name: '秦月',
      attrs: {
        profile: {
          NSFW_information: {
            sexual_personality: '主动',
            Kinks: ['耳语'],
            Limits: ['疼痛'],
            body: { overall: '纤细' },
          },
        },
        nsfwMeta: { inferred: true, lastPass: 'skeleton' },
      },
    }, {
      type: 'nsfw',
      name: '私密规矩',
      summary: '禁公开',
      attrs: emptyNsfwEntityAttrs('rule'),
    }, {
      type: 'item',
      name: '红绳',
      attrs: { adult: normalizeAdultAttrs({ eroticRole: '束缚', limits: ['勒伤'], playIdeas: ['腕缚'], atmosphere: '暧昧' }) },
    }];
    ents[1].attrs.limits = ['公开场合'];
    assert.match(formatPersonNsfwDigest(ents), /秦月/);
    assert.match(formatNsfwEntityDigest(ents), /私密规矩/);
    assert.match(formatAdultSideDigest(ents), /红绳/);
    assert.match(buildAdultContextDigests(ents), /成人向用法|红绳|秦月/);
    assert.match(extractStyleNsfwSection('## 文风\nx\n## NSFW 文风指令\n要写喘息\n## 其它'), /喘息/);
    assert.match(buildAdultAnalyzeHintBlock('skeleton'), /分步推断/);
    assert.match(buildAdultProgressiveHint('enrich'), /attrs\.adult/);
    assert.match(buildAdultProgressiveHint('extract'), /世界书抽取/);
    assert.match(buildNtlHintBlock('relations'), /禁忌张力|权力/);
    var modeState = createDefaultNovelState();
    setNtlMode(modeState, true);
    assert.match(buildModeHintBlocks(modeState, 'skeleton'), /NTL/);
    assert.doesNotMatch(buildModeHintBlocks(modeState, 'skeleton'), /分步推断/);
    setAdultMode(modeState, true);
    assert.match(buildModeHintBlocks(modeState, 'enrich'), /分步推断[\s\S]*NTL|NTL[\s\S]*分步推断/);
    assert.match(buildContentModeFlags(modeState), /NtlMode: true/);
  });

  it('状态栏 NSFW 草案从档案映射', function() {
    var entities = [];
    upsertEntity(entities, {
      type: 'person',
      name: '秦月',
      content: '长正文'.repeat(40),
      provenance: [{ quote: 'y' }],
      profile: {
        'Chinese name': '秦月',
        NSFW_information: {
          body: { overall: '纤细', breasts: '柔软', genitals: '敏感' },
          sexual_personality: '外冷内热',
          Kinks: ['耳语'],
          Limits: ['公开'],
          Sex_related_traits: { experiences: '有限', sexual_role: '偏受' },
        },
      },
    });
    var d = buildStatusBarNsfwDraftFromEntities(entities, '秦月');
    assert.ok(d.paths.length >= 3);
    assert.ok(d.paths.some(function(p) { return p.path.indexOf('nsfw_breasts') >= 0; }));
    assert.ok(d.paths.some(function(p) { return p.label === '界限'; }));
  });

  it('UI/桥接/助手工具接线：全局 NSFW/NTL', function() {
    const source = readFileSync(join(root, 'src/components/novel/NovelSourcePanel.astro'), 'utf8');
    assert.match(source, /novelGlobalAdult/);
    assert.match(source, /novelGlobalNtl/);
    assert.match(source, /成人模式（NSFW）|NTL/);
    const analyze = readFileSync(join(root, 'src/components/novel/NovelAnalyzePanel.astro'), 'utf8');
    assert.doesNotMatch(analyze, /novelAnalyzeIncludeAdult|novelGlobalAdult/);
    assert.match(analyze, /btnNovelNsfwStatusDraft/);
    assert.match(analyze, /novelNsfwStatusDraft/);
    const wb = readFileSync(join(root, 'src/components/novel/NovelWorldbookPanel.astro'), 'utf8');
    assert.doesNotMatch(wb, /novelIncludeAdult/);
    const style = readFileSync(join(root, 'src/components/novel/NovelStylePanel.astro'), 'utf8');
    assert.doesNotMatch(style, /novelStyleNsfw/);
    const app = readFileSync(join(root, 'src/lib/novel/browserApp.mjs'), 'utf8');
    assert.match(app, /setAdultMode|getAdultMode|buildNsfwStatusDraft/);
    assert.match(app, /setNtlMode|getNtlMode|buildModeHintBlocks|buildContentModeFlags/);
    assert.match(app, /boostAdultSearchQuery|extractStyleNsfwSection|buildAdultContextDigests/);
    assert.match(app, /novelGlobalAdult|novelGlobalNtl/);
    const tools = readFileSync(join(root, 'src/lib/assistant/tools.mjs'), 'utf8');
    assert.match(tools, /set_novel_adult_mode|set_novel_ntl_mode|draft_nsfw_statusbar/);
    const ex = readFileSync(join(root, 'src/lib/assistant/executor.mjs'), 'utf8');
    assert.match(ex, /set_novel_adult_mode|set_novel_ntl_mode|draft_nsfw_statusbar/);
    const bridge = readFileSync(join(root, 'src/components/AssistantPanel.astro'), 'utf8');
    assert.match(bridge, /setNovelAdultMode|setNovelNtlMode/);
  });
});
