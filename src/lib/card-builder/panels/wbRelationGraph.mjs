/**
 * 世界书「关系一览」弹窗（§6.4.3 · D18）
 */

import {
  mountCardRelationGraph,
  destroyCardRelationGraph,
  relayoutCardRelationGraph,
} from '../cardRelationGraph.mjs';

var modalOpen = false;

function getEntries() {
  return window.__getWorldbookEntries__ ? (window.__getWorldbookEntries__() || []) : [];
}

function closeModal(overlay) {
  modalOpen = false;
  destroyCardRelationGraph();
  if (overlay && overlay.__wbRelKeyHandler) {
    document.removeEventListener('keydown', overlay.__wbRelKeyHandler);
  }
  if (overlay && overlay.parentNode) overlay.remove();
}

export function openWorldbookRelationGraphModal() {
  if (modalOpen) return;
  var entries = getEntries();
  var overlay = document.createElement('div');
  overlay.className = 'app-confirm-overlay ss-studio-modal wb-relation-modal';
  overlay.setAttribute('role', 'presentation');
  overlay.innerHTML =
    '<div class="app-confirm-dialog ss-studio-modal__dialog wb-relation-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="wbRelationGraphTitle" tabindex="-1">'
    + '<div class="ss-modal-head">'
    + '<h3 id="wbRelationGraphTitle" class="ss-studio-modal__title">关系一览</h3>'
    + '<button type="button" class="btn-icon btn-icon--sm" data-wb-rel-close aria-label="关闭">×</button>'
    + '</div>'
    + '<div class="ss-modal-body wb-relation-modal__body">'
    + '<p class="ui-hint wb-relation-modal__lead">只读：worldbook 人物投影与共触发关系；改正文请回世界书条目。</p>'
    + '<div class="novel-graph-wrap wb-relation-graph-wrap">'
    + '<div id="wbRelationGraphCy" class="novel-graph-cy wb-relation-graph-cy" role="img" aria-label="卡关系图谱"></div>'
    + '</div>'
    + '<div class="novel-graph-footer ss-graph-footer wb-relation-graph-footer">'
    + '<div class="novel-graph-footer-meta novel-meta-line" aria-live="polite">'
    + '<span class="novel-meta-group ss-muted">点击节点查看投影状态</span>'
    + '</div>'
    + '<div id="wbRelationGraphDetail" class="novel-graph-detail ss-graph-detail">点击节点查看投影状态</div>'
    + '</div>'
    + '</div>'
    + '<div class="app-confirm-actions">'
    + '<button type="button" class="app-confirm-btn" data-wb-rel-close>关闭</button>'
    + '<button type="button" class="app-confirm-btn" data-wb-rel-layout>重新布局</button>'
    + '</div></div>';
  document.body.appendChild(overlay);
  modalOpen = true;

  var cy = overlay.querySelector('#wbRelationGraphCy');
  var detail = overlay.querySelector('#wbRelationGraphDetail');
  mountCardRelationGraph(cy, entries, { detailEl: detail, highlightDegree: 1 });

  function close() {
    closeModal(overlay);
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
  }
  overlay.querySelectorAll('[data-wb-rel-close]').forEach(function(btn) {
    btn.addEventListener('click', close);
  });
  overlay.querySelector('[data-wb-rel-layout]').addEventListener('click', function() {
    relayoutCardRelationGraph();
  });
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', onKey);
  overlay.__wbRelKeyHandler = onKey;
  var dialog = overlay.querySelector('.wb-relation-modal__dialog');
  if (dialog && dialog.focus) dialog.focus();
}

export function bindWorldbookRelationGraphButton(ctx) {
  var btn = ctx.$('btnOpenWbRelationGraph');
  if (!btn || btn.__wbRelBound) return;
  btn.__wbRelBound = true;
  btn.addEventListener('click', function() {
    openWorldbookRelationGraphModal();
  });
  window.addEventListener('card-open-relation-graph', function() {
    openWorldbookRelationGraphModal();
  });
}
