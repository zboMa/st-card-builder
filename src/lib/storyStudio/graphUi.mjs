/**
 * Story Studio 图谱交互：详情、右键菜单、弹窗编辑（对齐小说工坊图谱 UX）
 */
import { genStoryId } from './state.mjs';
import { showSsConfirm, showSsModal } from './dialogs.mjs';
import { escapeHtml } from '../utils.mjs';
import { state, $, setStatus, persistNovel } from './shared.mjs';

export var storyGraphUi = {
  personOnly: false,
  highlightDepth: 2,
};

var TYPE_ZH = {
  character: '人物',
  location: '地点',
  other: '其他',
  person: '人物',
  place: '地点',
  concept: '其他',
  protagonist: '主角',
};

var STORY_TYPE_FROM_KG = {
  person: 'character',
  place: 'location',
  location: 'location',
  concept: 'other',
  protagonist: 'character',
};

function hideCtxMenu() {
  var menu = $('ssGraphCtxMenu');
  if (menu) menu.hidden = true;
}

function ensureCtxMenu() {
  var menu = $('ssGraphCtxMenu');
  if (menu) return menu;
  menu = document.createElement('div');
  menu.id = 'ssGraphCtxMenu';
  menu.className = 'novel-graph-ctx-menu';
  menu.hidden = true;
  menu.setAttribute('role', 'menu');
  document.body.appendChild(menu);
  if (!document.__ssGraphCtxMenuBound) {
    document.__ssGraphCtxMenuBound = true;
    document.addEventListener('click', function() { hideCtxMenu(); });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') hideCtxMenu();
    });
  }
  return menu;
}

function findNode(id) {
  if (!state.novel || !state.novel.graph) return null;
  var sid = String(id || '');
  return (state.novel.graph.nodes || []).find(function(n) {
    return n && String(n.id) === sid;
  }) || null;
}

function findEdgeByEndpoints(from, to, label) {
  if (!state.novel || !state.novel.graph) return null;
  var f = String(from || '');
  var t = String(to || '');
  var lab = label != null ? String(label) : null;
  var edges = state.novel.graph.edges || [];
  var hit = edges.find(function(e) {
    return e && String(e.from) === f && String(e.to) === t
      && (lab == null || String(e.label || '') === lab);
  });
  if (hit) return hit;
  return edges.find(function(e) {
    return e && String(e.from) === f && String(e.to) === t;
  }) || null;
}

function touchGraph() {
  if (!state.novel || !state.novel.graph) return;
  state.novel.graph.updatedAt = new Date().toISOString();
}

async function saveAndRender(msg) {
  touchGraph();
  await persistNovel();
  if (msg) setStatus(msg);
  var mod = await import('./renderViews.mjs');
  mod.renderGraph();
}

function nodeOptionsHtml(selectedId) {
  var nodes = (state.novel && state.novel.graph && state.novel.graph.nodes) || [];
  return nodes.map(function(n) {
    var sel = String(n.id) === String(selectedId) ? ' selected' : '';
    return '<option value="' + escapeHtml(n.id) + '"' + sel + '>'
      + escapeHtml(n.name || n.id) + '</option>';
  }).join('');
}

export function formatStoryGraphDetail(payload) {
  if (!payload) return '点击节点或边查看详情';
  if (payload.kind === 'node') {
    var attrs = payload.attrs || {};
    var storyType = attrs.storyType || STORY_TYPE_FROM_KG[payload.type] || 'other';
    var typeZh = TYPE_ZH[storyType] || TYPE_ZH[payload.type] || payload.type || '';
    var note = attrs.note ? String(attrs.note) : '';
    return '<strong>' + escapeHtml(payload.label || payload.id) + '</strong>'
      + ' <span class="novel-graph-type">' + escapeHtml(typeZh) + '</span>'
      + (note
        ? '<ul class="novel-graph-attr-list"><li><span>备注</span> ' + escapeHtml(note) + '</li></ul>'
        : '')
      + '<div class="ss-graph-detail-actions">'
      + '<button type="button" class="btn btn-ghost btn-inline" data-ss-graph-act="edit-node" data-id="'
      + escapeHtml(payload.id) + '">编辑</button>'
      + '<button type="button" class="btn btn-ghost btn-inline" data-ss-graph-act="add-edge-from" data-id="'
      + escapeHtml(payload.id) + '">加关系</button>'
      + '</div>';
  }
  var ev = (payload.evidence || []).slice(0, 3).map(function(x) {
    return escapeHtml(String(x));
  }).join(' · ');
  return '<strong>' + escapeHtml(payload.source) + '</strong>'
    + ' → <em>' + escapeHtml(payload.label || '关系') + '</em> → '
    + '<strong>' + escapeHtml(payload.target) + '</strong>'
    + (ev ? '<div class="novel-graph-evidence">' + ev + '</div>' : '')
    + '<div class="ss-graph-detail-actions">'
    + '<button type="button" class="btn btn-ghost btn-inline" data-ss-graph-act="edit-edge"'
    + ' data-from="' + escapeHtml(payload.source) + '"'
    + ' data-to="' + escapeHtml(payload.target) + '"'
    + ' data-label="' + escapeHtml(payload.label || '') + '">编辑</button>'
    + '</div>';
}

