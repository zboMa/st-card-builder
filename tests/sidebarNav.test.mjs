/**
 * 侧栏菜单映射契约测试（与 AppSidebar / index 视图 id 对齐）
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readLayoutSources, readAssistantPanelSources, readVariableCardPanelSources, readWorldbookPanelSources } from './helpers/uiSources.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readCardManagerSources(base) {
  return [
    'cardManager.mjs',
    'cardManagerShared.mjs',
    'cardManagerRender.mjs',
    'cardManagerCrud.mjs',
    'cardManagerPublishShare.mjs',
    'cardManagerCloud.mjs',
    'cardManagerExport.mjs',
    'cardManagerBind.mjs',
  ].map(function (f) {
    return readFileSync(join(base, 'src/lib/card-builder/panels', f), 'utf8');
  }).join('');
}

/** 数据驱动侧栏在前端 matter 中的 view 契约 */
function sidebarViewPattern(viewId) {
  return new RegExp("view:\\s*'" + viewId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'");
}

function sidebarViewIndex(src, viewId) {
  return src.search(sidebarViewPattern(viewId));
}

/** 侧栏最终菜单 → data-view 映射（顺序即契约） */
const EXPECTED_MENU = {
  '角色卡制作': ['card-manager', 'adult-config', 'character', 'greetings', 'worldbook', 'statusbar', 'mvu', 'regex', 'tavern-scripts'],
  '小说': [
    'novel-source',
    'novel-chapters',
    'novel-analyze',
    'novel-character-setup',
    'novel-greetings',
    'novel-characters',
    'novel-worldbook',

    'novel-style',
  ],
  '小说创作': [
    'story-manage',
    'story-graph',
    'story-outline',
    'story-write',
    'story-read',
  ],
  '配置': ['account-sync', 'ai-config', 'prompt-config'],
};

describe('sidebar navigation contract', function() {
  it('AppSidebar 包含全部预期 data-view', function() {
    const src = readFileSync(join(root, 'src/components/AppSidebar.astro'), 'utf8');
    Object.values(EXPECTED_MENU).flat().forEach(function(viewId) {
      assert.match(src, sidebarViewPattern(viewId), 'sidebar missing ' + viewId);
    });
    assert.match(src, /data-view=\{item\.view\}/);
    assert.match(src, /角色卡制作/);
    assert.match(src, /小说/);
    assert.match(src, /小说创作/);
    assert.doesNotMatch(src, /title:\s*'完成制作'/);
    assert.match(src, /配置/);
  });

  // 校验「角色卡制作」内按钮出现顺序与契约一致
  it('角色卡制作菜单顺序为 管理→世界与限定→设定→开场白→世界书→状态栏→MVU→正则→酒馆脚本', function() {
    const src = readFileSync(join(root, 'src/components/AppSidebar.astro'), 'utf8');
    let last = -1;
    EXPECTED_MENU['角色卡制作'].forEach(function(viewId) {
      const idx = sidebarViewIndex(src, viewId);
      assert.ok(idx > last, 'order broken at ' + viewId);
      last = idx;
    });
    assert.match(src, /DEFAULT_VIEW\s*=\s*'character'/);
    assert.match(src, /角色卡管理/);
    assert.match(src, /世界与限定/);
  });

  it('角色卡管理与角色设定职责分离', function() {
    const mgr = readFileSync(join(root, 'src/components/CardManagerPanel.astro'), 'utf8');
    assert.match(mgr, /id="cardManagerList"/);
    assert.match(mgr, /id="btnNewDraft"/);
    assert.match(mgr, /card-manager-list/);
    assert.doesNotMatch(mgr, /id="draftSelect"/);
    const charSrc = readFileSync(join(root, 'src/components/CharacterPanel.astro'), 'utf8');
    assert.doesNotMatch(charSrc, /id="draftSelect"/);
    assert.doesNotMatch(charSrc, /多卡片草稿箱/);
    // 角色设定仅编辑表单，无当前卡摘要 / 回管理顶栏
    assert.doesNotMatch(charSrc, /id="currentCardName"/);
    assert.doesNotMatch(charSrc, /id="btnBackToCardManager"/);
    assert.doesNotMatch(charSrc, /current-card-bar/);
    assert.match(charSrc, /id="charName"/);
    assert.match(charSrc, /id="saveIndicator"/);
  });

  // 导入在管理页顶栏；导出在每张卡底部；JSON 追踪入口在角色设定弹窗
  it('导入在角色卡管理顶栏，导出在卡片底部，JSON 追踪无导入导出按钮', function() {
    const mgr = readFileSync(join(root, 'src/components/CardManagerPanel.astro'), 'utf8');
    assert.match(mgr, /id="btnNewDraft"/);
    assert.match(mgr, /id="btnImportCard"/);
    assert.match(mgr, /id="importCardInput"/);
    // 顶栏不再放全局导出
    assert.doesNotMatch(mgr, /id="btnDownloadJson"/);
    assert.doesNotMatch(mgr, /id="btnExportPNG"/);
    assert.match(mgr, /card-manager-toolbar/);
    const preview = readFileSync(join(root, 'src/components/PreviewPanel.astro'), 'utf8');
    assert.doesNotMatch(preview, /id="btnImportCard"/);
    assert.doesNotMatch(preview, /id="btnDownloadJson"/);
    assert.doesNotMatch(preview, /id="btnExportPNG"/);
    assert.doesNotMatch(preview, /id="importCardInput"/);
    assert.match(preview, /id="annotatedPreview"/);
    assert.match(preview, /id="toggleAnnotations"/);
    const charSrc = readFileSync(join(root, 'src/components/CharacterPanel.astro'), 'utf8');
    assert.match(charSrc, /id="btnOpenJsonPreview"/);
    assert.match(charSrc, /id="jsonPreviewModal"/);
    assert.match(charSrc, /JSON 实时追踪/);
    const sidebar = readFileSync(join(root, 'src/components/AppSidebar.astro'), 'utf8');
    assert.doesNotMatch(sidebar, /JSON 实时追踪/);
    assert.doesNotMatch(sidebar, /角色试聊/);
    assert.doesNotMatch(sidebar, /世界书内容监测/);
  });

  // 管理页网格渲染与点击切换契约（存储逻辑仍在 index）
  it('角色卡管理为预览卡片网格且点击切换进设定', function() {
    const mgr = readFileSync(join(root, 'src/components/CardManagerPanel.astro'), 'utf8');
    // 默认一行 4 列，窄屏自适应减列
    assert.match(mgr, /repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    assert.match(mgr, /repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    assert.match(mgr, /card-manager-item-actions__group/);
    assert.match(mgr, /card-mgr-icon/);
    assert.match(mgr, /id="btnImportCard"/);
    const cmSrc = readCardManagerSources(root);
    const chSrc = readFileSync(join(root, 'src/lib/card-builder/panels/character.mjs'), 'utf8');
    const smSrc = readFileSync(join(root, 'src/lib/card-builder/stateMachine.mjs'), 'utf8');
    const stSrc = readFileSync(join(root, 'src/lib/card-builder/state.mjs'), 'utf8');
    const exSrc = readFileSync(join(root, 'src/lib/card-builder/panels/export.mjs'), 'utf8');
    assert.match(cmSrc, /card-manager-cover/);
    assert.match(cmSrc, /avatarInIdb/);
    assert.match(chSrc, /hydrateManagerCoverThumb/);
    assert.match(chSrc, /applyAvatarFromImage/);
    assert.match(cmSrc, /getDraftsForDisplay/);
    assert.match(stSrc, /buildDraftSnapshot/);
    assert.match(cmSrc, /card-manager-item-actions__group--end/);
    assert.match(cmSrc, /document\.body\.appendChild\(pop\)/);
    assert.match(cmSrc, /is-fixed-portal/);
    assert.match(cmSrc, /handleCardMoreAction/);
    assert.match(mgr, /card-manager-item-actions__group--end/);
    assert.match(mgr, /position:\s*fixed/);
    assert.match(cmSrc, /buildCardManagerActionsHtml/);
    assert.match(cmSrc, /btn-icon--sm card-mgr-icon/);
    assert.match(cmSrc, /card-manager-item-actions__group/);
    assert.doesNotMatch(cmSrc, /btn-fetch.*export-json/);
    assert.doesNotMatch(cmSrc, /btn-delete.*delete/);
    assert.match(exSrc, /exportDraftAsJson/);
    assert.match(exSrc, /exportDraftAsPng/);
    assert.match(stSrc, /buildCardJSONFromDraft/);
    assert.match(smSrc, /loadDraftIntoState/);
    const indexSrc = readFileSync(join(root, 'src/pages/index.astro'), 'utf8');
    assert.match(indexSrc, /__avatarIdb__/);
    assert.doesNotMatch(indexSrc, /currentCardName/);
    assert.doesNotMatch(indexSrc, /btnBackToCardManager/);
  });

  it('角色设定含标签管理且导出写入 tags/data.tags', function() {
    const charSrc = readFileSync(join(root, 'src/components/CharacterPanel.astro'), 'utf8');
    assert.match(charSrc, /id="charTagsList"/);
    assert.match(charSrc, /id="charTagInput"/);
    assert.match(charSrc, /id="btnAddCharTag"/);
    // 紧凑 UI：label 旁 tip + form-section 内 chip/工具条
    assert.match(charSrc, /char-tags-tip/);
    assert.match(charSrc, /form-section char-tags-section/);
    assert.match(charSrc, /char-tags-add-row/);
    assert.match(charSrc, /btn-ai-tag/);
    assert.match(charSrc, /btn-panel-tool btn-ai-tag|btn btn-panel-tool btn-ai-tag/);
    assert.match(charSrc, /btn btn-meta/);
    assert.doesNotMatch(charSrc, /char-tags-hint/);
    const indexSrc = readFileSync(join(root, 'src/pages/index.astro'), 'utf8');
    assert.match(indexSrc, /charTags/);
    const chSrc = readFileSync(join(root, 'src/lib/card-builder/panels/character.mjs'), 'utf8');
    assert.match(chSrc, /__getCharTags__/);
    assert.match(chSrc, /__setCharTags__/);
    // generateFullJSON 同步顶层与 data.tags
    const stSrc = readFileSync(join(root, 'src/lib/card-builder/state.mjs'), 'utf8');
    assert.match(stSrc, /tags:\s*tags/);
    assert.match(stSrc, /tags:\s*tags\.slice\(\)/);
    const asst = readAssistantPanelSources(root);
    assert.match(asst, /__getCharTags__/);
    assert.match(asst, /__setCharTags__/);
  });

  it('世界书条目面板 flex 占满且列表内部滚动', function() {
    const layout = readLayoutSources(root);
    // 选择器形如 .app-view[data-view="worldbook"].is-active
    assert.match(layout, /\[data-view="worldbook"\]\.is-active/);
    assert.match(layout, /\.area-worldbook\s*\{[^}]*display:\s*flex/s);
    assert.match(layout, /#entriesList\s*\{[^}]*overflow-y:\s*auto/s);
    // 列表行禁止 flex 压缩，避免条目叠扁
    assert.match(layout, /\.entry-item\s*\{[^}]*flex-shrink:\s*0/s);
    assert.match(layout, /\.entry-item\s*\{[^}]*height:\s*auto/s);
    assert.match(layout, /\.entry-item\s*\{[^}]*min-height:\s*52px/s);
    // 折叠时隐藏详情；展开可点收起
    assert.match(layout, /\.entry-item:not\(\.is-expanded\):not\(\.is-creating\)\s+\.entry-detail/);
    assert.match(layout, /\.entry-collapse-btn/);
    const wb = readFileSync(join(root, 'src/components/WorldbookPanel.astro'), 'utf8');
    assert.match(wb, /id="entriesList"/);
    assert.match(wb, /wb-entries-list/);
    // 标题行右上操作；下方仅搜索筛选（非双列预览卡）
    assert.match(wb, /wb-panel-head/);
    assert.match(wb, /wb-head-actions/);
    assert.match(wb, /class="wb-toolbar"/);
    assert.match(wb, /id="wbSearchInput"/);
    assert.match(wb, /id="btnCreateEntry"[^>]*wb-entry-create-btn/);
    assert.match(wb, />新建</);
    assert.match(wb, /\.wb-entry-create-btn\s*\{[^}]*width:\s*auto/s);
    assert.match(wb, /\.wb-search-results\s*\{[^}]*flex-direction:\s*column/s);
    assert.match(wb, /\.wb-search-hit\s*\{/);
    assert.doesNotMatch(wb, /wb-toolbar-actions|wb-search-card|grid-template-columns:\s*1fr\s+1fr/);
    // 右上三小号按钮打开弹窗；执行按钮仍在弹窗内
    assert.match(wb, /id="btnOpenWbAiSingle"/);
    assert.match(wb, /id="btnOpenWbAiOrganize"/);
    assert.match(wb, /id="btnOpenWbAiKeygen"/);
    assert.match(wb, /wb-ai-open-btn/);
    assert.match(wb, /id="wbModalSingle"/);
    assert.match(wb, /id="wbModalOrganize"/);
    assert.match(wb, /id="wbModalKeygen"/);
    assert.match(wb, /id="btnAiSingleWb"/);
    assert.match(wb, /id="btnAiOrganize"/);
    assert.match(wb, /id="btnAiGenerateKeys"/);
    // 真弹窗：fixed 全屏 + 遮罩 + aria-modal；配置控件仅在 modal 内
    assert.match(wb, /\.wb-modal\s*\{[^}]*position:\s*fixed/s);
    assert.match(wb, /\.wb-modal\s*\{[^}]*inset:\s*0/s);
    assert.match(wb, /wb-modal-backdrop/);
    assert.match(wb, /aria-modal="true"/);
    assert.match(wb, /id="wbModalSingle"[\s\S]*id="wbSinglePrompt"/);
    assert.match(wb, /id="wbModalSingle"[\s\S]*id="wbIncludeCharData"/);
    assert.match(wb, /id="wbModalSingle"[\s\S]*id="wbIncludeOtherEntries"/);
    // 已去掉「AI 工具」折叠块与旧全宽工具条 / 内嵌 details
    assert.doesNotMatch(wb, /wb-ai-tools|wb-organize-wrap|wb-keygen-wrap|wb-entry-toolbar/);
    assert.doesNotMatch(wb, /<details[\s\S]*AI/);
    const wbAppSrc = readWorldbookPanelSources(root);
    assert.match(wbAppSrc, /wb-entries-empty/);
    assert.match(wbAppSrc, /textContent = isCreatingEntry \? '\\u53D6\\u6D88\\u65B0\\u5EFA' : '\\u65B0\\u5EFA'/);
    // 搜索：单列命中行 + 整行跳转编辑
    assert.match(wbAppSrc, /wb-search-hit/);
    assert.match(wbAppSrc, /buildWbHitSnippet/);
    assert.match(wbAppSrc, /jumpToWbEntry/);
    assert.match(wbAppSrc, /wb-search-empty/);
    assert.doesNotMatch(wbAppSrc, /wb-search-card|两列展示/);
    // 打开时挂 body，避免 panel transform 锁住 fixed；Esc / 遮罩关闭
    assert.match(wbAppSrc, /document\.body\.appendChild\(el\)/);
    assert.match(wbAppSrc, /wb-modal-open/);
    assert.match(wbAppSrc, /e\.key\s*!==\s*'Escape'/);
    assert.match(wbAppSrc, /data-wb-modal-close/);
    // 点击标题/编辑按钮打开弹窗；危险操作 stopPropagation；右侧图标操作
    assert.match(wbAppSrc, /editEntry/);
    assert.match(wbAppSrc, /entry-title-btn/);
    assert.match(wbAppSrc, /truncatePreviewLine|entry-preview-line/);
    assert.doesNotMatch(wbAppSrc, /toggleEntryExpand|expandedEntries|data-toggle-index|entry-collapse-btn|entry-expand-hint/);
    assert.match(wbAppSrc, /e\.stopPropagation\(\)/);
    assert.match(wbAppSrc, /openWbModal\('wbModalSingle'\)/);
    assert.match(wbAppSrc, /openWbModal\('wbModalEdit'\)|openWbEditModal/);
    assert.match(wbAppSrc, /renderStrategyTag|wb-strategy-tag/);
    assert.match(wbAppSrc, /strategyLabelZh/);
    assert.match(wbAppSrc, /entry-icon-btn/);
    assert.match(wbAppSrc, /entry-icon-btn btn-edit/);
    // 列表不再挂行内保存按钮
    assert.doesNotMatch(wbAppSrc, /btn-save-inline/);
    assert.match(wb, /id="wbModalEdit"/);
    assert.match(layout, /wb-strategy-tag/);
    assert.match(layout, /entry-preview-line/);
    assert.match(layout, /wb-strategy-dot/);
    assert.match(layout, /\.wb-strategy-tag\.is-constant/);
    assert.match(layout, /\.wb-strategy-tag\.is-selective/);
  });

  it('完成制作入口已迁出侧栏：试聊在右栏，JSON/监测在面板弹窗', function() {
    const src = readFileSync(join(root, 'src/components/AppSidebar.astro'), 'utf8');
    assert.doesNotMatch(src, /title:\s*'完成制作'/);
    assert.doesNotMatch(src, sidebarViewPattern('chat'));
    assert.doesNotMatch(src, sidebarViewPattern('preview'));
    assert.doesNotMatch(src, sidebarViewPattern('auditor'));
    assert.match(src, /hash === 'chat'/);
    assert.match(src, /__setAssistantPanelMode__/);
    assert.match(src, /__openJsonPreviewModal__/);
    assert.match(src, /__openWbAuditorModal__/);
    const asst = readAssistantPanelSources(root);
    assert.match(asst, /assistant-mode-switch/);
    assert.match(asst, /data-assistant-mode="chat"/);
    assert.match(asst, /ChatPlayground/);
    const wb = readFileSync(join(root, 'src/components/WorldbookPanel.astro'), 'utf8');
    assert.match(wb, /id="btnOpenWbAuditor"/);
    assert.match(wb, /id="wbAuditorModal"/);
    assert.match(wb, /WorldbookAuditor/);
  });

  it('角色试聊：右上角配置按钮 + 顶部滑出浮层 + flex 占满 + 对话区内滚', function() {
    const chat = readFileSync(join(root, 'src/components/ChatPlayground.astro'), 'utf8');
    assert.match(chat, /chat-panel-header/);
    assert.match(chat, /chat-header-actions/);
    // 操作控件在标题行内（HTML 段，脚本前）
    const htmlEnd = chat.indexOf('<style>');
    const htmlPart = htmlEnd > 0 ? chat.slice(0, htmlEnd) : chat;
    assert.match(htmlPart, /id="btnChatConfig"/);
    // 右上角仅配置按钮；其余在滑出浮层
    const headerChunk = htmlPart.match(/class="chat-header-actions">[\s\S]*?<\/div>/);
    assert.ok(headerChunk, 'header actions missing');
    assert.match(headerChunk[0], /btnChatConfig/);
    assert.doesNotMatch(headerChunk[0], /btnChatReset|chatWbIndicator|chatShowPrompt/);
    assert.match(htmlPart, /chatConfigDrawer[\s\S]*chatWbIndicator/);
    assert.match(htmlPart, /chatConfigDrawer[\s\S]*chatTokenIndicator/);
    assert.match(htmlPart, /chatConfigDrawer[\s\S]*chatShowPrompt/);
    assert.match(htmlPart, /chatConfigDrawer[\s\S]*btnChatReset/);
    assert.match(htmlPart, /chatConfigDrawer[\s\S]*btnChatRegenerate/);
    assert.match(htmlPart, /chatConfigDrawer[\s\S]*chatTemperature/);
    // 小号 ghost 按钮（抽屉内重置/重生成）；标题行「配置」为弱文字链
    assert.match(htmlPart, /btn-sm btn-ghost btn-chat-ctrl/);
    assert.match(htmlPart, /class="chat-config-link"/);
    assert.match(htmlPart, /btn-icon btn-icon--primary chat-btn-send/);
    assert.doesNotMatch(headerChunk[0], /btn btn-sm btn-ghost btn-chat-ctrl/);
    assert.match(chat, /chat-config-drawer/);
    assert.match(chat, /chat-controls/);
    assert.match(chat, /id="chatMessages"/);
    assert.match(chat, /chat-input-area/);
    // 触发标签与消息同属可滚对话层，避免撑破面板
    assert.match(htmlPart, /chat-conversation[\s\S]*chatWbTriggerBar[\s\S]*chatMessages/);
    assert.match(chat, /\.chat-playground\s*\{[^}]*height:\s*100%/s);
    assert.match(chat, /\.chat-playground\s*\{[^}]*max-height:\s*none/s);
    assert.match(chat, /\.chat-conversation\s*\{[^}]*overflow-y:\s*auto/s);
    assert.match(chat, /\.chat-conversation\s*\{[^}]*flex:\s*1/s);
    assert.doesNotMatch(chat, /max-height:\s*600px/);
    assert.doesNotMatch(chat, /max-height:\s*380px/);
    const layout = readLayoutSources(root);
    assert.match(layout, /\.panel\.chat-playground/);
    // 移动端不再对 .chat-conversation 限高（会把助手内输入栏顶出空白）
    assert.doesNotMatch(layout, /\.chat-playground\s+\.chat-conversation\s*\{[^}]*max-height:\s*min\(50vh/s);
    // 试聊已嵌入右栏，主栏不再挂 chat view；助手宿主保证对话区拉伸、输入贴底
    const asst = readAssistantPanelSources(root);
    assert.match(asst, /assistant-chat-host/);
    assert.match(asst, /ChatPlayground/);
    assert.match(asst, /\.assistant-chat-host\s+\.chat-playground\s+\.chat-conversation/);
    assert.match(asst, /\.assistant-chat-host\s+\.chat-playground\s+\.chat-input-area/);
    // 配置抽屉纵向排列；窄屏隐藏 Enter 提示
    assert.match(chat, /\.chat-setting-group\s*\{[^}]*flex-direction:\s*column/s);
    assert.match(chat, /chat-compose-hint[\s\S]*@media \(max-width:\s*900px\)/);
  });

  it('小说菜单顺序为 资料→拆章→分析→设定→开场白→人物列表→世界书条目→文风', function() {
    const src = readFileSync(join(root, 'src/components/AppSidebar.astro'), 'utf8');
    let last = -1;
    EXPECTED_MENU['小说'].forEach(function(viewId) {
      const idx = sidebarViewIndex(src, viewId);
      assert.ok(idx > last, 'novel order broken at ' + viewId);
      last = idx;
    });
    assert.match(src, /原始资料/);
    assert.match(src, /人物列表/);
    assert.match(src, /世界书条目/);
    assert.doesNotMatch(src, /novel-knowledge/);
    assert.doesNotMatch(src, /知识库/);
    // 小说模块 view id 勿与主卡 character/greetings 冲突
    assert.match(src, sidebarViewPattern('novel-character-setup'));
    assert.match(src, sidebarViewPattern('novel-greetings'));
    assert.doesNotMatch(src, /view: 'novel-character'/);
    // 菜单无产出浏览项；旧深链仍映射到人物列表
    assert.doesNotMatch(src, /view: 'novel-outputs'/);
    assert.doesNotMatch(src, /产出浏览/);
    assert.match(src, /hash === 'novel-outputs'/);
    assert.match(src, /novel-characters/);
  });

  it('小说创作菜单顺序为 管理→图谱→大纲→写作→阅读', function() {
    const src = readFileSync(join(root, 'src/components/AppSidebar.astro'), 'utf8');
    let last = -1;
    EXPECTED_MENU['小说创作'].forEach(function(viewId) {
      const idx = sidebarViewIndex(src, viewId);
      assert.ok(idx > last, 'story studio order broken at ' + viewId);
      last = idx;
    });
    assert.match(src, /小说创作/);
    assert.match(src, /view:\s*'story-manage'/);
    assert.match(src, /view:\s*'story-read'/);
    // 与小说工坊分离
    assert.doesNotMatch(src, /view:\s*'story-source'/);
  });

  it('index.astro 为每个菜单项提供 app-view', function() {
    const src = readFileSync(join(root, 'src/pages/index.astro'), 'utf8');
    Object.values(EXPECTED_MENU).flat().forEach(function(viewId) {
      assert.match(
        src,
        new RegExp('class="app-view"[^>]*data-view="' + viewId + '"|data-view="' + viewId + '"'),
        'index missing view ' + viewId
      );
    });
    assert.match(src, /GreetingPanel/);
    assert.match(src, /app-shell/);
    assert.match(src, /PromptStoreBootstrap/);
    assert.match(src, /PromptConfigPanel/);
    assert.match(src, /AssistantPanel/);
    // 全宽顶栏已移除，品牌区迁入侧栏
    assert.doesNotMatch(src, /class="app-header"/);
  });

  it('侧栏顶部包含品牌区文案且无版本/访客 tag', function() {
    const src = readFileSync(join(root, 'src/components/AppSidebar.astro'), 'utf8');
    assert.match(src, /app-sidebar-brand/);
    assert.match(src, /啊哈哈哈制卡器/);
    assert.match(src, /一个简单的制卡器/);
    // AI 任务进度入口在标题右侧
    assert.match(src, /app-title-row/);
    assert.match(src, /id="aiTaskBadge"/);
    assert.doesNotMatch(src, /V4 BUILD/);
    assert.doesNotMatch(src, /visitorNum|visitorCount|app-sidebar-brand-meta/);
    const layout = readLayoutSources(root);
    assert.match(layout, /\.app-sidebar-brand/);
    assert.doesNotMatch(layout, /\.app-header\s*\{/);
    assert.doesNotMatch(layout, /\.app-version-badge|\.app-visitor-badge|\.app-sidebar-brand-meta/);
    const index = readFileSync(join(root, 'src/pages/index.astro'), 'utf8');
    assert.doesNotMatch(index, /initVisitorCounter|increment_visitors|get_visitor_count/);
  });

  it('视口锁死：html/body 与主壳禁止整页滚动，栏内可滚', function() {
    const layout = readLayoutSources(root);
    assert.match(layout, /html\s*\{[^}]*overflow:\s*hidden/s);
    assert.match(layout, /body\s*\{[^}]*overflow:\s*hidden/s);
    assert.match(layout, /100dvh/);
    assert.match(layout, /\.app-shell\s*\{[^}]*overflow:\s*hidden/s);
    assert.match(layout, /\.app-shell\s*>\s*\*\s*\{[^}]*min-height:\s*0/s);
    assert.match(layout, /\.app-container\s*\{[^}]*overflow-y:\s*auto/s);
    // 侧栏仅中间菜单可滚；配置组底部固定
    assert.match(layout, /\.app-sidebar-nav\s*\{[^}]*flex:\s*1/s);
    assert.match(layout, /\.app-sidebar-nav\s*\{[^}]*overflow-y:\s*auto/s);
    assert.match(layout, /\.app-sidebar-group-config\s*\{[^}]*flex-shrink:\s*0/s);
    const panel = readAssistantPanelSources(root);
    assert.match(panel, /\.assistant-panel__messages\s*\{[^}]*overflow-y:\s*auto/s);
    assert.match(panel, /\.assistant-panel\s*\{[^}]*height:\s*100%/s);
    assert.doesNotMatch(panel, /calc\(100vh\s*-\s*32px\)/);
  });

  it('侧栏三段式：品牌顶固定、菜单中可滚、配置底固定且在 nav 外', function() {
    const src = readFileSync(join(root, 'src/components/AppSidebar.astro'), 'utf8');
    const brandIdx = src.indexOf('app-sidebar-brand');
    const navOpen = src.indexOf('app-sidebar-nav');
    const navClose = src.indexOf('</nav>');
    const configIdx = src.indexOf('app-sidebar-group-config');
    assert.ok(brandIdx > -1 && navOpen > brandIdx, '品牌区应在中间菜单之前');
    assert.ok(configIdx > navClose && navClose > navOpen, '配置组应在 </nav> 之后');
    assert.match(src, /id="appSidebarConfig"/);
    assert.doesNotMatch(src, /app-sidebar-spacer/);
    // 导航点击需覆盖 nav 外的配置项
    assert.match(src, /sidebar\.querySelectorAll\('\.app-sidebar-item\[data-view\]'\)/);
  });

  it('开场白模块保留 firstMes 与备选开场 DOM', function() {
    const src = readFileSync(join(root, 'src/components/GreetingPanel.astro'), 'utf8');
    assert.match(src, /id="firstMes"/);
    assert.match(src, /id="altGreetingsList"/);
    assert.match(src, /id="btnAddGreeting"/);
    assert.match(src, /__altGreetings__/);
    assert.match(src, /__renderAltGreetings__/);
    // 角色设定中不再承载开场白编辑
    const charSrc = readFileSync(join(root, 'src/components/CharacterPanel.astro'), 'utf8');
    assert.doesNotMatch(charSrc, /id="firstMes"/);
    assert.doesNotMatch(charSrc, /id="altGreetingsList"/);
  });

  it('AIPanel 提供配置区；生成区在 AiEngineModal 弹窗', function() {
    const cfg = readFileSync(join(root, 'src/components/AIPanel.astro'), 'utf8');
    assert.match(cfg, /area-ai-config/);
    assert.match(cfg, /AiEngineModal/);
    assert.match(cfg, /id="apiUrl"/);
    assert.match(cfg, /data-ai-config-tab="engine"/);
    assert.match(cfg, /id="tagContextChars"/);
    assert.doesNotMatch(cfg, /id="btnAiGenerate"/);

    const modal = readFileSync(join(root, 'src/components/AiEngineModal.astro'), 'utf8');
    assert.match(modal, /id="aiEngineModal"/);
    assert.match(modal, /id="btnAiGenerate"/);
    assert.match(modal, /id="greetingPrompt"/);
    assert.match(modal, /\[3\]\s*开场白|greetingPrompt/);
    assert.match(modal, /aiWorldviewSummary|世界与限定/);
    assert.doesNotMatch(modal, /id="aiWorldviewPresetPicker"/);
    assert.doesNotMatch(modal, /id="aiWorldviewPreset"/);
    assert.match(modal, /__openAiEngineModal__/);
    assert.match(modal, /ai-engine-wb-count-row/);
    assert.match(modal, /工作重心/);
    assert.match(modal, /\.ai-engine-continue-btn\[hidden\]/);
    assert.match(modal, /btnAiContinueEnrich[^>]*hidden/);
  });

  it('全局下拉为可搜索选择，并跳过 hidden select', function() {
    const layout = readLayoutSources(root);
    assert.match(layout, /className = 'cs-search'|className = \"cs-search\"/);
    assert.match(layout, /搜索选项/);
    assert.match(layout, /hasAttribute\('hidden'\)|getAttribute\('aria-hidden'\)/);
    assert.match(layout, /cs-native-skip/);
    assert.match(layout, /applyFilter/);
  });

  it('角色设定右上角含 AI 引擎入口', function() {
    const charSrc = readFileSync(join(root, 'src/components/CharacterPanel.astro'), 'utf8');
    assert.match(charSrc, /id="btnOpenAiEngine"/);
    assert.match(charSrc, />AI 引擎</);
  });

  it('角色设定含标签 AI 生成按钮', function() {
    const src = readFileSync(join(root, 'src/components/CharacterPanel.astro'), 'utf8');
    assert.match(src, /id="btnAiGenCharTags"/);
    assert.match(src, /id="btnAddCharTag"/);
    assert.match(src, /id="charTagsAiTip"/);
    // AI 生成在添加右侧
    const aiIdx = src.indexOf('btnAiGenCharTags');
    const addIdx = src.indexOf('btnAddCharTag');
    assert.ok(aiIdx > -1 && aiIdx > addIdx);
  });
});
