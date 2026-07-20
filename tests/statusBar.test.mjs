/**
 * 状态栏核心：人数/预设/一对一视觉主题、预览 HTML、注入脚本、设计规范化
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
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
  describeFemaleOnlyRule,
  modulesByGroup,
  normalizePathItem,
  normalizeCastCharacter,
  pathsFromMvuDesign,
  buildPreviewHtml,
  buildPlaceholderPaths,
  buildStatusBarSnippet,
  buildTavernHelperScript,
  buildStatusBarRegex,
  normalizeDesign,
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
  orphanPaths,
  worldScopedPaths,
  globalQuestEventPaths,
  displayBuckets,
} from '../src/lib/statusBarThemes/shared.mjs';

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
      designId: CUSTOM_DESIGN_ID,
      customCss: css,
      customBodyHtml: body,
      customPrompt: '赛博 HUD',
    });
    assert.equal(norm.designId, CUSTOM_DESIGN_ID);
    assert.equal(norm.customPrompt, '赛博 HUD');

    var themed = buildPreviewHtml({
      designId: CUSTOM_DESIGN_ID,
      customCss: css,
      customBodyHtml: body,
      castMode: 'single',
      paths: SAMPLE_PATHS,
    });
    assert.match(themed, /zb-custom-root/);

    assert.match(STATUS_BAR_CUSTOM_LAYOUT_PROMPT, /data-zb-path/);
    assert.match(STATUS_BAR_CUSTOM_LAYOUT_PROMPT, /\{\{userPrompt\}\}/);
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
    var sheet = buildPreviewHtml({
      designId: 'sheet_attr', paths: SAMPLE_PATHS, mainName: '林雾', castMode: 'single',
    });
    assert.match(sheet, /rpg-panel|rpg-mini-bars|rpg-grid/);
    assert.doesNotMatch(sheet, /class="zb-kv"/);

    assert.match(buildPreviewHtml({ designId: 'neon_monitor', paths: SAMPLE_PATHS, castMode: 'single' }), /crt-bezel|crt-screen|crt-prompt-line/);
    assert.match(buildPreviewHtml({ designId: 'form_sections', paths: SAMPLE_PATHS, castMode: 'single' }), /lib-panel|lib-grid|lib-toc/);
    assert.match(buildPreviewHtml({ designId: 'romance_glow', paths: SAMPLE_PATHS, castMode: 'single' }), /rom-panel|rom-chip|rom-diary/);
    assert.match(buildPreviewHtml({ designId: 'xianxia_scroll', paths: SAMPLE_PATHS, castMode: 'single' }), /xxs-scroll|xxs-couplet|xxs-rod/);
    assert.match(buildPreviewHtml({ designId: 'scifi_console', paths: SAMPLE_PATHS, castMode: 'single' }), /sci-panel|sci-grid|sci-hud/);
    assert.match(buildPreviewHtml({ designId: 'ink_paper', paths: SAMPLE_PATHS, castMode: 'single' }), /ink-panel|ink-cell/);
    var scrap = buildPreviewHtml({ designId: 'scrapbook', paths: SAMPLE_PATHS, castMode: 'single' });
    assert.match(scrap, /scr-page|scr-polaroid|scr-sticker/);
    assert.match(scrap, /scr-tab|scr-tabs/); // 分区 Tab
    assert.match(buildPreviewHtml({ designId: 'mahogany_dossier', paths: SAMPLE_PATHS, castMode: 'single' }), /wax-folio|wax-seal|wax-stamp/);

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
    assert.ok(presetsForCast('single').length >= 15);
    assert.ok(presetsForCast('multi').length >= 15);
    assert.ok(STATUS_BAR_PRESETS.length >= 30);

    var sfwIds = STATUS_BAR_MODULES.filter(function(m) { return !m.nsfw; }).map(function(m) { return m.id; });
    [
      'affection', 'trust', 'relation_stage', 'emotion', 'action', 'location', 'outfit',
      'items', 'money', 'quest', 'memory_summary', 'event_chips',
      'attributes', 'time_weather',
    ].forEach(function(id) {
      assert.ok(sfwIds.indexOf(id) >= 0, 'missing sfw ' + id);
    });
    assert.equal(sfwIds.indexOf('support_summary'), -1, '配角摘要模块应已移除');

    presetsForCast('multi').forEach(function(p) {
      assert.ok((p.modules || []).indexOf('support_summary') < 0, p.id + ' should not include support_summary');
    });
    assert.equal(defaultModuleFlags('multi_party', false).support_summary, undefined);

    var nsfwMods = STATUS_BAR_MODULES.filter(function(m) { return m.nsfw; }).map(function(m) { return m.id; });
    [
      'nsfw_vagina', 'nsfw_breasts', 'nsfw_legs', 'nsfw_feet', 'nsfw_anus', 'nsfw_thoughts',
      'nsfw_mouth', 'nsfw_erogenous', 'nsfw_orgasm', 'nsfw_fluids', 'nsfw_exposure',
      'nsfw_training', 'nsfw_experience', 'nsfw_act_state', 'corruption_stage',
    ].forEach(function(id) {
      assert.ok(nsfwMods.indexOf(id) >= 0, 'missing nsfw ' + id);
    });
    assert.equal(modulesByGroup(false).every(function(m) { return !m.nsfw; }), true);
    assert.ok(modulesByGroup(true).some(function(m) { return m.nsfw; }));

    var sfw = defaultModuleFlags('single_nsfw', false);
    assert.equal(sfw.nsfw_vagina, false);
    var nsfw = defaultModuleFlags('single_nsfw', true);
    assert.equal(nsfw.nsfw_vagina, true);
    assert.equal(nsfw.nsfw_mouth, true);
    var forced = resolveModuleFlags('single_daily', { nsfw_vagina: true }, false);
    assert.equal(forced.nsfw_vagina, false);
    assert.match(describeEnabledModules(nsfw), /小穴/);
    assert.equal(getPresetById('multi_party').cast, 'multi');
    assert.equal(getPresetById('single_wuxia').cast, 'single');
    assert.equal(getPresetById('multi_apocalypse').cast, 'multi');
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
    assert.match(STATUS_BAR_MVU_DESIGN_PROMPT, /视觉排版：\{\{design\}\}/);
    assert.match(STATUS_BAR_MVU_DESIGN_PROMPT, /配角摘要|完整同套|人人相等/);
    assert.match(STATUS_BAR_MVU_DESIGN_PROMPT, /每一个人|人人/);
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
    var multi = buildPreviewHtml({
      designId: 'multi_frost_blue', castMode: 'multi',
      mainName: '林雾', characters: chars, paths: mPaths,
    });
    assert.match(multi, /fr-panel|fr-card|fr-mini-bars/);
    assert.match(multi, /林雾/);
    assert.doesNotMatch(multi, /配角摘要/);
    assert.match(multi, /data-zb-design="multi_frost_blue"|data-zb-layout="multi_frost_blue"/);

    assert.match(buildPreviewHtml({
      designId: 'multi_snow_glass', castMode: 'multi',
      mainName: '林雾', characters: chars, paths: mPaths,
    }), /sn-panel|sn-card/);
    assert.match(buildPreviewHtml({
      designId: 'multi_scrapbook', castMode: 'multi',
      mainName: '林雾', characters: chars, paths: mPaths,
    }), /scr-stack|scr-note-card|scr-cast-tab/);
    assert.match(buildPreviewHtml({
      designId: 'multi_oz_green', castMode: 'multi',
      mainName: '林雾', characters: chars, paths: mPaths,
    }), /oz-panel|oz-card|oz-fold/);
    assert.match(buildPreviewHtml({
      designId: 'multi_romance_glass', castMode: 'multi',
      mainName: '林雾', characters: chars, paths: mPaths,
    }), /rom-panel|rom-card|rom-drawer|rom-tab/);
    assert.match(buildPreviewHtml({
      designId: 'multi_neon_cyber', castMode: 'multi',
      mainName: '林雾', characters: chars, paths: mPaths,
    }), /crt-bezel|crt-win|crt-grid/);

    // 暮褐群档：信笺叠匣点信封翻页（非 softmon）
    var mh = buildPreviewHtml({
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

    assert.match(buildPreviewHtml({
      designId: 'multi_xianxia_ink', castMode: 'multi',
      mainName: '林雾', characters: chars, paths: mPaths,
    }), /xxs-plaques|xxs-unit|xxs-couplet/);

    // 软监控：仪表盘结构（无「其他角色」精简区）
    var soft = buildPreviewHtml({
      designId: 'soft_monitor', castMode: 'single', mainName: '林雾',
      paths: SAMPLE_PATHS.concat([
        { path: '角色.好感', label: '好感', group: '角色', sample: '40' },
        { path: '角色.行动', label: '行动', group: '角色', sample: '闲聊' },
      ]),
    });
    assert.match(soft, /sm-panel|sm-mini-bars|sm-grid|sm-dial|SYSTEM MONITORING/);
    assert.match(designCss('soft_monitor'), /a8d8ea|81ecec/);

    var softM = buildPreviewHtml({
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
    var mhSolo = buildPreviewHtml({
      designId: 'mahogany_dossier', castMode: 'single',
      mainName: '林雾', paths: SAMPLE_PATHS,
    });
    assert.match(mhSolo, /wax-folio|wax-seal|wax-stamp/);
    assert.doesNotMatch(mhSolo, /其他角色|mh-tabs/);

    // 兼容旧 layoutId / 旧 multi id 入参
    var legacy = buildPreviewHtml({
      layoutId: 'hero_sheet', styleId: 'romance', paths: SAMPLE_PATHS, castMode: 'single',
    });
    assert.match(legacy, /data-zb-design="sheet_attr"|data-zb-layout="sheet_attr"/);
    var legacyMulti = buildPreviewHtml({
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
    var qin = multi.filter(function(p) { return p.role === '秦玥'; });
    var lin = multi.filter(function(p) { return p.role === '林雾'; });
    assert.ok(qin.some(function(p) { return /NPC\.秦玥/.test(p.path); }));
    assert.ok(lin.some(function(p) { return /NPC\.林雾/.test(p.path); }));
    // 信息量相等：同套模块字段数一致
    assert.equal(qin.length, lin.length);
    assert.equal(qin.length, 3); // emotion + affection + action
  });

  it('snippet / 助手脚本 / 正则组装', function() {
    var snip = buildStatusBarSnippet({
      designId: 'form_sections',
      castMode: 'single',
      mode: 'mvu',
      paths: [{ path: '角色.好感度', label: '好感' }],
    });
    assert.match(snip, /data-zb-path="角色\.好感度"/);
    assert.match(snip, /zb-style/);
    assert.match(snip, /data-zb-layout="form_sections"|data-zb-design="form_sections"/);
    var code = buildTavernHelperScript({ snippetHtml: snip, mode: 'mvu' });
    assert.match(code, /VARIABLE_UPDATE_ENDED|CHARACTER_MESSAGE_RENDERED/);
    assert.match(code, /data-zb-path/);
    var rx = buildStatusBarRegex({ snippetHtml: snip });
    assert.equal(rx.scriptName, '[美化]状态栏展示');
    assert.match(rx.findRegex, /StatusBar/);
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
    assert.equal(d.castMode, 'multi');
    assert.equal(d.presetId, 'multi_harem');
    assert.equal(d.designId, 'multi_frost_blue');
    assert.equal(d.layoutId, 'multi_frost_blue');
    assert.equal(d.styleId, 'multi_frost_blue');
    assert.equal(d.mainName, 'A');
    assert.equal(d.femaleOnly, true);
    assert.equal(d.characters[1].selected, false);
    assert.equal(d.paths[0].path, 'a');
    assert.equal(STATUS_BAR_EXT_KEY, 'zmer_statusbar_design');
    assert.equal(STATUS_BAR_SCRIPT_NAME, '[状态栏]前端展示');
    assert.equal(getDesignById('ink_paper').id, 'ink_paper');
    assert.equal(getLayoutById('scifi_console').id, 'scifi_console');
    assert.equal(getStyleById('neon_monitor').id, 'neon_monitor');

    // 单人误选多人方案 → 回落默认（旧 multi id 先 migrate 再校验 cast）
    var bad = normalizeDesign({ castMode: 'single', layoutId: 'multi_pill_sheet' });
    assert.equal(bad.designId, 'sheet_attr');

    // 多人误选单人方案 → 回落
    var badM = normalizeDesign({ castMode: 'multi', layoutId: 'sheet_attr' });
    assert.equal(badM.designId, 'multi_mahogany_dossier');

    var off = normalizeDesign({ femaleOnly: false });
    assert.equal(off.femaleOnly, false);

    // designId 直读
    var direct = normalizeDesign({ castMode: 'single', designId: 'romance_glow' });
    assert.equal(direct.designId, 'romance_glow');
  });
});

describe('statusBar wiring', function() {
  it('侧栏 / index / VALID_VIEWS / 面板 DOM', function() {
    const sidebar = readFileSync(join(root, 'src/components/AppSidebar.astro'), 'utf8');
    assert.match(sidebar, sidebarViewPattern('statusbar'));
    assert.match(sidebar, /状态栏/);
    const mvuIdx = sidebar.search(sidebarViewPattern('mvu'));
    const sbIdx = sidebar.search(sidebarViewPattern('statusbar'));
    assert.ok(sbIdx < mvuIdx, 'statusbar should be above mvu');
    const rxIdx = sidebar.search(sidebarViewPattern('regex'));
    assert.ok(rxIdx > mvuIdx, 'regex should be under mvu');

    const index = readFileSync(join(root, 'src/pages/index.astro'), 'utf8');
    assert.match(index, /StatusBarPanel/);
    assert.match(index, /data-view="statusbar"/);

    const tools = readFileSync(join(root, 'src/lib/assistant/tools.mjs'), 'utf8');
    assert.match(tools, /'statusbar'/);

    const panel = readFileSync(join(root, 'src/components/StatusBarPanel.astro'), 'utf8');
    assert.match(panel, /人数/);
    assert.match(panel, /预设/);
    assert.match(panel, /排版/);
    assert.match(panel, /panel-header statusbar-panel-head/);
    assert.match(panel, /ui-step-pills/);
    assert.match(panel, /人数 → 预设 → 生成/);
    assert.match(panel, /data-sb-step="3"[^>]*>[\s\S]*?生成/);
    assert.match(panel, /data-sb-step="4"[^>]*>[\s\S]*?排版/);
    assert.match(panel, /sbCustomBox/);
    assert.match(panel, /sbBtnCustomGenerate/);
    assert.match(panel, /statusbar_custom_layout/);
    assert.match(panel, /STATUS_BAR_CUSTOM_LAYOUT_PROMPT/);
    assert.match(panel, /CUSTOM_DESIGN_ID/);
    assert.doesNotMatch(panel, /人数 → 预设 → 排版 → 样式 → 生成/);
    assert.doesNotMatch(panel, /data-sb-step="5"/);
    assert.match(panel, /sbLayoutGrid/);
    assert.match(panel, /layoutsForCast/);
    assert.match(panel, /designId|getDesignById/);
    assert.match(panel, /sbBtnGenerate/);
    assert.match(panel, /sbBtnInject/);
    assert.match(panel, /statusbar_generate/);
    assert.match(panel, /statusbar_char_scan/);
    assert.match(panel, /__assistantMvuApi__/);
    assert.match(panel, /__aiTaskCenter__/);
    assert.match(panel, /完整视觉方案|一对一|模块联动/);
    assert.match(panel, /buildPlaceholderPaths/);
    assert.match(panel, /previewPaths/);
    assert.match(panel, /一律按开启模块重绘|previewPaths\(\)/);
    assert.match(panel, /state\.paths = \[\]/);
    assert.match(panel, /defaultDesignId\(state\.castMode\)/);
    assert.doesNotMatch(panel, /配角摘要/);
    assert.match(panel, /sbFemaleOnly/);
    assert.match(panel, /只识别女角色/);
    assert.match(panel, /describeFemaleOnlyRule/);
    // 「只识别女」须为独立 checkbox，不得包进 button（否则无法勾选）
    {
      const multiTool = panel.match(/id="sbMultiBox"[\s\S]*?id="sbCharList"/);
      assert.ok(multiTool, '多人工具行 DOM 缺失');
      const chunk = multiTool[0];
      assert.match(chunk, /id="sbFemaleOnly"/);
      assert.match(chunk, /id="sbBtnScanChars"/);
      assert.match(chunk, /sb-cast-toolbar/);
      assert.doesNotMatch(chunk, /sb-tool-actions/);
      assert.doesNotMatch(chunk, /<button[\s\S]*id="sbFemaleOnly"/);
      assert.doesNotMatch(chunk, /<button[\s\S]*?<\/button>[\s\S]*id="sbFemaleOnly"[\s\S]*?<\/button>/);
      // checkbox 在 label 内，与 AI 按钮为兄弟（同在 cast-toolbar）
      assert.match(chunk, /<label[^>]*for="sbFemaleOnly"[\s\S]*?id="sbFemaleOnly"[\s\S]*?<\/label>[\s\S]*?<button[^>]*id="sbBtnScanChars"/);
    }
    // 工具行布局：flex+gap，无 absolute 盖按钮；覆盖全局 .btn 全宽
    assert.match(panel, /\.sb-cast-toolbar\s*\{[^}]*display:\s*flex/);
    assert.match(panel, /\.sb-cast-toolbar\s*\{[^}]*gap:\s*var\(--space-2\)/);
    assert.match(panel, /\.sb-tool-btn\s*\{[^}]*width:\s*auto\s*!important/);
    assert.match(panel, /\.sb-tool-btn\s*\{[^}]*position:\s*static\s*!important/);
    assert.doesNotMatch(panel, /\.sb-cast-toolbar[^{]*\{[^}]*position:\s*absolute/);
    assert.doesNotMatch(panel, /\.sb-check-inline\s*\{[^}]*z-index:/);
    assert.match(panel, /femaleOnlyEl\.addEventListener\('change'/);
    assert.match(panel, /state\.femaleOnly = !!femaleOnlyEl\.checked/);
    assert.match(panel, /c\.selected = !!inp\.checked/);
    assert.match(panel, /syncMainSelect/);
    assert.match(panel, /sb-layout/);
    assert.match(panel, /grid-template-columns/);
    // 多人人物列表：紧凑网格短卡片（非整行纵向堆叠）
    assert.match(panel, /sb-char-card/);
    assert.match(panel, /minmax\(160px,\s*1fr\)/);
    assert.match(panel, /-webkit-line-clamp:\s*2/);
    assert.doesNotMatch(panel, /sb-char-row/);
    // 左栏排版：固定底栏同行、分段人数、工具行、主题色点短卡
    assert.match(panel, /sb-footer/);
    assert.match(panel, /sb-footer-btn/);
    assert.match(panel, /height:\s*36px/);
    assert.match(panel, /sb-seg/);
    assert.match(panel, /sb-tool-row/);
    assert.match(panel, /sb-tool-btn/);
    assert.match(panel, /sb-layout-dot/);
    assert.match(panel, /--sb-accent/);
    assert.doesNotMatch(panel, /📊/);
    assert.match(panel, /sb-status\.is-ok/);
    // 生成在 step3 工具行；注入在 step4 底栏
    assert.match(panel, /data-sb-stage="3"[\s\S]*?sb-tool-row[\s\S]*?sbBtnGenerate/);
    assert.match(panel, /data-sb-stage="4"[\s\S]*?sb-footer[\s\S]*?sbBtnInject/);
    assert.doesNotMatch(panel, /class="sb-actions"/);
    // 分步互斥：非当前步 hidden；CSS 须覆盖 .sb-stage 的 display:flex，否则会叠在一起
    assert.match(panel, /data-sb-stage="1"/);
    assert.match(panel, /data-sb-stage="2"[^>]*\bhidden\b/);
    assert.match(panel, /data-sb-stage="3"[^>]*\bhidden\b/);
    assert.match(panel, /data-sb-stage="4"[^>]*\bhidden\b/);
    assert.match(panel, /\.sb-stage\[hidden\][\s\S]*display:\s*none\s*!important/);
    assert.match(panel, /el\.hidden\s*=\s*Number\(el\.getAttribute\('data-sb-stage'\)\)\s*!==\s*n/);
    // 每步底栏在 stage 内（body 后），不跨步插在中间
    assert.match(panel, /data-sb-stage="1"[\s\S]*?sb-stage-body[\s\S]*?sb-footer[\s\S]*?sbBtnNext1/);
    assert.match(panel, /data-sb-stage="2"[\s\S]*?sb-stage-body[\s\S]*?sb-footer[\s\S]*?sbBtnNext2/);
  });

  it('MVU 面板已去掉整套生成入口', function() {
    const mvu = readFileSync(join(root, 'src/components/VariableCardPanel.astro'), 'utf8');
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
    assert.match(canon, /配角摘要|完整同套|人人/);
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
      var htmlSfw = buildPreviewHtml({ designId: id, paths: sfwPaths, mainName: '林雾', castMode: 'single' });
      assert.deepEqual(orphanPaths(sfwPaths, htmlSfw).map(function(p) { return p.label; }), [], id + ' SFW orphan');
      var htmlNsfw = buildPreviewHtml({ designId: id, paths: nsfwPaths, mainName: '林雾', castMode: 'single' });
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
      var html = buildPreviewHtml({
        designId: id, paths: multiPaths, mainName: '林雾', castMode: 'multi', characters: chars,
      });
      assert.match(html, /任务/, id + ' quest');
      assert.match(html, /事件/, id + ' event');
      assert.deepEqual(orphanPaths(multiPaths, html).map(function(p) { return p.label; }), [], id + ' multi orphan');
    });

    // softmonLayout 回归（frost）
    var frostHtml = buildPreviewHtml({
      designId: 'frost_blue', paths: sfwPaths, mainName: '林雾', castMode: 'single',
    });
    assert.deepEqual(orphanPaths(sfwPaths, frostHtml).map(function(p) { return p.label; }), [], 'frost_blue SFW');
    var multiFrost = buildPreviewHtml({
      designId: 'multi_frost_blue', paths: multiPaths, mainName: '林雾', castMode: 'multi', characters: chars,
    });
    assert.match(multiFrost, /任务/);
    assert.match(multiFrost, /事件/);
  });

  it('文档同步状态栏一对一主题与女角识别', function() {
    const doc = readFileSync(join(root, 'docs/card-writing-guide.md'), 'utf8');
    assert.match(doc, /只识别女角色/);
    assert.match(doc, /独立 checkbox|不在 AI 按钮内|独立勾选/);
    assert.match(doc, /紧凑网格短卡片|minmax\(160px/);
    assert.match(doc, /固定底栏|分段控件|工具行/);
    assert.match(doc, /亲密度\/好感|信任|关系阶段/);
    assert.match(doc, /口腔|敏感带|高潮\/快感|体液/);
    assert.match(doc, /视觉主题|一对一|完整视觉/);
    assert.match(doc, /排版/);
    assert.match(doc, /配角摘要/);
    assert.match(doc, /人人同套|同信息量/);
    assert.match(doc, /按人数严格过滤|单人只显示单人|人数过滤|按人数过滤/);
    assert.match(doc, /15 美学族|30 套|一主题一文件|暮褐|软监控/);
    assert.match(doc, /结构互异|拍立得|CRT|蜡封|人人同套|其他角色/);
    assert.match(doc, /开启模块重绘|模块.*重绘|即时按开启模块/);
    assert.match(doc, /模块覆盖约定|orphanPaths|worldScopedPaths|无硬/);
    assert.match(doc, /人数.*预设.*生成.*排版|生成.*排版/);
    assert.doesNotMatch(doc, /人数\/预设\/排版\/样式生成/);
    assert.doesNotMatch(doc, /其他角色折叠/);
    const readme = readFileSync(join(root, 'README.md'), 'utf8');
    assert.match(readme, /人数→预设→生成|人数 → 预设 → 生成/);
    assert.match(readme, /自定义排版/);
    assert.match(readme, /15 美学族|30 套|一主题一文件|软监控|一对一视觉主题/);
    assert.match(readme, /人人同套|同信息量|结构互异|其他角色/);
    assert.match(readme, /勾选模块须在预览中可见|无硬截断|全局任务\/事件/);
    assert.match(readme, /固定底栏|分段人数|短卡网格|工具行/);
  });
});
