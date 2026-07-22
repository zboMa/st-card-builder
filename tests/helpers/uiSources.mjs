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
    readFileSync(join(base, 'src/lib/layout/gsapAnimationsBoot.mjs'), 'utf8'),
  ].join('');
}

/** GSAP 动画（Astro + boot） */
export function readGsapAnimationsSources(base) {
  return [
    readFileSync(join(base, 'src/components/GsapAnimations.astro'), 'utf8'),
    readFileSync(join(base, 'src/lib/layout/gsapAnimationsBoot.mjs'), 'utf8'),
  ].join('');
}

export function readAssistantPanelSources(base) {
  return [
    readFileSync(join(base, 'src/components/AssistantPanel.astro'), 'utf8'),
    readFileSync(join(base, 'src/styles/assistant-panel.css'), 'utf8'),
    readFileSync(join(base, 'src/lib/assistant/panelBoot.mjs'), 'utf8'),
  ].join('');
}

export function readVariableCardPanelSources(base) {
  return [
    readFileSync(join(base, 'src/components/VariableCardPanel.astro'), 'utf8'),
    readFileSync(join(base, 'src/styles/variable-card-panel.css'), 'utf8'),
    readFileSync(join(base, 'src/lib/mvu/variableCardPanel.mjs'), 'utf8'),
  ].join('');
}

/** 状态栏面板（Astro + boot + lib） */
export function readStatusBarPanelSources(base) {
  return [
    readFileSync(join(base, 'src/components/StatusBarPanel.astro'), 'utf8'),
    readFileSync(join(base, 'src/lib/statusBar/panelBoot.mjs'), 'utf8'),
    readStatusBarSources(base),
  ].join('');
}

/** AI 配置面板（Astro + boot） */
export function readAiConfigPanelSources(base) {
  return [
    readFileSync(join(base, 'src/components/AIPanel.astro'), 'utf8'),
    readFileSync(join(base, 'src/lib/aiConfig/panelBoot.mjs'), 'utf8'),
  ].join('');
}

/** 试聊 playground（Astro + CSS + boot） */
export function readChatPlaygroundSources(base) {
  return [
    readFileSync(join(base, 'src/components/ChatPlayground.astro'), 'utf8'),
    readFileSync(join(base, 'src/styles/chat-playground.css'), 'utf8'),
    readFileSync(join(base, 'src/lib/chatRuntime/playgroundBoot.mjs'), 'utf8'),
  ].join('');
}

/** 账户/云同步面板 */
export function readAccountSyncPanelSources(base) {
  return [
    readFileSync(join(base, 'src/components/AccountSyncPanel.astro'), 'utf8'),
    readFileSync(join(base, 'src/lib/sync/accountSyncPanelBoot.mjs'), 'utf8'),
  ].join('');
}

/** 正则面板 */
export function readRegexPanelSources(base) {
  return [
    readFileSync(join(base, 'src/components/RegexPanel.astro'), 'utf8'),
    readFileSync(join(base, 'src/lib/regexPanelBoot.mjs'), 'utf8'),
  ].join('');
}

/** 酒馆脚本面板 */
export function readTavernScriptsPanelSources(base) {
  return [
    readFileSync(join(base, 'src/components/TavernScriptsPanel.astro'), 'utf8'),
    readFileSync(join(base, 'src/lib/tavernPanelBoot.mjs'), 'utf8'),
  ].join('');
}

/** 卡管理面板（Astro + CSS + 导入 boot + cardManager 模块） */
export function readCardManagerPanelSources(base) {
  return [
    readFileSync(join(base, 'src/components/CardManagerPanel.astro'), 'utf8'),
    readFileSync(join(base, 'src/styles/card-manager-panel.css'), 'utf8'),
    readFileSync(join(base, 'src/lib/card-builder/cardManagerPanelBoot.mjs'), 'utf8'),
    readFileSync(join(base, 'src/lib/card-builder/panels/cardManager.mjs'), 'utf8'),
    readFileSync(join(base, 'src/lib/card-builder/panels/cardManagerBind.mjs'), 'utf8'),
  ].join('');
}

/** 角色设定面板 */
export function readCharacterPanelSources(base) {
  return [
    readFileSync(join(base, 'src/components/CharacterPanel.astro'), 'utf8'),
    readFileSync(join(base, 'src/lib/card-builder/characterPanelBoot.mjs'), 'utf8'),
  ].join('');
}

/** 预览面板 */
export function readPreviewPanelSources(base) {
  return [
    readFileSync(join(base, 'src/components/PreviewPanel.astro'), 'utf8'),
    readFileSync(join(base, 'src/lib/card-builder/previewPanelBoot.mjs'), 'utf8'),
  ].join('');
}

/** 提示词配置面板 */
export function readPromptConfigPanelSources(base) {
  return [
    readFileSync(join(base, 'src/components/PromptConfigPanel.astro'), 'utf8'),
    readFileSync(join(base, 'src/styles/prompt-config-panel.css'), 'utf8'),
    readFileSync(join(base, 'src/lib/promptConfigPanelBoot.mjs'), 'utf8'),
  ].join('');
}

/** SecurityCordon */
export function readSecurityCordonSources(base) {
  return [
    readFileSync(join(base, 'src/components/SecurityCordon.astro'), 'utf8'),
    readFileSync(join(base, 'src/styles/security-cordon.css'), 'utf8'),
    readFileSync(join(base, 'src/lib/securityCordonBoot.mjs'), 'utf8'),
  ].join('');
}

/** AI 引擎弹窗 */
export function readAiEngineModalSources(base) {
  return [
    readFileSync(join(base, 'src/components/AiEngineModal.astro'), 'utf8'),
    readFileSync(join(base, 'src/styles/ai-engine-modal.css'), 'utf8'),
    readFileSync(join(base, 'src/lib/aiConfig/aiEngineModalBoot.mjs'), 'utf8'),
  ].join('');
}

/** 世界书审计 */
export function readWorldbookAuditorSources(base) {
  return [
    readFileSync(join(base, 'src/components/WorldbookAuditor.astro'), 'utf8'),
    readFileSync(join(base, 'src/lib/card-builder/worldbookAuditorBoot.mjs'), 'utf8'),
  ].join('');
}

/** 小说工坊共用样式 */
export function readNovelWorkshopStylesSources(base) {
  return [
    readFileSync(join(base, 'src/components/novel/NovelWorkshopStyles.astro'), 'utf8'),
    readFileSync(join(base, 'src/styles/novel-workshop.css'), 'utf8'),
  ].join('');
}

/** 小说创作共用样式 */
export function readStoryStudioStylesSources(base) {
  return [
    readFileSync(join(base, 'src/components/storyStudio/StoryStudioStyles.astro'), 'utf8'),
    readFileSync(join(base, 'src/styles/story-studio.css'), 'utf8'),
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
