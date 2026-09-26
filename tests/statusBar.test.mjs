/**
 * 状态栏核心：人数/预设/一对一视觉主题、预览 HTML、注入脚本、设计规范化
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readLayoutSources, readAssistantPanelSources, readVariableCardPanelSources, readStatusBarPanelSources } from './helpers/uiSources.mjs';
import {
  STATUS_BAR_STYLES,
  STATUS_BAR_LAYOUTS,
  STATUS_BAR_DESIGNS,
  STATUS_BAR_MODES,
  STATUS_BAR_CAST_MODES,
  STATUS_BAR_MODULES,
  STATUS_BAR_PRESETS,
  STATUS_BAR_SCRIPT_NAME,
  STATUS_BAR_EXT_KEY,
  STATUS_BAR_CHAR_SCAN_PROMPT,
  STATUS_BAR_MVU_DESIGN_PROMPT,
  getStyleById,
  getLayoutById,
  getDesignById,
  getPresetById,
  getModuleById,
  presetsForCast,
  layoutsForCast,
  designsForCast,
  defaultLayoutId,
  defaultDesignId,
  migrateLayoutId,
  migrateDesignId,
  defaultModuleFlags,
  resolveModuleFlags,
  migrateModuleFlags,
  describeEnabledModules,
  describeForbiddenModules,
  describeFemaleOnlyRule,
  modulesByGroup,
  normalizePathItem,
  normalizeCastCharacter,
  pathsFromMvuDesign,
  buildPreviewHtml,
  buildVariableTree,
  buildPlaceholderPaths,
  buildCastProfileBlock,
  ensureCardProtagonistInCast,
  describeMvuPathLayoutSpec,
  buildStatusBarSnippet,
  buildStatusBarRegex,
  normalizeDesign,
  rejectStatusBarGenerate,
  appendStylePreset,
  reconcileDesignWithCharName,
  validateSampleFloors,
  readFloorValue,
  CUSTOM_DESIGN_ID,
  isCustomDesign,
  customDesignMeta,
  getDesignMeta,
  buildCustomLayoutDocument,
  buildCustomLayoutSnippet,
  normalizeCustomBodyForSnippet,
  STATUS_BAR_CUSTOM_LAYOUT_PROMPT,
  styleCss,
  designCss,
} from '../src/lib/statusBar.mjs';
import {
  designCss as themeCss,
  renderDesignHtml,
  getDesignById as themeById,
} from '../src/lib/statusBarThemes/index.mjs';
import {
  orphanPaths,
  worldScopedPaths,
  globalQuestEventPaths,
  displayBuckets,
} from '../src/lib/statusBarThemes/shared.mjs';

function themePreviewHtml(opts) {
  var castMode = (opts && opts.castMode) || 'single';
  var raw = (opts && (opts.designId || opts.layoutId || opts.styleId)) || defaultDesignId(castMode);
  var designId = migrateDesignId(raw, opts && opts.styleId);
  var design = themeById(designId);
  if (design.cast !== castMode) designId = defaultDesignId(castMode);
  var paths = (opts && opts.paths) || [];
  var values = (opts && opts.values) || {};
  var body = renderDesignHtml({
    designId: designId,
    paths: paths,
    title: (opts && opts.title) || 'STATUS',
    castMode: castMode,
    characters: (opts && opts.characters) || [],
    mainName: (opts && opts.mainName) || '',
    valueFn: function(p) { return values[p.path] != null ? String(values[p.path]) : (p.sample || '—'); },
    rawValueHtml: false,
  });
  return '<style>' + themeCss(designId) + '</style><div data-zb-design="' + designId + '" data-zb-layout="' + designId + '">' + body + '</div>';
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function sidebarViewPattern(viewId) {
  return new RegExp("view:\\s*'" + viewId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'");
}

const SAMPLE_PATHS = [
  { path: '角色.体力', label: '体力', group: '属性', sample: '72' },
  { path: '角色.魔力', label: '魔力', group: '属性', sample: '55' },
  { path: '角色.好感度', label: '好感', group: '角色', sample: '42' },
  { path: '角色.情绪', label: '情绪', group: '角色', sample: '平静' },
  { path: '角色.行动', label: '行动', group: '角色', sample: '闲聊' },
  { path: '角色.着装', label: '着装', group: '角色', sample: '便装' },
  { path: '世界.时间', label: '时间', group: '世界', sample: '08:00' },
  { path: '世界.地点', label: '地点', group: '世界', sample: '咖啡馆' },
  { path: '事件.标签', label: '事件', group: '事件', sample: '同行' },
];

describe('statusBar core', function() {
  it('自定义排版：layoutsForCast 含 custom；预览/片段/规范化', function() {
    assert.ok(layoutsForCast('single').some(function(l) { return l.id === CUSTOM_DESIGN_ID; }));
    assert.ok(layoutsForCast('multi').some(function(l) { return l.id === CUSTOM_DESIGN_ID; }));
    assert.equal(getDesignMeta(CUSTOM_DESIGN_ID, 'single').label, '自定义');

    var css = '.zb-custom-root{color:#fff;padding:8px;}';
    var body = '<div class="zb-custom-root"><span class="zb-value" data-zb-path="世界.时间">08:00</span></div>';
    var preview = buildCustomLayoutDocument({ customCss: css, customBodyHtml: body, castMode: 'single' });
    assert.match(preview, /zb-custom-root/);
    assert.match(preview, /data-zb-path="世界.时间"/);

    var snippet = buildCustomLayoutSnippet({ customCss: css, customBodyHtml: body, castMode: 'single' });
    assert.match(snippet, /data-zb-path="世界.时间">—<\/span>/);
    assert.doesNotMatch(snippet, />08:00</);

    var norm = normalizeDesign({
      customCss: css,
      customBodyHtml: body,
      customPrompt: '赛博 HUD',
    });
    assert.equal(norm.layoutPrompt, '赛博 HUD');
    assert.equal(norm.customCss, css);
    assert.equal(norm.mode, 'mvu');
    assert.equal(norm.designId, undefined);

    var themed = buildPreviewHtml({
      customCss: css,
      customBodyHtml: body,
      paths: SAMPLE_PATHS,
    });
    assert.match(themed, /zb-custom-root/);
    assert.match(themed, /data-zb-path/);

    assert.match(STATUS_BAR_CUSTOM_LAYOUT_PROMPT, /data-zb-path/);
    assert.match(STATUS_BAR_CUSTOM_LAYOUT_PROMPT, /data-zb-meter/);
    assert.match(STATUS_BAR_CUSTOM_LAYOUT_PROMPT, /\{\{userPrompt\}\}/);
    assert.doesNotMatch(STATUS_BAR_CUSTOM_LAYOUT_PROMPT, /sheet_attr|neon_monitor|基准主题/);
  });

  it('视觉主题：15 族×单人/多人≥30，按人数严格过滤，family 成对', function() {
    var singles = designsForCast('single');
    var multis = designsForCast('multi');
    assert.ok(singles.length >= 15, 'single designs >= 15');
    assert.ok(multis.length >= 15, 'multi designs >= 15');
    assert.ok(STATUS_BAR_DESIGNS.length >= 30);
    assert.equal(STATUS_BAR_LAYOUTS.length, STATUS_BAR_DESIGNS.length);
    assert.equal(STATUS_BAR_STYLES.length, STATUS_BAR_DESIGNS.length);

    assert.ok(singles.every(function(l) { return l.cast === 'single'; }));
    assert.ok(multis.every(function(l) { return l.cast === 'multi'; }));
    assert.ok(!singles.some(function(l) { return l.id.indexOf('multi_') === 0; }));
    assert.ok(!multis.some(function(l) { return l.id === 'sheet_attr'; }));

    var families = [
      'rpg', 'neon', 'library', 'romance', 'xianxia', 'scifi', 'ink',
      'frost', 'sweet', 'scrap', 'snow', 'oz', 'lavender', 'mahogany', 'softmon',
    ];
    families.forEach(function(fam) {
      assert.ok(singles.some(function(d) { return d.family === fam; }), 'missing single family ' + fam);
      assert.ok(multis.some(function(d) { return d.family === fam; }), 'missing multi family ' + fam);
    });

    [
      'sheet_attr', 'neon_monitor', 'form_sections', 'romance_glow',
      'xianxia_scroll', 'scifi_console', 'ink_paper', 'frost_blue',
      'sweet_pink', 'scrapbook', 'snow_glass', 'oz_green',
      'soft_lavender', 'mahogany_dossier', 'soft_monitor',
    ].forEach(function(id) {
      assert.ok(singles.some(function(l) { return l.id === id; }), 'missing single ' + id);
    });
    [
      'multi_sheet_attr', 'multi_neon_cyber', 'multi_library_gold', 'multi_romance_glass',
      'multi_xianxia_ink', 'multi_scifi_hud', 'multi_ink_paper', 'multi_frost_blue',
      'multi_sweet_pink', 'multi_scrapbook', 'multi_snow_glass', 'multi_oz_green',
      'multi_soft_lavender', 'multi_mahogany_dossier', 'multi_soft_monitor',
    ].forEach(function(id) {
      assert.ok(multis.some(function(l) { return l.id === id; }), 'missing multi ' + id);
    });

    assert.equal(migrateDesignId('hero_sheet'), 'sheet_attr');
    assert.equal(migrateDesignId('multi_bar'), 'multi_frost_blue');
    assert.equal(migrateDesignId('grouped'), 'form_sections');
    assert.equal(migrateLayoutId('multi_switch'), 'multi_frost_blue');
    assert.equal(migrateDesignId('multi_pill_sheet'), 'multi_frost_blue');
    assert.equal(migrateDesignId('multi_cast_nested'), 'multi_scrapbook');
    assert.equal(migrateDesignId('multi_tab_sections'), 'multi_romance_glass');
    assert.equal(migrateDesignId('multi_side_panel'), 'multi_snow_glass');
    assert.equal(migrateDesignId('multi_fold_elegant'), 'multi_oz_green');
    assert.equal(migrateDesignId('multi_mahogany_dossier'), 'multi_mahogany_dossier');
    assert.equal(defaultDesignId('single'), 'sheet_attr');
    assert.equal(defaultDesignId('multi'), 'multi_mahogany_dossier');
    assert.equal(defaultLayoutId('single'), 'sheet_attr');
    assert.equal(defaultLayoutId('multi'), 'multi_mahogany_dossier');
  });

  it('各主题预览含独立结构类名与主题色，主路径不用 zb-kv', function() {
    var sheet = themePreviewHtml({
      designId: 'sheet_attr', paths: SAMPLE_PATHS, mainName: '林雾', castMode: 'single',
    });
    assert.match(sheet, /rpg-panel|rpg-mini-bars|rpg-grid/);
    assert.doesNotMatch(sheet, /class="zb-kv"/);

    assert.match(themePreviewHtml({ designId: 'neon_monitor', paths: SAMPLE_PATHS, castMode: 'single' }), /crt-bezel|crt-screen|crt-prompt-line/);
    assert.match(themePreviewHtml({ designId: 'form_sections', paths: SAMPLE_PATHS, castMode: 'single' }), /lib-panel|lib-grid|lib-toc/);
    assert.match(themePreviewHtml({ designId: 'romance_glow', paths: SAMPLE_PATHS, castMode: 'single' }), /rom-panel|rom-chip|rom-diary/);
    assert.match(themePreviewHtml({ designId: 'xianxia_scroll', paths: SAMPLE_PATHS, castMode: 'single' }), /xxs-scroll|xxs-couplet|xxs-rod/);
    assert.match(themePreviewHtml({ designId: 'scifi_console', paths: SAMPLE_PATHS, castMode: 'single' }), /sci-panel|sci-grid|sci-hud/);
    assert.match(themePreviewHtml({ designId: 'ink_paper', paths: SAMPLE_PATHS, castMode: 'single' }), /ink-panel|ink-cell/);
    var scrap = themePreviewHtml({ designId: 'scrapbook', paths: SAMPLE_PATHS, castMode: 'single' });
    assert.match(scrap, /scr-page|scr-polaroid|scr-sticker/);
    assert.match(scrap, /scr-tab|scr-tabs/); // 分区 Tab
    assert.match(themePreviewHtml({ designId: 'mahogany_dossier', paths: SAMPLE_PATHS, castMode: 'single' }), /wax-folio|wax-seal|wax-stamp/);

    // designCss / styleCss 含主题色
    assert.match(designCss('sheet_attr'), /38bdf8/);
    assert.match(designCss('neon_monitor'), /39ff14/);
    assert.match(designCss('form_sections'), /d4a017/);
    assert.match(designCss('romance_glow'), /fb7185/);
    assert.match(designCss('xianxia_scroll'), /fbbf24/);
    assert.match(designCss('scifi_console'), /2dd4bf/);
    assert.match(styleCss('ink_paper'), /475569|334155/);
    assert.match(designCss('frost_blue'), /60a5fa/);
    assert.match(designCss('sweet_pink'), /f472b6/);
    assert.match(designCss('scrapbook'), /c4a574/);
    assert.match(designCss('snow_glass'), /7dd3fc/);
    assert.match(designCss('oz_green'), /4ade80/);
    assert.match(designCss('soft_lavender'), /c4b5fd/);
    assert.match(designCss('mahogany_dossier'), /c9a46a|wax-folio/);
    assert.match(designCss('sheet_attr'), /rpg-panel|rpg-mini-bars|rpg-grid/);

    // 本轮 10 族不得依赖 softmonLayout 主渲染
    [
      'scrapbook', 'multi_scrapbook', 'neon_monitor', 'multi_neon_cyber',
      'mahogany_dossier', 'multi_mahogany_dossier', 'xianxia_scroll', 'multi_xianxia_ink',
      'sheet_attr', 'multi_sheet_attr', 'romance_glow', 'multi_romance_glass',
      'scifi_console', 'multi_scifi_hud', 'ink_paper', 'multi_ink_paper',
      'soft_monitor', 'multi_soft_monitor', 'form_sections', 'multi_library_gold',
    ].forEach(function(id) {
      var src = readFileSync(join(root, 'src/lib/statusBarThemes', id + '.mjs'), 'utf8');
      assert.doesNotMatch(src, /from ['"]\.\/softmonLayout\.mjs['"]/, id + ' must not import softmonLayout');
    });
  });

  it('人数 / 模式常量完整', function() {
    assert.deepEqual(STATUS_BAR_CAST_MODES.map(function(c) { return c.id; }), ['single', 'multi']);
    assert.deepEqual(STATUS_BAR_MODES.map(function(m) { return m.id; }), ['mvu', 'text']);
  });

  it('预设与模块：题材铺全、无配角摘要、NSFW 开关', function() {
    assert.equal(presetsForCast().length, 18);
    assert.equal(STATUS_BAR_PRESETS.length, 18);
    assert.ok(STATUS_BAR_PRESETS.every(function(p) { return !/^single_|^multi_/.test(p.id); }));

    var sfwIds = STATUS_BAR_MODULES.filter(function(m) { return !m.nsfw; }).map(function(m) { return m.id; });
    [
      'affection', 'trust', 'relation_stage', 'affection_stage', 'emotion', 'action', 'location', 'outfit',
      'items', 'money', 'quest', 'memory_summary', 'event_chips',
      'attributes', 'realm', 'injury', 'sanity', 'time_weather',
    ].forEach(function(id) {
      assert.ok(sfwIds.indexOf(id) >= 0, 'missing sfw ' + id);
    });
    assert.equal(sfwIds.indexOf('support_summary'), -1, '配角摘要模块应已移除');
    assert.equal(STATUS_BAR_MODULES.some(function(m) { return /阴茎|肉棒/.test(m.label); }), false);

    presetsForCast('multi').forEach(function(p) {
      assert.ok((p.modules || []).indexOf('support_summary') < 0, p.id + ' should not include support_summary');
    });
    assert.equal(defaultModuleFlags('multi_party', false).support_summary, undefined);
    assert.equal(getPresetById('multi_party').id, 'daily');

    var nsfwMods = STATUS_BAR_MODULES.filter(function(m) { return m.nsfw; }).map(function(m) { return m.id; });
    [
      'nsfw_vagina', 'nsfw_breasts', 'nsfw_legs', 'nsfw_feet', 'nsfw_anus', 'nsfw_thoughts',
      'nsfw_mouth', 'nsfw_erogenous', 'nsfw_orgasm', 'nsfw_fluids', 'nsfw_exposure',
      'nsfw_training', 'nsfw_experience', 'nsfw_act_state', 'corruption_stage',
      'nsfw_uterus', 'nsfw_pregnancy',
    ].forEach(function(id) {
      assert.ok(nsfwMods.indexOf(id) >= 0, 'missing nsfw ' + id);
    });
    assert.deepEqual(
      STATUS_BAR_MODULES.reduce(function(acc, m) {
        if (acc.indexOf(m.group) < 0) acc.push(m.group);
        return acc;
      }, []),
      ['scene', 'person', 'nsfw']
    );
    assert.equal(getModuleById('affection').label, '好感度');
    assert.equal(getModuleById('affection_stage').label, '亲密档位');
    assert.ok(getPresetById('wuxia').modules.indexOf('realm') >= 0);
    assert.ok(getPresetById('xianxia').modules.indexOf('realm') >= 0);
    assert.ok(getPresetById('adventure').modules.indexOf('injury') >= 0);
    assert.ok(getPresetById('apocalypse').modules.indexOf('injury') >= 0);
    assert.ok(getPresetById('military').modules.indexOf('injury') >= 0);
    assert.ok(getPresetById('lovecraft').modules.indexOf('sanity') >= 0);
    assert.ok(getPresetById('intimate').modules.indexOf('nsfw_uterus') >= 0);
    assert.ok(getPresetById('intimate').modules.indexOf('nsfw_pregnancy') >= 0);
    var added = buildPlaceholderPaths({
      includeProtagonist: true,
      charName: '甲',
      moduleFlags: { realm: true, injury: true, sanity: true, nsfw_uterus: true, nsfw_pregnancy: true },
    });
    assert.ok(added.some(function(p) { return p.path === '角色.境界'; }));
    assert.ok(added.some(function(p) { return p.path === '角色.伤势'; }));
    assert.ok(added.some(function(p) { return p.path === '角色.理智' && p.meter; }));
    assert.ok(added.some(function(p) { return p.path === '角色.子宫'; }));
    assert.ok(added.some(function(p) { return p.path === '角色.怀孕'; }));
    assert.equal(modulesByGroup(false).every(function(m) { return !m.nsfw; }), true);
    assert.ok(modulesByGroup(true).some(function(m) { return m.nsfw; }));

    var sfw = defaultModuleFlags('intimate', false);
    assert.equal(sfw.nsfw_vagina, false);
    var nsfw = defaultModuleFlags('intimate', true);
    assert.equal(nsfw.nsfw_vagina, true);
    assert.equal(nsfw.nsfw_mouth, true);
    var forced = resolveModuleFlags('daily', { nsfw_vagina: true }, false);
    assert.equal(forced.nsfw_vagina, false);
    assert.match(describeEnabledModules(nsfw), /小穴/);
    var forbid = describeForbiddenModules(
      resolveModuleFlags('daily', { affection: false, corruption_stage: false }, false),
      { castMode: 'single', nsfwEnabled: false }
    );
    assert.match(forbid, /好感度|affection/);
    assert.match(forbid, /恶堕/);
    assert.match(forbid, /小穴|nsfw_vagina/);
    assert.equal(getPresetById('wuxia').label, '武侠');
    assert.equal(getPresetById('apocalypse').label, '末日');
    assert.equal(getPresetById('not-a-preset').id, 'daily');
  });

  it('旧模块 flags 可迁移且丢弃配角摘要', function() {
    var m = migrateModuleFlags({
      world_time_place: true,
      action_outfit: true,
      memory_clue: true,
      relation: true,
      affection: false,
      support_summary: true,
    });
    assert.equal(m.time_weather, true);
    assert.equal(m.location, true);
    assert.equal(m.action, true);
    assert.equal(m.outfit, true);
    assert.equal(m.memory_summary, true);
    assert.equal(m.trust, true);
    assert.equal(m.relation_stage, true);
    assert.equal(m.affection, false);
    assert.equal(m.support_summary, undefined);
  });

  it('只识别女角色提示词规则与视觉方案占位', function() {
    assert.match(describeFemaleOnlyRule(true), /只识别女角色|女性/);
    assert.match(describeFemaleOnlyRule(false), /性别不限/);
    assert.match(STATUS_BAR_CHAR_SCAN_PROMPT, /femaleOnlyRule/);
    assert.match(STATUS_BAR_MVU_DESIGN_PROMPT, /\{\{pathLayoutSpec\}\}/);
    assert.match(STATUS_BAR_MVU_DESIGN_PROMPT, /角色\./);
    assert.match(STATUS_BAR_MVU_DESIGN_PROMPT, /NPC\.姓名/);
    assert.doesNotMatch(STATUS_BAR_MVU_DESIGN_PROMPT, /sheet_attr|neon_monitor|基准主题/);
  });

  it('ensureCardProtagonistInCast / buildCastProfileBlock / describeMvuPathLayoutSpec', function() {
    var merged = ensureCardProtagonistInCast(
      [{ name: '秦玥', selected: false, source: 'worldbook' }],
      { name: '林雾', desc: '主角设定\n第二行' }
    );
    assert.equal(merged.length, 2);
    assert.equal(merged[0].name, '林雾');
    assert.equal(merged[0].selected, true);
    assert.equal(merged[1].name, '秦玥');

    merged[1].selected = true;
    var wb = [{
      comment: '[人物] 秦玥',
      content: '世界书档案正文',
      keys: [],
    }];
    var block = buildCastProfileBlock({
      includeProtagonist: true,
      includeFemales: true,
      selected: merged,
      card: { name: '林雾', desc: '卡侧描述', firstMes: '你好' },
      worldbookEntries: wb,
    });
    assert.match(block, /角色\./);
    assert.match(block, /NPC\.姓名/);
    assert.match(block, /描述：卡侧描述/);
    assert.match(block, /开场白：你好/);
    assert.match(block, /· 秦玥/);
    assert.match(block, /档案：世界书档案正文/);
    assert.doesNotMatch(block, /· 林雾/);

    var flags = defaultModuleFlags('daily', false);
    var chars = [{ name: '林雾', selected: true }, { name: '秦玥', selected: true }];
    var spec = describeMvuPathLayoutSpec({
      includeProtagonist: true,
      includeFemales: true,
      charName: '林雾',
      moduleFlags: flags,
      characters: chars,
    });
    assert.match(spec, /路径布局规格/);
    assert.match(spec, /角色\./);
    assert.match(spec, /NPC\.秦玥\./);
    assert.doesNotMatch(spec, /NPC\.林雾\./);
  });

  it('normalizePathItem / pathsFromMvuDesign / castCharacter 勾选态', function() {
    var p = normalizePathItem({ path: 'stat_data.NPC.好感', label: '好感', group: 'NPC', sample: '10' });
    assert.equal(p.path, 'NPC.好感');
    assert.equal(p.label, '好感');
    var from = pathsFromMvuDesign({
      variables: [
        { path: '世界.时间', description: '时刻', default: '09:00' },
        { path: 'NPC.林雾.情绪', type: 'string' },
      ],
    }, { mainName: '林雾' });
    assert.equal(from.length, 2);
    assert.equal(from[0].group, '世界');
    assert.equal(from[1].role, '林雾');
    var c = normalizeCastCharacter({ name: '林雾', identity: '搭档' });
    assert.equal(c.name, '林雾');
    assert.equal(c.selected, true);
    var off = normalizeCastCharacter({ name: '秦玥', selected: false });
    assert.equal(off.selected, false);
  });

  it('buildPreviewHtml 多人结构互异且无配角摘要', function() {
    var chars = [{ name: '林雾' }, { name: '秦玥', identity: '配角' }];
    var mPaths = [
      { path: '世界.时间', label: '时间', group: '世界', sample: '08:00' },
      { path: 'NPC.林雾.情绪', label: '情绪', group: 'NPC', sample: '平静', role: '林雾' },
      { path: 'NPC.林雾.好感', label: '好感', group: 'NPC', sample: '40', role: '林雾' },
      { path: 'NPC.林雾.行动', label: '行动', group: 'NPC', sample: '观望', role: '林雾' },
      { path: 'NPC.林雾.着装', label: '着装', group: 'NPC', sample: '常服', role: '林雾' },
      { path: 'NPC.秦玥.情绪', label: '情绪', group: 'NPC', sample: '旁观', role: '秦玥' },
    ];
    var multi = themePreviewHtml({
      designId: 'multi_frost_blue', castMode: 'multi',
      mainName: '林雾', characters: chars, paths: mPaths,
    });
    assert.match(multi, /fr-panel|fr-card|fr-mini-bars/);
    assert.match(multi, /林雾/);
    assert.doesNotMatch(multi, /配角摘要/);
    assert.match(multi, /data-zb-design="multi_frost_blue"|data-zb-layout="multi_frost_blue"/);

    assert.match(themePreviewHtml({
      designId: 'multi_snow_glass', castMode: 'multi',
      mainName: '林雾', characters: chars, paths: mPaths,
    }), /sn-panel|sn-card/);
    assert.match(themePreviewHtml({
      designId: 'multi_scrapbook', castMode: 'multi',
      mainName: '林雾', characters: chars, paths: mPaths,
    }), /scr-stack|scr-note-card|scr-cast-tab/);
    assert.match(themePreviewHtml({
      designId: 'multi_oz_green', castMode: 'multi',
      mainName: '林雾', characters: chars, paths: mPaths,
    }), /oz-panel|oz-card|oz-fold/);
    assert.match(themePreviewHtml({
      designId: 'multi_romance_glass', castMode: 'multi',
      mainName: '林雾', characters: chars, paths: mPaths,
    }), /rom-panel|rom-card|rom-drawer|rom-tab/);
    assert.match(themePreviewHtml({
      designId: 'multi_neon_cyber', castMode: 'multi',
      mainName: '林雾', characters: chars, paths: mPaths,
    }), /crt-bezel|crt-win|crt-grid/);

    // 暮褐群档：信笺叠匣点信封翻页（非 softmon）
    var mh = themePreviewHtml({
      designId: 'multi_mahogany_dossier', castMode: 'multi',
      mainName: '林雾', characters: chars, paths: mPaths.concat([
        { path: '世界.地点', label: '地点', group: '世界', sample: '客厅' },
        { path: '世界.天气', label: '天气', group: '世界', sample: '阴' },
        { path: 'NPC.林雾.记忆', label: '记忆', group: 'NPC', sample: '初遇', role: '林雾' },
      ]),
    });
    assert.match(mh, /wax-stack|wax-letter|wax-letter-seal|wax-env/);
    assert.match(mh, /往来密函|致/);
    assert.doesNotMatch(mh, /配角摘要|class="zb-kv"|mh-tabs|其他角色/);
    assert.match(designCss('multi_mahogany_dossier'), /c9a46a|wax-letter/);
    assert.match(mh, /data-zb-design="multi_mahogany_dossier"|data-zb-layout="multi_mahogany_dossier"/);

    assert.match(themePreviewHtml({
      designId: 'multi_xianxia_ink', castMode: 'multi',
      mainName: '林雾', characters: chars, paths: mPaths,
    }), /xxs-plaques|xxs-unit|xxs-couplet/);

    // 软监控：仪表盘结构（无「其他角色」精简区）
    var soft = themePreviewHtml({
      designId: 'soft_monitor', castMode: 'single', mainName: '林雾',
      paths: SAMPLE_PATHS.concat([
        { path: '角色.好感', label: '好感', group: '角色', sample: '40' },
        { path: '角色.行动', label: '行动', group: '角色', sample: '闲聊' },
      ]),
    });
    assert.match(soft, /sm-panel|sm-mini-bars|sm-grid|sm-dial|SYSTEM MONITORING/);
    assert.match(designCss('soft_monitor'), /a8d8ea|81ecec/);

    var softM = themePreviewHtml({
      designId: 'multi_soft_monitor', castMode: 'multi',
      mainName: '林雾', characters: chars, paths: mPaths.concat([
        { path: '世界.地点', label: '地点', group: '世界', sample: '客厅' },
        { path: '事件.标签', label: '事件', group: '事件', sample: '同行' },
        { path: 'NPC.秦玥.好感', label: '好感', group: 'NPC', sample: '20', role: '秦玥' },
        { path: 'NPC.秦玥.行动', label: '行动', group: 'NPC', sample: '旁观', role: '秦玥' },
      ]),
    });
    assert.match(softM, /msm-panel|msm-mini-bars|msm-card/);
    assert.doesNotMatch(softM, /其他角色|配角摘要/);
    // 两人各有同结构卡
    assert.equal((softM.match(/msm-card/g) || []).length >= 2, true);
    assert.match(designCss('multi_soft_monitor'), /SYSTEM MONITORING|a8d8ea/);

    // 单人暮褐：蜡封印卷宗开合，无 Tab 栏名 mh-tabs
    var mhSolo = themePreviewHtml({
      designId: 'mahogany_dossier', castMode: 'single',
      mainName: '林雾', paths: SAMPLE_PATHS,
    });
    assert.match(mhSolo, /wax-folio|wax-seal|wax-stamp/);
    assert.doesNotMatch(mhSolo, /其他角色|mh-tabs/);

    // 兼容旧 layoutId / 旧 multi id 入参
    var legacy = themePreviewHtml({
      layoutId: 'hero_sheet', styleId: 'romance', paths: SAMPLE_PATHS, castMode: 'single',
    });
    assert.match(legacy, /data-zb-design="sheet_attr"|data-zb-layout="sheet_attr"/);
    var legacyMulti = themePreviewHtml({
      designId: 'multi_pill_sheet', castMode: 'multi',
      mainName: '林雾', characters: chars, paths: mPaths,
    });
    assert.match(legacyMulti, /data-zb-design="multi_frost_blue"|data-zb-layout="multi_frost_blue"/);
  });

  it('buildPlaceholderPaths 随模块开关增减；多人每人同套字段', function() {
    var off = buildPlaceholderPaths({
      castMode: 'single', mainName: '林雾',
      moduleFlags: { time_weather: true, location: true },
    });
    assert.ok(off.some(function(p) { return /时间/.test(p.label); }));
    assert.ok(!off.some(function(p) { return p.label === '好感'; }));

    var on = buildPlaceholderPaths({
      castMode: 'single', mainName: '林雾',
      moduleFlags: {
        time_weather: true, location: true, affection: true,
        attributes: true, emotion: true, relation_stage: true,
      },
    });
    assert.ok(on.some(function(p) { return p.label === '好感'; }));
    assert.ok(on.some(function(p) { return p.label === '体力'; }));
    assert.ok(on.some(function(p) { return p.label === '情绪'; }));
    assert.ok(on.length > off.length);

    var multi = buildPlaceholderPaths({
      castMode: 'multi', mainName: '秦玥',
      characters: [
        { name: '秦玥', selected: true },
        { name: '林雾', selected: true },
      ],
      moduleFlags: { emotion: true, affection: true, action: true },
    });
    assert.ok(multi.every(function(p) { return p.path.indexOf('NPC.秦玥') !== 0; }));
    assert.ok(multi.every(function(p) { return p.path.indexOf('角色.') !== 0; }));
    var lin = multi.filter(function(p) { return p.role === '林雾'; });
    assert.equal(lin.length, 3);
    assert.ok(lin.every(function(p) { return /NPC\.林雾/.test(p.path); }));
  });

  it('snippet / 正则组装', function() {
    var snip = buildStatusBarSnippet({
      designId: 'form_sections',
      castMode: 'single',
      mode: 'mvu',
      paths: [{ path: '角色.好感度', label: '好感' }],
    });
    assert.match(snip, /data-zb-path="角色\.好感度"/);
    assert.match(snip, /data-zb-meter="角色\.好感度"/);
    assert.match(snip, /zb-style/);
    assert.doesNotMatch(snip, /form_sections|sheet_attr/);
    var rx = buildStatusBarRegex({ snippetHtml: snip, mode: 'mvu' });
    assert.equal(rx.scriptName, '[美化]状态栏展示');
    assert.match(rx.findRegex, /StatusPlaceHolderImpl/);
    assert.match(rx.replaceString, /```html/);
    assert.match(rx.replaceString, /data-zb-path/);
    assert.match(rx.replaceString, /getCurrentMessageId/);
    assert.match(rx.replaceString, /display_data[\s\S]*stat_data/);
    assert.doesNotMatch(rx.replaceString, /type="module"/);
    assert.doesNotMatch(rx.replaceString, /message_id:"latest"|message_id: "latest"/);
    var rxText = buildStatusBarRegex({ snippetHtml: snip, mode: 'text' });
    assert.match(rxText.findRegex, /StatusBar/);
  });

  it('normalizeDesign 回落默认并 migrate 旧 layout/style', function() {
    var d = normalizeDesign({
      castMode: 'multi',
      presetId: 'multi_harem',
      nsfw: true,
      styleId: 'romance',
      layoutId: 'multi_bar', // 旧 id 迁移
      characters: [{ name: 'A' }, { name: 'B', selected: false }],
      paths: [{ path: 'a' }],
    });
    assert.equal(d.mode, 'mvu');
    assert.equal(d.presetId, 'romance');
    assert.equal(d.includeProtagonist, false);
    assert.equal(d.includeFemales, true);
    assert.equal(d.designId, undefined);
    assert.equal(d.mainName, undefined);
    assert.equal(d.femaleOnly, true);
    assert.equal(d.characters[0].name, 'A');
    assert.equal(d.characters[1].selected, false);
    assert.equal(d.paths[0].path, 'a');
    assert.equal(d.paths[0].set, 'global');
    assert.equal(STATUS_BAR_EXT_KEY, 'zmer_statusbar_design');
    assert.equal(STATUS_BAR_SCRIPT_NAME, '[状态栏]前端展示');
    assert.equal(getDesignById('ink_paper').id, 'ink_paper');
    assert.equal(getLayoutById('scifi_console').id, 'scifi_console');
    assert.equal(getStyleById('neon_monitor').id, 'neon_monitor');

    // 单人误选多人方案 → 回落默认（旧 multi id 先 migrate 再校验 cast）
    var bad = normalizeDesign({ castMode: 'single', layoutId: 'multi_pill_sheet' });
    assert.equal(bad.includeProtagonist, true);
    assert.equal(bad.includeFemales, false);
    assert.equal(bad.designId, undefined);

    var badM = normalizeDesign({
      castMode: 'multi',
      mainName: '卡角色',
      characters: [{ name: '卡角色', source: 'card' }, { name: '女配', selected: true }],
    });
    assert.equal(badM.includeProtagonist, true);
    assert.deepEqual(badM.characters.map(function(c) { return c.name; }), ['女配']);

    var off = normalizeDesign({ femaleOnly: false });
    assert.equal(off.femaleOnly, false);

    // designId 直读
    var direct = normalizeDesign({
      includeProtagonist: true,
      includeFemales: false,
      presetId: 'daily',
      layoutPrompt: '细线',
      floors: [{ global: { a: 1 } }],
    });
    assert.equal(direct.layoutPrompt, '细线');
    assert.equal(direct.floors, undefined);
    assert.equal(direct.includeFemales, false);
  });
});

describe('statusBar wiring', function() {
  it('侧栏 / index / VALID_VIEWS / 面板 DOM', function() {
    const sidebar = readFileSync(join(root, 'src/components/AppSidebar.astro'), 'utf8');
    assert.match(sidebar, sidebarViewPattern('statusbar'));
    assert.match(sidebar, /状态栏/);
    const sbIdx = sidebar.search(sidebarViewPattern('statusbar'));
    assert.equal(sidebar.search(sidebarViewPattern('mvu')), -1, 'mvu not in sidebar menu');
    const rxIdx = sidebar.search(sidebarViewPattern('regex'));
    assert.ok(rxIdx > sbIdx, 'regex should be under statusbar');

    const index = readFileSync(join(root, 'src/pages/index.astro'), 'utf8');
    assert.match(index, /StatusBarPanel/);
    assert.match(index, /data-view="statusbar"/);

    const tools = readFileSync(join(root, 'src/lib/assistant/tools.mjs'), 'utf8');
    assert.match(tools, /'statusbar'/);

    const panel = readStatusBarPanelSources(root);
    const astro = readFileSync(join(root, 'src/components/StatusBarPanel.astro'), 'utf8');
    const boot = readFileSync(join(root, 'src/lib/statusBar/panelBoot.mjs'), 'utf8');
    assert.match(astro, /人物/);
    assert.match(astro, /主角/);
    assert.match(astro, /女角色/);
    assert.match(astro, /id="sbBtnVars"/);
    assert.match(astro, /id="sbBtnLayoutRegen"/);
    assert.match(astro, /id="sbBtnLayoutRevise"/);
    assert.doesNotMatch(astro, /id="sbBtnGenerate"/);
    assert.match(astro, /sb-module-group/);
    assert.match(boot, /STATUS_BAR_MODULE_GROUPS/);
    assert.match(astro, /生成3楼样例变量数据/);
    assert.match(astro, /sbBtnPreviewPrompt/);
    assert.match(astro, /border-left:\s*2px solid var\(--color-accent\)/);
    assert.match(astro, /ui-step-pill/);
    assert.match(astro, /max-width:\s*960px/);
    assert.equal((astro.match(/btn-primary/g) || []).length, 0);
    assert.doesNotMatch(astro, /sbBtnRefreshPreview|sbLayoutGrid|sbBtnInject|上一步|下一步|sbPathGroups|查看注入脚本/);
    assert.match(astro, /assistant-mode-switch/);
    assert.match(astro, /data-sb-view="preview"/);
    assert.match(astro, /data-sb-view="vars"/);
    assert.match(astro, /data-sb-view="script"/);
    assert.match(boot, /buildVariableTree/);
    assert.match(panel, /rejectStatusBarGenerate/);
    assert.match(boot, /appendStylePreset/);
    assert.match(boot, /__getActivePresetsStr__/);
    assert.match(boot, /模型返回空内容/);
    const bootAi = readFileSync(join(root, 'src/lib/card-builder/bootAiConfig.mjs'), 'utf8');
    assert.match(bootAi, /window\.__getActivePresetsStr__/);
    const wb = readFileSync(join(root, 'src/lib/card-builder/panels/worldbookShared.mjs'), 'utf8');
    assert.match(wb, /window\.__getActivePresetsStr__/);
    assert.match(boot, /generateVariables/);
    assert.match(boot, /generateLayout/);
    assert.match(boot, /card\.statusbar\.layout/);
    assert.match(panel, /statusbar_sample_floors/);
    assert.match(panel, /validateSampleFloors/);
    assert.match(panel, /keepMarkupPaths/);
    assert.match(panel, /getCurrentMessageId|buildStatusBarRegex/);
    assert.doesNotMatch(astro + boot, /designCss\(|layoutsForCast|statusBarThemes/);
    assert.match(panel, /请勾选主角或女角色|rejectStatusBarGenerate/);
    assert.doesNotMatch(panel, /btn\.disabled\s*=\s*true/);
    assert.doesNotMatch(panel, /正在生成|正在识别/);
  });

  it('MVU 面板已去掉整套生成入口', function() {
    const mvu = readVariableCardPanelSources(root);
    assert.doesNotMatch(mvu, /id="btnVcGenerate"/);
    assert.doesNotMatch(mvu, /btnGen\.addEventListener/);
    assert.match(mvu, /已迁至状态栏|请使用「状态栏」|整套变量请在「状态栏」/);
    assert.match(mvu, /__assistantMvuApi__/);
    assert.match(mvu, /btnVcInfer|从卡推定变量/);
    assert.match(mvu, /vcCorruptionGap/);
  });

  it('提示词与任务类型已登记', function() {
    const meta = readFileSync(join(root, 'src/lib/promptStore.mjs'), 'utf8');
    assert.match(meta, /statusBarPaths/);
    assert.match(meta, /statusBarCharScan/);
    assert.match(meta, /statusBarMvuDesign/);
    assert.match(meta, /statusBarCustomLayout/);
    // 默认提示词正文在 promptCanon（描述体系组装）
    const canon = readFileSync(join(root, 'src/lib/promptCanon.mjs'), 'utf8');
    assert.match(canon, /femaleOnlyRule/);
    assert.match(canon, /statusBarCustomLayout/);
    assert.match(canon, /data-zb-path/);
    assert.match(canon, /data-zb-meter/);
    assert.match(canon, /不要输出当前卡角色本人/);
    assert.doesNotMatch(canon, /sheet_attr|neon_monitor|multi_frost/);
    const tc = readFileSync(join(root, 'src/lib/aiTaskCenter.mjs'), 'utf8');
    assert.match(tc, /statusbar_generate/);
    assert.match(tc, /statusbar_char_scan/);
    assert.match(tc, /statusbar_custom_layout/);
  });

  it('本轮 10 族：全开模块 label 全覆盖；多人任务/事件可见；softmon 回归', function() {
    var CORE_SINGLE = [
      'scrapbook', 'neon_monitor', 'mahogany_dossier', 'xianxia_scroll', 'sheet_attr',
      'romance_glow', 'scifi_console', 'ink_paper', 'soft_monitor', 'form_sections',
    ];
    var CORE_MULTI = [
      'multi_scrapbook', 'multi_neon_cyber', 'multi_mahogany_dossier', 'multi_xianxia_ink', 'multi_sheet_attr',
      'multi_romance_glass', 'multi_scifi_hud', 'multi_ink_paper', 'multi_soft_monitor', 'multi_library_gold',
    ];

    function allFlags(nsfw) {
      var on = {};
      STATUS_BAR_MODULES.forEach(function(m) { on[m.id] = !m.nsfw || nsfw; });
      return on;
    }

    // helper：任务事件从 items 分出
    var sample = [
      { path: '任务.当前', label: '任务', group: '任务', sample: 'x' },
      { path: '事件.标签', label: '事件', group: '事件', sample: 'y' },
      { path: '角色.物品', label: '物品', group: '角色', sample: 'z' },
    ];
    var db = displayBuckets(sample);
    assert.equal(db.questEvents.length, 2);
    assert.equal(db.bag.length, 1);
    assert.ok(worldScopedPaths(sample).length >= 2);
    assert.equal(globalQuestEventPaths(sample).length, 2);

    var sfwPaths = buildPlaceholderPaths({
      castMode: 'single', mainName: '林雾', moduleFlags: allFlags(false),
    });
    var nsfwPaths = buildPlaceholderPaths({
      castMode: 'single', mainName: '林雾', moduleFlags: allFlags(true),
    });
    assert.ok(sfwPaths.length >= 14);
    assert.ok(nsfwPaths.length > sfwPaths.length);

    CORE_SINGLE.forEach(function(id) {
      var htmlSfw = themePreviewHtml({ designId: id, paths: sfwPaths, mainName: '林雾', castMode: 'single' });
      assert.deepEqual(orphanPaths(sfwPaths, htmlSfw).map(function(p) { return p.label; }), [], id + ' SFW orphan');
      var htmlNsfw = themePreviewHtml({ designId: id, paths: nsfwPaths, mainName: '林雾', castMode: 'single' });
      assert.deepEqual(orphanPaths(nsfwPaths, htmlNsfw).map(function(p) { return p.label; }), [], id + ' NSFW orphan');
      assert.ok((htmlNsfw.match(/双乳|小穴|内心|美腿/g) || []).length >= 3, id + ' NSFW fields');
    });

    var chars = [
      { name: '林雾', selected: true },
      { name: '秦玥', selected: true },
    ];
    var multiPaths = buildPlaceholderPaths({
      castMode: 'multi', mainName: '林雾', characters: chars, moduleFlags: allFlags(true),
    });
    CORE_MULTI.forEach(function(id) {
      var html = themePreviewHtml({
        designId: id, paths: multiPaths, mainName: '林雾', castMode: 'multi', characters: chars,
      });
      assert.match(html, /任务/, id + ' quest');
      assert.match(html, /事件/, id + ' event');
      assert.deepEqual(orphanPaths(multiPaths, html).map(function(p) { return p.label; }), [], id + ' multi orphan');
    });

    // softmonLayout 回归（frost）
    var frostHtml = themePreviewHtml({
      designId: 'frost_blue', paths: sfwPaths, mainName: '林雾', castMode: 'single',
    });
    assert.deepEqual(orphanPaths(sfwPaths, frostHtml).map(function(p) { return p.label; }), [], 'frost_blue SFW');
    var multiFrost = themePreviewHtml({
      designId: 'multi_frost_blue', paths: multiPaths, mainName: '林雾', castMode: 'multi', characters: chars,
    });
    assert.match(multiFrost, /任务/);
    assert.match(multiFrost, /事件/);
  });

  it('文档同步状态栏两套路径', function() {
    const doc = readFileSync(join(root, 'docs/guides/card-writing-guide.md'), 'utf8');
    assert.match(doc, /只识别女/);
    assert.match(doc, /AI 识别/);
    assert.match(doc, /角色\.字段/);
    assert.match(doc, /NPC\.姓名/);
    assert.match(doc, /请勾选主角或女角色/);
    assert.match(doc, /getCurrentMessageId/);
    assert.doesNotMatch(doc, /15 美学族|30 套预览主题/);
    const readme = readFileSync(join(root, 'README.md'), 'utf8');
    assert.match(readme, /两套路径|角色\.字段/);
    assert.doesNotMatch(readme, /15 美学族 × 单人/);
  });
});

describe('statusBar two path sets', function() {
  var flags = { emotion: true, time_weather: true, affection: true, corruption_stage: true };

  it('只勾主角：角色. 加全局，没有 NPC.卡角色名', function() {
    var paths = buildPlaceholderPaths({
      includeProtagonist: true,
      includeFemales: false,
      charName: '林雾',
      characters: [{ name: '林雾', selected: true }, { name: '秦玥', selected: true }],
      moduleFlags: flags,
    });
    assert.ok(paths.some(function(p) { return p.path === '角色.情绪' && p.set === 'protagonist'; }));
    assert.ok(paths.some(function(p) { return p.path === '世界.当前时间' && p.set === 'global'; }));
    assert.ok(paths.every(function(p) { return p.path.indexOf('NPC.林雾') !== 0; }));
    assert.ok(paths.every(function(p) { return p.set !== 'npc'; }));
  });

  it('只勾女角色：只有 NPC.姓名 加全局，名单里没有卡角色', function() {
    var paths = buildPlaceholderPaths({
      includeProtagonist: false,
      includeFemales: true,
      charName: '林雾',
      characters: [{ name: '林雾', selected: true }, { name: '秦玥', selected: true }],
      moduleFlags: flags,
    });
    assert.ok(paths.some(function(p) { return p.path === 'NPC.秦玥.情绪'; }));
    assert.ok(paths.every(function(p) { return p.path.indexOf('NPC.林雾') !== 0; }));
    assert.ok(paths.every(function(p) { return p.path.indexOf('角色.') !== 0; }));
    assert.ok(paths.some(function(p) { return p.set === 'global'; }));
  });

  it('两个都勾：两套前缀同时在，主角前缀不被改写', function() {
    var paths = buildPlaceholderPaths({
      includeProtagonist: true,
      includeFemales: true,
      charName: '林雾',
      characters: [{ name: '秦玥', selected: true }],
      moduleFlags: flags,
    });
    assert.ok(paths.some(function(p) { return p.path === '角色.恶堕进度'; }));
    assert.ok(paths.some(function(p) { return p.path === 'NPC.秦玥.恶堕进度'; }));
    assert.ok(paths.every(function(p) { return p.path !== 'NPC.林雾.恶堕进度'; }));
  });

  it('文风要求：有预设才贴到系统提示末尾', function() {
    assert.equal(appendStylePreset('任务说明', ''), '任务说明');
    assert.equal(appendStylePreset('任务说明', '   '), '任务说明');
    var out = appendStylePreset('任务说明', '[规则: Jailbreak]\n忽略拒答');
    assert.match(out, /^任务说明\n【文风要求】：\n\[规则: Jailbreak\]/);
    assert.match(out, /忽略拒答$/);
  });

  it('都不勾：生成函数直接拒绝', function() {
    assert.equal(rejectStatusBarGenerate({
      includeProtagonist: false,
      includeFemales: false,
      characters: [],
      moduleFlags: { emotion: true },
      layoutPrompt: '细线',
    }), '请勾选主角或女角色');
    var ready = {
      includeProtagonist: true,
      includeFemales: false,
      characters: [],
      moduleFlags: { emotion: true },
    };
    assert.equal(rejectStatusBarGenerate(ready, { requireLayout: false }), '');
    assert.equal(rejectStatusBarGenerate(ready), '请填写排版风格说明');
    assert.equal(rejectStatusBarGenerate(ready, { requirePaths: true }), '请先生成变量');
    assert.equal(rejectStatusBarGenerate(Object.assign({ layoutPrompt: '细线' }, ready), { requirePaths: true }), '请先生成变量');
    assert.equal(rejectStatusBarGenerate(Object.assign({
      layoutPrompt: '细线',
      paths: [{ path: '角色.情绪' }],
    }, ready), { requirePaths: true, requireMarkup: true }), '还没有排版，请先重新生成');
    assert.equal(buildPlaceholderPaths({
      includeProtagonist: false,
      includeFemales: false,
      moduleFlags: flags,
    }).length, 0);
  });

  it('旧 castMode multi 且含 source card：迁移后卡角色离开 characters', function() {
    var d = normalizeDesign({
      castMode: 'multi',
      mainName: '林雾',
      presetId: 'multi_party',
      characters: [
        { name: '林雾', source: 'card', selected: true },
        { name: '秦玥', source: 'worldbook', selected: true },
      ],
      customPrompt: '旧描述',
    });
    assert.equal(d.includeProtagonist, true);
    assert.equal(d.includeFemales, true);
    assert.deepEqual(d.characters.map(function(c) { return c.name; }), ['秦玥']);
    assert.equal(d.presetId, 'daily');
    assert.equal(d.layoutPrompt, '旧描述');
    assert.equal(d.mode, 'mvu');
    var hydrated = reconcileDesignWithCharName(normalizeDesign({
      castMode: 'multi',
      characters: [{ name: '路人', selected: true }, { name: '现卡', selected: true }],
    }), '现卡');
    assert.equal(hydrated.includeProtagonist, true);
    assert.deepEqual(hydrated.characters.map(function(c) { return c.name; }), ['路人']);
  });

  it('三楼三份对象；切回第 1 楼读到第 1 楼的值', function() {
    var shared = { global: { '世界.当前时间': '相同' } };
    assert.equal(validateSampleFloors([shared, shared, { global: {} }]).ok, false);
    var a = { global: { '世界.当前时间': '晨' }, protagonist: { '角色.情绪': '平静' }, npc: {} };
    var b = { global: { '世界.当前时间': '午' }, protagonist: { '角色.情绪': '紧张' }, npc: {} };
    var c = { global: { '世界.当前时间': '夜' }, protagonist: { '角色.情绪': '疲倦' }, npc: {} };
    var checked = validateSampleFloors([a, b, c]);
    assert.equal(checked.ok, true);
    assert.notEqual(checked.floors[0], checked.floors[2]);
    assert.equal(readFloorValue(checked.floors[2], { path: '世界.当前时间', set: 'global' }), '夜');
    assert.equal(readFloorValue(checked.floors[0], { path: '世界.当前时间', set: 'global' }), '晨');
    assert.equal(readFloorValue(checked.floors[0], { path: '角色.情绪', set: 'protagonist' }), '平静');
    assert.equal(readFloorValue(checked.floors[0], { path: 'NPC.秦玥.情绪', set: 'npc', role: '秦玥' }), undefined);
  });

  it('样例不出现在 normalizeDesign 结果里', function() {
    var d = normalizeDesign({
      includeProtagonist: true,
      floors: [{ global: { x: 1 } }, { global: { x: 2 } }, { global: { x: 3 } }],
      activeFloor: 2,
    });
    assert.equal(d.floors, undefined);
    assert.equal(d.activeFloor, undefined);
  });

  it('预览朴素列表与正则都带 data-zb-path，数值条带 data-zb-meter', function() {
    var paths = buildPlaceholderPaths({
      includeProtagonist: true,
      charName: '林雾',
      moduleFlags: { affection: true, emotion: true },
    });
    var preview = buildPreviewHtml({ paths: paths });
    assert.match(preview, /data-zb-path="角色\.好感度"/);
    assert.match(preview, /data-zb-meter="角色\.好感度"/);
    assert.doesNotMatch(preview, /data-zb-meter="角色\.情绪"/);
    assert.doesNotMatch(preview, /sheet_attr|neon_monitor/);
    var snip = buildStatusBarSnippet({ paths: paths, mode: 'mvu' });
    var rx = buildStatusBarRegex({ snippetHtml: snip, mode: 'mvu' });
    assert.equal(rx.placement[0], 2);
    assert.match(rx.replaceString, /data-zb-path/);
    assert.match(rx.replaceString, /data-zb-meter/);
    assert.match(rx.replaceString, /getCurrentMessageId/);
    assert.doesNotMatch(rx.replaceString, /type=.module/);
    assert.doesNotMatch(rx.replaceString, /latest/);
  });

  it('变量树按路径嵌套，主角与女角色前缀不改写', function() {
    var tree = buildVariableTree([
      { path: '世界.当前时间', set: 'global', sample: '晨' },
      { path: '事件.标签', set: 'global', sample: ['青霞门逼债', '雨中苦练', '身份伪装'] },
      { path: '角色.情绪', set: 'protagonist', sample: '平静' },
      { path: '角色.好感度', set: 'protagonist', sample: '42' },
      { path: 'NPC.秦玥.情绪', set: 'npc', role: '秦玥', sample: '紧张' },
    ], function(p) { return p.sample; });
    assert.equal(tree['世界']['当前时间'], '晨');
    assert.deepEqual(tree['事件']['标签'], ['青霞门逼债', '雨中苦练', '身份伪装']);
    assert.equal(tree['角色']['情绪'], '平静');
    assert.equal(tree['NPC']['秦玥']['情绪'], '紧张');
    assert.equal(tree['NPC']['林雾'], undefined);
    assert.equal(tree['角色']['秦玥'], undefined);
  });

  it('提示词正文不含主题 CSS 与 30 套主题 id', function() {
    var blob = STATUS_BAR_MVU_DESIGN_PROMPT + '\n' + STATUS_BAR_CUSTOM_LAYOUT_PROMPT + '\n' + STATUS_BAR_CHAR_SCAN_PROMPT;
    STATUS_BAR_DESIGNS.forEach(function(d) {
      assert.equal(blob.indexOf(d.id), -1, d.id);
    });
    assert.doesNotMatch(blob, /基准主题|statusBarThemes|designCss/);
  });
});
