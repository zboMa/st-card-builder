/**
 * 管理端：视图切换与数据加载（拆自 browserApp）
 */
import {
  state, api, $, escapeHtml, fmtBytes, fmtTime, setBanner, setStatus, isOps,
} from './adminShared.mjs';

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


export { showView, loadDashboard, loadUsers, loadShares, loadTokens, loadDatabases, loadAudit, loadSystem };
