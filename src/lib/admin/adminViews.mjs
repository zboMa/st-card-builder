/**
 * 管理端：视图切换与数据加载（拆自 browserApp）
 */
import {
  state, api, $, escapeHtml, fmtBytes, fmtTime, setBanner, setStatus, isOps, hasPerm, askReason,
} from './adminShared.mjs';
import { sidebarGroups, quotaRows, sortCardsByBytes, capNote, permLabel, dictOptions } from './deskView.mjs';
import { apiUrl } from '../publicConfig.mjs';

function showView(name) {
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
  content: '内容管理',
  moderation: '审核合规',
  sys: '系统管理',
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
      flags.innerHTML = '<p class="admin-muted">进程已运行 ' + escapeHtml(uptime) + '，内存占用 ' + escapeHtml(mem) + '</p>';
    }
    if (trendBox) {
      var lines = (audit.audit || []).slice(0, 8).map(function(r) {
        var who = r.by || '—';
        var target = r.targetCardId || r.token || r.targetUserId || '—';
        return '<button type="button" class="admin-status-row" data-admin-jump="'
          + escapeHtml(r.targetCardId ? 'cards' : (r.token ? 'shares' : 'users')) + '">'
          + '<span>' + escapeHtml(who) + ' · ' + escapeHtml(r.action || '') + ' · ' + escapeHtml(target) + '</span>'
          + '<span class="admin-muted">' + escapeHtml(r.reason || '') + '</span></button>';
      }).join('');
      trendBox.innerHTML = '<h3>最近处置</h3>' + (lines || '<p class="ui-empty-tip">还没有处置记录</p>');
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
    + '<span>共 ' + total + ' · 第 ' + page + '/' + pages + ' 页</span>'
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
    box.innerHTML = '<table class="admin-table"><thead><tr>'
      + '<th>标题 / Token</th><th>类型</th><th>所有者</th><th>版本</th><th>状态</th><th></th>'
      + '</tr></thead><tbody>'
      + shares.map(function(s) {
        var ver = s.characterVersionHint || s.displayVersionHint || '—';
        var st = !s.enabled
          ? '<span class="admin-pill admin-pill--warn">已停用</span>'
          : (s.expired
            ? '<span class="admin-pill admin-pill--warn">已过期</span>'
            : '<span class="admin-pill admin-pill--ok">有效</span>');
        var meta = [];
        if (s.hasPassword) meta.push('密码');
        if (s.pngPublic) meta.push('PNG直链');
        var actions = '';
        if (isOps()) {
          if (s.enabled) {
            actions += '<button type="button" class="btn btn-sm btn-ghost" data-share-soft="'
              + escapeHtml(s.token) + '" data-on="0">软停用</button>';
          } else {
            actions += '<button type="button" class="btn btn-sm btn-ghost" data-share-soft="'
              + escapeHtml(s.token) + '" data-on="1">恢复</button>';
          }
          actions += '<button type="button" class="btn btn-sm btn-delete" data-share-del="'
            + escapeHtml(s.token) + '">删除</button>';
        } else {
          actions = '<span class="admin-muted">只读</span>';
        }
        return '<tr>'
          + '<td><strong>' + escapeHtml(s.titleHint || s.token) + '</strong>'
          + '<div class="admin-muted">' + escapeHtml(s.token)
          + (meta.length ? ' · ' + meta.join(' · ') : '') + '</div></td>'
          + '<td>' + escapeHtml(s.type === 'card-share' ? '角色卡' : (s.type === 'novel-share' ? '小说' : s.type)) + '</td>'
          + '<td class="admin-mono">' + escapeHtml(s.ownerUserId || '—') + '</td>'
          + '<td>' + escapeHtml(ver) + '</td>'
          + '<td>' + st + '</td>'
          + '<td class="admin-td-actions">' + actions + '</td></tr>';
      }).join('')
      + '</tbody></table>'
      + pagerHtml('shares', data.total || 0, state.sharesOffset);
  } catch (e) {
    if (box) box.innerHTML = '<div class="admin-empty">' + escapeHtml(e.message || e) + '</div>';
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
        var actions = isOps()
          ? ('<button type="button" class="btn btn-sm btn-delete" data-token-revoke="'
            + escapeHtml(t.id) + '">吊销</button>')
          : '<span class="admin-muted">只读</span>';
        return '<tr>'
          + '<td><strong>' + escapeHtml(t.displayName || t.username || t.userId) + '</strong>'
          + '<div class="admin-muted">' + escapeHtml(t.userId) + '</div></td>'
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
    if (analysisEl) {
      analysisEl.innerHTML = '<div class="admin-flag-grid">'
        + '<div class="admin-flag"><span>用户库</span><strong>' + escapeHtml(a.userDbCount || 0) + '</strong></div>'
        + '<div class="admin-flag"><span>注册用户</span><strong>' + escapeHtml(a.registryCount || 0) + '</strong></div>'
        + '<div class="admin-flag"><span>孤儿库</span><strong>' + escapeHtml((a.orphans || []).length) + '</strong></div>'
        + '<div class="admin-flag"><span>缺库用户</span><strong>' + escapeHtml((a.missing || []).length) + '</strong></div>'
        + '</div>'
        + ((a.orphans || []).length
          ? '<p class="admin-muted admin-mt">孤儿库：' + escapeHtml((a.orphans || []).join(', ')) + '</p>'
          : '')
        + ((a.missing || []).length
          ? '<p class="admin-muted">缺库：' + escapeHtml((a.missing || []).map(function(m) { return m.userId; }).join(', ')) + '</p>'
          : '');
    }
    if (!box) return;
    if (!dbs.length) {
      box.innerHTML = '<div class="admin-empty">无数据库信息</div>';
      return;
    }
    box.innerHTML = '<table class="admin-table"><thead><tr>'
      + '<th>名称</th><th>类型</th><th>文档数</th><th>磁盘</th></tr></thead><tbody>'
      + dbs.map(function(d) {
        return '<tr><td class="admin-mono">' + escapeHtml(d.name) + '</td>'
          + '<td>' + escapeHtml(d.type) + '</td>'
          + '<td>' + escapeHtml(d.docCount) + '</td>'
          + '<td>' + escapeHtml(fmtBytes(d.diskSize)) + '</td></tr>';
      }).join('')
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
    var data = await api('/api/admin/audit?action=' + encodeURIComponent(action)
      + '&by=' + encodeURIComponent(by)
      + '&limit=' + state.pageSize
      + '&offset=' + state.auditOffset);
    var rows = data.audit || [];
    if (!box) return;
    if (!rows.length) {
      box.innerHTML = '<div class="admin-empty">无审计记录</div>' + pagerHtml('audit', data.total || 0, state.auditOffset);
      return;
    }
    box.innerHTML = '<table class="admin-table"><thead><tr>'
      + '<th>时间</th><th>动作</th><th>操作者</th><th>目标</th></tr></thead><tbody>'
      + rows.map(function(r) {
        var target = r.targetUserId || r.token || r.tokenId || r.outDir || '—';
        return '<tr><td>' + escapeHtml(fmtTime(r.at)) + '</td>'
          + '<td><code>' + escapeHtml(r.action) + '</code></td>'
          + '<td class="admin-mono">' + escapeHtml(r.by || '—') + '</td>'
          + '<td class="admin-mono">' + escapeHtml(target) + '</td></tr>';
      }).join('')
      + '</tbody></table>'
      + pagerHtml('audit', data.total || 0, state.auditOffset);
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
    var backups = [];
    try { backups = (await api('/api/admin/backups')).backups || []; } catch (eB) { /* ignore */ }
    try { state.overview = overview; } catch (e0) { /* ignore */ }
    var sysCards = '';
    if (sysStatus) {
      sysCards = '<div class="admin-flag-grid">'
        + '<div class="admin-flag"><span>运行时长</span><strong>' + Math.round((sysStatus.uptimeSec || 0) / 60) + ' 分</strong></div>'
        + '<div class="admin-flag"><span>Node</span><strong>' + escapeHtml(sysStatus.node || '') + '</strong></div>'
        + '<div class="admin-flag"><span>CPU 核</span><strong>' + (sysStatus.cpus || 0) + '</strong></div>'
        + '<div class="admin-flag"><span>内存使用</span><strong>' + (sysStatus.memUsedPct || 0) + '%</strong></div>'
        + '<div class="admin-flag"><span>Couch</span><strong>' + (sysStatus.couch && sysStatus.couch.ok ? '正常' : '异常') + '</strong></div>'
        + '</div>';
    }
    var backupRows = (backups || []).map(function(b) {
      return '<tr><td>' + escapeHtml(fmtTime(b.at)) + '</td>'
        + '<td>' + escapeHtml(b.status) + '</td>'
        + '<td class="admin-mono">' + escapeHtml(b.outDir || '') + '</td>'
        + '<td>' + escapeHtml(b.triggeredBy || '—') + '</td></tr>';
    }).join('');
    box.innerHTML = '<h3>服务器状态</h3>' + sysCards
      + '<h3 class="admin-mt">Health</h3><pre class="admin-pre">' + escapeHtml(JSON.stringify(health, null, 2)) + '</pre>'
      + '<h3 class="admin-mt">Overview flags</h3><pre class="admin-pre">' + escapeHtml(JSON.stringify(overview.flags || {}, null, 2)) + '</pre>'
      + '<h3 class="admin-mt">备份历史（' + (backups || []).length + '）</h3>'
      + '<table class="admin-table"><thead><tr><th>时间</th><th>状态</th><th>目录</th><th>触发</th></tr></thead><tbody>'
      + (backupRows || '<tr><td colspan="4" class="admin-empty">无备份记录</td></tr>')
      + '</tbody></table>'
      + '<p class="admin-muted">备份：需在服务器 .env 设置 ADMIN_BACKUP_ENABLED=true。逻辑备份写入 ADMIN_BACKUP_DIR 或 server/backups/。周期备份可在「定时任务」开启。</p>'
      + '</div>';
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
    var rows = roles.map(function(r) {
      var actions = editable
        ? ('<button type="button" class="btn btn-sm btn-ghost" data-role-edit="' + escapeHtml(r.id) + '">编辑</button>'
          + (r.builtin
            ? ''
            : '<button type="button" class="btn btn-sm btn-delete" data-role-del="' + escapeHtml(r.id) + '">删除</button>'))
        : '<span class="admin-muted">只读</span>';
      return '<tr>'
        + '<td><strong>' + escapeHtml(r.name || r.id) + '</strong>'
        + (r.builtin ? ' <span class="admin-badge admin-badge--muted">内置</span>' : '')
        + '<div class="admin-muted">' + escapeHtml(r.desc || '') + '</div></td>'
        + '<td class="admin-mono">' + escapeHtml(r.id) + '</td>'
        + '<td>' + (r.perms || []).length + '</td>'
        + '<td class="admin-td-actions">' + actions + '</td></tr>';
    }).join('');
    var editor = '<div class="admin-editor" id="adminRoleEditor" hidden>'
      + '<div class="admin-panel-head"><h3 id="adminRoleEditorTitle">编辑角色</h3></div>'
      + '<div class="admin-toolbar">'
      + '<input id="adminRoleName" placeholder="角色名" />'
      + '<input id="adminRoleDesc" placeholder="描述" />'
      + '<input id="adminRoleNewId" placeholder="新角色 id（英文）" hidden />'
      + '</div>'
      + '<div id="adminRolePermBox" class="admin-perm-box"></div>'
      + '<div class="admin-toolbar">'
      + '<button type="button" class="btn btn-sm btn-primary" id="btnAdminRoleSave">保存</button>'
      + '<button type="button" class="btn btn-sm btn-ghost" id="btnAdminRoleCancel">取消</button>'
      + '</div></div>';
    box.innerHTML = editor
      + (editable
        ? '<div class="admin-panel-head"><h3>角色</h3><button type="button" class="btn btn-sm btn-fetch" id="btnAdminRoleNew">新建角色</button></div>'
        : '<div class="admin-panel-head"><h3>角色</h3></div>')
      + '<table class="admin-table"><thead><tr><th>名称</th><th>id</th><th>权限点</th><th></th></tr></thead><tbody>'
      + (rows || '<tr><td colspan="4" class="admin-empty">无角色</td></tr>')
      + '</tbody></table>';
    state.rolePermGroups = groups;
    state.rolePerms = permsData.perms || [];
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
  if (title) title.textContent = role.id ? ('编辑角色 · ' + role.id) : '新建角色';
  if (newId) {
    newId.hidden = !!role.id;
    if (!role.id) newId.value = '';
  }
  if (name) name.value = role.name || '';
  if (desc) desc.value = role.desc || '';
  var box = $('adminRolePermBox');
  if (box) box.innerHTML = permEditorHtml(role.perms || [], state.rolePermGroups || {});
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
        var actions = editable
          ? ('<button type="button" class="btn btn-sm btn-ghost" data-menu-edit="' + escapeHtml(m.id) + '">编辑</button>'
            + '<button type="button" class="btn btn-sm btn-delete" data-menu-del="' + escapeHtml(m.id) + '">删除</button>')
          : '';
        html += '<tr>'
          + '<td class="admin-menu-name" style="padding-left:' + (depth * 20 + 8) + 'px">'
          + (depth ? '↳ ' : '') + '<strong>' + escapeHtml(m.name) + '</strong>'
          + (m.group ? ' <span class="admin-badge admin-badge--muted">分组</span>' : '') + '</td>'
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
      + '<table class="admin-table"><thead><tr><th>名称</th><th>权限点</th><th>排序</th><th></th></tr></thead><tbody>'
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
      if (!window.confirm('删除该角色？引用该角色的用户将失去其权限。')) return;
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
      if (!window.confirm('删除该菜单？')) return;
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


async function loadModeration() {
  var box = $('adminModerationBody');
  if (!box) return;
  var canReview = hasPerm('moderation.review');
  var canApprove = hasPerm('moderation.approve');
  try {
    var flagData = await api('/api/admin/moderation/flags?status=open');
    var apprData = await api('/api/admin/moderation/approvals?status=pending');
    var flags = flagData.flags || [];
    var approvals = apprData.approvals || [];
    var flagRows = flags.map(function(f) {
      var actions = canReview
        ? ('<button type="button" class="btn btn-sm btn-ghost" data-flag-resolve="' + escapeHtml(f._id) + '|ignore">忽略</button>'
          + '<button type="button" class="btn btn-sm btn-ghost" data-flag-resolve="' + escapeHtml(f._id) + '|remove">下架目标</button>')
        : '<span class="admin-muted">只读</span>';
      return '<tr>'
        + '<td>' + escapeHtml(f.targetType === 'card' ? '卡' : '小说') + '</td>'
        + '<td class="admin-mono">' + escapeHtml(f.targetUserId) + '</td>'
        + '<td class="admin-mono">' + escapeHtml(f.cardId + (f.novelId ? '/' + f.novelId : '')) + '</td>'
        + '<td>' + escapeHtml((f.reason || '').slice(0, 80)) + '</td>'
        + '<td>' + escapeHtml(f.reportedBy || '—') + '</td>'
        + '<td>' + escapeHtml(fmtTime(f.at)) + '</td>'
        + '<td class="admin-td-actions">' + actions + '</td></tr>';
    }).join('');
    var approvalRows = approvals.map(function(a) {
      var t = a.target || {};
      var own = state.user && String(a.requestedBy || '') === String(state.user.id);
      var actions = (!canApprove || own)
        ? '<span class="admin-muted">' + (own ? '不能批自己的单' : '无审批权') + '</span>'
        : ('<button type="button" class="btn btn-sm btn-primary" data-appr-decide="' + escapeHtml(a._id) + '|1">通过</button>'
          + '<button type="button" class="btn btn-sm btn-ghost" data-appr-decide="' + escapeHtml(a._id) + '|0">驳回</button>');
      return '<tr>'
        + '<td><code>' + escapeHtml(a.action) + '</code></td>'
        + '<td class="admin-mono">' + escapeHtml(t.userId) + '</td>'
        + '<td class="admin-mono">' + escapeHtml((t.cardId || '') + (t.novelId ? '/' + t.novelId : '')) + '</td>'
        + '<td>' + escapeHtml((a.reason || '').slice(0, 80)) + '</td>'
        + '<td>' + escapeHtml(a.requestedBy || '—') + '</td>'
        + '<td>' + escapeHtml(fmtTime(a.at)) + '</td>'
        + '<td class="admin-td-actions">' + actions + '</td></tr>';
    }).join('');
    box.innerHTML = '<h3>举报队列（' + flags.length + '）</h3>'
      + '<table class="admin-table"><thead><tr><th>类型</th><th>目标用户</th><th>目标</th><th>理由</th><th>举报人</th><th>时间</th><th></th></tr></thead><tbody>'
      + (flagRows || '<tr><td colspan="7" class="admin-empty">无待处理举报</td></tr>')
      + '</tbody></table>'
      + '<h3 class="admin-mt">待审批高危操作（' + approvals.length + '）</h3>'
      + '<table class="admin-table"><thead><tr><th>动作</th><th>目标用户</th><th>目标</th><th>理由</th><th>申请人</th><th>时间</th><th></th></tr></thead><tbody>'
      + (approvalRows || '<tr><td colspan="7" class="admin-empty">无待审批</td></tr>')
      + '</tbody></table>';
  } catch (e) {
    box.innerHTML = '<div class="admin-empty">' + escapeHtml(e.message || e) + '</div>';
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', async function(e) {
    var t = e.target.closest('[data-flag-resolve],[data-appr-decide]');
    if (!t) return;
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
      + '&limit=200&offset=0');
    var cards = data.cards || [];
    if (!cards.length) {
      box.innerHTML = '<div class="admin-empty">无匹配卡</div>';
      return;
    }
    var canDisable = hasPerm('content.card.disable');
    var canDelete = hasPerm('content.card.delete');
    var canExport = hasPerm('content.card.export');
    box.innerHTML = '<table class="admin-table"><thead><tr>'
      + '<th>卡名</th><th>用户</th><th>cardId</th><th>标记</th><th>内容</th><th>大小</th><th>状态</th><th>分享</th><th></th>'
      + '</tr></thead><tbody>'
      + cards.map(function(c) {
        var removed = c.moderated && c.moderated.status === 'removed';
        var badges = '';
        if (c.nsfw) badges += '<span class="admin-pill admin-pill--warn">NSFW</span>';
        if (c.avatar) badges += '<span class="admin-pill">图</span>';
        var share = c.share ? (c.share.enabled && !c.share.expired ? '有效' : '停用') : '—';
        var actions = '<button type="button" class="btn btn-sm btn-ghost" data-card-detail="'
          + escapeHtml(c.userId) + '|' + escapeHtml(c.cardId) + '">详情</button>';
        if (canDisable) {
          actions += removed
            ? '<button type="button" class="btn btn-sm btn-ghost" data-card-restore="'
              + escapeHtml(c.userId) + '|' + escapeHtml(c.cardId) + '">恢复</button>'
            : '<button type="button" class="btn btn-sm btn-ghost" data-card-disable="'
              + escapeHtml(c.userId) + '|' + escapeHtml(c.cardId) + '">下架</button>';
        }
        if (canExport) {
          actions += '<button type="button" class="btn btn-sm btn-ghost" data-card-export="'
            + escapeHtml(c.userId) + '|' + escapeHtml(c.cardId) + '">导出</button>';
        }
        if (canDelete) {
          actions += '<button type="button" class="btn btn-sm btn-delete" data-card-del="'
            + escapeHtml(c.userId) + '|' + escapeHtml(c.cardId) + '">审批删除</button>';
        }
        return '<tr class="' + (removed ? 'is-disabled' : '') + '">'
          + '<td><strong>' + escapeHtml(c.charName || '(未命名)') + '</strong></td>'
          + '<td class="admin-mono">' + escapeHtml(c.userId) + '</td>'
          + '<td class="admin-mono">' + escapeHtml(c.cardId) + '</td>'
          + '<td>' + badges + '</td>'
          + '<td>小说 ' + c.storyCount + ' · WB ' + c.wbCount + '</td>'
          + '<td>' + escapeHtml(fmtBytes(c.bundleBytes)) + '</td>'
          + '<td>' + (removed ? '<span class="admin-pill admin-pill--warn">已下架</span>' : '<span class="admin-pill admin-pill--ok">正常</span>') + '</td>'
          + '<td>' + escapeHtml(share) + '</td>'
          + '<td class="admin-td-actions">' + actions + '</td></tr>';
      }).join('')
      + '</tbody></table>'
      + '<p class="admin-muted">' + cards.length + ' 条 · 全库检索（索引驱动）</p>';
  } catch (e) {
    box.innerHTML = '<div class="admin-empty">' + escapeHtml(e.message || e) + '</div>';
  }
}

