/**
 * 管理端：视图切换与数据加载（拆自 browserApp）
 */
import {
  state, api, $, escapeHtml, fmtBytes, fmtTime, setBanner, setStatus, isOps, hasPerm, askReason,
} from './adminShared.mjs';
import { sidebarGroups, quotaRows, sortCardsByBytes, capNote, permLabel, dictOptions, DICT_TYPES, MENU_LOCKED } from './deskView.mjs';
import { apiUrl } from '../publicConfig.mjs';

function showView(name, opts) {
  if (!(opts && opts.keep)) {
    ['adminUserProfile', 'adminCardDetail', 'adminNovelDetail', 'adminShareDetail'].forEach(function(id) {
      var el = $(id);
      if (el) el.innerHTML = '';
    });
  }
  state.view = name;
  document.querySelectorAll('[data-admin-view]').forEach(function(sec) {
    sec.hidden = sec.getAttribute('data-admin-view') !== name;
  });
  document.querySelectorAll('[data-admin-nav]').forEach(function(btn) {
    btn.classList.toggle('is-active', btn.getAttribute('data-admin-nav') === name);
  });
  if (name === 'dashboard') loadDashboard();
  if (name === 'users') loadUsers();
  if (name === 'cards') loadCards();
  if (name === 'novels') loadNovels();
  if (name === 'shares') loadShares();
  if (name === 'tokens') loadTokens();
  if (name === 'databases') loadDatabases();
  if (name === 'audit') loadAudit();
  if (name === 'moderation') loadModeration();
  if (name === 'system') loadSystem();
  if (name === 'roles') loadRoles();
  if (name === 'menus') loadMenus();
  if (name === 'oplog') loadOpLog();
  if (name === 'loginlog') loadLoginLog();
  if (name === 'params') loadParams();
  if (name === 'dicts') loadDicts();
  if (name === 'invites') loadInvites();
  if (name === 'quota') loadQuota();
  if (name === 'files') loadFiles();
  if (name === 'tasks') loadTasks();
  if (name === 'backup') loadBackup();
}

function navBtn(m) {
  return '<button type="button" data-admin-nav="' + escapeHtml(m.id) + '">'
    + escapeHtml(m.name) + '</button>';
}

/** 从 /api/admin/menus 渲染侧边导航（按权限点过滤） */
async function renderAdminNav() {
  var nav = $('adminNav');
  if (!nav) return;
  try {
    var data = await api('/api/admin/menus');
    var menus = data.menus || [];
    var visible = menus.filter(function(m) { return !m.perm || hasPerm(m.perm); });
    var tree = sidebarGroups(visible);
    var html = tree.tops.map(navBtn).join('');
    tree.groups.forEach(function(g) {
      html += '<div class="admin-nav-group">'
        + '<div class="admin-nav-group-label">' + escapeHtml(g.name) + '</div>'
        + g.children.map(navBtn).join('') + '</div>';
    });
    nav.innerHTML = html;
    applyDictSelects();
  } catch (e) {
    nav.innerHTML = '';
  }
}

var PERM_DOMAIN_LABELS = {
  admin: '用户与分享',
  content: '内容',
  moderation: '审核',
  sys: '系统',
};

function permGroups(all) {
  var out = { admin: [], content: [], moderation: [], sys: [] };
  (all || []).forEach(function(p) {
    var domain = String(p || '').split('.')[0];
    if (out[domain]) out[domain].push(p);
    else out[domain] = [p];
  });
  return out;
}

function permEditorHtml(checked, groups) {
  var html = '';
  Object.keys(groups).forEach(function(key) {
    if (!groups[key].length) return;
    html += '<div class="admin-perm-group"><div class="admin-perm-group-label">'
      + escapeHtml(PERM_DOMAIN_LABELS[key] || key) + '</div><div class="admin-perm-items">';
    groups[key].forEach(function(p) {
      html += '<label class="admin-perm-item"><input type="checkbox" value="' + escapeHtml(p) + '"'
        + (checked.indexOf(p) >= 0 ? ' checked' : '') + '> ' + escapeHtml(permLabel(p))
        + ' <code>' + escapeHtml(p) + '</code></label>';
    });
    html += '</div></div>';
  });
  return html;
}

async function loadDashboard() {
  var grid = $('adminDashGrid');
  var flags = $('adminDashFlags');
  var trendBox = $('adminTrendBox');
  if (trendBox) trendBox.innerHTML = '';
  try {
    var data = await api('/api/admin/overview');
    var couchOk = data.couch && data.couch.ok;
    var tasks = [];
    var quota = { users: [] };
    var approvals = { approvals: [] };
    var audit = { audit: [] };
    var sys = null;
    try { tasks = (await api('/api/admin/tasks')).tasks || []; } catch (e1) { tasks = []; }
    try { quota = await api('/api/admin/quota/users?over=1&limit=1'); } catch (e2) { quota = { total: 0 }; }
    try { approvals = await api('/api/admin/moderation/approvals?status=pending'); } catch (e3) { approvals = { approvals: [] }; }
    try { audit = await api('/api/admin/audit?limit=8'); } catch (e4) { audit = { audit: [] }; }
    try { sys = (await api('/api/admin/system-status')).status; } catch (e5) { sys = null; }
    var failed = tasks.filter(function(t) { return t.lastStatus === 'error'; }).length;
    var pending = (approvals.approvals || []).length;
    var over = quota.total || 0;
    if (grid) {
      grid.innerHTML = ''
        + statusRow('databases', 'Couch', couchOk ? '正常' : '异常')
        + statusRow('tasks', '任务', failed ? (failed + ' 个失败') : '任务正常')
        + statusRow('quota', '配额', over ? (over + ' 人超限') : '无人超限')
        + statusRow('moderation', '审批', pending ? (pending + ' 条待审批') : '无待审批');
    }
    if (flags) {
      var uptime = sys ? Math.round((sys.uptimeSec || 0) / 60) + ' 分钟' : '—';
      var mem = sys ? ((sys.memUsedPct || 0) + '%') : '—';
      flags.textContent = '进程已运行 ' + uptime + '，内存占用 ' + mem;
    }
    if (trendBox) {
      var lines = (audit.audit || []).slice(0, 8).map(function(r) {
        var who = r.by || '—';
        var target = r.targetCardId || r.token || r.targetUserId || '—';
        var open = r.targetNovelId && r.targetUserId
          ? ' data-open-novel="' + escapeHtml(r.targetUserId) + '|' + escapeHtml(r.targetCardId || '') + '|' + escapeHtml(r.targetNovelId) + '"'
          : (r.targetCardId && r.targetUserId
            ? ' data-open-card="' + escapeHtml(r.targetUserId) + '|' + escapeHtml(r.targetCardId) + '"'
            : (r.token
              ? ' data-open-share="' + escapeHtml(r.token) + '"'
              : ' data-user-profile="' + escapeHtml(r.targetUserId || '') + '"'));
        return '<button type="button" class="admin-status-row"' + open + '>'
          + '<span>' + escapeHtml(who) + ' · ' + escapeHtml(r.action || '') + ' · ' + escapeHtml(target) + '</span>'
          + '<span class="admin-muted">' + escapeHtml(r.reason || '') + '</span></button>';
      }).join('');
      trendBox.innerHTML = '<h3>最近处置</h3>'
        + (lines
          ? '<div class="admin-status-list">' + lines + '</div>'
          : '<p class="admin-muted">还没有处置记录</p>');
    }
    setBanner('');
  } catch (e) {
    if (grid) grid.innerHTML = '';
    setBanner(bannerForError(e), e.status === 502 || e.status >= 500 ? 'err' : 'warn');
  }
}

function statusRow(view, label, value) {
  return '<button type="button" class="admin-status-row" data-admin-nav="' + view + '">'
    + '<span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></button>';
}

