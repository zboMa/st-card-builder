/**
 * 制作路线 tip（§6.1 · D6）— 消费 cardProgress suggestions
 */

import { detectCardJourneySteps, renderJourneyTipHtml, bindCardJourneyTip } from './cardJourney.mjs';

function journeyOptsFromCtx(ctx) {
  var o = {};
  try {
    if (window.__novelWorkshopBridge__ && window.__novelWorkshopBridge__.getNovel) {
      var nb = window.__novelWorkshopBridge__.getNovel();
      o.novelTouched = !!(nb && (nb.sourceLen || nb.chapters && nb.chapters.length));
    }
  } catch (e) { /* ignore */ }
  return o;
}

export async function refreshCardJourneyTip(ctx) {
  var host = document.getElementById('cardJourneyHost');
  if (!host || !ctx || !ctx.state) return;
  var cardId = String(ctx.state.draftId || '').trim();
  if (!cardId) {
    host.innerHTML = '';
    return;
  }
  var steps = await detectCardJourneySteps(cardId, ctx.state, journeyOptsFromCtx(ctx));
  host.innerHTML = renderJourneyTipHtml(steps, cardId);
  bindCardJourneyTip(host, cardId);
}

export function installCardJourneyRefresh(ctx) {
  if (!ctx || ctx.__cardJourneyInstalled) return;
  ctx.__cardJourneyInstalled = true;
  var refresh = function() { refreshCardJourneyTip(ctx); };
  window.addEventListener('card-builder-data-changed', refresh);
  window.addEventListener('card-draft-changed', refresh);
  window.addEventListener('worldbook-changed', refresh);
  refresh();
}
