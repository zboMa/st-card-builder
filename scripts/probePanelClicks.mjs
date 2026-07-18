/**
 * 全面诊断：正则/酒馆面板点击命中与遮挡层
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:4322';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

async function probeView(viewId, btnSelector) {
  await page.goto(`${BASE}/#${viewId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const report = await page.evaluate(({ viewId, btnSelector }) => {
    const view = document.querySelector('.app-view[data-view="' + viewId + '"]');
    const panel = view?.querySelector('.panel');
    const btn = document.querySelector(btnSelector);

    function hit(x, y) {
      const el = document.elementFromPoint(x, y);
      if (!el) return { x, y, top: null };
      return {
        x, y,
        topTag: el.tagName,
        topId: el.id || '',
        topClass: (el.className || '').toString().slice(0, 80),
        inPanel: !!(panel && panel.contains(el)),
        inView: !!(view && view.contains(el)),
      };
    }

    const panelRect = panel?.getBoundingClientRect();
    const btnRect = btn?.getBoundingClientRect();
    const hits = [];
    if (btnRect && btnRect.width > 0) {
      hits.push(hit(btnRect.left + btnRect.width / 2, btnRect.top + btnRect.height / 2));
    }
    if (panelRect && panelRect.width > 0) {
      hits.push(hit(panelRect.left + panelRect.width / 2, panelRect.top + panelRect.height / 2));
      hits.push(hit(panelRect.left + 20, panelRect.top + 80));
    }

    // 固定层：可能盖住主区
    const blockers = [];
    document.querySelectorAll('body *').forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.pointerEvents === 'none') return;
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      if (Number(cs.opacity) === 0 && !el.matches('.panel-hover-glow')) return;
      const z = parseInt(cs.zIndex, 10);
      if (!z || z < 5) return;
      const r = el.getBoundingClientRect();
      if (r.width < 100 || r.height < 100) return;
      if (r.bottom < 0 || r.top > innerHeight) return;
      const pos = cs.position;
      if (pos !== 'fixed' && pos !== 'absolute') return;
      // 主内容区约 x 240~900
      if (r.left > 950 || r.right < 200) return;
      blockers.push({
        tag: el.tagName,
        id: el.id,
        cls: (el.className || '').toString().slice(0, 60),
        zIndex: cs.zIndex,
        pos,
        pointerEvents: cs.pointerEvents,
        opacity: cs.opacity,
        rect: { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top) },
      });
    });

    function stylePick(el) {
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        opacity: cs.opacity,
        pointerEvents: cs.pointerEvents,
        clipPath: cs.clipPath,
        zIndex: cs.zIndex,
        overflow: cs.overflow,
      };
    }

    return {
      viewId,
      activeView: document.querySelector('.app-view.is-active')?.getAttribute('data-view'),
      panel: stylePick(panel),
      view: stylePick(view),
      appContainer: stylePick(document.querySelector('.app-container')),
      btn: stylePick(btn),
      hits,
      blockers: blockers.slice(0, 15),
      hasRegexApi: typeof window.__regexPanelApi__ !== 'undefined',
    };
  }, { viewId, btnSelector });

  let clickOk = false;
  let listAfter = -1;
  try {
    await page.click(btnSelector, { timeout: 2500 });
    clickOk = true;
  } catch (e) {
    report.clickErr = e.message.split('\n')[0];
  }

  listAfter = await page.evaluate((viewId) => {
    if (viewId === 'regex') return window.__getRegexScripts__?.().length ?? -1;
    if (viewId === 'tavern-scripts') return window.__getTavernHelperScripts__?.().length ?? -1;
    return -1;
  }, viewId);

  return { ...report, clickOk, listAfter };
}

const regex = await probeView('regex', '#rxBtnAdd');
const tavern = await probeView('tavern-scripts', '#thBtnAdd');

console.log('REGEX', JSON.stringify(regex, null, 2));
console.log('TAVERN', JSON.stringify(tavern, null, 2));
if (errors.length) console.log('PAGE_ERRORS', errors);

await browser.close();