function trendSvg(trends) {
  if (!trends.length) return '<div class="admin-empty">无趋势数据</div>';
  var W = 700, H = 130, PAD = 4;
  var max = Math.max(1, trends.reduce(function(a, t) { return Math.max(a, t.events, t.users, t.cards); }, 1));
  var series = {
    events: '#f59e0b',
    users: '#10b981',
    cards: '#6366f1',
  };
  function poly(key) {
    var pts = trends.map(function(t, i) {
      var x = PAD + i * ((W - PAD * 2) / Math.max(1, trends.length - 1));
      var y = H - PAD - (t[key] / max) * (H - PAD * 2);
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    return '<polyline fill="none" stroke="' + series[key] + '" stroke-width="1.6" points="' + pts + '"/>';
  }
  var legend = ['events 事件', 'users 注册', 'cards 新卡'].map(function(l, i) {
    var keys = ['events', 'users', 'cards'];
    return '<span class="admin-trend-legend"><i style="background:' + series[keys[i]] + '"></i>' + l + '</span>';
  }).join('');
  var labels = trends.map(function(t, i) {
    if (i % 2 !== 0 && i !== trends.length - 1) return '';
    return '<span class="admin-trend-label">' + escapeHtml(String(t.date).slice(5)) + '</span>';
  }).join('');
  return '<div class="admin-trend"><h3>近 ' + trends.length + ' 日趋势</h3>'
    + '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" class="admin-trend-svg">'
    + poly('events') + poly('users') + poly('cards') + '</svg>'
    + '<div class="admin-trend-labels">' + labels + '</div>'
    + '<div class="admin-trend-legend">' + legend + '</div></div>';
}

function card(label, value, tone) {
  return '<div class="admin-stat' + (tone ? ' admin-stat--' + tone : '') + '">'
    + '<div class="admin-stat__label">' + escapeHtml(label) + '</div>'
    + '<div class="admin-stat__value">' + escapeHtml(value) + '</div></div>';
}

function flag(label, on) {
  return '<div class="admin-flag"><span>' + escapeHtml(label) + '</span>'
    + '<strong class="' + (on ? 'is-on' : 'is-off') + '">' + (on ? '开' : '关') + '</strong></div>';
}

function bannerForError(e) {
  if (e && (e.status === 502 || e.status === 503 || /Failed to fetch|NetworkError|HTTP 502/i.test(String(e.message)))) {
    return '无法连接 API（' + (e.message || e) + '）。请检查 st-card-builder-api / Nginx 反代 / CouchDB 是否运行。';
  }
  return String(e.message || e);
}

function pagerHtml(prefix, total, offset) {
  var size = state.pageSize;
  var page = Math.floor(offset / size) + 1;
  var pages = Math.max(1, Math.ceil(total / size));
  return '<div class="admin-pager">'
    + '<span>共 ' + total + ' 条 · 第 ' + page + '/' + pages + ' 页</span>'
    + '<button type="button" class="btn btn-sm btn-ghost" data-pager="' + prefix + '-prev"'
    + (offset <= 0 ? ' disabled' : '') + '>上一页</button>'
    + '<button type="button" class="btn btn-sm btn-ghost" data-pager="' + prefix + '-next"'
    + (offset + size >= total ? ' disabled' : '') + '>下一页</button>'
    + '</div>';
}

async function loadUsers() {
  var box = $('adminUserTable');
  var q = ($('adminUserQ') || {}).value || '';
  var status = ($('adminUserStatus') || {}).value || 'all';
  try {
    var data = await api('/api/admin/users?q=' + encodeURIComponent(q)
      + '&status=' + encodeURIComponent(status)
      + '&limit=' + state.pageSize
      + '&offset=' + state.usersOffset);
    var users = data.users || [];
    if (!box) return;
    if (!users.length) {
      box.innerHTML = '<div class="admin-empty">无匹配用户</div>' + pagerHtml('users', data.total || 0, state.usersOffset);
      return;
    }
    var note = capNote(data.capped, data.listedCap);
    box.innerHTML = (note ? '<p class="admin-muted">' + escapeHtml(note) + '</p>' : '')
      + '<table class="admin-table"><thead><tr>'
      + '<th>名字</th><th>邮箱或 Discord</th><th>档位</th><th>状态</th><th>卡数</th><th>更新</th>'
      + '</tr></thead><tbody>'
      + users.map(function(u) {
        var disabled = !!u.disabled;
        var identity = u.email
          ? escapeHtml(u.email)
          : (u.discordId ? ('Discord ' + escapeHtml(u.discordId)) : '—');
        return '<tr class="' + (disabled ? 'is-disabled' : '') + '" data-user-profile="' + escapeHtml(u.userId) + '">'
          + '<td><strong>' + escapeHtml(u.displayName || u.username || u.userId) + '</strong>'
          + '<div class="admin-muted">' + escapeHtml(u.userId) + '</div></td>'
          + '<td>' + identity + '</td>'
          + '<td>' + escapeHtml(u.quotaTier || 'registered') + '</td>'
          + '<td>' + (disabled ? '已禁用' : '正常') + '</td>'
          + '<td>' + escapeHtml(u.cardCount || 0) + '</td>'
          + '<td>' + escapeHtml(fmtTime(u.updatedAt || u.createdAt)) + '</td></tr>';
      }).join('')
      + '</tbody></table>'
      + pagerHtml('users', data.total || 0, state.usersOffset);
    box.hidden = !!(($('adminUserProfile') || {}).innerHTML);
  } catch (e) {
    if (box) box.innerHTML = '<div class="admin-empty">' + escapeHtml(e.message || e) + '</div>';
  }
}

async function loadShares() {
  var box = $('adminShareTable');
  var q = ($('adminShareQ') || {}).value || '';
  var type = ($('adminShareType') || {}).value || 'all';
  var status = ($('adminShareStatus') || {}).value || 'all';
  try {
    var data = await api('/api/admin/shares?q=' + encodeURIComponent(q)
      + '&type=' + encodeURIComponent(type)
      + '&status=' + encodeURIComponent(status)
      + '&limit=' + state.pageSize
      + '&offset=' + state.sharesOffset);
    var shares = data.shares || [];
    if (!box) return;
    if (!shares.length) {
      box.innerHTML = '<div class="admin-empty">无匹配分享</div>' + pagerHtml('shares', data.total || 0, state.sharesOffset);
      return;
    }
    var note = capNote(data.capped, data.listedCap);
    box.innerHTML = '<table class="admin-table"><thead><tr>'
      + '<th>目标名</th><th>类型</th><th>主人</th><th>状态</th><th>过期</th>'
      + '</tr></thead><tbody>'
      + shares.map(function(s) {
        var st = !s.enabled ? '已停' : (s.expired ? '已过期' : '有效');
        var kind = s.type === 'card-share' ? '卡' : (s.type === 'novel-share' ? '小说' : s.type);
        return '<tr data-open-share="' + escapeHtml(s.token) + '">'
          + '<td><strong>' + escapeHtml(s.titleHint || s.cardId || s.token) + '</strong></td>'
          + '<td>' + escapeHtml(kind) + '</td>'
          + '<td class="admin-mono">' + escapeHtml(s.ownerUserId || '—') + '</td>'
          + '<td>' + st + '</td>'
          + '<td>' + escapeHtml(fmtTime(s.expiresAt)) + '</td></tr>';
      }).join('')
      + '</tbody></table>'
      + pagerHtml('shares', data.total || 0, state.sharesOffset)
      + (note ? '<p class="admin-muted">' + escapeHtml(note) + '</p>' : '');
    box.hidden = !!(($('adminShareDetail') || {}).innerHTML);
  } catch (e) {
    if (box) box.innerHTML = '<div class="admin-empty">' + escapeHtml(e.message || e) + '</div>';
  }
}

async function openShareDetail(token) {
  state.openShareToken = token;
  var box = $('adminShareDetail');
  if (!box) return;
  var table = $('adminShareTable');
  if (table) table.hidden = true;
  try {
    var data = await api('/api/admin/shares/' + encodeURIComponent(token));
    var s = data.share || {};
    var on = s.enabled && !s.expired;
    var canToggle = hasPerm('admin.share.toggle');
    var canDelete = hasPerm('admin.share.delete');
    var kind = s.type === 'novel-share' || s.novelId ? '小说' : '卡';
    var target = s.novelId
      ? '<button type="button" class="btn btn-inline" data-open-novel="' + escapeHtml(s.ownerUserId) + '|' + escapeHtml(s.cardId) + '|' + escapeHtml(s.novelId) + '">' + escapeHtml(s.titleHint || s.novelId) + '</button>'
      : '<button type="button" class="btn btn-inline" data-open-card="' + escapeHtml(s.ownerUserId) + '|' + escapeHtml(s.cardId) + '">' + escapeHtml(s.titleHint || s.cardId) + '</button>';
    var actions = '';
    if (canToggle) {
      actions += on
        ? '<button type="button" class="btn btn-primary" data-share-soft="' + escapeHtml(s.token) + '" data-on="0">停用</button>'
        : '<button type="button" class="btn btn-primary" data-share-soft="' + escapeHtml(s.token) + '" data-on="1">恢复</button>';
      if (s.hasPassword) actions += ' <button type="button" class="btn btn-ghost" data-share-clear="' + escapeHtml(s.token) + '">清除口令</button>';
    }
    if (canDelete) actions += ' <button type="button" class="btn btn-ghost" data-share-del="' + escapeHtml(s.token) + '">删除映射</button>';
    box.innerHTML = '<div class="admin-editor">'
      + '<div class="admin-panel-head"><h3>' + escapeHtml(s.titleHint || s.token) + '</h3>'
      + '<button type="button" class="btn btn-ghost" id="btnAdminShareClose">返回列表</button></div>'
      + '<p class="admin-mono">' + escapeHtml(s.token) + ' <button type="button" class="btn btn-inline" data-share-copy="' + escapeHtml(s.token) + '">复制</button></p>'
      + '<p>' + kind + ' · 主人 <button type="button" class="btn btn-inline" data-user-profile="' + escapeHtml(s.ownerUserId) + '">' + escapeHtml(s.ownerUserId) + '</button>'
      + ' · 目标 ' + target + '</p>'
      + '<p class="admin-muted">' + (on ? '有效' : '打不开') + ' · 过期 ' + escapeHtml(fmtTime(s.expiresAt))
      + ' · 访客口令 ' + (s.hasPassword ? '已设置' : '无')
      + ' · 图片公开 ' + (s.pngPublic ? '是' : '否') + '</p>'
      + ((s.why || []).length ? '<p>现在打不开：' + escapeHtml(s.why.join('、')) + '</p>' : '')
      + (actions ? '<p>' + actions + '</p>' : '')
      + '<p class="admin-muted">停用后公开读取会被拒绝，恢复可以再打开。删除映射只删这条链接，不删卡和小说，删了不能恢复。这里不给这条链接设新口令。</p>'
      + '</div>';
  } catch (e) {
    box.innerHTML = '<div class="admin-editor"><h3>这条分享不存在</h3><button type="button" class="btn btn-ghost" id="btnAdminShareClose">返回列表</button></div>';
  }
}

async function loadTokens() {
  var box = $('adminTokenTable');
  var q = ($('adminTokenQ') || {}).value || '';
  var status = ($('adminTokenStatus') || {}).value || 'all';
  try {
    var data = await api('/api/admin/tokens?q=' + encodeURIComponent(q)
      + '&status=' + encodeURIComponent(status)
      + '&limit=' + state.pageSize
      + '&offset=' + state.tokensOffset);
    var tokens = data.tokens || [];
    if (!box) return;
    if (!tokens.length) {
      box.innerHTML = '<div class="admin-empty">无 Token</div>' + pagerHtml('tokens', data.total || 0, state.tokensOffset);
      return;
    }
    box.innerHTML = '<table class="admin-table"><thead><tr>'
      + '<th>用户</th><th>创建</th><th>过期</th><th>状态</th><th></th>'
      + '</tr></thead><tbody>'
      + tokens.map(function(t) {
        var actions = hasPerm('admin.token.revoke')
          ? ('<button type="button" class="btn btn-inline" data-token-revoke="'
            + escapeHtml(t.id) + '">撤销</button>')
          : '';
        return '<tr>'
          + '<td><button type="button" class="btn btn-inline" data-user-profile="' + escapeHtml(t.userId) + '">'
          + escapeHtml(t.displayName || t.username || t.userId) + '</button></td>'
          + '<td>' + escapeHtml(fmtTime(t.createdAt)) + '</td>'
          + '<td>' + escapeHtml(fmtTime(t.expiresAt)) + '</td>'
          + '<td>' + (t.expired
            ? '<span class="admin-pill admin-pill--warn">过期</span>'
            : '<span class="admin-pill admin-pill--ok">有效</span>') + '</td>'
          + '<td class="admin-td-actions">' + actions + '</td></tr>';
      }).join('')
      + '</tbody></table>'
      + pagerHtml('tokens', data.total || 0, state.tokensOffset);
  } catch (e) {
    if (box) box.innerHTML = '<div class="admin-empty">' + escapeHtml(e.message || e) + '</div>';
  }
}

async function loadDatabases() {
  var box = $('adminDbTable');
  var analysisEl = $('adminDbAnalysis');
  try {
    var data = await api('/api/admin/databases');
    var dbs = data.databases || [];
    var a = data.analysis || {};
    var couch = data.couch || {};
    if (analysisEl) {
      analysisEl.innerHTML = '<p>' + (couch.ok ? '正常' : '异常')
        + ' · 版本 ' + escapeHtml(couch.version || '—')
        + ' · 用户库 ' + (a.userDbCount || 0)
        + ' · 孤儿 ' + ((a.orphans || []).length)
        + ' · 登记了但库不存在 ' + ((a.missing || []).length)
        + '</p><p class="admin-muted">这页不删库。</p>';
    }
    if (!box) return;
    var rows = a.rows || [];
    var label = { ok: '正常', orphan: '孤儿', missing: '缺失' };
    box.innerHTML = '<table class="admin-table"><thead><tr><th>库名</th><th>对应用户</th><th>状态</th></tr></thead><tbody>'
      + (rows.length ? rows.map(function(r) {
        var who = r.userId
          ? '<button type="button" class="btn btn-inline" data-user-profile="' + escapeHtml(r.userId) + '">' + escapeHtml(r.userId) + '</button>'
          : '—';
        return '<tr><td class="admin-mono">' + escapeHtml(r.name) + '</td><td>' + who + '</td><td>'
          + escapeHtml(label[r.status] || r.status) + '</td></tr>';
      }).join('') : '<tr><td colspan="3" class="admin-empty">没有用户库</td></tr>')
      + '</tbody></table>';
  } catch (e) {
    if (box) box.innerHTML = '<div class="admin-empty">' + escapeHtml(e.message || e) + '</div>';
  }
}

async function loadAudit() {
  var box = $('adminAuditTable');
  var action = ($('adminAuditAction') || {}).value || '';
  var by = ($('adminAuditBy') || {}).value || '';
  try {
    var targetUserId = ($('adminAuditUser') || {}).value || '';
    var data = await api('/api/admin/audit?action=' + encodeURIComponent(action)
      + '&by=' + encodeURIComponent(by)
      + '&targetUserId=' + encodeURIComponent(targetUserId)
      + '&limit=' + state.pageSize
      + '&offset=' + state.auditOffset);
    var rows = data.audit || [];
    if (!box) return;
    if (!rows.length) {
      box.innerHTML = '<div class="admin-empty">无审计记录</div>' + pagerHtml('audit', data.total || 0, state.auditOffset);
      return;
    }
    var note = capNote(data.capped, data.listedCap);
    box.innerHTML = '<table class="admin-table"><thead><tr>'
      + '<th>时间</th><th>操作者</th><th>动作</th><th>对象</th><th>原因</th></tr></thead><tbody>'
      + rows.map(function(r) {
        var target = r.targetUserId || r.token || r.tokenId || '—';
        var open = '';
        if (r.targetNovelId && r.targetCardId && r.targetUserId) {
          open = ' data-open-novel="' + escapeHtml(r.targetUserId) + '|' + escapeHtml(r.targetCardId) + '|' + escapeHtml(r.targetNovelId) + '"';
        } else if (r.targetCardId && r.targetUserId) {
          open = ' data-open-card="' + escapeHtml(r.targetUserId) + '|' + escapeHtml(r.targetCardId) + '"';
        } else if (r.token) {
          open = ' data-open-share="' + escapeHtml(r.token) + '"';
        } else if (r.targetUserId) {
          open = ' data-user-profile="' + escapeHtml(r.targetUserId) + '"';
        }
        return '<tr' + open + '><td>' + escapeHtml(fmtTime(r.at)) + '</td>'
          + '<td class="admin-mono">' + escapeHtml(r.by || '—') + '</td>'
          + '<td><code>' + escapeHtml(r.action) + '</code></td>'
          + '<td class="admin-mono">' + escapeHtml(target) + '</td>'
          + '<td>' + escapeHtml(r.reason || '') + '</td></tr>';
      }).join('')
      + '</tbody></table>'
      + pagerHtml('audit', data.total || 0, state.auditOffset)
      + (note ? '<p class="admin-muted">' + escapeHtml(note) + '</p>' : '');
  } catch (e) {
    if (box) box.innerHTML = '<div class="admin-empty">' + escapeHtml(e.message || e) + '</div>';
  }
}

async function loadSystem() {
  var box = $('adminSystemBody');
  if (!box) return;
  try {
    var health = await api('/api/health');
    var overview = await api('/api/admin/overview');
    var sysStatus = null;
    try { sysStatus = (await api('/api/admin/system-status')).status; } catch (eS) { /* ignore */ }
    try { state.overview = overview; } catch (e0) { /* ignore */ }
    var uptime = sysStatus ? Math.round((sysStatus.uptimeSec || 0) / 60) + ' 分钟' : '—';
    var mem = sysStatus ? ((sysStatus.memUsedPct || 0) + '%') : '—';
    var couchOk = sysStatus && sysStatus.couch && sysStatus.couch.ok;
    box.innerHTML = '<p>进程已运行 ' + uptime + '，内存占用 ' + mem + '。</p>'
      + '<p>Couch ' + (couchOk ? '正常' : '异常') + ' · 接口 ' + (health && health.ok !== false ? '可访问' : '异常') + '</p>'
      + '<p class="admin-muted">备份在备份页。这页不改配置。</p>';
    var btn = $('btnAdminBackup');
    if (window.__actionEngine__ && typeof window.__actionEngine__.refresh === 'function') {
      window.__actionEngine__.refresh();
    } else if (btn) {
      btn.disabled = !isOps() || !(overview.flags && overview.flags.backupEnabled);
    }
  } catch (e) {
    box.innerHTML = '<div class="admin-empty">' + escapeHtml(bannerForError(e)) + '</div>';
  }
}

async function loadRoles() {
  var box = $('adminRoleTable');
  if (!box) return;
  try {
    var data = await api('/api/admin/roles');
    var permsData = await api('/api/admin/perms');
    var roles = data.roles || [];
    var groups = permGroups(permsData.perms || []);
    var editable = hasPerm('sys.role.manage');
    state.roleList = roles;
    var side = roles.map(function(r) {
      return '<button type="button" data-role-edit="' + escapeHtml(r.id) + '">' + escapeHtml(r.name || r.id)
        + (r.builtin ? '' : '') + '</button>';
    }).join('');
    box.innerHTML = '<div class="admin-split"><div>'
      + (editable ? '<p><button type="button" class="btn btn-ghost" id="btnAdminRoleNew">新建角色</button></p>' : '')
      + '<div class="admin-side-list">' + side + '</div></div>'
      + '<div class="admin-editor" id="adminRoleEditor">'
      + '<h3 id="adminRoleEditorTitle">角色</h3>'
      + '<form class="admin-query"><label>名称<input id="adminRoleName" /></label>'
      + '<label>说明<input id="adminRoleDesc" /></label>'
      + '<label>id<input id="adminRoleNewId" /></label></form>'
      + '<div id="adminRolePermBox" class="admin-perm-box"></div>'
      + (editable ? '<p><button type="button" class="btn btn-primary" id="btnAdminRoleSave">保存</button></p>' : '')
      + '<p id="adminRoleDel"></p></div></div>';
    state.rolePermGroups = groups;
    state.rolePerms = permsData.perms || [];
    if (roles[0]) openRoleEditor(roles[0]);
  } catch (e) {
    box.innerHTML = '<div class="admin-empty">' + escapeHtml(e.message || e) + '</div>';
  }
}

function openRoleEditor(role) {
  var editor = $('adminRoleEditor');
  if (!editor) return;
  editor.hidden = false;
  state.activeRoleId = role.id;
  var title = $('adminRoleEditorTitle');
  var newId = $('adminRoleNewId');
  var name = $('adminRoleName');
  var desc = $('adminRoleDesc');
  if (title) title.textContent = role.id ? (role.name || role.id) : '新建角色';
  if (newId) {
    newId.disabled = !!role.id;
    newId.value = role.id || '';
  }
  if (name) name.value = role.name || '';
  if (desc) desc.value = role.desc || '';
  var box = $('adminRolePermBox');
  if (box) box.innerHTML = permEditorHtml(role.perms || [], state.rolePermGroups || {});
  var del = $('adminRoleDel');
  if (del) {
    del.innerHTML = (role.id && !role.builtin && hasPerm('sys.role.manage'))
      ? '<button type="button" class="btn btn-ghost" data-role-del="' + escapeHtml(role.id) + '">删除</button>'
      : (role.builtin ? '<span class="admin-muted">内置角色不能删除</span>' : '');
  }
  document.querySelectorAll('.admin-side-list [data-role-edit]').forEach(function(btn) {
    btn.classList.toggle('is-active', btn.getAttribute('data-role-edit') === role.id);
  });
}

async function saveRoleFromForm() {
  var id = state.activeRoleId || ($('adminRoleNewId') || {}).value || '';
  if (!id) { setStatus('缺少角色 id'); return; }
  var perms = [];
  var box = $('adminRolePermBox');
  if (box) {
    box.querySelectorAll('input[type=checkbox]:checked').forEach(function(c) { perms.push(c.value); });
  }
  var body = {
    id: id,
    name: ($('adminRoleName') || {}).value || '',
    desc: ($('adminRoleDesc') || {}).value || '',
    perms: perms,
  };
  try {
    await api('/api/admin/roles/' + encodeURIComponent(id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setStatus('角色已保存');
    loadRoles();
  } catch (e) {
    setStatus(String(e.message || e));
  }
}

async function loadMenus() {
  var box = $('adminMenuTable');
  if (!box) return;
  try {
    var data = await api('/api/admin/menus');
    var menus = data.menus || [];
    var editable = hasPerm('sys.menu.manage');
    var byParent = {};
    menus.forEach(function(m) {
      var p = m.parentId || '';
      (byParent[p] = byParent[p] || []).push(m);
    });
    var byId = {};
    menus.forEach(function(m) { byId[m.id] = m; });
    function render(id, depth) {
      var html = '';
      var kids = (byParent[id] || []).slice().sort(function(a, b) { return (a.order || 0) - (b.order || 0); });
      kids.forEach(function(m) {
        var locked = m.group || MENU_LOCKED.indexOf(m.id) >= 0;
        var actions = editable
          ? ('<button type="button" class="btn btn-inline" data-menu-edit="' + escapeHtml(m.id) + '">编辑</button>'
            + (locked ? '' : '<button type="button" class="btn btn-inline" data-menu-del="' + escapeHtml(m.id) + '">删除</button>'))
          : '';
        html += '<tr>'
          + '<td class="admin-menu-name" style="padding-left:' + (depth * 20 + 8) + 'px">'
          + (depth ? '' : '') + '<strong>' + escapeHtml(m.name) + '</strong></td>'
          + '<td class="admin-mono">' + escapeHtml(m.group ? '—' : m.id) + '</td>'
          + '<td class="admin-mono">' + escapeHtml(m.perm || '—') + '</td>'
          + '<td>' + (m.order || 0) + '</td>'
          + '<td class="admin-td-actions">' + actions + '</td></tr>';
        html += render(m.id, depth + 1);
      });
      return html;
    }
    var editor = '<div class="admin-editor" id="adminMenuEditor" hidden>'
      + '<div class="admin-panel-head"><h3 id="adminMenuEditorTitle">编辑菜单</h3></div>'
      + '<div class="admin-toolbar">'
      + '<input id="adminMenuId" placeholder="菜单 id（英文，不可改）" />'
      + '<input id="adminMenuName" placeholder="名称" />'
      + '<select id="adminMenuParent"><option value="">— 顶级 —</option></select>'
      + '<input id="adminMenuPerm" placeholder="权限点（可空）" />'
      + '<input id="adminMenuOrder" type="number" value="0" style="max-width:80px" />'
      + '<label class="admin-perm-item"><input type="checkbox" id="adminMenuGroup"> 分组</label>'
      + '</div>'
      + '<div class="admin-toolbar">'
      + '<button type="button" class="btn btn-sm btn-primary" id="btnAdminMenuSave">保存</button>'
      + '<button type="button" class="btn btn-sm btn-ghost" id="btnAdminMenuCancel">取消</button>'
      + '</div></div>';
    box.innerHTML = editor
      + (editable
        ? '<div class="admin-panel-head"><h3>菜单</h3><button type="button" class="btn btn-sm btn-fetch" id="btnAdminMenuNew">新建菜单</button></div>'
        : '<div class="admin-panel-head"><h3>菜单</h3></div>')
      + '<table class="admin-table"><thead><tr><th>名称</th><th>视图</th><th>权限</th><th>顺序</th><th></th></tr></thead><tbody>'
      + render('', 0)
      + '</tbody></table>';
    state.menus = menus;
    var sel = $('adminMenuParent');
    if (sel) {
      sel.innerHTML = '<option value="">— 顶级 —</option>'
        + menus.map(function(m) { return '<option value="' + escapeHtml(m.id) + '">' + escapeHtml(m.name) + '</option>'; }).join('');
    }
  } catch (e) {
    box.innerHTML = '<div class="admin-empty">' + escapeHtml(e.message || e) + '</div>';
  }
}

function openMenuEditor(menu) {
  var editor = $('adminMenuEditor');
  if (!editor) return;
  editor.hidden = false;
  state.activeMenuId = menu.id;
  var title = $('adminMenuEditorTitle');
  if (title) title.textContent = menu.id ? ('编辑菜单 · ' + menu.id) : '新建菜单';
  var id = $('adminMenuId');
  var name = $('adminMenuName');
  var parent = $('adminMenuParent');
  var perm = $('adminMenuPerm');
  var order = $('adminMenuOrder');
  var group = $('adminMenuGroup');
  if (id) {
    id.value = menu.id || '';
    id.disabled = !!menu.id;
  }
  if (name) name.value = menu.name || '';
  if (parent) parent.value = menu.parentId || '';
  if (perm) perm.value = menu.perm || '';
  if (order) order.value = menu.order || 0;
  if (group) group.checked = !!menu.group;
}

async function saveMenuFromForm() {
  var id = state.activeMenuId || ($('adminMenuId') || {}).value || '';
  if (!id) { setStatus('缺少菜单 id'); return; }
  var body = {
    id: id,
    name: ($('adminMenuName') || {}).value || '',
    parentId: ($('adminMenuParent') || {}).value || '',
    perm: ($('adminMenuPerm') || {}).value || '',
    order: Number(($('adminMenuOrder') || {}).value) || 0,
    group: !!($('adminMenuGroup') || {}).checked,
  };
  try {
    await api('/api/admin/menus/' + encodeURIComponent(id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setStatus('菜单已保存');
    loadMenus();
  } catch (e) {
    setStatus(String(e.message || e));
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', async function(e) {
    var t = e.target.closest('[data-role-edit],[data-role-del],[data-menu-edit],[data-menu-del]');
    if (!t) return;
    if (t.hasAttribute('data-role-edit')) {
      var roleId = t.getAttribute('data-role-edit');
      try {
        var rd = await api('/api/admin/roles/' + encodeURIComponent(roleId));
        openRoleEditor(rd.role || { id: roleId });
      } catch (e2) { setStatus(String(e2.message || e2)); }
      return;
    }
    if (t.hasAttribute('data-role-del')) {
      var sure = await askReason('删除这个角色。引用它的用户会失去这些权限。');
      if (!sure) return;
      try {
        await api('/api/admin/roles/' + encodeURIComponent(t.getAttribute('data-role-del')), { method: 'DELETE' });
        setStatus('已删除角色');
        loadRoles();
      } catch (e2) { setStatus(String(e2.message || e2)); }
      return;
    }
    if (t.hasAttribute('data-menu-edit')) {
      var menu = (state.menus || []).find(function(m) { return m.id === t.getAttribute('data-menu-edit'); });
      openMenuEditor(menu || { id: t.getAttribute('data-menu-edit') });
      return;
    }
    if (t.hasAttribute('data-menu-del')) {
      var sureMenu = await askReason('删除这个菜单');
      if (!sureMenu) return;
      try {
        await api('/api/admin/menus/' + encodeURIComponent(t.getAttribute('data-menu-del')), { method: 'DELETE' });
        setStatus('已删除菜单');
        loadMenus();
      } catch (e2) { setStatus(String(e2.message || e2)); }
    }
  });
  document.addEventListener('click', function(e) {
    var t = e.target.closest('#btnAdminRoleSave,#btnAdminRoleCancel,#btnAdminRoleNew,#btnAdminMenuSave,#btnAdminMenuCancel,#btnAdminMenuNew');
    if (!t) return;
    var btnId = t.id;
    if (btnId === 'btnAdminRoleSave') saveRoleFromForm();
    if (btnId === 'btnAdminRoleNew') openRoleEditor({});
    if (btnId === 'btnAdminRoleCancel') { var ed = $('adminRoleEditor'); if (ed) ed.hidden = true; }
    if (btnId === 'btnAdminMenuSave') saveMenuFromForm();
    if (btnId === 'btnAdminMenuNew') openMenuEditor({});
    if (btnId === 'btnAdminMenuCancel') { var me = $('adminMenuEditor'); if (me) me.hidden = true; }
  });
}


function tailId(id) {
  var s = String(id || '');
  var i = s.lastIndexOf('/');
  return i >= 0 ? s.slice(i + 1) : s;
}

function openFlagItem(id) {
  var box = $('adminModerationBody');
  var f = (state.modFlags || []).find(function(x) { return tailId(x._id) === id; });
  if (!box || !f) return;
  var canReview = hasPerm('moderation.review');
  var resolved = f.status === 'resolved';
  var res = f.resolution || {};
  var target = f.novelId
    ? '<button type="button" class="btn btn-inline" data-open-novel="' + escapeHtml(f.targetUserId) + '|' + escapeHtml(f.cardId) + '|' + escapeHtml(f.novelId) + '">打开小说</button>'
    : '<button type="button" class="btn btn-inline" data-open-card="' + escapeHtml(f.targetUserId) + '|' + escapeHtml(f.cardId) + '">打开卡</button>';
  var actions = '';
  if (!resolved && canReview) {
    actions = '<p><button type="button" class="btn btn-ghost" data-flag-resolve="' + escapeHtml(id) + '|ignore">忽略</button> '
      + '<button type="button" class="btn btn-primary" data-flag-resolve="' + escapeHtml(id) + '|remove">下架</button></p>';
  }
  var done = resolved
    ? '<p>结果：' + (res.action === 'remove' ? '已下架' : '忽略') + ' · ' + escapeHtml(res.by || '') + ' · ' + escapeHtml(fmtTime(res.at)) + '</p>'
    : '';
  box.innerHTML = '<div class="admin-editor"><div class="admin-panel-head"><h3>举报</h3>'
    + '<button type="button" class="btn btn-ghost" data-mod-back>返回</button></div>'
    + '<p>' + escapeHtml(f.reason || '') + '</p>'
    + '<p class="admin-muted">' + (f.targetType === 'card' ? '卡' : '小说') + ' · ' + escapeHtml(f.targetUserId)
    + ' · ' + escapeHtml(f.cardId) + (f.novelId ? ' / ' + escapeHtml(f.novelId) : '') + '</p>'
    + '<p>' + target + '</p>' + done + actions
    + (resolved ? '<p class="admin-muted">要恢复内容，去卡页或小说页。这里不能重新打开。</p>' : '')
    + '</div>';
}

function openApprovalItem(id) {
  var box = $('adminModerationBody');
  var a = (state.modApprovals || []).find(function(x) { return tailId(x._id) === id; });
  if (!box || !a) return;
  var t = a.target || {};
  var own = state.user && String(a.requestedBy || '') === String(state.user.id);
  var canApprove = hasPerm('moderation.approve');
  var actions = '<button type="button" class="btn btn-ghost" data-appr-decide="' + escapeHtml(id) + '|0">驳回</button>';
  if (canApprove && !own) actions = '<button type="button" class="btn btn-primary" data-appr-decide="' + escapeHtml(id) + '|1">通过</button> ' + actions;
  box.innerHTML = '<div class="admin-editor"><div class="admin-panel-head"><h3>删除审批</h3>'
    + '<button type="button" class="btn btn-ghost" data-mod-back>返回</button></div>'
    + '<p>将删除' + (t.novelId ? '小说' : '卡') + ' ' + escapeHtml(t.cardId || '') + (t.novelId ? ' / ' + escapeHtml(t.novelId) : '')
    + '，不能恢复。</p>'
    + '<p>申请人 ' + escapeHtml(a.requestedBy || '') + ' · ' + escapeHtml(a.reason || '') + '</p>'
    + (own ? '<p class="admin-muted">不能批自己的单</p>' : '')
    + '<p>' + actions + '</p></div>';
}

async function loadModeration() {
  var box = $('adminModerationBody');
  if (!box) return;
  try {
    var flagStatus = state.modFlagStatus || 'open';
    var flagData = await api('/api/admin/moderation/flags?status=' + encodeURIComponent(flagStatus));
    var openFlags = flagStatus === 'open' ? (flagData.flags || []) : ((await api('/api/admin/moderation/flags?status=open')).flags || []);
    var apprData = await api('/api/admin/moderation/approvals?status=pending');
    var flags = flagData.flags || [];
    var approvals = apprData.approvals || [];
    state.modFlags = flags;
    state.modApprovals = approvals;
    var tab = state.modTab === 'approvals' ? 'approvals' : 'flags';
    var flagRows = flags.map(function(f) {
      var name = f.cardId + (f.novelId ? '/' + f.novelId : '');
      return '<tr data-flag-open="' + escapeHtml(tailId(f._id)) + '">'
        + '<td>' + escapeHtml(name) + '</td>'
        + '<td>' + escapeHtml(f.targetType === 'card' ? '卡' : '小说') + '</td>'
        + '<td class="admin-mono">' + escapeHtml(f.targetUserId) + '</td>'
        + '<td>' + escapeHtml((f.reason || '').slice(0, 80)) + '</td>'
        + '<td>' + escapeHtml(f.reportedBy || '—') + '</td>'
        + '<td>' + escapeHtml(fmtTime(f.at)) + '</td></tr>';
    }).join('');
    var approvalRows = approvals.map(function(a) {
      var t = a.target || {};
      return '<tr data-appr-open="' + escapeHtml(tailId(a._id)) + '">'
        + '<td>' + escapeHtml(a.action) + '</td>'
        + '<td>' + escapeHtml((t.cardId || '') + (t.novelId ? '/' + t.novelId : '')) + '</td>'
        + '<td>' + escapeHtml(a.requestedBy || '—') + '</td>'
        + '<td>' + escapeHtml((a.reason || '').slice(0, 80)) + '</td>'
        + '<td>' + escapeHtml(fmtTime(a.at)) + '</td></tr>';
    }).join('');
    var body = tab === 'approvals'
      ? ('<table class="admin-table"><thead><tr><th>动作</th><th>目标</th><th>申请人</th><th>理由</th><th>时间</th></tr></thead><tbody>'
        + (approvalRows || '<tr><td colspan="5" class="admin-empty">没有待审批</td></tr>')
        + '</tbody></table>')
      : ('<form class="admin-query"><label>状态<select id="adminFlagStatus">'
        + '<option value="open"' + (flagStatus === 'open' ? ' selected' : '') + '>待处理</option>'
        + '<option value="resolved"' + (flagStatus === 'resolved' ? ' selected' : '') + '>已处理</option>'
        + '</select></label><button type="submit" class="btn btn-primary" id="btnAdminFlagQuery">查询</button></form>'
        + '<table class="admin-table"><thead><tr><th>目标名</th><th>类型</th><th>主人</th><th>理由</th><th>举报人</th><th>时间</th></tr></thead><tbody>'
        + (flagRows || '<tr><td colspan="6" class="admin-empty">没有举报</td></tr>')
        + '</tbody></table>');
    box.innerHTML = '<div class="admin-query">'
      + '<button type="button" class="btn ' + (tab === 'flags' ? 'btn-primary' : 'btn-ghost') + '" data-mod-tab="flags">举报 ' + openFlags.length + '</button>'
      + '<button type="button" class="btn ' + (tab === 'approvals' ? 'btn-primary' : 'btn-ghost') + '" data-mod-tab="approvals">待审批 ' + approvals.length + '</button>'
      + '</div>' + body;
  } catch (e) {
    box.innerHTML = '<div class="admin-empty">' + escapeHtml(e.message || e) + '</div>';
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', async function(e) {
    var t = e.target.closest('[data-flag-resolve],[data-appr-decide],[data-mod-tab],[data-flag-open],[data-appr-open],[data-mod-back],#btnAdminFlagQuery');
    if (!t) return;
    if (t.hasAttribute('data-mod-tab')) {
      state.modTab = t.getAttribute('data-mod-tab');
      loadModeration();
      return;
    }
    if (t.hasAttribute('data-mod-back')) { loadModeration(); return; }
    if (t.id === 'btnAdminFlagQuery') {
      state.modFlagStatus = ($('adminFlagStatus') || {}).value || 'open';
      loadModeration();
      return;
    }
    if (t.hasAttribute('data-flag-open')) { openFlagItem(t.getAttribute('data-flag-open')); return; }
    if (t.hasAttribute('data-appr-open')) { openApprovalItem(t.getAttribute('data-appr-open')); return; }
    if (t.hasAttribute('data-flag-resolve')) {
      var fr = t.getAttribute('data-flag-resolve').split('|');
      var action = fr[1];
      var flagReason = '';
      if (action === 'remove') {
        flagReason = await askReason('下架这条举报的目标');
        if (!flagReason) return;
      }
      try {
        await api('/api/admin/moderation/flags/' + encodeURIComponent(fr[0]) + '/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: action, reason: flagReason }),
        });
        setStatus('举报已处理');
        loadModeration();
      } catch (e2) { setStatus(String(e2.message || e2)); }
      return;
    }
    if (t.hasAttribute('data-appr-decide')) {
      var ad = t.getAttribute('data-appr-decide').split('|');
      var approve = ad[1] === '1';
      if (approve) {
        var okDel = await askReason('通过后会删除，不能恢复。写下原因');
        if (!okDel) return;
      }
      try {
        await api('/api/admin/moderation/approvals/' + encodeURIComponent(ad[0]) + '/decide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approve: approve }),
        });
        setStatus(approve ? '已批准并执行' : '已驳回');
        loadModeration();
      } catch (e2) { setStatus(String(e2.message || e2)); }
    }
  });
}

async function loadCards() {
  var box = $('adminCardTable');
  if (!box) return;
  var q = ($('adminCardQ') || {}).value || '';
  var nsfw = ($('adminCardNsfw') || {}).value || 'all';
  var status = ($('adminCardStatus') || {}).value || 'all';
  var userId = ($('adminCardUser') || {}).value || '';
  try {
    var data = await api('/api/admin/cards?q=' + encodeURIComponent(q)
      + '&nsfw=' + encodeURIComponent(nsfw)
      + '&status=' + encodeURIComponent(status)
      + '&userId=' + encodeURIComponent(userId)
      + '&limit=' + state.pageSize
      + '&offset=' + state.cardsOffset);
    var cards = data.cards || [];
    var note = capNote(data.capped, data.listedCap);
    if (!cards.length) {
      box.innerHTML = '<div class="admin-empty">无匹配卡</div>' + pagerHtml('cards', data.total || 0, state.cardsOffset)
        + (note ? '<p class="admin-muted">' + escapeHtml(note) + '</p>' : '');
      return;
    }
    box.innerHTML = '<table class="admin-table"><thead><tr>'
      + '<th>卡名</th><th>主人</th><th>体积</th><th>NSFW</th><th>有效分享</th><th>状态</th><th>更新</th>'
      + '</tr></thead><tbody>'
      + cards.map(function(c) {
        var removed = c.moderated && c.moderated.status === 'removed';
        var key = escapeHtml(c.userId) + '|' + escapeHtml(c.cardId);
        return '<tr class="' + (removed ? 'is-disabled' : '') + '" data-open-card="' + key + '">'
          + '<td><strong>' + escapeHtml(c.charName || '(未命名)') + '</strong></td>'
          + '<td class="admin-mono">' + escapeHtml(c.userId) + '</td>'
          + '<td>' + escapeHtml(fmtBytes(c.bundleBytes)) + '</td>'
          + '<td>' + (c.nsfw ? '是' : '否') + '</td>'
          + '<td>' + (c.activeShares || 0) + '</td>'
          + '<td>' + (removed ? '已下架' : '正常') + '</td>'
          + '<td>' + escapeHtml(fmtTime(c.updatedAt)) + '</td></tr>';
      }).join('')
      + '</tbody></table>'
      + pagerHtml('cards', data.total || 0, state.cardsOffset)
      + (note ? '<p class="admin-muted">' + escapeHtml(note) + '</p>' : '');
    box.hidden = !!(($('adminCardDetail') || {}).innerHTML);
  } catch (e) {
    box.innerHTML = '<div class="admin-empty">' + escapeHtml(e.message || e) + '</div>';
  }
}

async function openCardDetail(key) {
  state.openCardKey = key;
  var parts = String(key || '').split('|');
  var userId = parts[0] || '';
  var cardId = parts[1] || '';
  var box = $('adminCardDetail');
  if (!box) return;
  try {
    var data = await api('/api/admin/cards/' + encodeURIComponent(userId) + '/' + encodeURIComponent(cardId));
    var d = data.detail || {};
    var meta = (d.doc && d.doc.draftMeta) || {};
    var mod = d.doc && d.doc.moderation;
    var cardTable = $('adminCardTable');
    if (cardTable) cardTable.hidden = true;
    var removed = mod && mod.status === 'removed';
    var key = escapeHtml(userId) + '|' + escapeHtml(cardId);
    var canDisable = hasPerm('content.card.disable');
    var canExport = hasPerm('content.card.export');
    var canDelete = hasPerm('content.card.delete');
    var canShare = hasPerm('admin.share.toggle');
    var actions = '';
    if (canDisable) {
      actions += removed
        ? '<button type="button" class="btn btn-primary" data-card-restore="' + key + '">恢复</button>'
        : '<button type="button" class="btn btn-primary" data-card-disable="' + key + '">下架</button>';
    }
    if (canExport) actions += ' <button type="button" class="btn btn-ghost" data-card-export="' + key + '">导出</button>';
    if (canDelete) actions += ' <button type="button" class="btn btn-ghost" data-card-del="' + key + '">申请删除</button>';
    var release = d.release || {};
    var titles = meta.worldbookTitles || [];
    var shareRows = (d.shares || []).map(function(s) {
      var on = s.enabled && !s.expired;
      var act = canShare
        ? (on
          ? '<button type="button" class="btn btn-inline" data-share-soft="' + escapeHtml(s.token) + '" data-on="0">停用</button>'
          : '<button type="button" class="btn btn-inline" data-share-soft="' + escapeHtml(s.token) + '" data-on="1">恢复</button>')
        : '';
      return '<tr><td><button type="button" class="btn btn-inline" data-open-share="' + escapeHtml(s.token) + '">' + escapeHtml(s.token) + '</button></td><td>'
        + (on ? '有效' : '已停') + '</td><td>' + escapeHtml(fmtTime(s.expiresAt)) + '</td><td>' + act + '</td></tr>';
    }).join('');
    var novelRows = (d.novels || []).map(function(n) {
      var nk = escapeHtml(userId) + '|' + escapeHtml(cardId) + '|' + escapeHtml(n.novelId);
      return '<tr data-open-novel="' + nk + '"><td>' + escapeHtml(n.title || '(未命名)') + '</td><td>'
        + (n.chapterCount || 0) + '</td><td>' + (n.removed ? '已下架' : '正常') + '</td></tr>';
    }).join('');
    var auditRows = (d.audit || []).map(function(r) {
      return '<tr><td>' + escapeHtml(fmtTime(r.at)) + '</td><td>' + escapeHtml(r.by || '—') + '</td><td>'
        + escapeHtml(r.action || '') + '</td><td>' + escapeHtml(r.reason || '') + '</td></tr>';
    }).join('');
    var html = '<div class="admin-editor">'
      + '<div class="admin-panel-head"><h3>' + escapeHtml(meta.charName || cardId) + '</h3>'
      + '<button type="button" class="btn btn-ghost" id="btnAdminCardDetailClose">返回列表</button></div>'
      + '<p class="admin-muted">主人 <button type="button" class="btn btn-inline" data-user-profile="' + escapeHtml(userId) + '">'
      + escapeHtml(userId) + '</button> · ' + escapeHtml(cardId)
      + ' · ' + (removed ? '已下架' : '正常')
      + ' · NSFW ' + (meta.nsfw ? '是' : '否')
      + ' · ' + escapeHtml(fmtBytes(d.entry && d.entry.bundleBytes)) + '</p>'
      + (actions ? '<p>' + actions + '</p>' : '')
      + (d.pendingDelete ? '<p>删除审批中，尚未删除</p>' : '')
      + (d.indexStale ? '<p>索引旧了 <button type="button" class="btn btn-inline" data-card-reindex="' + key + '">重建这张卡的索引</button></p>' : '')
      + '<h4 class="admin-mt">正文</h4>'
      + '<p>' + escapeHtml(meta.description || '没有描述') + '</p>'
      + '<p class="admin-muted">开场白 ' + (meta.greetingCount || 0) + ' 条'
      + (meta.greetingStart ? ' · ' + escapeHtml(meta.greetingStart) : '') + '</p>'
      + '<p class="admin-muted">世界书 '
      + (titles.length ? titles.map(escapeHtml).join('、') : '无')
      + (meta.worldbookMore ? ' …共超过 20 条' : '') + '</p>'
      + '<h4 class="admin-mt">发布</h4>'
      + '<p>版本 ' + escapeHtml(release.characterVersion || meta.characterVersion || '—')
      + ' · 发布时间 ' + escapeHtml(fmtTime(release.publishedAt))
      + '</p><p class="admin-muted">公开链接读的是发布包。</p>'
      + '<h4 class="admin-mt">分享</h4>'
      + (shareRows
        ? '<table class="admin-table"><thead><tr><th>token</th><th>状态</th><th>过期</th><th></th></tr></thead><tbody>' + shareRows + '</tbody></table>'
        : '<p class="admin-muted">没有分享</p>')
      + '<h4 class="admin-mt">小说</h4>'
      + (novelRows
        ? '<table class="admin-table"><thead><tr><th>标题</th><th>章节</th><th>状态</th></tr></thead><tbody>' + novelRows + '</tbody></table>'
        : '<p class="admin-muted">没有小说</p>')
      + '<h4 class="admin-mt">处置</h4>'
      + (auditRows
        ? '<table class="admin-table"><thead><tr><th>时间</th><th>谁</th><th>动作</th><th>原因</th></tr></thead><tbody>' + auditRows + '</tbody></table>'
        : '<p class="admin-muted">还没有处置记录</p>')
      + '</div>';
    box.innerHTML = html;
  } catch (e) {
    box.innerHTML = '<div class="admin-empty">' + escapeHtml(e.message || e) + '</div>';
  }
}

async function runCardAction(verb, key) {
  var parts = String(key || '').split('|');
  var userId = parts[0] || '';
  var cardId = parts[1] || '';
  var base = '/api/admin/cards/' + encodeURIComponent(userId) + '/' + encodeURIComponent(cardId);
  try {
    if (verb === 'disable') {
      var reason = await askReason('下架这张卡');
      if (!reason) return;
      await api(base + '/disable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: reason }) });
      setStatus('已下架。这条卡的分享已停，公开链接再打开会被拒绝。恢复不会自动打开分享。');
    } else if (verb === 'restore') {
      await api(base + '/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      setStatus('已恢复 ' + cardId);
    } else if (verb === 'del') {
      var delReason = await askReason('申请删除。通过后才会删掉，卡现在还在');
      if (!delReason) return;
      var ar = await api(base, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: delReason }) });
      setStatus(ar.pending ? '已提交删除审批，卡还在' : '已删除 ' + cardId);
    } else if (verb === 'export') {
      var ed = await api(base + '/export');
      var blob = new Blob([JSON.stringify(ed, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'card-' + cardId + '.json';
      a.click();
      setStatus('已导出 ' + cardId);
    }
    if (verb === 'del' && ar && !ar.pending) {
      var gone = $('adminCardDetail');
      if (gone) gone.innerHTML = '<div class="admin-editor"><h3>这张卡已经不存在</h3></div>';
      return;
    }
    if (state.view === 'users' && state.openUserId) openUserProfile(state.openUserId);
    else openCardDetail(key);
  } catch (e) {
    setStatus(String(e.message || e));
  }
}

async function loadNovels() {
  var box = $('adminNovelTable');
  if (!box) return;
  var q = ($('adminNovelQ') || {}).value || '';
  var status = ($('adminNovelStatus') || {}).value || 'all';
  var userId = ($('adminNovelUser') || {}).value || '';
  try {
    var data = await api('/api/admin/novels?q=' + encodeURIComponent(q)
      + '&status=' + encodeURIComponent(status)
      + '&userId=' + encodeURIComponent(userId)
      + '&limit=' + state.pageSize
      + '&offset=' + state.novelsOffset);
    var novels = data.novels || [];
    var note = capNote(data.capped, data.listedCap);
    if (!novels.length) {
      box.innerHTML = '<div class="admin-empty">无匹配小说</div>' + pagerHtml('novels', data.total || 0, state.novelsOffset);
      return;
    }
    box.innerHTML = '<table class="admin-table"><thead><tr>'
      + '<th>标题</th><th>所属卡</th><th>主人</th><th>章节</th><th>发布</th><th>状态</th>'
      + '</tr></thead><tbody>'
      + novels.map(function(n) {
        var removed = n.moderated && n.moderated.status === 'removed';
        var key = escapeHtml(n.userId) + '|' + escapeHtml(n.cardId) + '|' + escapeHtml(n.novelId);
        return '<tr class="' + (removed ? 'is-disabled' : '') + '" data-open-novel="' + key + '">'
          + '<td><strong>' + escapeHtml(n.title || '(未命名)') + '</strong></td>'
          + '<td class="admin-mono">' + escapeHtml(n.cardId) + '</td>'
          + '<td class="admin-mono">' + escapeHtml(n.userId) + '</td>'
          + '<td>' + (n.chapterCount || 0) + '</td>'
          + '<td>' + (n.published ? '已发布' : '未发布') + '</td>'
          + '<td>' + (removed ? '已下架' : '正常') + '</td></tr>';
      }).join('')
      + '</tbody></table>'
      + pagerHtml('novels', data.total || 0, state.novelsOffset)
      + (note ? '<p class="admin-muted">' + escapeHtml(note) + '</p>' : '');
    box.hidden = !!(($('adminNovelDetail') || {}).innerHTML);
  } catch (e) {
    box.innerHTML = '<div class="admin-empty">' + escapeHtml(e.message || e) + '</div>';
  }
}

async function openNovelDetail(key) {
  state.openNovelKey = key;
  var parts = String(key || '').split('|');
  var userId = parts[0] || '';
  var cardId = parts[1] || '';
  var novelId = parts[2] || '';
  var box = $('adminNovelDetail');
  if (!box) return;
  var table = $('adminNovelTable');
  if (table) table.hidden = true;
  try {
    var data = await api('/api/admin/novels/' + encodeURIComponent(userId) + '/' + encodeURIComponent(cardId) + '/' + encodeURIComponent(novelId));
    var n = data.novel || {};
    var removed = n.moderated && n.moderated.status === 'removed';
    var nk = escapeHtml(userId) + '|' + escapeHtml(cardId) + '|' + escapeHtml(novelId);
    var canDisable = hasPerm('content.novel.disable');
    var canDelete = hasPerm('content.novel.delete');
    var canShare = hasPerm('admin.share.toggle');
    var actions = '';
    if (canDisable) {
      actions += removed
        ? '<button type="button" class="btn btn-primary" data-novel-restore="' + nk + '">恢复</button>'
        : '<button type="button" class="btn btn-primary" data-novel-disable="' + nk + '">下架</button>';
    }
    if (canDelete) actions += ' <button type="button" class="btn btn-ghost" data-novel-del="' + nk + '">申请删除</button>';
    var shareRows = (data.shares || []).map(function(s) {
      var on = s.enabled && !s.expired;
      var act = canShare
        ? '<button type="button" class="btn btn-inline" data-share-soft="' + escapeHtml(s.token) + '" data-on="' + (on ? '0' : '1') + '">' + (on ? '停用' : '恢复') + '</button>'
        : '';
      return '<tr><td class="admin-mono">' + escapeHtml(s.token) + '</td><td>' + (on ? '有效' : '已停') + '</td><td>' + act + '</td></tr>';
    }).join('');
    box.innerHTML = '<div class="admin-editor">'
      + '<div class="admin-panel-head"><h3>' + escapeHtml(n.title || novelId) + '</h3>'
      + '<button type="button" class="btn btn-ghost" id="btnAdminNovelClose">返回列表</button></div>'
      + '<p>所属卡 <button type="button" class="btn btn-inline" data-open-card="' + escapeHtml(userId) + '|' + escapeHtml(cardId) + '">' + escapeHtml(cardId) + '</button>'
      + ' · 主人 <button type="button" class="btn btn-inline" data-user-profile="' + escapeHtml(userId) + '">' + escapeHtml(userId) + '</button></p>'
      + '<p class="admin-muted">章节 ' + (n.chapterCount || 0) + ' · ' + (n.published ? '已发布' : '未发布') + ' · ' + (removed ? '已下架' : '正常') + '</p>'
      + (removed && n.moderated && n.moderated.reason ? '<p>下架原因：' + escapeHtml(n.moderated.reason) + '</p>' : '')
      + (data.pendingDelete ? '<p>删除审批中，尚未删除</p>' : '')
      + (actions ? '<p>' + actions + '</p>' : '')
      + '<h4 class="admin-mt">分享</h4>'
      + (shareRows
        ? '<table class="admin-table"><thead><tr><th>token</th><th>状态</th><th></th></tr></thead><tbody>' + shareRows + '</tbody></table>'
        : '<p class="admin-muted">没有分享</p>')
      + '</div>';
  } catch (e) {
    if (e && e.status === 404) {
      box.innerHTML = '<div class="admin-editor"><h3>这本小说不存在</h3><button type="button" class="btn btn-ghost" id="btnAdminNovelClose">返回列表</button></div>';
      return;
    }
    box.innerHTML = '<div class="admin-empty">' + escapeHtml(e.message || e) + '</div>';
  }
}

async function runNovelAction(verb, key) {
  var parts = String(key || '').split('|');
  var userId = parts[0] || '';
  var cardId = parts[1] || '';
  var novelId = parts[2] || '';
  var base = '/api/admin/novels/' + encodeURIComponent(userId) + '/' + encodeURIComponent(cardId) + '/' + encodeURIComponent(novelId);
  try {
    if (verb === 'disable') {
      var reason = await askReason('下架这本小说');
      if (!reason) return;
      await api(base + '/disable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: reason }) });
      setStatus('已下架。这本小说的分享已停。恢复不会自动打开分享。');
    } else if (verb === 'restore') {
      await api(base + '/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      setStatus('已恢复小说');
    } else if (verb === 'del') {
      var delReason = await askReason('申请删除这本小说。通过后才会消失');
      if (!delReason) return;
      var ar = await api(base, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: delReason }) });
      setStatus(ar.pending ? '已提交删除审批，小说还在' : '已删除小说');
      if (!ar.pending) {
        var gone = $('adminNovelDetail');
        if (gone) gone.innerHTML = '<div class="admin-editor"><h3>这本小说已经不存在</h3></div>';
        return;
      }
    }
    if (state.view === 'cards' && state.openCardKey) openCardDetail(state.openCardKey);
    else openNovelDetail(key);
  } catch (e) {
    setStatus(String(e.message || e));
  }
}

async function openUserProfile(userId) {
  var box = $('adminUserProfile');
  if (!box) return;
  state.openUserId = userId;
  try {
    var data = await api('/api/admin/users/' + encodeURIComponent(userId) + '/overview');
    var ov = data.overview || {};
    var reg = ov.registry || {};
    var rows = quotaRows(ov.quota || {});
    var quotaHtml = rows.map(function(r) {
      var used = r.bytes ? fmtBytes(r.used) : String(r.used);
      var lim = r.unlimited ? '不限' : (r.bytes ? fmtBytes(r.limit) : String(r.limit));
      return '<tr' + (r.over ? ' class="is-disabled"' : '') + '><td>' + escapeHtml(r.label) + '</td><td>'
        + escapeHtml(used) + ' / ' + escapeHtml(lim) + (r.over ? ' · 超限' : '') + '</td></tr>';
    }).join('');
    var cards = sortCardsByBytes(ov.cards || []);
    var canDisable = hasPerm('admin.user.disable');
    var canQuota = hasPerm('sys.quota.manage') && !ov.tierLocked;
    var canShare = hasPerm('admin.share.toggle');
    var canRevoke = hasPerm('admin.token.revoke');
    var canCard = hasPerm('content.card.disable');
    var shareRows = (ov.shares || []).map(function(s) {
      var on = s.enabled && !s.expired;
      var act = canShare
        ? '<button type="button" class="btn btn-inline" data-share-soft="' + escapeHtml(s.token) + '" data-on="' + (s.enabled ? '0' : '1') + '">' + (s.enabled ? '停用' : '恢复') + '</button>'
        : '';
      return '<tr><td>' + escapeHtml(s.titleHint || s.cardId || s.token) + '</td>'
        + '<td>' + escapeHtml(s.type === 'novel-share' || s.novelId ? '小说' : '卡') + '</td>'
        + '<td>' + (on ? '有效' : (s.enabled ? '已过期' : '已停')) + '</td><td>' + act + '</td></tr>';
    }).join('');
    var tokenRows = (ov.tokens || []).map(function(t) {
      var act = canRevoke && !t.expired
        ? '<button type="button" class="btn btn-inline" data-token-revoke="' + escapeHtml(t.id) + '">撤销</button>'
        : '';
      return '<tr><td>' + escapeHtml(fmtTime(t.expiresAt)) + '</td><td>' + (t.expired ? '过期' : '有效') + '</td><td>' + act + '</td></tr>';
    }).join('');
    var table = $('adminUserTable');
    if (table) table.hidden = true;
    box.hidden = false;
    var tier = (ov.quota && ov.quota.tier) || reg.quotaTier || 'registered';
    box.innerHTML = '<div class="admin-editor">'
      + '<div class="admin-panel-head"><h3>' + escapeHtml(reg.displayName || reg.username || userId) + '</h3>'
      + '<button type="button" class="btn btn-ghost" id="btnAdminProfileClose">返回列表</button></div>'
      + '<p class="admin-muted">' + escapeHtml(userId)
      + (reg.email ? ' · ' + escapeHtml(reg.email) : '')
      + (reg.discordId ? ' · Discord ' + escapeHtml(reg.discordId) : '')
      + ' · ' + escapeHtml(reg.provider === 'discord' ? 'Discord' : (reg.email ? '邮箱' : (reg.provider || '—')))
      + ' · ' + (reg.disabled ? '已禁用' : '正常') + '</p>'
      + (canDisable
        ? '<p><button type="button" class="btn btn-primary" data-user-toggle="' + escapeHtml(userId)
          + '" data-disabled="' + (reg.disabled ? '0' : '1') + '">' + (reg.disabled ? '启用' : '禁用') + '</button> '
          + '<button type="button" class="btn btn-ghost" data-user-password="' + escapeHtml(userId) + '">重置密码</button></p>'
        : '')
      + (reg.disabled ? '<p class="admin-muted">下一次登录和同步会被拒绝。已经打开的主站要到下一次请求才失败。</p>' : '')
      + '<h4 class="admin-mt">配额</h4><table class="admin-table" data-quota-rows="5"><thead><tr><th>项</th><th>已用 / 上限</th></tr></thead><tbody>'
      + quotaHtml + '</tbody></table>'
      + (ov.tierLocked
        ? '<p class="admin-muted">这个账号在环境变量管理员名单里，配额固定为管理员档。</p>'
        : (canQuota
          ? '<p><label>档位 <select id="adminUserTier"><option value="registered">registered</option><option value="member">member</option><option value="admin">admin</option></select></label> '
            + '<button type="button" class="btn btn-primary" data-user-tier="' + escapeHtml(userId) + '">保存档位</button></p>'
          : ''))
      + '<h4 class="admin-mt">角色</h4><div id="adminUserRoles"></div>'
      + '<h4 class="admin-mt">卡</h4><table class="admin-table"><thead><tr><th>卡名</th><th>体积</th><th>状态</th><th>有效分享</th><th></th></tr></thead><tbody>'
      + (cards.length ? cards.map(function(c) {
        var removed = c.moderated && c.moderated.status === 'removed';
        var ck = escapeHtml(userId) + '|' + escapeHtml(c.id);
        var nShare = (ov.shares || []).filter(function(s) {
          return s.cardId === c.id && !s.novelId && s.enabled && !s.expired;
        }).length;
        var act = canCard
          ? (removed
            ? '<button type="button" class="btn btn-inline" data-card-restore="' + ck + '">恢复</button>'
            : '<button type="button" class="btn btn-inline" data-card-disable="' + ck + '">下架</button>')
          : '';
        return '<tr><td><button type="button" class="btn btn-inline" data-open-card="' + ck + '">'
          + escapeHtml(c.charName || '(未命名)') + '</button></td>'
          + '<td>' + escapeHtml(fmtBytes(c.bundleBytes)) + '</td>'
          + '<td>' + (removed ? '已下架' : '正常') + '</td><td>' + nShare + '</td><td>' + act + '</td></tr>';
      }).join('') : '<tr><td colspan="5" class="admin-empty">无</td></tr>') + '</tbody></table>'
      + '<h4 class="admin-mt">分享</h4><table class="admin-table"><thead><tr><th>目标</th><th>类型</th><th>状态</th><th></th></tr></thead><tbody>'
      + (shareRows || '<tr><td colspan="4" class="admin-empty">无</td></tr>') + '</tbody></table>'
      + '<h4 class="admin-mt">Token</h4><table class="admin-table"><thead><tr><th>过期</th><th>状态</th><th></th></tr></thead><tbody>'
      + (tokenRows || '<tr><td colspan="3" class="admin-empty">无</td></tr>') + '</tbody></table>'
      + '<h4 class="admin-mt">处置</h4><table class="admin-table"><thead><tr><th>时间</th><th>动作</th><th>原因</th></tr></thead><tbody>'
      + ((ov.audit || []).length ? (ov.audit || []).map(function(r) {
        return '<tr><td>' + escapeHtml(fmtTime(r.at)) + '</td><td>' + escapeHtml(r.action || '') + '</td><td>' + escapeHtml(r.reason || '') + '</td></tr>';
      }).join('') : '<tr><td colspan="3" class="admin-empty">无</td></tr>') + '</tbody></table>'
      + '<h4 class="admin-mt">最近登录</h4><table class="admin-table"><thead><tr><th>时间</th><th>结果</th><th>原因</th></tr></thead><tbody>'
      + ((ov.logins || []).length ? (ov.logins || []).map(function(l) {
        return '<tr><td>' + escapeHtml(fmtTime(l.at)) + '</td><td>' + (l.ok ? '成功' : '失败') + '</td><td>' + escapeHtml(l.reason || '') + '</td></tr>';
      }).join('') : '<tr><td colspan="3" class="admin-empty">无</td></tr>') + '</tbody></table>'
      + '</div>';
    var selTier = $('adminUserTier');
    if (selTier) selTier.value = tier;
    var roleBox = $('adminUserRoles');
    if (roleBox && hasPerm('sys.user.manage')) {
      try {
        var roleData = await api('/api/admin/roles');
        var owned = reg.roles || [];
        roleBox.innerHTML = (roleData.roles || []).map(function(r) {
          return '<label class="admin-perm-item"><input type="checkbox" data-user-role value="' + escapeHtml(r.id) + '"'
            + (owned.indexOf(r.id) >= 0 ? ' checked' : '') + '> ' + escapeHtml(r.name || r.id) + '</label>';
        }).join('') + ' <button type="button" class="btn btn-primary" data-user-roles="' + escapeHtml(userId) + '">保存</button>'
          + '<p class="admin-muted">空着则仍按环境变量里的管理员名单。</p>';
      } catch (eRole) {
        roleBox.innerHTML = '<p class="admin-muted">角色列表没有读到</p>';
      }
    } else if (roleBox) {
      roleBox.innerHTML = '<p class="admin-muted">' + escapeHtml((reg.roles || []).join('、') || '按环境变量管理员名单') + '</p>';
    }
  } catch (e) {
    box.innerHTML = '<div class="admin-empty">' + escapeHtml(e.message || e) + '</div>';
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', async function(e) {
    var t = e.target.closest('[data-card-detail],[data-card-disable],[data-card-restore],[data-card-del],[data-card-export],[data-card-reindex],[data-novel-disable],[data-novel-restore],[data-novel-del],[data-user-profile],[data-open-card],[data-open-novel],[data-open-share],[data-user-roles],[data-share-copy],[data-share-clear]');
    if (!t) return;
    if (t.hasAttribute('data-card-detail')) { openCardDetail(t.getAttribute('data-card-detail')); return; }
    if (t.hasAttribute('data-card-disable')) { runCardAction('disable', t.getAttribute('data-card-disable')); return; }
    if (t.hasAttribute('data-card-restore')) { runCardAction('restore', t.getAttribute('data-card-restore')); return; }
    if (t.hasAttribute('data-card-del')) { runCardAction('del', t.getAttribute('data-card-del')); return; }
    if (t.hasAttribute('data-card-export')) { runCardAction('export', t.getAttribute('data-card-export')); return; }
    if (t.hasAttribute('data-card-reindex')) {
      var rk = t.getAttribute('data-card-reindex').split('|');
      try {
        await api('/api/admin/cards/' + encodeURIComponent(rk[0]) + '/' + encodeURIComponent(rk[1]) + '/reindex', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        setStatus('已重建这张卡的索引');
        openCardDetail(t.getAttribute('data-card-reindex'));
      } catch (err) { setStatus(String(err.message || err)); }
      return;
    }
    if (t.hasAttribute('data-novel-disable')) { runNovelAction('disable', t.getAttribute('data-novel-disable')); return; }
    if (t.hasAttribute('data-novel-restore')) { runNovelAction('restore', t.getAttribute('data-novel-restore')); return; }
    if (t.hasAttribute('data-novel-del')) { runNovelAction('del', t.getAttribute('data-novel-del')); return; }
    if (t.hasAttribute('data-user-profile')) {
      if (!t.getAttribute('data-user-profile')) return;
      showView('users', { keep: true });
      openUserProfile(t.getAttribute('data-user-profile'));
      return;
    }
    if (t.hasAttribute('data-open-card')) {
      showView('cards', { keep: true });
      openCardDetail(t.getAttribute('data-open-card'));
      return;
    }
    if (t.hasAttribute('data-open-novel')) {
      showView('novels', { keep: true });
      openNovelDetail(t.getAttribute('data-open-novel'));
      return;
    }
    if (t.hasAttribute('data-open-share')) {
      showView('shares', { keep: true });
      openShareDetail(t.getAttribute('data-open-share'));
      return;
    }
    if (t.hasAttribute('data-share-copy')) {
      var token = t.getAttribute('data-share-copy');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(token).then(function() { setStatus('已复制'); }, function() { setStatus(token); });
      } else setStatus(token);
      return;
    }
    if (t.hasAttribute('data-share-clear')) {
      var clearToken = t.getAttribute('data-share-clear');
      try {
        await api('/api/admin/shares/' + encodeURIComponent(clearToken) + '/clear-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        setStatus('已清除口令，停用状态没变');
        openShareDetail(clearToken);
      } catch (errClear) { setStatus(String(errClear.message || errClear)); }
      return;
    }
    if (t.hasAttribute('data-user-roles')) {
      var roleUser = t.getAttribute('data-user-roles');
      var picked = [];
      document.querySelectorAll('[data-user-role]:checked').forEach(function(c) { picked.push(c.value); });
      try {
        await api('/api/admin/users/' + encodeURIComponent(roleUser) + '/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roles: picked }),
        });
        setStatus('角色已保存');
        openUserProfile(roleUser);
      } catch (errRole) { setStatus(String(errRole.message || errRole)); }
      return;
    }
    if (t.hasAttribute('data-user-password')) {
      var uid = t.getAttribute('data-user-password');
      var pwd = await askReason('重置密码。没有邮箱认证记录会停在这里并说明，不会显示成功。', '新密码');
      if (!pwd) return;
      try {
        await api('/api/admin/users/' + encodeURIComponent(uid) + '/password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pwd }),
        });
        setStatus('密码已重置');
      } catch (err) {
        setStatus(String(err.message || err));
      }
    }
    if (t.hasAttribute('data-user-tier')) {
      var uid2 = t.getAttribute('data-user-tier');
      var sel = $('adminUserTier');
      try {
        await api('/api/admin/users/' + encodeURIComponent(uid2) + '/quota', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tier: sel ? sel.value : '' }),
        });
        setStatus('档位已保存，五行上限已按新档重算');
        openUserProfile(uid2);
      } catch (err2) {
        setStatus(String(err2.message || err2));
      }
    }
  });
  document.addEventListener('click', function(e) {
    var t = e.target.closest('#btnAdminCardDetailClose,#btnAdminProfileClose,#btnAdminNovelClose,#btnAdminShareClose');
    if (!t) return;
    if (t.id === 'btnAdminProfileClose') {
      var profile = $('adminUserProfile');
      if (profile) profile.innerHTML = '';
      var users = $('adminUserTable');
      if (users) users.hidden = false;
      loadUsers();
    }
    if (t.id === 'btnAdminCardDetailClose') {
      var detail = $('adminCardDetail');
      if (detail) detail.innerHTML = '';
      loadCards();
    }
    if (t.id === 'btnAdminNovelClose') {
      var novel = $('adminNovelDetail');
      if (novel) novel.innerHTML = '';
      loadNovels();
    }
    if (t.id === 'btnAdminShareClose') {
      var share = $('adminShareDetail');
      if (share) share.innerHTML = '';
      loadShares();
    }
  });
}