async function openCardDetail(key) {
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
    var html = '<div class="admin-editor">'
      + '<div class="admin-panel-head"><h3>卡 · ' + escapeHtml(meta.charName || cardId) + '</h3>'
      + '<button type="button" class="btn btn-sm btn-ghost" id="btnAdminCardDetailClose">关闭</button></div>'
      + '<div class="admin-flag-grid">'
      + '<div class="admin-flag"><span>用户</span><strong>' + escapeHtml(userId) + '</strong></div>'
      + '<div class="admin-flag"><span>cardId</span><strong>' + escapeHtml(cardId) + '</strong></div>'
      + '<div class="admin-flag"><span>NSFW</span><strong>' + (meta.nsfw ? '是' : '否') + '</strong></div>'
      + '<div class="admin-flag"><span>版本</span><strong>' + escapeHtml(meta.characterVersion || '—') + '</strong></div>'
      + '<div class="admin-flag"><span>世界书条数</span><strong>' + (meta.worldbookEntries || 0) + '</strong></div>'
      + '<div class="admin-flag"><span>头像</span><strong>' + (d.avatarFullPresent ? '有' : '无') + '</strong></div>'
      + '<div class="admin-flag"><span>小说工坊</span><strong>' + (d.novelWorkshopPresent ? '有' : '无') + '</strong></div>'
      + '<div class="admin-flag"><span>Story 小说</span><strong>' + (d.storyCount || 0) + '</strong></div>'
      + '<div class="admin-flag"><span>更新时间</span><strong>' + escapeHtml(fmtTime(d.doc && d.doc.updatedAt)) + '</strong></div>'
      + '</div>'
      + (d.pendingDelete ? '<p>删除审批中，尚未删除</p>' : '')
      + (d.indexStale ? '<p>索引旧了 <button type="button" class="btn btn-inline" data-card-reindex="'
        + escapeHtml(userId) + '|' + escapeHtml(cardId) + '">重建这张卡的索引</button></p>' : '')
      + (meta.description ? '<p>' + escapeHtml(meta.description) + '</p>' : '')
      + '<p class="admin-muted">开场白 ' + (meta.greetingCount || 0) + ' 条'
      + (meta.greetingStart ? ' · ' + escapeHtml(meta.greetingStart) : '') + '</p>'
      + (mod
        ? '<p class="admin-muted">下架：' + escapeHtml(mod.reason || '') + ' · ' + escapeHtml(mod.by || '') + ' · ' + escapeHtml(fmtTime(mod.at)) + '</p>'
        : '')
      + '<h4>分享</h4>'
      + ((d.shares || []).length
        ? '<ul>' + d.shares.map(function(s) {
          return '<li class="admin-mono">' + escapeHtml(s.token) + ' · ' + (s.enabled && !s.expired ? '有效' : '已停') + '</li>';
        }).join('') + '</ul>'
        : '<p class="admin-muted">没有分享</p>')
      + (meta.charTags && meta.charTags.length
        ? '<p class="admin-muted" style="margin-top:8px">标签：' + meta.charTags.map(escapeHtml).join(' · ') + '</p>'
        : '')
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
    loadCards();
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
      + '&limit=200&offset=0');
    var novels = data.novels || [];
    if (!novels.length) {
      box.innerHTML = '<div class="admin-empty">无匹配小说</div>';
      return;
    }
    var canDisable = hasPerm('content.novel.disable');
    var canDelete = hasPerm('content.novel.delete');
    box.innerHTML = '<table class="admin-table"><thead><tr>'
      + '<th>标题</th><th>用户</th><th>cardId</th><th>novelId</th><th>章节</th><th>发布</th><th>状态</th><th></th>'
      + '</tr></thead><tbody>'
      + novels.map(function(n) {
        var removed = n.moderated && n.moderated.status === 'removed';
        var actions = '';
        if (canDisable) {
          actions += removed
            ? '<button type="button" class="btn btn-sm btn-ghost" data-novel-restore="'
              + escapeHtml(n.userId) + '|' + escapeHtml(n.cardId) + '|' + escapeHtml(n.novelId) + '">恢复</button>'
            : '<button type="button" class="btn btn-sm btn-ghost" data-novel-disable="'
              + escapeHtml(n.userId) + '|' + escapeHtml(n.cardId) + '|' + escapeHtml(n.novelId) + '">下架</button>';
        }
        if (canDelete) {
          actions += '<button type="button" class="btn btn-sm btn-delete" data-novel-del="'
            + escapeHtml(n.userId) + '|' + escapeHtml(n.cardId) + '|' + escapeHtml(n.novelId) + '">审批删除</button>';
        }
        return '<tr class="' + (removed ? 'is-disabled' : '') + '">'
          + '<td><strong>' + escapeHtml(n.title || '(未命名)') + '</strong></td>'
          + '<td class="admin-mono">' + escapeHtml(n.userId) + '</td>'
          + '<td class="admin-mono">' + escapeHtml(n.cardId) + '</td>'
          + '<td class="admin-mono">' + escapeHtml(n.novelId) + '</td>'
          + '<td>' + (n.chapterCount || 0) + '</td>'
          + '<td>' + (n.published ? '<span class="admin-pill admin-pill--ok">已发布</span>' : '—') + '</td>'
          + '<td>' + (removed ? '<span class="admin-pill admin-pill--warn">已下架</span>' : '<span class="admin-pill admin-pill--ok">正常</span>') + '</td>'
          + '<td class="admin-td-actions">' + actions + '</td></tr>';
      }).join('')
      + '</tbody></table>'
      + '<p class="admin-muted">' + novels.length + ' 条 · 全库检索（索引驱动）</p>';
  } catch (e) {
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
    }
    loadNovels();
  } catch (e) {
    setStatus(String(e.message || e));
  }
}

