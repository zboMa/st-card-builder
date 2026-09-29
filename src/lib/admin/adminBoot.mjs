/**
 * 管理端：登录门禁 / 事件 / boot（拆自 browserApp）
 */
import { apiFetch, getPublicAppUrl, discordLoginUrl } from '../publicConfig.mjs';
import {
  state, api, $, escapeHtml, setBanner, setStatus, isOps, hasPerm, apiEmailLogin, askReason,
} from './adminShared.mjs';
import { showView, renderAdminNav, loadUsers, loadShares, loadTokens, loadDatabases, loadAudit, loadCards, loadNovels, loadOpLog, loadLoginLog, loadParams, loadDicts, loadInvites, loadQuota, loadFiles, openUserProfile } from './adminViews.mjs';
import { bootAdminActionEngine } from '../actionEngine/bootAdmin.mjs';
import { engineBegin, engineEnd, engineTryAllowed, engineRefresh } from '../actionEngine/helpers.mjs';

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
  state.perms = Array.isArray(st.perms) ? st.perms : [];
  if (line) {
    line.textContent = (st.user.displayName || st.user.username)
      + ' · ' + (state.role === 'readonly' ? '只读管理员' : '运维管理员');
  }
  document.body.classList.toggle('admin-readonly', state.role === 'readonly');
  renderAdminNav();
  engineRefresh();
  showView('dashboard');
}

function bindEvents() {
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-admin-nav]');
    if (btn) showView(btn.getAttribute('data-admin-nav'));
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
  $('btnAdminLoadCards') && $('btnAdminLoadCards').addEventListener('click', function() {
    loadCards();
  });
  $('btnAdminLoadNovels') && $('btnAdminLoadNovels').addEventListener('click', function() {
    loadNovels();
  });
  $('btnAdminLoadOpLog') && $('btnAdminLoadOpLog').addEventListener('click', loadOpLog);
  $('btnAdminLoadLoginLog') && $('btnAdminLoadLoginLog').addEventListener('click', loadLoginLog);
  $('btnAdminLoadParams') && $('btnAdminLoadParams').addEventListener('click', loadParams);
  $('btnAdminLoadDicts') && $('btnAdminLoadDicts').addEventListener('click', loadDicts);
  $('btnAdminLoadInvites') && $('btnAdminLoadInvites').addEventListener('click', loadInvites);
  $('btnAdminLoadQuota') && $('btnAdminLoadQuota').addEventListener('click', loadQuota);
  $('btnAdminLoadFiles') && $('btnAdminLoadFiles').addEventListener('click', loadFiles);
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
    if (!engineTryAllowed('admin.token.purge').ok) return;
    var preview = await api('/api/admin/tokens?status=expired&limit=1');
    setStatus('将清理 ' + (preview.total || 0) + ' 条过期 Token');
    engineBegin('admin.token.purge');
    try {
      var r = await api('/api/admin/tokens/purge-expired', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      setStatus('已清掉 ' + r.purged + ' 条');
      loadTokens();
    } catch (e) {
      setStatus(String(e.message || e));
    } finally {
      engineEnd('admin.token.purge');
    }
  });
  $('btnAdminBackup') && $('btnAdminBackup').addEventListener('click', async function() {
    if (!isOps()) return;
    if (!engineTryAllowed('admin.backup.run').ok) return;
    engineBegin('admin.backup.run');
    setStatus('备份进行中…');
    try {
      var r = await api('/api/admin/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      setStatus('备份完成：' + r.outDir);
    } catch (e) {
      setStatus('备份失败：' + (e.message || e));
    } finally {
      engineEnd('admin.backup.run');
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

    if (!hasPerm('admin.user.disable') && !hasPerm('admin.share.toggle') && !hasPerm('admin.share.delete') && !hasPerm('admin.token.revoke')) return;

    var uid = t.getAttribute('data-user-toggle');
    if (uid) {
      if (!hasPerm('admin.user.disable')) return;
      if (!engineTryAllowed('admin.user.disable').ok) return;
      var disabled = t.getAttribute('data-disabled') === '1';
      var reason = '';
      if (disabled) {
        reason = await askReason('禁用这个用户。下一次登录和同步会被拒绝，已经打开的页面要到下一次请求才失败。');
        if (!reason) return;
      }
      try {
        await api('/api/admin/users/' + encodeURIComponent(uid) + '/disable', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ disabled: disabled, reason: reason }),
        });
        setStatus(disabled ? '已禁用，Token 已撤销' : '已启用');
        loadUsers();
        var profile = $('adminUserProfile');
        if (profile && profile.innerHTML) openUserProfile(uid);
      } catch (err) {
        setStatus(String(err.message || err));
      }
      return;
    }

    var soft = t.getAttribute('data-share-soft');
    if (soft) {
      if (!engineTryAllowed('admin.share.toggle').ok) return;
      var on = t.getAttribute('data-on') === '1';
      var stopReason = '';
      if (!on) {
        stopReason = await askReason('停用这条分享');
        if (!stopReason) return;
      }
      try {
        await api('/api/admin/shares/' + encodeURIComponent(soft) + '/enabled', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: on, reason: stopReason }),
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
      if (!engineTryAllowed('admin.share.delete').ok) return;
      var delReason = await askReason('删除这条分享映射。卡和小说还在，链接不能恢复。');
      if (!delReason) return;
      try {
        await api('/api/admin/shares/' + encodeURIComponent(del), {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: delReason }),
        });
        setStatus('已删除分享');
        loadShares();
      } catch (err) {
        setStatus(String(err.message || err));
      }
      return;
    }

    var tok = t.getAttribute('data-token-revoke');
    if (tok) {
      if (!engineTryAllowed('admin.token.revoke').ok) return;
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
  var engine = bootAdminActionEngine({
    isOps: function() { return isOps(); },
    backupEnabled: function() { return !!(state.overview && state.overview.flags && state.overview.flags.backupEnabled); },
  });
  bindEvents();
  engineRefresh();
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
    try {
      var me = await api('/api/admin/me');
      st.perms = Array.isArray(me && me.perms) ? me.perms : [];
    } catch (eMe) {
      st.perms = [];
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