async function loadOpLog() {
  var box = $('adminOpLogTable');
  if (!box) return;
  var who = ($('adminOpLogWho') || {}).value || '';
  var action = ($('adminOpLogAction') || {}).value || '';
  try {
    var data = await api('/api/admin/oplog?who=' + encodeURIComponent(who) + '&action=' + encodeURIComponent(action) + '&limit=200');
    var logs = data.logs || [];
    if (!logs.length) { box.innerHTML = '<div class="admin-empty">无日志</div>'; return; }
    box.innerHTML = '<table class="admin-table"><thead><tr><th>时间</th><th>谁</th><th>方法与路径</th><th>状态</th><th>IP</th></tr></thead><tbody>'
      + logs.map(function(l) {
        return '<tr><td>' + escapeHtml(fmtTime(l.at)) + '</td>'
          + '<td><button type="button" class="btn btn-inline" data-user-profile="' + escapeHtml(l.who || '') + '">' + escapeHtml(l.who || '—') + '</button></td>'
          + '<td><code>' + escapeHtml((l.method || '') + ' ' + (l.action || '')) + '</code></td>'
          + '<td>' + (l.status >= 400 ? '<span class="admin-pill admin-pill--warn">' + l.status + '</span>' : l.status) + '</td>'
          + '<td class="admin-mono">' + escapeHtml(l.ip || '—') + '</td></tr>';
      }).join('')
      + '</tbody></table>';
  } catch (e) {
    box.innerHTML = '<div class="admin-empty">' + escapeHtml(e.message || e) + '</div>';
  }
}

