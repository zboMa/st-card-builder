/**
 * 全站 design token 与 ui-patterns 契约
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readLayoutSources, readAssistantPanelSources, readVariableCardPanelSources, readWorldbookPanelSources, readNovelBrowserAppSources, readNovelWorldbookPanelSources, readNovelCharactersPanelSources, readAiConfigPanelSources, readChatPlaygroundSources, readCharacterPanelSources, readAiEngineModalSources } from './helpers/uiSources.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tokensPath = join(root, 'src/styles/tokens.css');
const patternsPath = join(root, 'src/styles/ui-patterns.css');
const layoutPath = join(root, 'src/layouts/Layout.astro');

/** 夜庭主题必须暴露的语义 token */
const REQUIRED_TOKENS = [
  '--color-paper',
  '--color-surface',
  '--color-surface-inset',
  '--color-accent',
  '--color-on-accent',
  '--color-chip-bg',
  '--color-msg-user-bg',
  '--color-success-soft',
  '--color-warning-soft',
  '--color-slider-track',
  '--color-overlay',
  '--color-text',
  '--color-border',
  '--font-sans',
  '--radius-md',
  '--ease-out',
];

/** ui-patterns 共享类（全站复用） */
const REQUIRED_UI_CLASSES = [
  '.panel-header',
  '.form-section',
  '.ui-chip',
  '.ui-tabs',
  '.ui-slider',
  '.ui-pill-btn',
  '.btn-primary',
  '.btn-ghost',
  '.btn-toolbar',
  '.btn-panel-tool',
  '.btn-ai-engine',
  '.btn-meta',
  '.btn-inline',
  '.ui-search-bar',
  '.ui-panel-lead',
  '.ui-empty-tip',
];

describe('design tokens (Nocturne Atelier)', function() {
  it('tokens.css 存在', function() {
    assert.ok(existsSync(tokensPath), 'missing src/styles/tokens.css');
  });

  it('tokens.css 含关键语义变量', function() {
    const css = readFileSync(tokensPath, 'utf8');
    REQUIRED_TOKENS.forEach(function(name) {
      assert.match(css, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'missing ' + name);
    });
  });

  it('ui-patterns.css 存在且含共享 UI 类', function() {
    assert.ok(existsSync(patternsPath), 'missing src/styles/ui-patterns.css');
    const css = readFileSync(patternsPath, 'utf8');
    REQUIRED_UI_CLASSES.forEach(function(cls) {
      assert.match(css, new RegExp(cls.replace('.', '\\.')), 'missing ' + cls);
    });
  });

  it('Layout.astro 引入 tokens 与 ui-patterns', function() {
    const layout = readLayoutSources(root);
    assert.match(layout, /tokens\.css/);
    assert.match(layout, /ui-patterns\.css/);
    assert.match(layout, /layout-chrome\.css/);
  });

  it('CharacterPanel 使用 form-section 与分级按钮', function() {
    const panel = readCharacterPanelSources(root);
    assert.match(panel, /form-section/);
    assert.match(panel, /btn-ai-engine/);
    assert.match(panel, /btn-panel-tool/);
    assert.match(panel, /btn-meta/);
    assert.match(panel, /chip-list/);
  });

  it('AssistantPanel composer 使用 btn-icon 与发送/停止切换', function() {
    const panel = readAssistantPanelSources(root);
    assert.match(panel, /btn-icon--primary assistant-btn-action/);
    assert.match(panel, /id="assistantActionBtn"/);
    assert.match(panel, /btn-icon assistant-btn-clear/);
    assert.match(panel, /btn-icon assistant-btn-undo/);
    assert.match(panel, /composer-bar/);
    assert.match(panel, /syncActionBtn/);
    assert.match(panel, /window\.__assistantPanel__\s*=\s*\{/);
    assert.match(panel, /btn-primary assistant-btn-apply/);
    assert.doesNotMatch(panel, /id="assistantSendBtn"/);
  });

  it('AIPanel 使用 ui-tabs；AiEngineModal 使用 ui-pill-btn', function() {
    const panel = readAiConfigPanelSources(root);
    assert.match(panel, /ui-tabs ai-config-tabs/);
    assert.doesNotMatch(panel, /⚙️ AI 配置/);
    const modal = readAiEngineModalSources(root);
    assert.match(modal, /ui-pill-btn wb-count-btn/);
  });

  it('ui-patterns 含 btn-icon 与 composer-bar', function() {
    const css = readFileSync(join(root, 'src/styles/ui-patterns.css'), 'utf8');
    assert.match(css, /\.btn-icon/);
    assert.match(css, /\.composer-bar/);
    assert.match(css, /\.ui-step-pill/);
  });

  it('未扩展 AI 按钮金色 token 与 btn-ai-expand', function() {
    const tokens = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8');
    assert.match(tokens, /--color-ai-gold/);
    const css = readFileSync(join(root, 'src/styles/ui-patterns.css'), 'utf8');
    assert.match(css, /\.btn-ai-expand/);
    const wbSrc = readWorldbookPanelSources(root);
    assert.match(wbSrc, /btn-ai-expand/);
    assert.match(wbSrc, /isSk \? ' btn-ai-expand'/);
    const novelCtx = readFileSync(join(root, 'src/lib/novel/shared/context.mjs'), 'utf8');
    assert.match(novelCtx, /isUnexpandedWbContent/);
    const novelWb = readNovelWorldbookPanelSources(root);
    assert.match(novelWb, /needExpand \? 'btn-ai-expand'/);
  });

  it('人物行操作：同步世界书在左、AI 扩展紧贴编辑', function() {
    const app = readNovelCharactersPanelSources(root);
    // 在 novel-list-actions 片段内断言顺序（人物只同步世界书，不再同步主角设定）
    const start = app.indexOf("'+ '<div class=\"novel-list-actions\">'");
    const alt = app.indexOf("novel-list-actions");
    const from = start > 0 ? start : alt;
    const block = app.slice(from, from + 800);
    const syncIdx = block.indexOf('data-char-sync-wb');
    const expandIdx = block.indexOf('data-char-expand');
    const editIdx = block.indexOf("data-char-edit=\"' + c.id");
    assert.ok(syncIdx > 0, 'missing worldbook sync');
    assert.ok(block.indexOf('data-char-sync-char') < 0, 'must not sync person into protagonist');
    assert.ok(expandIdx > syncIdx, 'expand should follow sync');
    assert.ok(editIdx > expandIdx, 'edit should follow expand');
  });

  it('站点 favicon 为侧栏同形 SVG；酒馆预设列表 540px', function() {
    const layout = readLayoutSources(root);
    assert.match(layout, /rel="icon"[^>]*favicon\.svg/);
    const fav = readFileSync(join(root, 'public/favicon.svg'), 'utf8');
    assert.match(fav, /<rect[^>]*rx="3"/);
    assert.match(fav, /M8 9h8M8 13h5/);
    const ai = readAiConfigPanelSources(root);
    assert.match(ai, /id="presetListContainer"[^>]*max-height:\s*540px/);
  });

  it('ChatPlayground 使用 ui-slider 与 msg token', function() {
    const chat = readChatPlaygroundSources(root);
    assert.match(chat, /ui-slider setting-slider/);
    assert.match(chat, /--color-msg-user-bg/);
  });
});