async function openUserProfile(userId) {
  var box = $('adminUserProfile');
  if (!box) return;
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
    var shareRows = (ov.shares || []).map(function(s) {
      return '<tr><td class="admin-mono">' + escapeHtml(s.token) + '</td>'
        + '<td>' + escapeHtml(s.type) + '</td>'
        + '<td>' + (s.enabled && !s.expired ? '有效' : (s.enabled ? '已过期' : '已停用')) + '</td></tr>';
    }).join('');
    var tokenRows = (ov.tokens || []).map(function(t) {
      return '<tr><td class="admin-mono">' + escapeHtml(t.id) + '</td><td>' + escapeHtml(fmtTime(t.expiresAt)) + '</td></tr>';
    }).join('');
    var storyRows = (ov.stories || []).map(function(n) {
      return '<tr><td>' + escapeHtml(n.title) + '</td><td class="admin-mono">' + escapeHtml(n.novelId) + '</td>'
        + '<td>' + (n.chapterCount || 0) + '</td>'
        + '<td>' + (n.moderated && n.moderated.status === 'removed' ? '已下架' : '正常') + '</td></tr>';
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
      + '<h4 class="admin-mt">卡</h4><table class="admin-table"><thead><tr><th>卡名</th><th>体积</th><th>状态</th></tr></thead><tbody>'
      + cards.map(function(c) {
        return '<tr><td><button type="button" class="btn btn-inline" data-open-card="'
          + escapeHtml(userId) + '|' + escapeHtml(c.id) + '">' + escapeHtml(c.charName || '(未命名)') + '</button></td>'
          + '<td>' + escapeHtml(fmtBytes(c.bundleBytes)) + '</td>'
          + '<td>' + (c.moderated && c.moderated.status === 'removed' ? '已下架' : '正常') + '</td></tr>';
      }).join('') + '</tbody></table>'
      + '<h4 class="admin-mt">分享</h4><table class="admin-table"><thead><tr><th>token</th><th>类型</th><th>状态</th></tr></thead><tbody>'
      + (shareRows || '<tr><td colspan="3" class="admin-empty">无</td></tr>') + '</tbody></table>'
      + '<h4 class="admin-mt">有效 Token</h4><table class="admin-table"><thead><tr><th>id</th><th>过期</th></tr></thead><tbody>'
      + (tokenRows || '<tr><td colspan="2" class="admin-empty">无</td></tr>') + '</tbody></table>'
      + '<h4 class="admin-mt">Story 小说</h4><table class="admin-table"><thead><tr><th>标题</th><th>novelId</th><th>章节</th><th>状态</th></tr></thead><tbody>'
      + (storyRows || '<tr><td colspan="4" class="admin-empty">无</td></tr>') + '</tbody></table>'
      + '</div>';
    var selTier = $('adminUserTier');
    if (selTier) selTier.value = tier;
  } catch (e) {
    box.innerHTML = '<div class="admin-empty">' + escapeHtml(e.message || e) + '</div>';
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', async function(e) {
    var t = e.target.closest('[data-card-detail],[data-card-disable],[data-card-restore],[data-card-del],[data-card-export],[data-card-reindex],[data-novel-disable],[data-novel-restore],[data-novel-del],[data-user-profile]');
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
      showView('users');
      openUserProfile(t.getAttribute('data-user-profile'));
    }
    if (t.hasAttribute('data-open-card')) {
      showView('cards');
      openCardDetail(t.getAttribute('data-open-card'));
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
    var t = e.target.closest('#btnAdminCardDetailClose,#btnAdminProfileClose');
    if (!t) return;
    var target = t.id === 'btnAdminCardDetailClose' ? $('adminCardDetail') : $('adminUserProfile');
    if (target) target.innerHTML = '';
    if (t.id === 'btnAdminProfileClose') {
      var table = $('adminUserTable');
      if (table) table.hidden = false;
    }
    if (t.id === 'btnAdminCardDetailClose') {
      var cards = $('adminCardTable');
      if (cards) cards.hidden = false;
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
    box.innerHTML = '<table class="admin-table"><thead><tr><th>时间</th><th>操作者</th><th>方法</th><th>动作</th><th>状态</th><th>IP</th></tr></thead><tbody>'
      + logs.map(function(l) {
        return '<tr><td>' + escapeHtml(fmtTime(l.at)) + '</td>'
          + '<td class="admin-mono">' + escapeHtml(l.who || '—') + '</td>'
          + '<td>' + escapeHtml(l.method || '') + '</td>'
          + '<td><code>' + escapeHtml(l.action || '') + '</code></td>'
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
    var logs = data.logs || [];
    if (!logs.length) { box.innerHTML = '<div class="admin-empty">无日志</div>'; return; }
    box.innerHTML = '<table class="admin-table"><thead><tr><th>时间</th><th>用户</th><th>方式</th><th>结果</th><th>原因</th><th>IP</th></tr></thead><tbody>'
      + logs.map(function(l) {
        return '<tr><td>' + escapeHtml(fmtTime(l.at)) + '</td>'
          + '<td class="admin-mono">' + escapeHtml(l.who || '—') + '</td>'
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
    var dicts = data.dicts || [];
    box.innerHTML = (canEdit
      ? '<div class="admin-toolbar"><input id="adminNewDictType" placeholder="新字典 type" style="max-width:180px" />'
        + '<button type="button" class="btn btn-sm btn-primary" id="btnAdminNewDict">新建字典</button></div>'
      : '')
      + '<table class="admin-table"><thead><tr><th>type</th><th>label</th><th>项数</th><th>操作</th></tr></thead><tbody>'
      + (dicts.length ? dicts.map(function(d) {
        var actions = canEdit
          ? ('<button type="button" class="btn btn-sm btn-ghost" data-dict-edit="' + escapeHtml(d.dictType) + '">编辑</button>'
            + '<button type="button" class="btn btn-sm btn-delete" data-dict-del="' + escapeHtml(d.dictType) + '">删除</button>')
          : '';
        return '<tr><td class="admin-mono">' + escapeHtml(d.dictType) + '</td>'
          + '<td>' + escapeHtml(d.label) + '</td>'
          + '<td>' + (d.items || []).length + '</td>'
          + '<td class="admin-td-actions">' + actions + '</td></tr>';
      }).join('') : '<tr><td colspan="4" class="admin-empty">无字典</td></tr>')
      + '</tbody></table>'
      + '<div id="adminDictEditor" class="admin-editor" hidden>'
      + '<div class="admin-panel-head"><h3 id="adminDictEditorTitle">编辑字典</h3></div>'
      + '<div class="admin-toolbar"><input id="adminDictLabel" placeholder="label" style="max-width:180px" /></div>'
      + '<textarea id="adminDictItems" rows="8" placeholder="每行一项：value,label"></textarea>'
      + '<div class="admin-toolbar"><button type="button" class="btn btn-sm btn-primary" id="btnAdminDictSave">保存</button>'
      + '<button type="button" class="btn btn-sm btn-ghost" id="btnAdminDictCancel">取消</button></div></div>';
  } catch (e) {
    box.innerHTML = '<div class="admin-empty">' + escapeHtml(e.message || e) + '</div>';
  }
}

async function loadInvites() {
  var box = $('adminInviteTable');
  if (!box) return;
  var canManage = hasPerm('sys.invite.manage');
  try {
    var data = await api('/api/admin/invites');
    var invites = data.invites || [];
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
          + '<td class="admin-mono">' + escapeHtml(inv.usedBy || '—') + '</td>'
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
    var data = await api('/api/admin/quota/users');
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
      }).join('') : '<tr><td colspan="7" class="ui-empty-tip">无用户</td></tr>')
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
    var files = data.files || [];
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
      }).join('') : '<tr><td colspan="5" class="admin-empty">无文件</td></tr>')
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
      if (!window.confirm('删除该字典？')) return;
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
      if (!window.confirm('删除该文件？')) return;
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
  var editor = $('adminDictEditor');
  if (!editor) return;
  editor.hidden = false;
  state.activeDictType = dict.dictType;
  var title = $('adminDictEditorTitle');
  if (title) title.textContent = '编辑字典 · ' + (dict.dictType || '(新)');
  var label = $('adminDictLabel');
  if (label) label.value = dict.label || '';
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
  var label = ($('adminDictLabel') || {}).value || type;
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
  try {
    var r = await api('/api/admin/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: note, count: count }),
    });
    setStatus('已生成 ' + (r.codes || []).join(' '));
    loadInvites();
  } catch (e) { setStatus(String(e.message || e)); }
}