async function loadLoginLog() {
  var box = $('adminLoginLogTable');
  if (!box) return;
  var who = ($('adminLoginLogWho') || {}).value || '';
  try {
    var data = await api('/api/admin/loginlog?who=' + encodeURIComponent(who) + '&limit=200');
    var okFilter = ($('adminLoginLogOk') || {}).value || 'all';
    var logs = (data.logs || []).filter(function(l) {
      if (okFilter === 'ok') return !!l.ok;
      if (okFilter === 'fail') return !l.ok;
      return true;
    });
    if (!logs.length) { box.innerHTML = '<div class="admin-empty">无日志</div>'; return; }
    box.innerHTML = '<table class="admin-table"><thead><tr><th>时间</th><th>用户</th><th>方式</th><th>结果</th><th>原因</th><th>IP</th></tr></thead><tbody>'
      + logs.map(function(l) {
        return '<tr><td>' + escapeHtml(fmtTime(l.at)) + '</td>'
          + '<td><button type="button" class="btn btn-inline" data-user-profile="' + escapeHtml(l.who || '') + '">' + escapeHtml(l.who || '—') + '</button></td>'
          + '<td>' + escapeHtml(l.via || '') + '</td>'
          + '<td>' + (l.ok ? '<span class="admin-pill admin-pill--ok">成功</span>' : '<span class="admin-pill admin-pill--warn">失败</span>') + '</td>'
          + '<td>' + escapeHtml(l.reason || '—') + '</td>'
          + '<td class="admin-mono">' + escapeHtml(l.ip || '—') + '</td></tr>';
      }).join('')
      + '</tbody></table>';
  } catch (e) {
    box.innerHTML = '<div class="admin-empty">' + escapeHtml(e.message || e) + '</div>';
  }
}

