#!/usr/bin/env python3
"""批次 F：剩余大模块机械拆分（只搬代码）"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def line_idx(lines, pred, start=0):
    for i in range(start, len(lines)):
        if pred(lines[i]):
            return i
    raise ValueError('marker not found')


def wrap_attach(name, imports, body, extra_args=''):
    args = 'ctx, panel' + (', ' + extra_args if extra_args else '')
    return imports + f'''
/**
 * {name}（拆自原模块）
 */
export function {name}({args}) {{
{body}
}}
'''


def split_analyze():
    path = ROOT / 'src/lib/novel/panels/analyze.mjs'
    src = path.read_text(encoding='utf-8')
    lines = src.splitlines(keepends=True)

    reg = line_idx(lines, lambda l: l.startswith('export function registerAnalyze'))
    shared = ''.join(lines[:reg])
    bind = line_idx(lines, lambda l: l.strip() == 'panel.bind = function() {')
    bind_graph = line_idx(lines, lambda l: l.strip() == 'panel.bindGraphControls = function() {')
    run = line_idx(lines, lambda l: l.strip() == 'panel.runBuildRagIndex = async function(opts) {')
    end = line_idx(lines, lambda l: l.strip() == 'ctx.panels.analyze = panel;')

    shared_path = ROOT / 'src/lib/novel/panels/analyzeShared.mjs'
    shared_path.write_text(shared + '\nexport { novelCanonBlock, vesselOptsFromState, ENTITY_TYPE_ZH };\n', encoding='utf-8')

    render_body = ''.join(lines[reg + 3:bind])
    bind_body = ''.join(lines[bind:run])
    run_body = ''.join(lines[run:end])

    render_mod = wrap_attach(
        'attachNovelAnalyzeRender',
        "import { getPipelineGates, WB_FOCUS_OPTIONS } from '../state.mjs';\n"
        "import { buildExtractShards, estimateExtractCalls, chaptersSourceFingerprint } from '../chapters.mjs';\n"
        "import { emptyKnowledgeGraph } from '../graphMerge.mjs';\n"
        "import { mountOrUpdateGraph, relayoutGraph } from '../graphViz.mjs';\n"
        "import { countEntitiesByType, isEntityEnriched, ENTITY_TYPES, projectEntitiesToLegacy } from '../entityStore.mjs';\n"
        "import { getAdultMode } from '../nsfwSupport.mjs';\n"
        "import { escapeHtml } from '../../utils.mjs';\n"
        "import { ENTITY_TYPE_ZH } from './analyzeShared.mjs';\n",
        render_body,
        'graphRef',
    )

    bind_mod = wrap_attach(
        'attachNovelAnalyzeBind',
        "import { projectEntitiesToLegacy } from '../entityStore.mjs';\n"
        "import { relayoutGraph } from '../graphViz.mjs';\n"
        "import {\n"
        "  buildStatusBarNsfwDraftFromEntities, buildStatusBarNtlDraftFromEntities,\n"
        "  buildStatusBarVesselDraftFromEntities, resolveWorldframe,\n"
        "} from '../nsfwSupport.mjs';\n",
        bind_body,
        'graphRef',
    )

    run_imports = (
        "import { buildExtractShards, estimateExtractCalls, chaptersSourceFingerprint } from '../chapters.mjs';\n"
        "import { emptyKnowledgeGraph } from '../graphMerge.mjs';\n"
        "import { mountOrUpdateGraph } from '../graphViz.mjs';\n"
        "import {\n"
        "  countEntitiesByType, isEntityEnriched, ENTITY_TYPES, projectEntitiesToLegacy,\n"
        "  findEntityMatch, upsertEntity, ingestLegacyIntoEntities,\n"
        "} from '../entityStore.mjs';\n"
        "import {\n"
        "  applySkeletonResult, applyEnrichResult, listEntitiesNeedingEnrich, buildSkeletonPriorBlock,\n"
        "} from '../analyzePipeline.mjs';\n"
        "import { buildNovelRagIndex } from '../rag/indexBuild.mjs';\n"
        "import { hybridSearch } from '../rag/hybridSearch.mjs';\n"
        "import { buildRagInjectBlock, pickRelatedEntities } from '../rag/inject.mjs';\n"
        "import { getEmbeddingConfig, EMBEDDING_API_URL_KEY, EMBEDDING_API_KEY_KEY, EMBEDDING_MODEL_KEY } from '../rag/embeddingConfig.mjs';\n"
        "import {\n"
        "  getAdultMode, getNtlMode, boostAdultSearchQuery, extractStyleNsfwSection,\n"
        "  buildModeHintBlocks, buildContentModeFlags, buildNsfwFlavorHint, buildNtlTabooHint,\n"
        "  buildPaletteGuidanceBlock, getNsfwFlavorItems, evaluateFlavorRichness,\n"
        "  buildFlavorExpandSystemPrompt, buildFlavorExpandUserPrompt, NSFW_FLAVOR_PRESETS,\n"
        "  NTL_TABOO_TYPES, getNtlTabooTypes, evaluateNtlRichness, buildNtlExpandSystemPrompt,\n"
        "  buildNtlExpandUserPrompt, buildAdultCanonDigest, ADULT_CANON_BUDGET,\n"
        "  buildStatusBarNsfwDraftFromEntities, buildStatusBarVesselDraftFromEntities,\n"
        "  resolveWorldframe, evaluateVesselRichness, buildVesselExpandSystemPrompt,\n"
        "  buildVesselExpandUserPrompt, buildVesselHintForState, listVesselEntities, personMentionsVessels,\n"
        "} from '../nsfwSupport.mjs';\n"
        "import { RAG_ENTITY_BUDGET } from '../contextBudgets.mjs';\n"
        "import { parseJsonLoose } from '../../utils.mjs';\n"
        "import { novelCanonBlock, vesselOptsFromState, ENTITY_TYPE_ZH } from './analyzeShared.mjs';\n"
    )
    run_mod = wrap_attach('attachNovelAnalyzeRun', run_imports, run_body)

    register = '''/**
 * 小说分析面板：分片配置、RAG、骨架、丰满、关系、图谱
 */
import { attachNovelAnalyzeRender } from './analyzeRender.mjs';
import { attachNovelAnalyzeBind } from './analyzeBind.mjs';
import { attachNovelAnalyzeRun } from './analyzeRun.mjs';

export { novelCanonBlock, vesselOptsFromState, ENTITY_TYPE_ZH } from './analyzeShared.mjs';

export function registerAnalyze(ctx) {
  var panel = {};
  var graphRef = { cy: null };
  attachNovelAnalyzeRender(ctx, panel, graphRef);
  attachNovelAnalyzeBind(ctx, panel, graphRef);
  attachNovelAnalyzeRun(ctx, panel);
  ctx.panels.analyze = panel;
}
'''
    (ROOT / 'src/lib/novel/panels/analyzeRender.mjs').write_text(
        render_mod.replace('graphCy', 'graphRef.cy').replace('graphCy =', 'graphRef.cy ='),
        encoding='utf-8',
    )
    (ROOT / 'src/lib/novel/panels/analyzeBind.mjs').write_text(
        bind_mod.replace('relayoutGraph(graphCy)', 'relayoutGraph(graphRef.cy)').replace('graphCy,', 'graphRef.cy,'),
        encoding='utf-8',
    )
    (ROOT / 'src/lib/novel/panels/analyzeRun.mjs').write_text(run_mod, encoding='utf-8')
    path.write_text(register, encoding='utf-8')


def split_characters():
    path = ROOT / 'src/lib/novel/panels/characters.mjs'
    src = path.read_text(encoding='utf-8')
    lines = src.splitlines(keepends=True)

    reg = line_idx(lines, lambda l: l.startswith('export function registerCharacters'))
    expand = line_idx(lines, lambda l: l.strip().startswith('panel.expand = async function'))
    scan = line_idx(lines, lambda l: 'formatPriorCharScanRef' in l and l.strip().startswith('function'))
    end = line_idx(lines, lambda l: l.strip() == 'ctx.panels.characters = panel;')

    head = ''.join(lines[:reg])
    render_body = ''.join(lines[reg + 3:expand])
    expand_body = ''.join(lines[expand:scan])
    scan_body = ''.join(lines[scan:end])

    render_mod = wrap_attach(
        'attachNovelCharactersRender',
        head.replace('export function registerCharacters(ctx) {\n  var panel = {};\n\n', ''),
        render_body,
    )
    expand_mod = wrap_attach(
        'attachNovelCharactersExpand',
        head.split('export function registerCharacters')[0],
        expand_body,
    )
    scan_mod = wrap_attach(
        'attachNovelCharactersScanBind',
        head.split('export function registerCharacters')[0],
        scan_body,
    )

    register = head.split('export function registerCharacters')[0]
    register += '''import { attachNovelCharactersRender } from './charactersRender.mjs';
import { attachNovelCharactersExpand } from './charactersExpand.mjs';
import { attachNovelCharactersScanBind } from './charactersScanBind.mjs';

export function registerCharacters(ctx) {
  var panel = {};
  attachNovelCharactersRender(ctx, panel);
  attachNovelCharactersExpand(ctx, panel);
  attachNovelCharactersScanBind(ctx, panel);
  ctx.panels.characters = panel;
}
'''
    (ROOT / 'src/lib/novel/panels/charactersRender.mjs').write_text(render_mod, encoding='utf-8')
    (ROOT / 'src/lib/novel/panels/charactersExpand.mjs').write_text(expand_mod, encoding='utf-8')
    (ROOT / 'src/lib/novel/panels/charactersScanBind.mjs').write_text(scan_mod, encoding='utf-8')
    path.write_text(register, encoding='utf-8')


def split_admin():
    path = ROOT / 'src/lib/admin/browserApp.mjs'
    src = path.read_text(encoding='utf-8')
    lines = src.splitlines(keepends=True)

    show_view = line_idx(lines, lambda l: l.startswith('function showView'))
    boot_start = line_idx(lines, lambda l: l.startswith('async function doLogoutAndReload'))

    shared = ''.join(lines[:show_view])
    views = ''.join(lines[show_view:boot_start])
    boot = ''.join(lines[boot_start:])

    shared_path = ROOT / 'src/lib/admin/adminShared.mjs'
    shared_path.write_text(
        shared + '\nexport { state, api, $, escapeHtml, fmtBytes, fmtTime, setBanner, setStatus, isOps, card, flag, bannerForError, pagerHtml };\n',
        encoding='utf-8',
    )

    views_mod = '''/**
 * 管理端：视图切换与数据加载（拆自 browserApp）
 */
import {
  state, api, $, escapeHtml, fmtBytes, fmtTime, setBanner, setStatus, isOps, card, flag, bannerForError, pagerHtml,
} from './adminShared.mjs';

''' + views + '\nexport { showView, loadDashboard, loadUsers, loadShares, loadTokens, loadDatabases, loadAudit, loadSystem };\n'

    boot_mod = '''/**
 * 管理端：登录门禁 / 事件 / boot（拆自 browserApp）
 */
import { apiFetch, getPublicAppUrl } from '../publicConfig.mjs';
import {
  state, api, $, escapeHtml, setBanner, setStatus, isOps,
} from './adminShared.mjs';
import { showView } from './adminViews.mjs';

''' + boot

    thin = '''/**
 * 管理端客户端：仪表盘 / 用户 / 分享 / Token / Couch / 审计 / 系统
 */
import { bootAdminApp } from './adminBoot.mjs';

bootAdminApp();
'''
    boot_mod = boot_mod.replace('async function boot()', 'export async function bootAdminApp()')
    boot_mod = boot_mod.replace('\nboot();\n', '\n')

    (ROOT / 'src/lib/admin/adminViews.mjs').write_text(views_mod, encoding='utf-8')
    (ROOT / 'src/lib/admin/adminBoot.mjs').write_text(boot_mod, encoding='utf-8')
    path.write_text(thin, encoding='utf-8')


def split_status_bar():
    path = ROOT / 'src/lib/statusBar.mjs'
    src = path.read_text(encoding='utf-8')
    lines = src.splitlines(keepends=True)
    split = line_idx(lines, lambda l: l.startswith('export function pathsFromMvuDesign'))

    catalog = ''.join(lines[:split])
    build = ''.join(lines[split:])

    catalog_path = ROOT / 'src/lib/statusBarCatalog.mjs'
    catalog_path.write_text(catalog, encoding='utf-8')
    (ROOT / 'src/lib/statusBarBuild.mjs').write_text(
        '/** 状态栏：路径解析 / 预览 / 脚本拼装（拆自 statusBar） */\n' + build,
        encoding='utf-8',
    )

    barrel = '''/**
 * 状态栏设计：人数/预设模块/一对一视觉主题、预览 HTML、注入脚本与变量设计辅助
 */
export * from './statusBarCatalog.mjs';
export * from './statusBarBuild.mjs';
'''
    path.write_text(barrel, encoding='utf-8')


def split_executor():
    path = ROOT / 'src/lib/assistant/executor.mjs'
    src = path.read_text(encoding='utf-8')
    lines = src.splitlines(keepends=True)
    create = line_idx(lines, lambda l: l.startswith('export function createToolExecutor'))
    exec_fn = line_idx(lines, lambda l: l.strip() == 'async function executeConfirmed(toolName, args, execOpts) {')

    head = ''.join(lines[:create])
    helpers_body = ''.join(lines[create + 1:exec_fn])
    exec_body = ''.join(lines[exec_fn:-1])  # drop closing brace of createToolExecutor

    resolve_mod = head + '\n'
    helpers_mod = '''/**
 * 助手工具执行器 helpers（拆自 executor）
 */
import { getToolByName, VALID_VIEWS } from './tools.mjs';
import { classifyToolRisk, buildChangePreview } from './risk.mjs';
import {
  CHARACTER_CANONICAL_KEYS,
  normalizeCharacterFieldKey,
  normalizeCharacterPatch,
} from './characterFields.mjs';
import { resolveWorldbookIndex } from './executorResolve.mjs';

export function attachExecutorHelpers(bridge, snaps, bag) {
''' + helpers_body + '}\n'

    exec_mod = '''/**
 * 助手工具执行器 execute / invoke（拆自 executor）
 */
import { getToolByName } from './tools.mjs';
import { classifyToolRisk, buildChangePreview } from './risk.mjs';
import { resolveWorldbookIndex } from './executorResolve.mjs';

export function attachExecutorExecute(bridge, snaps, bag) {
''' + exec_body + '''
  bag.invoke = invoke;
  bag.executeConfirmed = executeConfirmed;
}
'''

    resolve_path = ROOT / 'src/lib/assistant/executorResolve.mjs'
    resolve_path.write_text(resolve_mod, encoding='utf-8')

    barrel = '''/**
 * 助手工具执行器：依赖 bridge 读写卡片状态，纯逻辑可单测
 */
export { normalizeTarget, resolveWorldbookIndex } from './executorResolve.mjs';
import { attachExecutorHelpers } from './executorHelpers.mjs';
import { attachExecutorExecute } from './executorExecute.mjs';

export function createToolExecutor(bridge, snapApi) {
  var snaps = snapApi || {};
  var bag = {};
  attachExecutorHelpers(bridge, snaps, bag);
  attachExecutorExecute(bridge, snaps, bag);
  return {
    invoke: bag.invoke,
    executeConfirmed: bag.executeConfirmed,
    classify: classifyToolRisk,
    resolveWorldbookIndex: resolveWorldbookIndex,
    normalizeTarget: bag.normalizeTarget || undefined,
  };
}
'''
    # Fix helpers to assign to bag
    helpers_mod = helpers_mod.replace('  function ok(', '  bag.ok = function ok(')
    helpers_mod = helpers_mod.replace('  function fail(', '  bag.fail = function fail(')
    helpers_mod = helpers_mod.replace('  function findWbIndex(', '  bag.findWbIndex = function findWbIndex(')
    helpers_mod = helpers_mod.replace('  function searchCard(', '  bag.searchCard = function searchCard(')
    helpers_mod = helpers_mod.replace('  function analyzeChatLocal(', '  bag.analyzeChatLocal = function analyzeChatLocal(')
    helpers_mod = helpers_mod.replace('  function buildLintFixOps(', '  bag.buildLintFixOps = function buildLintFixOps(')

    exec_mod = exec_mod.replace('ok(', 'bag.ok(').replace('fail(', 'bag.fail(').replace('findWbIndex(', 'bag.findWbIndex(')
    exec_mod = exec_mod.replace('searchCard(', 'bag.searchCard(').replace('analyzeChatLocal(', 'bag.analyzeChatLocal(')
    exec_mod = exec_mod.replace('buildLintFixOps(', 'bag.buildLintFixOps(')

    # restore function declarations that got wrongly replaced
    exec_mod = exec_mod.replace('async bag.ok(', 'async function executeConfirmed(')
    exec_mod = exec_mod.replace('async bag.fail(', 'async function invoke(')

    # Better approach: manual fix after - the replace is too naive. Let me rewrite executor split more carefully below.
    path.write_text(src, encoding='utf-8')  # restore, will redo manually


def split_bridge():
    path = ROOT / 'src/lib/novel/shared/bridge.mjs'
    src = path.read_text(encoding='utf-8')
    lines = src.splitlines(keepends=True)
    create = line_idx(lines, lambda l: l.startswith('export function createBridge'))
    fields = ''.join(lines[:create])
    body = ''.join(lines[create:])

    fields_path = ROOT / 'src/lib/novel/shared/bridgeFields.mjs'
    fields_path.write_text(fields.rstrip() + '\n', encoding='utf-8')

    create_mod = body  # already starts with export function createBridge
    (ROOT / 'src/lib/novel/shared/bridgeCreate.mjs').write_text(
        '/** 小说工坊助手 bridge 工厂（拆自 bridge） */\n' + create_mod,
        encoding='utf-8',
    )

    barrel = fields.split('export function setCharacterFields')[0]
    barrel += "export {\n"
    barrel += "  setCharacterFields, setGreetingFields, applyRagOptionsFromUi, syncRagOptionsToAiPanel,\n"
    barrel += "} from './bridgeFields.mjs';\n"
    barrel += "export { syncOutputs } from './bridgeSyncOutputs.mjs';\n"
    barrel += "export { createBridge } from './bridgeCreate.mjs';\n"
    path.write_text(barrel, encoding='utf-8')


def split_executor_v2():
    """Split executor: resolve helpers | helpers+lint | execute+invoke"""
    path = ROOT / 'src/lib/assistant/executor.mjs'
    src = path.read_text(encoding='utf-8')
    lines = src.splitlines(keepends=True)
    create = line_idx(lines, lambda l: l.startswith('export function createToolExecutor'))
    exec_fn = line_idx(lines, lambda l: l.strip() == 'async function executeConfirmed(toolName, args, execOpts) {')
    invoke_fn = line_idx(lines, lambda l: l.strip() == 'async function invoke(toolName, args, options) {')
    ret_fn = line_idx(lines, lambda l: l.strip() == 'return {')

    resolve = ''.join(lines[:create])
    (ROOT / 'src/lib/assistant/executorResolve.mjs').write_text(resolve, encoding='utf-8')

    inner_helpers = ''.join(lines[create + 1:exec_fn])
    inner_exec = ''.join(lines[exec_fn:ret_fn])
    inner_ret = ''.join(lines[ret_fn:])

    helpers_mod = '''/**
 * 助手工具执行器 helpers（拆自 executor）
 */
import { VALID_VIEWS } from './tools.mjs';
import { resolveWorldbookIndex } from './executorResolve.mjs';

export function createExecutorHelpers(bridge, snaps) {
''' + inner_helpers + '}\n'

    exec_mod = '''/**
 * 助手工具 executeConfirmed / invoke（拆自 executor）
 */
import { getToolByName } from './tools.mjs';
import { classifyToolRisk, buildChangePreview } from './risk.mjs';
import { resolveWorldbookIndex } from './executorResolve.mjs';

export function createExecutorExecute(bridge, snaps, helpers) {
  var ok = helpers.ok;
  var fail = helpers.fail;
  var findWbIndex = helpers.findWbIndex;
  var searchCard = helpers.searchCard;
  var analyzeChatLocal = helpers.analyzeChatLocal;
  var buildLintFixOps = helpers.buildLintFixOps;
''' + inner_exec + inner_ret + '}\n'

    (ROOT / 'src/lib/assistant/executorHelpers.mjs').write_text(helpers_mod, encoding='utf-8')
    (ROOT / 'src/lib/assistant/executorExecute.mjs').write_text(exec_mod, encoding='utf-8')

    barrel = '''/**
 * 助手工具执行器：依赖 bridge 读写卡片状态，纯逻辑可单测
 */
export { normalizeTarget, resolveWorldbookIndex } from './executorResolve.mjs';
import { createExecutorHelpers } from './executorHelpers.mjs';
import { createExecutorExecute } from './executorExecute.mjs';

export function createToolExecutor(bridge, snapApi) {
  var snaps = snapApi || {};
  var helpers = createExecutorHelpers(bridge, snaps);
  return createExecutorExecute(bridge, snaps, helpers);
}
'''
    path.write_text(barrel, encoding='utf-8')


if __name__ == '__main__':
    split_analyze()
    split_characters()
    split_admin()
    split_status_bar()
    split_bridge()
    split_executor_v2()
    print('batch F splits done')
