/**
 * 绑卡制作向导（轻量 tip，可关闭）
 */
import { computeCardProgress } from './cardProgress.mjs';

var DISMISS_KEY = 'st_v3_card_journey_dismiss_v1';

function dismissedMap() {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}') || {};
  } catch (e) {
    return {};
  }
}

export function dismissCardJourney(cardId) {
  if (!cardId) return;
  var m = dismissedMap();
  m[String(cardId)] = Date.now();
  localStorage.setItem(DISMISS_KEY, JSON.stringify(m));
}

export function isCardJourneyDismissed(cardId) {
  return !!(cardId && dismissedMap()[String(cardId)]);
}

/**
 * @param {object} ctx
 * @param {string} cardId
 * @param {object} state
 */
export async function detectCardJourneySteps(cardId, state, opts) {
  opts = opts || {};
  if (!cardId || isCardJourneyDismissed(cardId)) return [];
  var progress = computeCardProgress(state, opts);
  return (progress.suggestions || []).slice(0, 5).map(function(s) {
    return { id: s.id, label: s.label, hash: s.hash || 'character' };
  });
}

export function renderJourneyTipHtml(steps, cardId) {
  if (!steps || !steps.length) return '';
  var first = steps[0];
  return '<p class="ui-hint card-journey-tip" data-card-id="' + cardId + '">'
    + '建议下一步：<button type="button" class="btn-inline card-journey-link" data-journey-hash="'
    + first.hash + '">' + first.label + '</button>'
    + ' · <button type="button" class="btn-inline card-journey-dismiss">不再提示</button>'
    + '</p>';
}

export function bindCardJourneyTip(container, cardId) {
  if (!container) return;
  container.querySelectorAll('.card-journey-link').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var h = btn.getAttribute('data-journey-hash') || 'character';
      location.hash = h;
    });
  });
  var dismiss = container.querySelector('.card-journey-dismiss');
  if (dismiss) {
    dismiss.addEventListener('click', function() {
      dismissCardJourney(cardId);
      var tip = container.querySelector('.card-journey-tip');
      if (tip) tip.remove();
    });
  }
}