var PARAM_ROWS = [
  { key: 'auth.loginFailLock', hint: '邮箱登录：是否启用、失败次数、锁定分钟。失败记在登录日志。' },
  { key: 'share.defaultExpireDays', hint: '新建分享没有填过期时用这个天数。0 表示不设过期。' },
  { key: 'announcement.topbar', hint: '主站顶栏公告。留空则顶栏不显示这句。' },
];

async function applyDictSelects() {
  try {
    var data = await api('/api/admin/dicts');
    var byType = {};
    (data.dicts || []).forEach(function(d) { byType[d.dictType || d.type] = d.items; });
    [
      ['adminUserStatus', 'user.status'],
      ['adminShareType', 'share.type'],
      ['adminShareStatus', 'share.status'],
      ['adminAuditAction', 'audit.action'],
    ].forEach(function(pair) {
      var el = $(pair[0]);
      if (!el) return;
      var cur = el.value;
      var opts = dictOptions(pair[1], byType[pair[1]]);
      el.innerHTML = opts.map(function(o) {
        return '<option value="' + escapeHtml(o.value) + '">' + escapeHtml(o.label) + '</option>';
      }).join('');
      if (cur) el.value = cur;
    });
  } catch (e) { /* 下拉保持页面里的默认项 */ }
}

