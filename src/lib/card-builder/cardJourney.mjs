/**
 * 绑卡制作向导（轻量 tip，可关闭）
 */
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
  var steps = [];
  var name = String((state && state.charName) || '').trim();
  var wb = (state && state.worldbookEntries) || [];
  if (!name) {
    steps.push({ id: 'character', label: '补全角色设定', hash: 'character' });
  }
  if (!wb.length) {
    steps.push({ id: 'worldbook', label: '添加世界书', hash: 'worldbook' });
  }
  if (!opts.novelTouched) {
    steps.push({ id: 'novel', label: '绑定小说工坊', hash: 'novel-source' });
  }
  if (!opts.hasStory) {
    steps.push({ id: 'story', label: '去 Story Studio 写作', hash: 'story-studio' });
  }
  steps.push({ id: 'publish', label: '导出检查 / 发布', hash: 'card-manager' });
  return steps;
}

export function renderJourneyTipHtml(steps, cardId) {
  if (!steps || !steps.length) return '';
  var links = steps.map(function(s) {
    return '<button type="button" class="btn-inline card-journey-link" data-journey-hash="'
      + s.hash + '">' + s.label + '</button>';
  }).join(' · ');
  return '<div class="account-session-tip card-journey-tip" data-card-id="' + cardId + '">'
    + '制作路线：' + links
    + ' · <button type="button" class="btn-inline card-journey-dismiss">不再提示</button>'
    + '</div>';
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
