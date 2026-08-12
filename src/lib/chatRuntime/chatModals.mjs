/**
 * 试聊选段 / 归档弹窗（§6.3.6–§6.3.8 · D15/D12）
 */

import { escapeHtml } from '../utils.mjs';
import { showConfirmDialog } from '../ui/confirmDialog.mjs';
import { CHAT_ANALYZE_DEFAULT } from './chatSession.mjs';
import {
  listStoryCatalogForCard,
  getActiveStoryNovelIdForCard,
  createBlankStoryNovel,
  promoteChatEpisodeToStory,
} from './chatPromote.mjs';
import { LEDGER_STATUSES } from '../storyStudio/plotLedger.mjs';

function previewLine(content, max) {
  var s = String(content || '').replace(/\s+/g, ' ').trim();
  var lim = max != null ? max : 120;
  if (s.length <= lim) return s;
  return s.slice(0, lim - 1) + '…';
}

function mountModal(title, bodyHtml, actionsHtml) {
  return new Promise(function(resolve) {
    var overlay = document.createElement('div');
    overlay.className = 'app-confirm-overlay ss-studio-modal';
    overlay.innerHTML =
      '<div class="app-confirm-dialog ss-studio-modal__dialog" role="dialog" aria-modal="true" style="max-width:520px;width:92vw;">'
      + '<h3 class="ss-studio-modal__title">' + escapeHtml(title) + '</h3>'
      + '<div class="ss-modal-body ss-modal-body--form">' + bodyHtml + '</div>'
      + '<div class="app-confirm-actions">' + actionsHtml + '</div>'
      + '</div>';
    document.body.appendChild(overlay);
    function close(val) {
      overlay.remove();
      resolve(val);
    }
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) close(null);
    });
    overlay.querySelectorAll('[data-modal-action]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        close(btn.getAttribute('data-modal-action'));
      });
    });
  });
}

/**
 * @param {{ messages: {id,role,content}[], selectionIds?: string[] }} opts
 * @returns {Promise<string[]|null>}
 */
export async function openChatSelectionModal(opts) {
  var o = opts || {};
  var messages = Array.isArray(o.messages) ? o.messages : [];
  if (!messages.length) {
    await showConfirmDialog({
      icon: '💬',
      title: '尚无试聊记录',
      message: '请先在试聊 Tab 玩几轮后再选段。',
      okText: '知道了',
      danger: false,
    });
    return null;
  }
  var selected = {};
  (o.selectionIds || []).forEach(function(id) { selected[id] = true; });

  var rows = messages.map(function(m, idx) {
    var roleLabel = m.role === 'user' ? '用户' : '场景';
    var checked = selected[m.id] ? ' checked' : '';
    return '<label class="chat-select-row" style="display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--color-border-subtle, rgba(255,255,255,0.08));">'
      + '<input type="checkbox" data-msg-id="' + escapeHtml(m.id) + '"' + checked + ' />'
      + '<span style="flex:0 0 auto;font-size:0.72rem;opacity:0.7;">' + escapeHtml(String(idx + 1)) + '·' + roleLabel + '</span>'
      + '<span style="flex:1;font-size:0.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'
      + escapeHtml(previewLine(m.content, 120))
      + '</span></label>';
  }).join('');

  var body = '<div style="max-height:50vh;overflow:auto;">' + rows + '</div>'
    + '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">'
    + '<button type="button" class="btn-inline" data-select-all>全选</button>'
    + '<button type="button" class="btn-inline" data-select-none>取消全选</button>'
    + '<button type="button" class="btn-inline" data-select-recent>最近 ' + CHAT_ANALYZE_DEFAULT + ' 条</button>'
    + '</div>';

  var overlay = document.createElement('div');
  overlay.className = 'app-confirm-overlay ss-studio-modal';
  overlay.innerHTML =
    '<div class="app-confirm-dialog ss-studio-modal__dialog" role="dialog" aria-modal="true" style="max-width:520px;width:92vw;">'
    + '<h3 class="ss-studio-modal__title">选择试聊消息</h3>'
    + '<div class="ss-modal-body ss-modal-body--form">' + body + '</div>'
    + '<div class="app-confirm-actions">'
    + '<button type="button" class="app-confirm-btn" data-modal-action="cancel">取消</button>'
    + '<button type="button" class="app-confirm-btn primary" data-modal-action="ok">确定</button>'
    + '</div></div>';
  document.body.appendChild(overlay);

  return new Promise(function(resolve) {
    function close(val) {
      overlay.remove();
      resolve(val);
    }
    overlay.querySelector('[data-select-all]').addEventListener('click', function() {
      overlay.querySelectorAll('input[data-msg-id]').forEach(function(cb) { cb.checked = true; });
    });
    overlay.querySelector('[data-select-none]').addEventListener('click', function() {
      overlay.querySelectorAll('input[data-msg-id]').forEach(function(cb) { cb.checked = false; });
    });
    overlay.querySelector('[data-select-recent]').addEventListener('click', function() {
      overlay.querySelectorAll('input[data-msg-id]').forEach(function(cb) { cb.checked = false; });
      var cbs = overlay.querySelectorAll('input[data-msg-id]');
      for (var i = Math.max(0, cbs.length - CHAT_ANALYZE_DEFAULT); i < cbs.length; i++) {
        cbs[i].checked = true;
      }
    });
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) close(null);
    });
    overlay.querySelector('[data-modal-action="cancel"]').addEventListener('click', function() {
      close(null);
    });
    overlay.querySelector('[data-modal-action="ok"]').addEventListener('click', function() {
      var ids = [];
      overlay.querySelectorAll('input[data-msg-id]:checked').forEach(function(cb) {
        ids.push(cb.getAttribute('data-msg-id'));
      });
      close(ids);
    });
  });
}