async function loadParams() {
  var box = $('adminParamTable');
  if (!box) return;
  var canEdit = hasPerm('sys.param.manage');
  try {
    var data = await api('/api/admin/params');
    var saved = {};
    (data.params || []).forEach(function(p) { saved[p.key] = p; });
    var params = PARAM_ROWS.map(function(row) {
      return Object.assign({ value: null }, saved[row.key] || {}, row);
    });
    box.innerHTML = '<table class="admin-table"><thead><tr><th>参数</th><th>值</th><th></th></tr></thead><tbody>'
      + params.map(function(p) {
        var actions = canEdit
          ? '<button type="button" class="btn btn-inline" data-param-save="' + escapeHtml(p.key) + '">保存</button>'
          : '';
        var shown = p.value == null ? '' : (typeof p.value === 'string' ? p.value : JSON.stringify(p.value));
        return '<tr><td><div class="admin-mono">' + escapeHtml(p.key) + '</div><div class="admin-muted">' + escapeHtml(p.hint || '') + '</div></td>'
          + '<td><input type="text" class="admin-param-value" data-key="' + escapeHtml(p.key) + '" value="' + escapeHtml(shown) + '" style="min-width:260px" /></td>'
          + '<td class="admin-td-actions">' + actions + '</td></tr>';
      }).join('')
      + '</tbody></table>';
  } catch (e) {
    box.innerHTML = '<div class="admin-empty">' + escapeHtml(e.message || e) + '</div>';
  }
}

