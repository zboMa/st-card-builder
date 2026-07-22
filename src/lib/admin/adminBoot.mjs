/**
 * 管理端：登录门禁 / 事件 / boot（拆自 browserApp）
 */
import { apiFetch, getPublicAppUrl, discordLoginUrl } from '../publicConfig.mjs';
import {
  state, api, $, escapeHtml, setBanner, setStatus, isOps, apiEmailLogin,
} from './adminShared.mjs';
import { showView } from './adminViews.mjs';

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

export async function bootAdminApp() {
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