async function uploadFileFromForm() {
  var fileInput = $('adminFileData');
  var file = fileInput && fileInput.files && fileInput.files[0];
  if (!file) { setStatus('请选择文件'); return; }
  var name = ($('adminFileName') || {}).value || file.name;
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
    box.innerHTML = '<div class="ui-empty-tip">' + escapeHtml(e.message || e) + '</div>';
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
      + '<table class="admin-table"><thead><tr><th>时间</th><th>结果</th><th>目录</th></tr></thead><tbody>'
      + (backups.length ? backups.map(function(b) {
        return '<tr><td>' + escapeHtml(fmtTime(b.at)) + '</td><td>' + escapeHtml(b.status || '') + '</td><td class="admin-mono">'
          + escapeHtml(b.outDir || b.log || '') + '</td></tr>';
      }).join('') : '<tr><td colspan="3" class="ui-empty-tip">还没有备份</td></tr>')
      + '</tbody></table>';
  } catch (e) {
    box.innerHTML = '<div class="ui-empty-tip">' + escapeHtml(e.message || e) + '</div>';
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

export { showView, loadDashboard, loadUsers, loadShares, loadTokens, loadDatabases, loadAudit, loadSystem, loadRoles, loadMenus, renderAdminNav, loadCards, loadNovels, loadOpLog, loadLoginLog, loadParams, loadDicts, loadInvites, loadQuota, loadFiles, loadTasks, loadBackup, openUserProfile };