async function loadDicts() {
  var box = $('adminDictTable');
  if (!box) return;
  var canEdit = hasPerm('sys.dict.manage');
  try {
    var data = await api('/api/admin/dicts');
    state.dictList = data.dicts || [];
    var side = DICT_TYPES.map(function(d) {
      return '<button type="button" data-dict-edit="' + escapeHtml(d.type) + '">' + escapeHtml(d.label) + '</button>';
    }).join('');
    box.innerHTML = '<div class="admin-split"><div class="admin-side-list">' + side + '</div>'
      + '<div><h3 id="adminDictEditorTitle">条目</h3>'
      + '<p class="admin-muted">一行一条：值,显示名。用户、分享、审核、审计的下拉读这里。空着就用页面里原来的选项。不拿字典改角色卡字段。</p>'
      + '<textarea id="adminDictItems" rows="10"></textarea>'
      + (canEdit ? '<p><button type="button" class="btn btn-primary" id="btnAdminDictSave">保存</button></p>' : '')
      + '</div></div>';
    var first = DICT_TYPES[0];
    if (first) openDictEditor({ dictType: first.type, label: first.label, items: itemsOf(first.type) });
  } catch (e) {
    box.innerHTML = '<div class="admin-empty">' + escapeHtml(e.message || e) + '</div>';
  }
}

function itemsOf(type) {
  var found = (state.dictList || []).find(function(d) { return (d.dictType || d.type) === type; });
  return found && found.items || [];
}

async function loadInvites() {
  var box = $('adminInviteTable');
  if (!box) return;
  var canManage = hasPerm('sys.invite.manage');
  try {
    var data = await api('/api/admin/invites');
    var statusFilter = ($('adminInviteStatus') || {}).value || 'all';
    var invites = (data.invites || []).filter(function(inv) {
      return statusFilter === 'all' || inv.status === statusFilter;
    });
    box.innerHTML = '<table class="admin-table"><thead><tr><th>码</th><th>状态</th><th>备注</th><th>使用人</th><th>创建</th><th>过期</th><th></th></tr></thead><tbody>'
      + (invites.length ? invites.map(function(inv) {
        var st = inv.status === 'valid'
          ? '<span class="admin-pill admin-pill--ok">有效</span>'
          : (inv.status === 'used' ? '<span class="admin-pill">已用</span>' : '<span class="admin-pill admin-pill--warn">已作废</span>');
        var actions = (inv.status === 'valid' && canManage)
          ? '<button type="button" class="btn btn-sm btn-delete" data-invite-revoke="' + escapeHtml(inv.code) + '">作废</button>'
          : '';
        return '<tr><td class="admin-mono"><strong>' + escapeHtml(inv.code) + '</strong></td>'
          + '<td>' + st + '</td><td>' + escapeHtml(inv.note || '') + '</td>'
          + '<td>' + (inv.usedBy
            ? '<button type="button" class="btn btn-inline" data-user-profile="' + escapeHtml(inv.usedBy) + '">' + escapeHtml(inv.usedBy) + '</button>'
            : '—') + '</td>'
          + '<td>' + escapeHtml(fmtTime(inv.createdAt)) + '</td>'
          + '<td>' + escapeHtml(fmtTime(inv.expiresAt)) + '</td>'
          + '<td class="admin-td-actions">' + actions + '</td></tr>';
      }).join('') : '<tr><td colspan="7" class="admin-empty">无邀请码</td></tr>')
      + '</tbody></table>';
  } catch (e) {
    box.innerHTML = '<div class="admin-empty">' + escapeHtml(e.message || e) + '</div>';
  }
}

async function loadQuota() {
  var box = $('adminQuotaTable');
  var tiersBox = $('adminQuotaTiers');
  if (!box) return;
  try {
    var tier = ($('adminQuotaTier') || {}).value || 'all';
    var over = ($('adminQuotaOver') || {}).value || '';
    var data = await api('/api/admin/quota/users?tier=' + encodeURIComponent(tier) + '&over=' + encodeURIComponent(over));
    var users = data.users || [];
    if (tiersBox) {
      tiersBox.innerHTML = capNote(data.capped, data.listedCap)
        ? '<p class="admin-muted">' + escapeHtml(capNote(data.capped, data.listedCap)) + '。点一行进用户页改档，这里不改档。</p>'
        : '<p class="admin-muted">点一行进用户页改档，这里不改档。</p>';
    }
    box.innerHTML = '<table class="admin-table"><thead><tr><th>用户</th><th>档位</th><th>卡</th><th>容量</th><th>分享</th><th>Token</th><th>超了</th></tr></thead><tbody>'
      + (users.length ? users.map(function(u) {
        var use = u.usage || {};
        var lim = u.limits || {};
        function pair(key, bytes) {
          var used = bytes ? fmtBytes(use[key]) : String(use[key] || 0);
          var cap = Number.isFinite(lim[key]) ? (bytes ? fmtBytes(lim[key]) : String(lim[key])) : '不限';
          return used + '/' + cap;
        }
        return '<tr data-user-profile="' + escapeHtml(u.userId) + '"><td>' + escapeHtml(u.displayName || u.userId) + '</td>'
          + '<td>' + escapeHtml(u.tierLabel || u.tier || '') + '</td>'
          + '<td>' + pair('cardsOnCloud') + '</td>'
          + '<td>' + pair('cloudBytes', true) + '</td>'
          + '<td>' + pair('activeShares') + '</td>'
          + '<td>' + pair('bearerTokens') + '</td>'
          + '<td>' + escapeHtml((u.exceeded || []).join('、') || '—') + '</td></tr>';
      }).join('') : '<tr><td colspan="7" class="admin-empty">无用户</td></tr>')
      + '</tbody></table>';
  } catch (e) {
    box.innerHTML = '<div class="admin-empty">' + escapeHtml(e.message || e) + '</div>';
  }
}