export function openEditNodeDialog(nodeOrId) {
  if (!state.novel) return Promise.resolve(false);
  var node = typeof nodeOrId === 'object' && nodeOrId
    ? nodeOrId
    : findNode(nodeOrId);
  var isNew = !node;
  var draft = node
    ? { id: node.id, type: node.type || 'character', name: node.name || '', note: node.note || '' }
    : { id: genStoryId('node'), type: 'character', name: '', note: '' };

  return showSsModal({
    title: isNew ? '添加节点' : '编辑节点',
    bodyHtml:
      '<div class="form-group">'
      + '<label for="ssGraphNodeType">类型</label>'
      + '<select id="ssGraphNodeType">'
      + '<option value="character"' + (draft.type === 'character' ? ' selected' : '') + '>人物</option>'
      + '<option value="location"' + (draft.type === 'location' ? ' selected' : '') + '>地点</option>'
      + '<option value="other"' + (draft.type === 'other' ? ' selected' : '') + '>其他</option>'
      + '</select></div>'
      + '<div class="form-group">'
      + '<label for="ssGraphNodeName">名称</label>'
      + '<input id="ssGraphNodeName" type="text" value="' + escapeHtml(draft.name) + '" placeholder="节点名称" autocomplete="off" />'
      + '</div>'
      + '<div class="form-group">'
      + '<label for="ssGraphNodeNote">备注</label>'
      + '<textarea id="ssGraphNodeNote" rows="4" placeholder="身份、定位、备注…">'
      + escapeHtml(draft.note) + '</textarea></div>',
    footerHtml:
      '<button type="button" class="app-confirm-btn" data-ss-dlg="cancel">取消</button>'
      + '<button type="button" class="app-confirm-btn primary" data-ss-dlg="ok">保存</button>',
    onMount: function(overlay, close) {
      var ok = overlay.querySelector('[data-ss-dlg="ok"]');
      var cancel = overlay.querySelector('[data-ss-dlg="cancel"]');
      if (cancel) cancel.addEventListener('click', close);
      var nameEl = overlay.querySelector('#ssGraphNodeName');
      if (nameEl) {
        try { nameEl.focus(); nameEl.select(); } catch (e) { /* ignore */ }
      }
      if (ok) {
        ok.addEventListener('click', async function() {
          var typeEl = overlay.querySelector('#ssGraphNodeType');
          var noteEl = overlay.querySelector('#ssGraphNodeNote');
          var name = nameEl ? String(nameEl.value || '').trim() : '';
          if (!name) {
            setStatus('请填写节点名称', true);
            return;
          }
          var next = {
            id: draft.id,
            type: typeEl ? typeEl.value : 'other',
            name: name,
            note: noteEl ? String(noteEl.value || '') : '',
          };
          if (!state.novel.graph) state.novel.graph = { nodes: [], edges: [] };
          if (isNew) {
            state.novel.graph.nodes.push(next);
          } else {
            var idx = state.novel.graph.nodes.findIndex(function(n) {
              return String(n.id) === String(draft.id);
            });
            if (idx >= 0) state.novel.graph.nodes[idx] = next;
            else state.novel.graph.nodes.push(next);
          }
          close();
          await saveAndRender(isNew ? '已添加节点' : '节点已更新');
        });
      }
    },
  }).then(function() { return true; });
}

