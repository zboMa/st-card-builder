/**
 * UI 契约测试：读取拆分后的 Astro 壳 + 外提模块
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function readLayoutSources(base) {
  return [
    readFileSync(join(base, 'src/layouts/Layout.astro'), 'utf8'),
    readFileSync(join(base, 'src/styles/layout-chrome.css'), 'utf8'),
    readFileSync(join(base, 'src/lib/layout/chromeBoot.mjs'), 'utf8'),
  ].join('');
}

export function readAssistantPanelSources(base) {
  return [
    readFileSync(join(base, 'src/components/AssistantPanel.astro'), 'utf8'),
    readFileSync(join(base, 'src/lib/assistant/panelBoot.mjs'), 'utf8'),
  ].join('');
}

export function readVariableCardPanelSources(base) {
  return [
    readFileSync(join(base, 'src/components/VariableCardPanel.astro'), 'utf8'),
    readFileSync(join(base, 'src/lib/mvu/variableCardPanel.mjs'), 'utf8'),
  ].join('');
}

/** 卡侧世界书面板（register + 拆分模块） */
export function readWorldbookPanelSources(base) {
  return [
    'worldbook.mjs',
    'worldbookShared.mjs',
    'worldbookBind.mjs',
  ].map(function (f) {
    return readFileSync(join(base, 'src/lib/card-builder/panels', f), 'utf8');
  }).join('');
}

/** 卡侧 AI 引擎面板（register + 拆分模块） */
export function readAiEnginePanelSources(base) {
  return [
    'aiEngine.mjs',
    'aiEngineShared.mjs',
    'aiEnginePanel.mjs',
    'aiEngineBind.mjs',
  ].map(function (f) {
    return readFileSync(join(base, 'src/lib/card-builder/panels', f), 'utf8');
  }).join('');
}

/** 卡侧成人配置面板（register + 拆分模块） */
export function readAdultConfigPanelSources(base) {
  return [
    'adultConfig.mjs',
    'adultConfigShared.mjs',
    'adultConfigPanel.mjs',
    'adultConfigBind.mjs',
  ].map(function (f) {
    return readFileSync(join(base, 'src/lib/card-builder/panels', f), 'utf8');
  }).join('');
}

/** 小说工坊 worldbook 面板（register + 拆分模块） */
export function readNovelWorldbookPanelSources(base) {
  return [
    'worldbook.mjs',
    'worldbookExtractUtil.mjs',
    'worldbookRender.mjs',
    'worldbookAi.mjs',
  ].map(function (f) {
    return readFileSync(join(base, 'src/lib/novel/panels', f), 'utf8');
  }).join('');
}

/** 小说工坊 browserApp（boot + 拆分模块） */
export function readNovelBrowserAppSources(base) {
  return [
    readFileSync(join(base, 'src/lib/novel/browserApp.mjs'), 'utf8'),
    readFileSync(join(base, 'src/lib/novel/bootSetupGreetings.mjs'), 'utf8'),
    readFileSync(join(base, 'src/lib/novel/bootEvents.mjs'), 'utf8'),
  ].join('');
}

/** 制卡 browserApp（boot + 拆分模块） */
export function readCardBuilderBrowserAppSources(base) {
  return [
    readFileSync(join(base, 'src/lib/card-builder/browserApp.mjs'), 'utf8'),
    readFileSync(join(base, 'src/lib/card-builder/fieldValidation.mjs'), 'utf8'),
    readFileSync(join(base, 'src/lib/card-builder/bootAiConfig.mjs'), 'utf8'),
  ].join('');
}

/** 小说工坊 bridge（含 syncOutputs / createBridge 拆分） */
export function readNovelBridgeSources(base) {
  return [
    'bridge.mjs',
    'bridgeFields.mjs',
    'bridgeCreate.mjs',
    'bridgeSyncOutputs.mjs',
  ].map(function (f) {
    return readFileSync(join(base, 'src/lib/novel/shared', f), 'utf8');
  }).join('');
}

/** 小说工坊 characters 面板（register + 拆分模块） */
export function readNovelCharactersPanelSources(base) {
  return [
    'characters.mjs',
    'charactersRender.mjs',
    'charactersExpand.mjs',
    'charactersScanBind.mjs',
  ].map(function (f) {
    return readFileSync(join(base, 'src/lib/novel/panels', f), 'utf8');
  }).join('');
}

/** 小说工坊 analyze 面板（register + 拆分模块） */
export function readNovelAnalyzePanelSources(base) {
  return [
    'analyze.mjs',
    'analyzeShared.mjs',
    'analyzeRender.mjs',
    'analyzeBind.mjs',
    'analyzeRun.mjs',
  ].map(function (f) {
    return readFileSync(join(base, 'src/lib/novel/panels', f), 'utf8');
  }).join('');
}

/** 状态栏（catalog + build + barrel） */
export function readStatusBarSources(base) {
  return [
    readFileSync(join(base, 'src/lib/statusBar.mjs'), 'utf8'),
    readFileSync(join(base, 'src/lib/statusBarCatalog.mjs'), 'utf8'),
    readFileSync(join(base, 'src/lib/statusBarBuild.mjs'), 'utf8'),
  ].join('');
}

/** 助手 executor（resolve + helpers + execute + barrel） */
export function readAssistantExecutorSources(base) {
  return [
    'executor.mjs',
    'executorResolve.mjs',
    'executorHelpers.mjs',
    'executorExecute.mjs',
  ].map(function (f) {
    return readFileSync(join(base, 'src/lib/assistant', f), 'utf8');
  }).join('');
}

/** 管理端 browserApp（boot + 拆分模块） */
export function readAdminBrowserAppSources(base) {
  return [
    readFileSync(join(base, 'src/lib/admin/browserApp.mjs'), 'utf8'),
    readFileSync(join(base, 'src/lib/admin/adminShared.mjs'), 'utf8'),
    readFileSync(join(base, 'src/lib/admin/adminViews.mjs'), 'utf8'),
    readFileSync(join(base, 'src/lib/admin/adminBoot.mjs'), 'utf8'),
  ].join('');
}