async function loadFiles() {
  var box = $('adminFileTable');
  if (!box) return;
  var canManage = hasPerm('sys.file.manage');
  try {
    var data = await api('/api/admin/files');
    var source = ($('adminFileSource') || {}).value || 'all';
    var nameQ = String(($('adminFileName') || {}).value || '').trim().toLowerCase();
    var files = (data.files || []).filter(function(f) {
      if (source !== 'all' && (f.source || 'upload') !== source) return false;
      if (nameQ && String(f.name || '').toLowerCase().indexOf(nameQ) < 0) return false;
      return true;
    });
    box.innerHTML = '<table class="admin-table"><thead><tr><th>名称</th><th>来源</th><th>大小</th><th>时间</th><th>谁</th><th></th></tr></thead><tbody>'
      + (files.length ? files.map(function(f) {
        var actions = '<a class="btn btn-sm btn-ghost" href="' + apiUrl('/api/admin/files/' + encodeURIComponent(f.id) + '/download') + '" target="_blank">下载</a>'
          + (canManage ? '<button type="button" class="btn btn-sm btn-delete" data-file-del="' + escapeHtml(f.id) + '">删除</button>' : '');
        return '<tr><td>' + escapeHtml(f.name) + '</td>'
          + '<td>' + escapeHtml(f.source || 'upload') + '</td>'
          + '<td>' + escapeHtml(fmtBytes(f.size)) + '</td>'
          + '<td>' + escapeHtml(fmtTime(f.uploadedAt)) + '</td>'
          + '<td>' + escapeHtml(f.uploadedBy || '—') + '</td>'
          + '<td class="admin-td-actions">' + actions + '</td></tr>';
      }).join('') : '<tr><td colspan="6" class="admin-empty">无文件</td></tr>')
      + '</tbody></table>';
  } catch (e) {
    box.innerHTML = '<div class="admin-empty">' + escapeHtml(e.message || e) + '</div>';
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', async function(e) {
    var t = e.target.closest('[data-param-save],[data-param-del],[data-dict-edit],[data-dict-del],[data-invite-revoke],[data-file-del]');
    if (!t) return;
    if (t.hasAttribute('data-param-save')) {
      var key = t.getAttribute('data-param-save');
      var input = document.querySelector('.admin-param-value[data-key="' + CSS.escape(key) + '"]');
      try {
        await api('/api/admin/params/' + encodeURIComponent(key), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: input ? input.value : '' }),
        });
        setStatus('参数已保存');
        loadParams();
      } catch (e2) { setStatus(String(e2.message || e2)); }
      return;
    }
    if (t.hasAttribute('data-param-del')) {
      try {
        await api('/api/admin/params/' + encodeURIComponent(t.getAttribute('data-param-del')), { method: 'DELETE' });
        setStatus('已重置');
        loadParams();
      } catch (e2) { setStatus(String(e2.message || e2)); }
      return;
    }
    if (t.hasAttribute('data-dict-edit')) {
      var dt = t.getAttribute('data-dict-edit');
      try {
        var dd = await api('/api/admin/dicts');
        var found = (dd.dicts || []).find(function(x) { return x.dictType === dt; });
        openDictEditor(found || { dictType: dt, label: dt, items: [] });
      } catch (e2) { setStatus(String(e2.message || e2)); }
      return;
    }
    if (t.hasAttribute('data-dict-del')) {
      var sureDict = await askReason('删除这个字典');
      if (!sureDict) return;
      try {
        await api('/api/admin/dicts/' + encodeURIComponent(t.getAttribute('data-dict-del')), { method: 'DELETE' });
        setStatus('已删除字典');
        loadDicts();
      } catch (e2) { setStatus(String(e2.message || e2)); }
      return;
    }
    if (t.hasAttribute('data-invite-revoke')) {
      try {
        await api('/api/admin/invites/' + encodeURIComponent(t.getAttribute('data-invite-revoke')) + '/revoke', { method: 'POST' });
        setStatus('已作废');
        loadInvites();
      } catch (e2) { setStatus(String(e2.message || e2)); }
      return;
    }
    if (t.hasAttribute('data-file-del')) {
      var sureFile = await askReason('删除这个文件');
      if (!sureFile) return;
      try {
        await api('/api/admin/files/' + encodeURIComponent(t.getAttribute('data-file-del')), { method: 'DELETE' });
        setStatus('已删除');
        loadFiles();
      } catch (e2) { setStatus(String(e2.message || e2)); }
    }
  });
  document.addEventListener('click', function(e) {
    var t = e.target.closest('#btnAdminNewDict,#btnAdminDictSave,#btnAdminDictCancel,#btnAdminGenInvites,#btnAdminUploadFile');
    if (!t) return;
    if (t.id === 'btnAdminNewDict') openDictEditor({ dictType: ($('adminNewDictType') || {}).value || '', label: '', items: [] });
    if (t.id === 'btnAdminDictCancel') { var ed = $('adminDictEditor'); if (ed) ed.hidden = true; }
    if (t.id === 'btnAdminDictSave') saveDictFromForm();
    if (t.id === 'btnAdminGenInvites') genInvites();
    if (t.id === 'btnAdminUploadFile') uploadFileFromForm();
  });
}

function openDictEditor(dict) {
  state.activeDictType = dict.dictType;
  var meta = DICT_TYPES.find(function(d) { return d.type === dict.dictType; });
  var title = $('adminDictEditorTitle');
  if (title) title.textContent = (meta && meta.label) || dict.dictType || '条目';
  var label = $('adminDictLabel');
  if (label) label.value = (meta && meta.label) || dict.label || '';
  document.querySelectorAll('[data-dict-edit]').forEach(function(btn) {
    btn.classList.toggle('is-active', btn.getAttribute('data-dict-edit') === dict.dictType);
  });
  var items = $('adminDictItems');
  if (items) {
    items.value = (dict.items || []).map(function(i) {
      var v = i.value != null ? i.value : i;
      var l = i.label != null ? i.label : i;
      return v === l ? String(v) : (String(v) + ',' + String(l));
    }).join('\n');
  }
}

async function saveDictFromForm() {
  var type = state.activeDictType;
  if (!type) { setStatus('缺少字典 type'); return; }
  var meta = DICT_TYPES.find(function(d) { return d.type === type; });
  var label = ($('adminDictLabel') || {}).value || (meta && meta.label) || type;
  var raw = ($('adminDictItems') || {}).value || '';
  var items = raw.split('\n').map(function(line) {
    line = String(line || '').trim();
    if (!line) return null;
    var comma = line.indexOf(',');
    if (comma >= 0) return { value: line.slice(0, comma).trim(), label: line.slice(comma + 1).trim() };
    return { value: line, label: line };
  }).filter(Boolean);
  try {
    await api('/api/admin/dicts/' + encodeURIComponent(type), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: type, label: label, items: items }),
    });
    setStatus('字典已保存');
    loadDicts();
  } catch (e) { setStatus(String(e.message || e)); }
}

async function genInvites() {
  var note = ($('adminInviteNote') || {}).value || '';
  var count = Number(($('adminInviteCount') || {}).value) || 1;
  var days = Number(($('adminInviteDays') || {}).value);
  try {
    var r = await api('/api/admin/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: note, count: count, expiresInDays: days > 0 ? days : 0 }),
    });
    setStatus('已生成 ' + (r.codes || []).join(' '));
    loadInvites();
  } catch (e) { setStatus(String(e.message || e)); }
}

async function uploadFileFromForm() {
  var fileInput = $('adminFileData');
  var file = fileInput && fileInput.files && fileInput.files[0];
  if (!file) { setStatus('请选择文件'); return; }
  var name = file.name;
  var reader = new FileReader();
  reader.onload = async function() {
    try {
      var base64 = String(reader.result || '').split(',')[1] || '';
      await api('/api/admin/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, contentType: file.type || 'application/octet-stream', base64: base64 }),
      });
      setStatus('已上传 ' + name);
      loadFiles();
      if (fileInput) fileInput.value = '';
    } catch (e) { setStatus(String(e.message || e)); }
  };
  reader.readAsDataURL(file);
}

async function loadTasks() {
  var box = $('adminTaskTable');
  if (!box) return;
  var canToggle = hasPerm('sys.task.manage');
  var canRun = hasPerm('sys.task.trigger');
  try {
    var data = await api('/api/admin/tasks');
    var tasks = data.tasks || [];
    box.innerHTML = '<table class="admin-table"><thead><tr><th>名称</th><th>周期</th><th>开启</th><th>上次</th><th>结果</th><th></th></tr></thead><tbody>'
      + tasks.map(function(t) {
        var err = t.lastStatus === 'error' ? '<div class="admin-muted">' + escapeHtml(t.lastError || '') + '</div>' : '';
        var result = t.lastStatus === 'skipped' ? '跳过：' + (t.lastResult || '') : (t.lastStatus || '—');
        var actions = '';
        if (canToggle) {
          actions += '<button type="button" class="btn btn-inline" data-task-toggle="' + escapeHtml(t.id) + '" data-on="' + (t.enabled ? '0' : '1') + '">'
            + (t.enabled ? '关闭' : '开启') + '</button> ';
        }
        if (canRun) {
          actions += '<button type="button" class="btn btn-inline" data-task-run="' + escapeHtml(t.id) + '">立即执行</button>';
        }
        return '<tr><td>' + escapeHtml(t.name || t.id) + '</td><td>' + escapeHtml(t.schedule || '') + '</td><td>'
          + (t.enabled ? '开' : '关') + '</td><td>' + escapeHtml(fmtTime(t.lastFinishedAt || t.lastRun)) + '</td><td>'
          + escapeHtml(result) + err + '</td><td>' + actions + '</td></tr>';
      }).join('')
      + '</tbody></table>';
  } catch (e) {
    box.innerHTML = '<div class="admin-empty">' + escapeHtml(e.message || e) + '</div>';
  }
}

async function loadBackup() {
  var box = $('adminBackupBody');
  if (!box) return;
  try {
    var overview = await api('/api/admin/overview');
    state.overview = overview;
    var on = !!(overview.flags && overview.flags.backupEnabled);
    var btn = $('btnAdminBackup');
    if (btn) {
      btn.disabled = !on || !hasPerm('admin.backup.run');
      btn.title = on ? '' : '服务器未打开 ADMIN_BACKUP_ENABLED';
    }
    var backups = [];
    try { backups = (await api('/api/admin/backups')).backups || []; } catch (eB) { backups = []; }
    box.innerHTML = '<p class="admin-muted">' + (on
      ? '服务器允许备份。下载的是这次备份的结果说明，目录仍在服务器 ADMIN_BACKUP_DIR。'
      : '服务器未打开 ADMIN_BACKUP_ENABLED，这里不能把它改成开启。') + '</p>'
      + '<table class="admin-table"><thead><tr><th>时间</th><th>结果</th><th>大小</th><th>下载</th></tr></thead><tbody>'
      + (backups.length ? backups.map(function(b) {
        var dl = b.fileId
          ? '<a class="btn btn-inline" href="' + apiUrl('/api/admin/files/' + encodeURIComponent(b.fileId) + '/download') + '">下载</a>'
          : '—';
        var err = b.status === 'error' ? '<div class="admin-muted">' + escapeHtml(b.log || '') + '</div>' : '';
        return '<tr><td>' + escapeHtml(fmtTime(b.at)) + '</td><td>' + escapeHtml(b.status || '') + err + '</td><td>'
          + escapeHtml(b.size ? fmtBytes(b.size) : '—') + '</td><td>' + dl + '</td></tr>';
      }).join('') : '<tr><td colspan="4" class="admin-empty">还没有备份</td></tr>')
      + '</tbody></table>';
  } catch (e) {
    box.innerHTML = '<div class="admin-empty">' + escapeHtml(e.message || e) + '</div>';
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', async function(e) {
    var t = e.target.closest('[data-task-toggle],[data-task-run]');
    if (!t) return;
    var id = t.getAttribute('data-task-toggle') || t.getAttribute('data-task-run');
    try {
      if (t.hasAttribute('data-task-toggle')) {
        await api('/api/admin/tasks/' + encodeURIComponent(id) + '/enabled', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: t.getAttribute('data-on') === '1' }),
        });
      } else {
        var run = await api('/api/admin/tasks/' + encodeURIComponent(id) + '/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        var st = run.run && run.run.status;
        setStatus(st === 'skipped' ? '未执行：服务器未开启备份' : ('任务结果：' + st));
      }
      loadTasks();
    } catch (err) {
      setStatus(String(err.message || err));
    }
  });
}

export { showView, loadDashboard, loadUsers, loadShares, loadTokens, loadDatabases, loadAudit, loadSystem, loadRoles, loadMenus, renderAdminNav, loadCards, loadNovels, loadOpLog, loadLoginLog, loadParams, loadDicts, loadInvites, loadQuota, loadFiles, loadTasks, loadBackup, openUserProfile, openCardDetail, openNovelDetail, openShareDetail };