export function openEditEdgeDialog(opts) {
  opts = opts || {};
  if (!state.novel) return Promise.resolve(false);
  var nodes = state.novel.graph.nodes || [];
  if (nodes.length < 1) {
    setStatus('请先添加节点', true);
    return Promise.resolve(false);
  }
  var existing = opts.edge || null;
  if (!existing && opts.from && opts.to) {
    existing = findEdgeByEndpoints(opts.from, opts.to, opts.label);
  }
  var isNew = !existing;
  var draft = existing
    ? { id: existing.id, from: existing.from, to: existing.to, label: existing.label || '关系', note: existing.note || '' }
    : {
      id: genStoryId('edge'),
      from: opts.from || nodes[0].id,
      to: opts.to || (nodes[1] ? nodes[1].id : nodes[0].id),
      label: '关系',
      note: '',
    };

  return showSsModal({
    title: isNew ? '添加关系' : '编辑关系',
    bodyHtml:
      '<div class="form-group">'
      + '<label for="ssGraphEdgeFrom">起点</label>'
      + '<select id="ssGraphEdgeFrom">' + nodeOptionsHtml(draft.from) + '</select></div>'
      + '<div class="form-group">'
      + '<label for="ssGraphEdgeLabel">关系</label>'
      + '<input id="ssGraphEdgeLabel" type="text" value="' + escapeHtml(draft.label) + '" placeholder="例如：师徒 / 对立" autocomplete="off" />'
      + '</div>'
      + '<div class="form-group">'
      + '<label for="ssGraphEdgeTo">终点</label>'
      + '<select id="ssGraphEdgeTo">' + nodeOptionsHtml(draft.to) + '</select></div>'
      + '<div class="form-group">'
      + '<label for="ssGraphEdgeNote">备注（可选）</label>'
      + '<input id="ssGraphEdgeNote" type="text" value="' + escapeHtml(draft.note || '') + '" placeholder="补充说明" autocomplete="off" />'
      + '</div>',
    footerHtml:
      '<button type="button" class="app-confirm-btn" data-ss-dlg="cancel">取消</button>'
      + '<button type="button" class="app-confirm-btn primary" data-ss-dlg="ok">保存</button>',
    onMount: function(overlay, close) {
      var ok = overlay.querySelector('[data-ss-dlg="ok"]');
      var cancel = overlay.querySelector('[data-ss-dlg="cancel"]');
      if (cancel) cancel.addEventListener('click', close);
      var labelEl = overlay.querySelector('#ssGraphEdgeLabel');
      if (labelEl) {
        try { labelEl.focus(); labelEl.select(); } catch (e) { /* ignore */ }
      }
      if (ok) {
        ok.addEventListener('click', async function() {
          var fromEl = overlay.querySelector('#ssGraphEdgeFrom');
          var toEl = overlay.querySelector('#ssGraphEdgeTo');
          var noteEl = overlay.querySelector('#ssGraphEdgeNote');
          var from = fromEl ? fromEl.value : '';
          var to = toEl ? toEl.value : '';
          var label = labelEl ? String(labelEl.value || '').trim() || '关系' : '关系';
          if (!from || !to) {
            setStatus('请选择起点与终点', true);
            return;
          }
          var next = {
            id: draft.id,
            from: from,
            to: to,
            label: label,
            note: noteEl ? String(noteEl.value || '') : '',
          };
          if (!state.novel.graph.edges) state.novel.graph.edges = [];
          if (isNew) {
            state.novel.graph.edges.push(next);
          } else {
            var idx = state.novel.graph.edges.findIndex(function(e) {
              return e && String(e.id) === String(draft.id);
            });
            if (idx >= 0) state.novel.graph.edges[idx] = next;
            else state.novel.graph.edges.push(next);
          }
          close();
          await saveAndRender(isNew ? '已添加关系' : '关系已更新');
        });
      }
    },
  }).then(function() { return true; });
}

export async function deleteStoryGraphNode(nodeId) {
  if (!state.novel) return false;
  var node = findNode(nodeId);
  if (!node) return false;
  var ok = await showSsConfirm({
    icon: '🗑️',
    title: '删除节点？',
    message: '将删除「' + (node.name || node.id) + '」及其相关关系边。',
    okText: '删除',
    cancelText: '取消',
    danger: true,
  });
  if (!ok) return false;
  var sid = String(nodeId);
  state.novel.graph.nodes = (state.novel.graph.nodes || []).filter(function(n) {
    return String(n.id) !== sid;
  });
  state.novel.graph.edges = (state.novel.graph.edges || []).filter(function(e) {
    return e && String(e.from) !== sid && String(e.to) !== sid;
  });
  await saveAndRender('已删除节点');
  return true;
}

