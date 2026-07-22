/**
 * GSAP 面板入场与视图切换交互契约（防止 clip-path/opacity 阻塞点击）
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { readGsapAnimationsSources } from './helpers/uiSources.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gsapSrc = readGsapAnimationsSources(root);

describe('GSAP panel view interaction contract', function() {
  it('提供 getActiveViewId 并与侧栏 hash 归一化一致', function() {
    assert.match(gsapSrc, /function getActiveViewId\(\)/);
    assert.match(gsapSrc, /hash === 'novel'\) hash = 'novel-source'/);
    assert.match(gsapSrc, /return 'character'/);
  });

  it('非首屏视图跳过阻塞性入场动画', function() {
    assert.match(gsapSrc, /panelViewId\(panel\) !== initialViewId\)/);
    assert.match(gsapSrc, /跳过阻塞性入场/);
  });

  it('app-view-changed 时 ensurePanelsInteractive 清除 GSAP 残留', function() {
    assert.match(gsapSrc, /addEventListener\('app-view-changed'/);
    assert.match(gsapSrc, /function ensurePanelsInteractive\(/);
    assert.match(gsapSrc, /clearProps: 'transform,opacity,scale,clipPath,filter,willChange'/);
    assert.match(gsapSrc, /panel\.style\.clipPath = ''/);
    assert.match(gsapSrc, /isUnfoldOverlay/);
  });

  it('h2 入场仅作用于首屏视图内面板', function() {
    assert.match(gsapSrc, /panelViewId\(host\) !== h2ViewId\)/);
  });

  it('ai-task-badge 变量已定义，避免 pageerror', function() {
    assert.match(gsapSrc, /var badge = q\('\.ai-task-badge'\)/);
    const badgeIdx = gsapSrc.indexOf("var badge = q('.ai-task-badge')");
    const ifIdx = gsapSrc.indexOf('if (badge)', badgeIdx);
    assert.ok(badgeIdx >= 0 && ifIdx > badgeIdx, 'badge 须在 if (badge) 之前定义');
  });
});