/** @param {object} opts */
export async function openChatPromoteModal(opts) {
  var o = opts || {};
  var draftId = String(o.draftId || '');
  var messageIds = Array.isArray(o.messageIds) ? o.messageIds : [];
  if (!draftId || !messageIds.length) return null;

  var catalog = await listStoryCatalogForCard(draftId);
  var activeId = await getActiveStoryNovelIdForCard(draftId);
  var options = catalog.map(function(c) {
    var id = c.id || c.novelId;
    return '<option value="' + escapeHtml(id) + '"' + (id === activeId ? ' selected' : '') + '>'
      + escapeHtml(c.title || id) + '</option>';
  }).join('');

  var body =
    '<p style="font-size:0.82rem;opacity:0.85;margin:0 0 12px;">已选 <strong>' + messageIds.length + '</strong> 条消息</p>'
    + '<label style="display:flex;gap:8px;align-items:center;margin:8px 0;"><input type="checkbox" id="cpChapter" checked /> 章节草稿</label>'
    + '<div id="cpChapterFields" style="margin-left:24px;">'
    + '<label class="form-group">目标 novel<select id="cpNovel" class="ui-select" style="width:100%;">'
    + options + '<option value="__new__">＋ 新建空白 novel</option></select></label>'
    + '<label class="form-group">章标题<input id="cpTitle" class="ui-input" value="试聊归档 · ' + new Date().toISOString().slice(0, 10) + '" /></label>'
    + '<label class="form-group">正文模式<select id="cpMode" class="ui-select"><option value="verbatim">原文拼接</option></select></label>'
    + '</div>'
    + '<label style="display:flex;gap:8px;align-items:center;margin:12px 0 8px;"><input type="checkbox" id="cpLedger" /> plotLedger 条目</label>'
    + '<div id="cpLedgerFields" style="margin-left:24px;display:none;">'
    + '<label class="form-group">标题<input id="cpLedgerTitle" class="ui-input" value="试聊状态摘要" /></label>'
    + '<label class="form-group">status<select id="cpLedgerStatus" class="ui-select">'
    + LEDGER_STATUSES.map(function(s) {
      return '<option value="' + s + '"' + (s === 'open' ? ' selected' : '') + '>' + s + '</option>';
    }).join('')
    + '</select></label>'
    + '<label class="form-group">note<textarea id="cpLedgerNote" class="ui-textarea" rows="2"></textarea></label>'
    + '<label style="display:flex;gap:8px;align-items:center;"><input type="checkbox" id="cpMvu" /> 附 MVU 快照</label>'
    + '</div>';

  var overlay = document.createElement('div');
  overlay.className = 'app-confirm-overlay ss-studio-modal';
  overlay.innerHTML =
    '<div class="app-confirm-dialog ss-studio-modal__dialog" role="dialog" aria-modal="true" style="max-width:520px;width:92vw;">'
    + '<h3 class="ss-studio-modal__title">归档到 Story</h3>'
    + '<div class="ss-modal-body ss-modal-body--form">' + body + '</div>'
    + '<div class="app-confirm-actions">'
    + '<button type="button" class="app-confirm-btn" data-modal-action="cancel">取消</button>'
    + '<button type="button" class="app-confirm-btn primary" data-modal-action="ok">归档</button>'
    + '</div></div>';
  document.body.appendChild(overlay);

  var ledgerCb = overlay.querySelector('#cpLedger');
  var ledgerFields = overlay.querySelector('#cpLedgerFields');
  if (ledgerCb && ledgerFields) {
    ledgerCb.addEventListener('change', function() {
      ledgerFields.style.display = ledgerCb.checked ? 'block' : 'none';
    });
  }

  var action = await new Promise(function(resolve) {
    function close(val) {
      overlay.remove();
      resolve(val);
    }
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) close(null);
    });
    overlay.querySelector('[data-modal-action="cancel"]').addEventListener('click', function() { close(null); });
    overlay.querySelector('[data-modal-action="ok"]').addEventListener('click', function() { close('ok'); });
  });

  if (action !== 'ok') return null;

  var useChapter = overlay.querySelector('#cpChapter') ? overlay.querySelector('#cpChapter').checked : false;
  var useLedger = ledgerCb ? ledgerCb.checked : false;
  if (!useChapter && !useLedger) return null;

  var novelSel = overlay.querySelector('#cpNovel');
  var novelId = novelSel ? novelSel.value : '';
  if (novelId === '__new__') {
    var created = await createBlankStoryNovel(draftId, '试聊归档 ' + new Date().toISOString().slice(0, 10));
    novelId = created.id;
  }
  if (!novelId) return null;

  return {
    novelId: novelId,
    messageIds: messageIds,
    chapterDraft: useChapter ? {
      title: (overlay.querySelector('#cpTitle') || {}).value,
      mode: (overlay.querySelector('#cpMode') || {}).value || 'verbatim',
    } : null,
    plotLedger: useLedger ? {
      title: (overlay.querySelector('#cpLedgerTitle') || {}).value || '试聊状态摘要',
      status: (overlay.querySelector('#cpLedgerStatus') || {}).value || 'open',
      note: (overlay.querySelector('#cpLedgerNote') || {}).value || '',
      includeMvu: !!(overlay.querySelector('#cpMvu') && overlay.querySelector('#cpMvu').checked),
    } : null,
  };
}
