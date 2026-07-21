/**
 * 管理端客户端：仪表盘 / 用户 / 分享 / Token / Couch / 审计 / 系统
 */
import {
  apiFetch,
  apiUrl,
  discordLoginUrl,
  getPublicAppUrl,
} from '../publicConfig.mjs';

async function apiEmailLogin(payload) {
  var res = await apiFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: payload && payload.email,
      password: payload && payload.password,
    }),
  });
  var body = await res.json().catch(function() { return {}; });
  if (!res.ok) throw new Error(body.message || body.error || 'login_failed');
  return body;
}

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtBytes(n) {
  var v = Number(n) || 0;
  if (v < 1024) return v + ' B';
  if (v < 1024 * 1024) return (v / 1024).toFixed(1) + ' KB';
  if (v < 1024 * 1024 * 1024) return (v / (1024 * 1024)).toFixed(1) + ' MB';
  return (v / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function fmtTime(s) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString('zh-CN', { hour12: false });
  } catch (e) {
    return String(s);
  }
}

var state = {
  role: null,
  user: null,
  view: 'dashboard',
  usersOffset: 0,
  sharesOffset: 0,
  tokensOffset: 0,
  auditOffset: 0,
  pageSize: 30,
};

async function api(path, opts) {
  var res = await apiFetch(path, opts || {});
  var ct = res.headers.get('content-type') || '';
  var data = ct.indexOf('json') >= 0
    ? await res.json().catch(function() { return {}; })
    : await res.text();
  if (!res.ok) {
    var msg = (data && data.message) || (data && data.error) || ('HTTP ' + res.status);
    var err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function setBanner(msg, kind) {
  var el = $('adminBanner');
  if (!el) return;
  if (!msg) {
    el.hidden = true;
    el.textContent = '';
    el.className = 'admin-banner';
    return;
  }
  el.hidden = false;
  el.textContent = msg;
  el.className = 'admin-banner' + (kind ? ' admin-banner--' + kind : '');
}

function setStatus(msg) {
  var el = $('adminStatus');
  if (el) el.textContent = msg || '';
}

function isOps() {
  return state.role === 'ops';
}

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
  if (name === 'shares') loadShares();
  if (name === 'tokens') loadTokens();
  if (name === 'databases') loadDatabases();
  if (name === 'audit') loadAudit();
  if (name === 'system') loadSystem();
}

async function loadDashboard() {
  var grid = $('adminDashGrid');
  var flags = $('adminDashFlags');
  try {
    var data = await api('/api/admin/overview');
    var c = data.counts || {};
    var couchOk = data.couch && data.couch.ok;
    if (grid) {
      grid.innerHTML = [
        card('API', '正常', 'ok'),
        card('CouchDB', couchOk ? ('正常 · ' + (data.couch.version || '')) : '异常', couchOk ? 'ok' : 'bad'),
        card('注册用户', String(c.registryUsers || 0)),
        card('已禁用', String(c.disabledUsers || 0), c.disabledUsers ? 'warn' : ''),
        card('活跃分享', String(c.activeShares || 0) + ' / ' + String(c.shareMappings || 0)),
        card('卡分享', String(c.cardShares || 0)),
        card('小说分享', String(c.novelShares || 0)),
        card('用户库', String(c.userDatabases || 0)),
        card('插件 Token', String(c.activeBearerTokens || 0) + ' 有效'),
        card('孤儿库', c.orphanUserDbs == null ? '—' : String(c.orphanUserDbs), c.orphanUserDbs ? 'warn' : 'ok'),
      ].join('');
    }
    var f = data.flags || {};
    if (flags) {
      flags.innerHTML = [
        flag('DEV_LOGIN', f.devLoginEnabled),
        flag('Discord 门禁', f.enforceMembership),
        flag('Cookie Secure', f.cookieSecure),
        flag('备份开关', f.backupEnabled),
        '<div class="admin-flag"><span>运维管理员</span><strong>' + escapeHtml(f.adminIdsConfigured) + '</strong></div>',
        '<div class="admin-flag"><span>只读管理员</span><strong>' + escapeHtml(f.readonlyAdminIdsConfigured) + '</strong></div>',
        '<div class="admin-flag admin-flag--wide"><span>PUBLIC_APP_URL</span><strong>' + escapeHtml(f.publicAppUrl || '—') + '</strong></div>',
        '<div class="admin-flag admin-flag--wide"><span>PUBLIC_API_URL</span><strong>' + escapeHtml(f.publicApiUrl || '—') + '</strong></div>',
      ].join('');
    }
    setBanner('');
  } catch (e) {
    if (grid) grid.innerHTML = '';
    setBanner(bannerForError(e), e.status === 502 || e.status >= 500 ? 'err' : 'warn');
  }
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
    box.innerHTML = '<table class="admin-table"><thead><tr>'
      + '<th>用户</th><th>身份</th><th>Token</th><th>状态</th><th>更新</th><th></th>'
      + '</tr></thead><tbody>'
      + users.map(function(u) {
        var badges = '';
        if (u.isOpsAdmin) badges += '<span class="admin-badge">运维</span>';
        if (u.isReadonlyAdmin) badges += '<span class="admin-badge admin-badge--muted">只读</span>';
        var disabled = !!u.disabled;
        var actions = isOps()
          ? ('<button type="button" class="btn btn-sm btn-ghost" data-user-toggle="'
            + escapeHtml(u.userId) + '" data-disabled="' + (disabled ? '0' : '1') + '">'
            + (disabled ? '启用' : '禁用') + '</button>')
          : '<span class="admin-muted">只读</span>';
        var identity = u.email
          ? escapeHtml(u.email)
          : (u.discordId ? ('Discord ' + escapeHtml(u.discordId)) : '—');
        var provider = escapeHtml(u.provider || '—');
        return '<tr class="' + (disabled ? 'is-disabled' : '') + '">'
          + '<td><strong>' + escapeHtml(u.displayName || u.username || u.userId) + '</strong>'
          + badges
          + '<div class="admin-muted">' + escapeHtml(u.userId) + '</div></td>'
          + '<td><div>' + identity + '</div><div class="admin-muted">' + provider + '</div></td>'
          + '<td>' + escapeHtml(u.bearerCount || 0) + '</td>'
          + '<td>' + (disabled ? '<span class="admin-pill admin-pill--warn">已禁用</span>' : '<span class="admin-pill admin-pill--ok">正常</span>') + '</td>'
          + '<td>' + escapeHtml(fmtTime(u.updatedAt || u.createdAt)) + '</td>'
          + '<td class="admin-td-actions">' + actions + '</td></tr>';
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
    box.innerHTML = '<div class="admin-pre-wrap">'
      + '<h3>Health</h3><pre class="admin-pre">' + escapeHtml(JSON.stringify(health, null, 2)) + '</pre>'
      + '<h3>Overview flags</h3><pre class="admin-pre">' + escapeHtml(JSON.stringify(overview.flags || {}, null, 2)) + '</pre>'
      + '<p class="admin-muted">备份：需在服务器 .env 设置 ADMIN_BACKUP_ENABLED=true。逻辑备份写入 ADMIN_BACKUP_DIR 或 server/backups/。</p>'
      + '</div>';
    var btn = $('btnAdminBackup');
    if (btn) btn.disabled = !isOps() || !(overview.flags && overview.flags.backupEnabled);
  } catch (e) {
    box.innerHTML = '<div class="admin-empty">' + escapeHtml(bannerForError(e)) + '</div>';
  }
}

async function doLogoutAndReload() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch (e) { /* ignore */ }
  location.reload();
}

function setAppBackLinks(url) {
  var href = String(url || getPublicAppUrl() || '/').replace(/\/$/, '') + '/';
  var a = $('btnAdminBackApp');
  var b = $('btnAdminBackAppTop');
  if (a) a.href = href;
  if (b) b.href = href;
}

function showLoginGate(opts) {
  opts = opts || {};
  var gate = $('adminLoginGate');
  var workspace = $('adminWorkspace');
  var tip = $('adminGateTip');
  var discordBtn = $('btnAdminDiscordLogin');
  var emailBox = $('adminEmailAuthBox');
  var extra = $('adminLoginExtra');
  document.body.classList.add('admin-locked');
  if (workspace) workspace.hidden = true;
  if (gate) {
    gate.hidden = false;
    requestAnimationFrame(function() {
      gate.classList.add('is-ready');
    });
  }
  if (tip) {
    tip.textContent = opts.tip || '';
    tip.classList.toggle('is-err', !!opts.err);
  }
  if (emailBox) {
    emailBox.hidden = !opts.emailAuthEnabled || !!opts.hideAuthForms;
  }
  if (discordBtn) {
    var showDiscord = !!opts.discordLoginEnabled && !opts.hideAuthForms;
    discordBtn.hidden = !showDiscord;
    if (showDiscord) {
      discordBtn.href = discordLoginUrl(location.href);
      var ok = opts.discordOk !== false;
      discordBtn.classList.toggle('is-disabled', !ok);
      discordBtn.setAttribute('aria-disabled', ok ? 'false' : 'true');
    }
  }
  if (extra) {
    // 显式 hidden：避免父级 display:flex 盖过 [hidden]
    var showOut = !!opts.showLogout;
    extra.hidden = !showOut;
    extra.style.display = showOut ? 'flex' : 'none';
  }
}

function showAdminWorkspace(st) {
  var gate = $('adminLoginGate');
  var workspace = $('adminWorkspace');
  var line = $('adminUserLine');
  document.body.classList.remove('admin-locked');
  if (gate) {
    gate.classList.remove('is-ready');
    gate.hidden = true;
  }
  if (workspace) workspace.hidden = false;
  state.user = st.user;
  state.role = st.adminRole || 'ops';
  if (line) {
    line.textContent = (st.user.displayName || st.user.username)
      + ' · ' + (state.role === 'readonly' ? '只读管理员' : '运维管理员');
  }
  document.body.classList.toggle('admin-readonly', state.role === 'readonly');
  showView('dashboard');
}

function bindEvents() {
  document.querySelectorAll('[data-admin-nav]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      showView(btn.getAttribute('data-admin-nav'));
    });
  });

  var btnLogout = $('btnAdminLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', function() { doLogoutAndReload(); });
  }
  var btnGateLogout = $('btnAdminGateLogout');
  if (btnGateLogout) {
    btnGateLogout.addEventListener('click', function() { doLogoutAndReload(); });
  }

  var formEmail = $('formAdminEmailLogin');
  if (formEmail) {
    formEmail.addEventListener('submit', async function(e) {
      e.preventDefault();
      var tip = $('adminGateTip');
      var email = ($('adminEmailLoginEmail') || {}).value || '';
      var password = ($('adminEmailLoginPassword') || {}).value || '';
      try {
        if (tip) {
          tip.textContent = '登录中…';
          tip.classList.remove('is-err');
        }
        await apiEmailLogin({ email: email, password: password });
        location.reload();
      } catch (err) {
        if (tip) {
          tip.textContent = String(err && err.message || err);
          tip.classList.add('is-err');
        }
      }
    });
  }

  $('btnAdminLoadUsers') && $('btnAdminLoadUsers').addEventListener('click', function() {
    state.usersOffset = 0;
    loadUsers();
  });
  $('btnAdminLoadShares') && $('btnAdminLoadShares').addEventListener('click', function() {
    state.sharesOffset = 0;
    loadShares();
  });
  $('btnAdminLoadTokens') && $('btnAdminLoadTokens').addEventListener('click', function() {
    state.tokensOffset = 0;
    loadTokens();
  });
  $('btnAdminLoadDbs') && $('btnAdminLoadDbs').addEventListener('click', loadDatabases);
  $('btnAdminLoadAudit') && $('btnAdminLoadAudit').addEventListener('click', function() {
    state.auditOffset = 0;
    loadAudit();
  });
  $('btnAdminExportAudit') && $('btnAdminExportAudit').addEventListener('click', function() {
    window.open(apiUrl('/api/admin/audit/export'), '_blank');
  });
  $('btnAdminPurgeTokens') && $('btnAdminPurgeTokens').addEventListener('click', async function() {
    if (!isOps()) return;
    if (!window.confirm('清理所有过期插件 Token？')) return;
    try {
      var r = await api('/api/admin/tokens/purge-expired', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      setStatus('已清理 ' + r.purged + ' 个过期 Token');
      loadTokens();
    } catch (e) {
      setStatus(String(e.message || e));
    }
  });
  $('btnAdminBackup') && $('btnAdminBackup').addEventListener('click', async function() {
    if (!isOps()) return;
    if (!window.confirm('确认在服务器执行逻辑备份？可能耗时较长。')) return;
    setStatus('备份进行中…');
    try {
      var r = await api('/api/admin/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      setStatus('备份完成：' + r.outDir);
    } catch (e) {
      setStatus('备份失败：' + (e.message || e));
    }
  });

  document.addEventListener('click', async function(e) {
    var t = e.target.closest('[data-user-toggle],[data-share-soft],[data-share-del],[data-token-revoke],[data-pager]');
    if (!t) return;

    var pager = t.getAttribute('data-pager');
    if (pager) {
      var size = state.pageSize;
      if (pager === 'users-prev') state.usersOffset = Math.max(0, state.usersOffset - size);
      if (pager === 'users-next') state.usersOffset += size;
      if (pager === 'shares-prev') state.sharesOffset = Math.max(0, state.sharesOffset - size);
      if (pager === 'shares-next') state.sharesOffset += size;
      if (pager === 'tokens-prev') state.tokensOffset = Math.max(0, state.tokensOffset - size);
      if (pager === 'tokens-next') state.tokensOffset += size;
      if (pager === 'audit-prev') state.auditOffset = Math.max(0, state.auditOffset - size);
      if (pager === 'audit-next') state.auditOffset += size;
      if (pager.indexOf('users') === 0) loadUsers();
      if (pager.indexOf('shares') === 0) loadShares();
      if (pager.indexOf('tokens') === 0) loadTokens();
      if (pager.indexOf('audit') === 0) loadAudit();
      return;
    }

    if (!isOps()) return;

    var uid = t.getAttribute('data-user-toggle');
    if (uid) {
      var disabled = t.getAttribute('data-disabled') === '1';
      try {
        await api('/api/admin/users/' + encodeURIComponent(uid) + '/disable', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ disabled: disabled }),
        });
        setStatus((disabled ? '已禁用 ' : '已启用 ') + uid);
        loadUsers();
      } catch (err) {
        setStatus(String(err.message || err));
      }
      return;
    }

    var soft = t.getAttribute('data-share-soft');
    if (soft) {
      var on = t.getAttribute('data-on') === '1';
      try {
        await api('/api/admin/shares/' + encodeURIComponent(soft) + '/enabled', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: on }),
        });
        setStatus(on ? '已恢复分享' : '已软停用分享');
        loadShares();
      } catch (err) {
        setStatus(String(err.message || err));
      }
      return;
    }

    var del = t.getAttribute('data-share-del');
    if (del) {
      if (!window.confirm('硬删除分享映射？此操作不可恢复。')) return;
      try {
        await api('/api/admin/shares/' + encodeURIComponent(del), { method: 'DELETE' });
        setStatus('已删除分享');
        loadShares();
      } catch (err) {
        setStatus(String(err.message || err));
      }
      return;
    }

    var tok = t.getAttribute('data-token-revoke');
    if (tok) {
      if (!window.confirm('吊销该插件 Token？')) return;
      try {
        await api('/api/admin/tokens/' + encodeURIComponent(tok), { method: 'DELETE' });
        setStatus('已吊销 Token');
        loadTokens();
      } catch (err) {
        setStatus(String(err.message || err));
      }
    }
  });
}

