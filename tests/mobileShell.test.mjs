import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readLayoutSources, readAssistantPanelSources } from './helpers/uiSources.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('mobile shell: drawer + assistant FAB', function() {
  it('index has mobile modbar and shell backdrop', function() {
    const index = readFileSync(join(root, 'src/pages/index.astro'), 'utf8');
    assert.match(index, /id="appMobileModbar"/);
    assert.match(index, /id="btnMobileModPrev"/);
    assert.match(index, /id="btnMobileModCurrent"/);
    assert.match(index, /id="btnMobileModNext"/);
    assert.match(index, /id="appShellBackdrop"/);
    assert.doesNotMatch(index, /id="btnMobileNavOpen"/);
    assert.match(index, /AssistantPanel/);
  });

  it('Layout enables drawer styles at max-width 900px', function() {
    const layout = readLayoutSources(root);
    assert.match(layout, /@media \(max-width:\s*900px\)/);
    assert.match(layout, /\.app-sidebar\.is-drawer-open/);
    assert.match(layout, /\.app-mobile-modbar/);
    assert.match(layout, /is-mobile-nav-open/);
    assert.match(layout, /is-mobile-assistant-open/);
    assert.match(layout, /translateX\(-105%\)/);
  });

  it('AppSidebar toggles drawer via modbar and closes on nav click', function() {
    const sidebar = readFileSync(join(root, 'src/components/AppSidebar.astro'), 'utf8');
    assert.match(sidebar, /btnMobileModCurrent/);
    assert.match(sidebar, /stepMod/);
    assert.match(sidebar, /is-drawer-open/);
    assert.match(sidebar, /__closeMobileNav__/);
    assert.match(sidebar, /max-width:\s*900px/);
    assert.match(sidebar, /closeDrawer/);
  });

  it('AssistantPanel has FAB sheet open/close without using is-collapsed', function() {
    const panel = readAssistantPanelSources(root);
    assert.match(panel, /id="btnAssistantFab"/);
    assert.match(panel, /id="btnAssistantClose"/);
    assert.match(panel, /is-assistant-open/);
    assert.match(panel, /__openAssistantSheet__/);
    assert.match(panel, /__closeAssistantSheet__/);
    assert.doesNotMatch(panel, /is-collapsed/);
  });

  it('custom select does not auto-focus search on touch/narrow', function() {
    const boot = readFileSync(join(root, 'src/lib/layout/chromeBoot.mjs'), 'utf8');
    assert.match(boot, /pointer:\s*coarse/);
    assert.match(boot, /touchish/);
    assert.match(boot, /search\.focus/);
  });
});
