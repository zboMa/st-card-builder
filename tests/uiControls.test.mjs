/**
 * 通用控件不得写死夜庭紫悬停或石板底。场景层 CSS 不在此列。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const FILES = [
  'src/styles/ui-patterns.css',
  'src/styles/layout-chrome.css',
  'src/styles/assistant-panel.css',
  'src/styles/card-manager-panel.css',
  'src/styles/prompt-config-panel.css',
  'src/styles/novel-workshop.css',
  'src/styles/story-studio.css',
  'src/components/WorldbookPanel.astro',
  'src/components/CharacterPanel.astro',
  'src/pages/index.astro',
  'src/styles/ai-engine-modal.css',
  'docs/ui/design-system.md',
];

const FORBIDDEN = [
  'rgba(15, 23, 42',
  'rgba(8, 12, 28',
  'rgba(8, 12, 24',
  'rgba(51, 65, 85',
  '#0f172a',
  '#c7d2fe',
  '#f8fafc',
  'oklch(76% 0.095 310',
  'oklch(72% 0.14 305',
  'oklch(42% 0.08 305',
  'oklch(28% 0.024 288',
  '#050510',
  '#263044',
  '#0f1419',
];

describe('通用控件颜色', () => {
  for (const rel of FILES) {
    it(`${rel} 不写死石板底或夜庭紫悬停`, () => {
      const text = readFileSync(join(root, rel), 'utf8');
      for (const needle of FORBIDDEN) {
        assert.equal(text.includes(needle), false, `${rel} 含 ${needle}`);
      }
    });
  }

  it('控件目录写在设计系统里', () => {
    const text = readFileSync(join(root, 'docs/ui/design-system.md'), 'utf8');
    assert.match(text, /通用控件/);
    assert.match(text, /\.ui-timeline/);
    assert.match(text, /\.btn-danger/);
    const css = readFileSync(join(root, 'src/styles/ui-patterns.css'), 'utf8');
    assert.match(css, /\.btn-danger/);
    assert.match(css, /\.ui-timeline/);
    assert.match(css, /\.ui-menu/);
    assert.match(css, /accent-color:\s*var\(--color-accent\)/);
  });
});