export async function deleteStoryGraphEdge(edgeOrOpts) {
  if (!state.novel) return false;
  var edge = edgeOrOpts && edgeOrOpts.id
    ? edgeOrOpts
    : findEdgeByEndpoints(
      edgeOrOpts && edgeOrOpts.from,
      edgeOrOpts && edgeOrOpts.to,
      edgeOrOpts && edgeOrOpts.label
    );
  if (!edge) return false;
  var ok = await showSsConfirm({
    icon: '🗑️',
    title: '删除关系？',
    message: '确认删除「' + (edge.label || '关系') + '」边？',
    okText: '删除',
    cancelText: '取消',
    danger: true,
  });
  if (!ok) return false;
  var eid = String(edge.id);
  state.novel.graph.edges = (state.novel.graph.edges || []).filter(function(e) {
    return e && String(e.id) !== eid;
  });
  await saveAndRender('已删除关系');
  return true;
}

export function openStoryGraphCtxMenu(payload) {
  if (!payload) return;
  var menu = ensureCtxMenu();
  var items = [];
  if (payload.kind === 'edge') {
    items.push({
      id: 'edit',
      label: '编辑关系',
      run: function() {
        openEditEdgeDialog({
          from: payload.source || payload.from,
          to: payload.target || payload.to,
          label: payload.label,
        });
      },
    });
    items.push({
      id: 'del',
      label: '删除关系',
      danger: true,
      run: function() {
        deleteStoryGraphEdge({
          from: payload.source || payload.from,
          to: payload.target || payload.to,
          label: payload.label,
        });
      },
    });
  } else {
    items.push({
      id: 'edit',
      label: '编辑节点',
      run: function() { openEditNodeDialog(payload.id); },
    });
    items.push({
      id: 'add-edge',
      label: '从此添加关系',
      run: function() { openEditEdgeDialog({ from: payload.id }); },
    });
    items.push({
      id: 'del',
      label: '删除节点',
      danger: true,
      run: function() { deleteStoryGraphNode(payload.id); },
    });
  }
  menu.innerHTML = items.map(function(it) {
    return '<button type="button" role="menuitem" data-graph-act="' + escapeHtml(it.id) + '"'
      + (it.danger ? ' class="is-danger"' : '') + '>' + escapeHtml(it.label) + '</button>';
  }).join('');
  menu.querySelectorAll('[data-graph-act]').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var act = btn.getAttribute('data-graph-act');
      var hit = items.find(function(x) { return x.id === act; });
      hideCtxMenu();
      if (hit && hit.run) hit.run();
    });
  });
  var x = Math.max(8, Math.min(window.innerWidth - 190, payload.clientX || 0));
  var y = Math.max(8, Math.min(window.innerHeight - 160, payload.clientY || 0));
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.hidden = false;
}

export function bindStoryGraphUi() {
  var depthEl = $('ssGraphHighlightDepth');
  if (depthEl && !depthEl.__ssBound) {
    depthEl.__ssBound = true;
    depthEl.addEventListener('change', function() {
      var v = Math.max(0, Math.min(6, Math.floor(Number(depthEl.value) || 0)));
      depthEl.value = String(v);
      storyGraphUi.highlightDepth = v;
      import('./renderViews.mjs').then(function(m) { m.renderGraph(); });
    });
  }
  var personEl = $('ssGraphPersonOnly');
  if (personEl && !personEl.__ssBound) {
    personEl.__ssBound = true;
    personEl.addEventListener('change', function() {
      storyGraphUi.personOnly = !!personEl.checked;
      import('./renderViews.mjs').then(function(m) { m.renderGraph(); });
    });
  }
  var detail = $('ssGraphDetail');
  if (detail && !detail.__ssBound) {
    detail.__ssBound = true;
    detail.addEventListener('click', function(ev) {
      var btn = ev.target.closest('[data-ss-graph-act]');
      if (!btn) return;
      var act = btn.getAttribute('data-ss-graph-act');
      if (act === 'edit-node') openEditNodeDialog(btn.getAttribute('data-id'));
      else if (act === 'add-edge-from') openEditEdgeDialog({ from: btn.getAttribute('data-id') });
      else if (act === 'edit-edge') {
        openEditEdgeDialog({
          from: btn.getAttribute('data-from'),
          to: btn.getAttribute('data-to'),
          label: btn.getAttribute('data-label'),
        });
      }
    });
  }
}
