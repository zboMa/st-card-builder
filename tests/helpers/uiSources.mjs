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
