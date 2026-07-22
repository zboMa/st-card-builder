#!/usr/bin/env python3
"""批次 E：剩余大模块机械拆分（只搬代码）"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def wrap_attach(name, imports, body, panel_arg='panel'):
    return imports + f'''
/**
 * {name}（拆自原模块）
 */
export function {name}(ctx, {panel_arg}) {{
{body}
}}
'''


def split_novel_worldbook():
    src = (ROOT / 'src/lib/novel/panels/worldbook.mjs').read_text(encoding='utf-8')
    lines = src.splitlines(keepends=True)

    util_end = next(i for i, l in enumerate(lines) if l.startswith('export function registerWorldbook'))
    util = ''.join(lines[:util_end])

    reg_start = util_end
    bind_marker = next(i for i, l in enumerate(lines) if l.strip() == '// ---- 事件绑定 ----')
    ai_marker = next(i for i, l in enumerate(lines) if l.strip() == '// ---- AI 扩展 ----')

    render_body = ''.join(lines[reg_start + 3:bind_marker])  # skip register + panel + blank
    bind_body = ''.join(lines[bind_marker:ai_marker])
    ai_body = ''.join(lines[ai_marker:-2])  # drop closing ctx.panels assign

    render_mod = wrap_attach(
        'attachNovelWorldbookRender',
        "import { WB_FOCUS_OPTIONS } from '../state.mjs';\n"
        "import { strategyLabelZh } from '../../utils.mjs';\n"
        "import { escapeHtml, truncatePreviewLine, parseJsonLoose, normalizeNameList } from '../../utils.mjs';\n"
        "import { findEntityMatch, upsertEntity, projectEntitiesToLegacy } from '../entityStore.mjs';\n"
        "import { applyDraftsToWorldbook } from '../sync.mjs';\n",
        render_body + bind_body,
    )

    ai_imports = (
        "import { buildExtractShards, estimateExtractCalls } from '../chapters.mjs';\n"
        "import { buildRecallPayload, DEFAULT_EXPAND_BUDGET } from '../recall.mjs';\n"
        "import { findEntityMatch, upsertEntity, projectEntitiesToLegacy, isEntityEnriched, ingestLegacyIntoEntities } from '../entityStore.mjs';\n"
        "import { applyDraftsToWorldbook } from '../sync.mjs';\n"
        "import { mergeWbExtractEntry, normalizeNameList } from './worldbookExtractUtil.mjs';\n"
        "import { parseJsonLoose } from '../../utils.mjs';\n"
        "import {\n"
        "  getAdultMode, getNtlMode, buildModeHintBlocks, buildContentModeFlags,\n"
        "  buildNsfwFlavorHint, getNsfwFlavorItems, evaluateFlavorRichness,\n"
        "  buildFlavorExpandSystemPrompt, buildFlavorExpandUserPrompt, NSFW_FLAVOR_PRESETS,\n"
        "  getNtlTabooTypes, buildNtlTabooHint, evaluateNtlRichness,\n"
        "  buildNtlExpandSystemPrompt, buildNtlExpandUserPrompt,\n"
        "  buildAdultCanonDigest, ADULT_CANON_BUDGET, resolveWorldframe,\n"
        "  evaluateVesselRichness, buildVesselExpandSystemPrompt, buildVesselExpandUserPrompt,\n"
        "  buildVesselHintForState,\n"
        "} from '../nsfwSupport.mjs';\n"
        "import { PRIOR_WB_EXTRACT_PER, RAG_ENTITY_BUDGET, ENTITY_SUMMARY_STORE } from '../contextBudgets.mjs';\n"
        "import { formatPriorWbExtractRef } from './worldbookExtractUtil.mjs';\n"
    )
    ai_mod = wrap_attach('attachNovelWorldbookAi', ai_imports, ai_body)

    util_path = ROOT / 'src/lib/novel/panels/worldbookExtractUtil.mjs'
    util_path.write_text(util, encoding='utf-8')

    register = util.split('export function registerWorldbook')[0]
    register += '''import { attachNovelWorldbookRender } from './worldbookRender.mjs';
import { attachNovelWorldbookAi } from './worldbookAi.mjs';

export { normalizeNameList, formatPriorWbExtractRef, mergeWbExtractEntry } from './worldbookExtractUtil.mjs';

export function registerWorldbook(ctx) {
  var panel = {};
  attachNovelWorldbookRender(ctx, panel);
  attachNovelWorldbookAi(ctx, panel);
  ctx.panels.worldbook = panel;
}
'''
    (ROOT / 'src/lib/novel/panels/worldbookRender.mjs').write_text(render_mod, encoding='utf-8')
    (ROOT / 'src/lib/novel/panels/worldbookAi.mjs').write_text(ai_mod, encoding='utf-8')
    (ROOT / 'src/lib/novel/panels/worldbook.mjs').write_text(register, encoding='utf-8')


def split_bridge():
    src = (ROOT / 'src/lib/novel/shared/bridge.mjs').read_text(encoding='utf-8')
    lines = src.splitlines(keepends=True)
    sync_start = next(i for i, l in enumerate(lines) if l.startswith('export function syncOutputs'))
    sync_end = next(i for i, l in enumerate(lines) if l.startswith('export function createBridge'))
    sync_body = ''.join(lines[sync_start:sync_end])
    head = ''.join(lines[:sync_start])

    sync_file = head + sync_body
    sync_file = sync_file.replace(
        'export function syncOutputs',
        '/** 小说工坊 → 主卡同步（拆自 bridge） */\nexport function syncOutputs',
    )
    (ROOT / 'src/lib/novel/shared/bridgeSyncOutputs.mjs').write_text(sync_file, encoding='utf-8')

    bridge_new = head.split('export function syncOutputs')[0]
    bridge_new += "export { syncOutputs } from './bridgeSyncOutputs.mjs';\n\n"
    bridge_new += ''.join(lines[sync_end:])
    (ROOT / 'src/lib/novel/shared/bridge.mjs').write_text(bridge_new, encoding='utf-8')


def split_card_field_validation():
    src = (ROOT / 'src/lib/card-builder/browserApp.mjs').read_text(encoding='utf-8')
    lines = src.splitlines(keepends=True)
    start = next(i for i, l in enumerate(lines) if l.startswith('var FIELD_DICT'))
    end = next(i for i, l in enumerate(lines) if l.startswith('export function bootCardBuilder'))
    chunk = ''.join(lines[start:end])
    mod = '''/**
 * 制卡字段字典与 JSON 校验（拆自 browserApp）
 */
''' + chunk + '\nexport { FIELD_DICT, getFieldInfo, validateField, validateFullJSON, countNovelUnsynced };\n'
    (ROOT / 'src/lib/card-builder/fieldValidation.mjs').write_text(mod, encoding='utf-8')

    new_boot = ''.join(lines[:start])
    new_boot += "import { getFieldInfo, validateFullJSON, countNovelUnsynced } from './fieldValidation.mjs';\n"
    new_boot += "import { attachBootAiConfig } from './bootAiConfig.mjs';\n"
    new_boot += ''.join(lines[end:])

    # Extract AI config block from bootCardBuilder
    boot_lines = new_boot.splitlines(keepends=True)
    ai_start = next(i for i, l in enumerate(boot_lines) if '  var AI_KEY = ' in l)
    ai_end = next(i for i, l in enumerate(boot_lines) if l.strip() == 'window.__persistAiConfig__ = saveAIConfig;') + 1
    ai_chunk = ''.join(boot_lines[ai_start:ai_end])
    ai_mod = '''/**
 * 制卡 boot：AI 配置持久化与 window 桥（拆自 browserApp）
 */
import { escapeHtml } from '../utils.mjs';
import { buildExportChecklist } from './exportChecklist.mjs';

export function attachBootAiConfig(ctx) {
''' + ai_chunk + '''
  return { saveAIConfig: saveAIConfig, loadAIConfig: loadAIConfig };
}
'''
    (ROOT / 'src/lib/card-builder/bootAiConfig.mjs').write_text(ai_mod, encoding='utf-8')

    # Replace AI block with attachBootAiConfig call
    before = ''.join(boot_lines[:ai_start])
    after_part = ''.join(boot_lines[ai_end:])
    # find loadAIConfig() call and assistant bridges still in after_part
    insert = '''  var bootAi = attachBootAiConfig(ctx);
  var saveAIConfig = bootAi.saveAIConfig;
  var loadAIConfig = bootAi.loadAIConfig;

'''
    # Remove duplicate window bridges if still in after - ai_end was only through __persistAiConfig__
    # Need to extend ai_end to include all window bridges until __assistantCardApi__
    full_src = (ROOT / 'src/lib/card-builder/browserApp.mjs').read_text(encoding='utf-8')
    full_lines = full_src.splitlines(keepends=True)
    ai_start2 = next(i for i, l in enumerate(full_lines) if '  var AI_KEY = ' in l)
    ai_end2 = next(i for i, l in enumerate(full_lines) if '  window.__assistantCardApi__' in l)
    ai_full = ''.join(full_lines[ai_start2:ai_end2])
    ai_mod2 = '''/**
 * 制卡 boot：AI 配置持久化与 window 桥（拆自 browserApp）
 */
import { escapeHtml } from '../utils.mjs';
import { buildExportChecklist } from './exportChecklist.mjs';
import { countNovelUnsynced } from './fieldValidation.mjs';

export function attachBootAiConfig(ctx) {
''' + ai_full + '''
  return { saveAIConfig: saveAIConfig, loadAIConfig: loadAIConfig };
}
'''
    (ROOT / 'src/lib/card-builder/bootAiConfig.mjs').write_text(ai_mod2, encoding='utf-8')

    boot_start = next(i for i, l in enumerate(full_lines) if l.startswith('export function bootCardBuilder'))
    boot_end = next(i for i, l in enumerate(full_lines) if l.startswith('export function initCardBuilder'))
    boot_head = ''.join(full_lines[boot_start:ai_start2])
    boot_tail = ''.join(full_lines[ai_end2:boot_end])
    boot_new = ''.join(full_lines[:boot_start])
    boot_new += "import { getFieldInfo, validateFullJSON } from './fieldValidation.mjs';\n"
    boot_new += "import { attachBootAiConfig } from './bootAiConfig.mjs';\n"
    boot_new += boot_head
    boot_new += '''  var bootAi = attachBootAiConfig(ctx);
  var loadAIConfig = bootAi.loadAIConfig;

'''
    boot_new += boot_tail
    boot_new += ''.join(full_lines[boot_end:])
    (ROOT / 'src/lib/card-builder/browserApp.mjs').write_text(boot_new, encoding='utf-8')


def split_novel_boot_setup():
    src = (ROOT / 'src/lib/novel/browserApp.mjs').read_text(encoding='utf-8')
    lines = src.splitlines(keepends=True)
    setup_start = next(i for i, l in enumerate(lines) if '  // ===== 角色设定 / 开场白' in l)
    setup_end = next(i for i, l in enumerate(lines) if '  // ===== 全局 renderAll' in l)
    setup_body = ''.join(lines[setup_start + 1:setup_end])

    events_start = next(i for i, l in enumerate(lines) if '  // ===== 事件绑定 =====' in l)
    events_end = next(i for i, l in enumerate(lines) if '  // ===== 助手桥接 =====' in l)
    events_body = ''.join(lines[events_start + 1:events_end])

    setup_mod = '''/**
 * 小说工坊：角色设定 / 开场白生成（拆自 browserApp）
 */
export function attachNovelBootSetup(ctx, deps) {
  var state = deps.state;
  var sm = deps.sm;
  var $ = deps.$;
  var gates = deps.gates;
  var setStatus = deps.setStatus;
  var isAiConfigured = deps.isAiConfigured;
  var getApiConfig = deps.getApiConfig;
  var renderGates = deps.renderGates;
  var promptText = deps.promptText;
  var callAI = deps.callAI;
  var runTracked = deps.runTracked;
  var isTrackedAbort = deps.isTrackedAbort;
  var bridgeSetCharFields = deps.bridgeSetCharFields;
''' + setup_body + '''
  return {
    fillPersonEntityPick: fillPersonEntityPick,
    renderCharacterSetup: renderCharacterSetup,
    renderGreetingsGen: renderGreetingsGen,
    runGenerateCharSetup: runGenerateCharSetup,
    runGenerateGreetings: runGenerateGreetings,
    bindCharacterSetup: bindCharacterSetup,
    bindGreetingsGen: bindGreetingsGen,
  };
}
'''
    (ROOT / 'src/lib/novel/bootSetupGreetings.mjs').write_text(setup_mod, encoding='utf-8')

    events_mod = '''/**
 * 小说工坊：角色设定/开场白事件绑定（拆自 browserApp）
 */
export function attachNovelBootEvents(deps) {
  var bindCharacterSetup = deps.bindCharacterSetup;
  var bindGreetingsGen = deps.bindGreetingsGen;
''' + events_body + '''
}
'''
    (ROOT / 'src/lib/novel/bootEvents.mjs').write_text(events_mod, encoding='utf-8')

    new_lines = lines[:setup_start]
    new_lines.append("  var setupBoot = attachNovelBootSetup(ctx, {\n")
    new_lines.append("    state: state, sm: sm, $: $, gates: gates, setStatus: setStatus,\n")
    new_lines.append("    isAiConfigured: isAiConfigured, getApiConfig: getApiConfig,\n")
    new_lines.append("    renderGates: renderGates, promptText: promptText, callAI: callAI,\n")
    new_lines.append("    runTracked: runTracked, isTrackedAbort: isTrackedAbort,\n")
    new_lines.append("    bridgeSetCharFields: bridgeSetCharFields,\n")
    new_lines.append("  });\n")
    new_lines.append("  var fillPersonEntityPick = setupBoot.fillPersonEntityPick;\n")
    new_lines.append("  var renderCharacterSetup = setupBoot.renderCharacterSetup;\n")
    new_lines.append("  var renderGreetingsGen = setupBoot.renderGreetingsGen;\n")
    new_lines.append("  var runGenerateCharSetup = setupBoot.runGenerateCharSetup;\n")
    new_lines.append("  var runGenerateGreetings = setupBoot.runGenerateGreetings;\n")
    new_lines.append("  ctx._runGenerateCharSetup = runGenerateCharSetup;\n")
    new_lines.append("  ctx._runGenerateGreetings = runGenerateGreetings;\n\n")
    new_lines.extend(lines[setup_end:events_start])
    # wire renderAll to use setupBoot functions - already in lines[setup_end:events_start]
    new_lines.append("  attachNovelBootEvents({\n")
    new_lines.append("    bindCharacterSetup: setupBoot.bindCharacterSetup,\n")
    new_lines.append("    bindGreetingsGen: setupBoot.bindGreetingsGen,\n")
    new_lines.append("  });\n\n")
    new_lines.extend(lines[events_end:])

    head = ''.join(lines[:147])
    if 'attachNovelBootSetup' not in head:
        head = head.replace(
            "import { createBridge, setCharacterFields as bridgeSetCharFields, syncOutputs as bridgeSyncOutputs } from './shared/bridge.mjs';\n",
            "import { createBridge, setCharacterFields as bridgeSetCharFields, syncOutputs as bridgeSyncOutputs } from './shared/bridge.mjs';\n"
            "import { attachNovelBootSetup } from './bootSetupGreetings.mjs';\n"
            "import { attachNovelBootEvents } from './bootEvents.mjs';\n",
        )
    out = head.split('export function initNovelWorkshop')[0]
    out += 'export function initNovelWorkshop() {\n'
    out += ''.join(new_lines[147:])
    (ROOT / 'src/lib/novel/browserApp.mjs').write_text(out, encoding='utf-8')


def split_panel_by_bind(src_path, attach_render_name, attach_ai_name, register_name):
    """Generic: split registerWorldbook-style panel at bind and AI markers."""
    pass


if __name__ == '__main__':
    split_novel_worldbook()
    split_bridge()
    split_card_field_validation()
    try:
        split_novel_boot_setup()
    except Exception as e:
        print('novel boot setup skipped:', e)
    print('batch E splits done')