async function boot() {
  bindEvents();
  setAppBackLinks(getPublicAppUrl() || '/');
  showLoginGate({ tip: '正在校验登录状态…', discordOk: true });
  try {
    var st = await api('/api/auth/status');
    if (st.publicAppUrl) setAppBackLinks(st.publicAppUrl);
    var discordOk = !!(st.discordConfigured && st.canAcceptDiscordRegistration !== false);
    var emailAuthEnabled = !!st.emailAuthEnabled;
    var discordLoginEnabled = !!st.discordLoginEnabled;
    if (!st.user) {
      var tip = '';
      var err = false;
      if (!emailAuthEnabled && !discordLoginEnabled) {
        tip = '登录暂不可用，请稍后重试。';
        err = true;
      } else if (discordLoginEnabled && !discordOk && !emailAuthEnabled) {
        tip = '登录暂不可用，请稍后重试。';
        err = true;
      }
      showLoginGate({
        tip: tip,
        err: err,
        discordOk: discordOk,
        emailAuthEnabled: emailAuthEnabled,
        discordLoginEnabled: discordLoginEnabled,
        showLogout: false,
      });
      return;
    }
    if (!st.isAdmin) {
      showLoginGate({
        tip: '当前账号没有管理权限，请更换账号后重试。',
        err: true,
        hideAuthForms: true,
        discordOk: discordOk,
        emailAuthEnabled: emailAuthEnabled,
        discordLoginEnabled: discordLoginEnabled,
        showLogout: true,
      });
      return;
    }
    showAdminWorkspace(st);
  } catch (e) {
    showLoginGate({
      tip: '暂时无法连接服务，请稍后重试。',
      err: true,
      discordOk: true,
      emailAuthEnabled: false,
      discordLoginEnabled: false,
      showLogout: false,
    });
  }
}

boot();
