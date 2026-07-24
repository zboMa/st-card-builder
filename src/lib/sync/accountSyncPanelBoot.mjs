/**
 * 账户/云同步面板 boot（从 AccountSyncPanel.astro 外提）
 */
import {
    fetchAuthStatus,
    runSync,
    startAutoSync,
    stopAutoSync,
    applyAutoSyncPref,
    setAutoSyncPref,
    onSyncEvent,
    getSyncStatus,
    getMsUntilNextSync,
    formatSyncCountdown,
    friendlySyncError,
    setCloudEnabled,
  } from './index.mjs';
  import {
    apiDevLogin,
    apiLogout,
    apiEmailLogin,
    apiEmailRegister,
    discordLoginUrlForCurrentPage,
  } from './authClient.mjs';
  import {
    uploadAiSecretsToCloud,
    downloadAiSecretsFromCloud,
    clearCloudAiSecrets,
  } from './secrets.mjs';
  import {
    setUserPrefsSyncEnabled,
    scheduleUserPrefsCloudPush,
    pullUserPrefsFromCloud,
    pushUserPrefsToCloudNow,
  } from './userPrefsMirror.mjs';
  import { buildSyncCenterSnapshot } from './syncCenter.mjs';
  import { fetchCloudQuota, quotaUsageHtml, invalidateQuotaCache } from './quotaClient.mjs';
  import { fetchCloudExport, fetchAuthTokens, revokeAuthToken } from './cloudApi.mjs';
  import { getDraftsMapSync } from '../draftsStore.mjs';

export function initAccountSyncPanel() {
  window.__scheduleUserPrefsCloudPush__ = scheduleUserPrefsCloudPush;

  var panelCountdownTimer = null;

  function setAuthTab(mode) {
    var loginForm = document.getElementById('formEmailLogin');
    var regForm = document.getElementById('formEmailRegister');
    var tabLogin = document.getElementById('tabAuthLogin');
    var tabReg = document.getElementById('tabAuthRegister');
    var isLogin = mode !== 'register';
    if (loginForm) loginForm.hidden = !isLogin;
    if (regForm) regForm.hidden = isLogin;
    if (tabLogin) tabLogin.classList.toggle('is-active', isLogin);
    if (tabReg) tabReg.classList.toggle('is-active', !isLogin);
  }

  function setDiscordCta(st) {
    var discordBtn = document.getElementById('btnDiscordLogin');
    if (!discordBtn) return;
    var show = !!(st && st.discordLoginEnabled);
    discordBtn.hidden = !show;
    if (!show) return;
    discordBtn.href = discordLoginUrlForCurrentPage();
    var ok = !!(st.discordConfigured && st.canAcceptDiscordRegistration);
    discordBtn.classList.toggle('is-disabled', !ok);
    discordBtn.setAttribute('aria-disabled', ok ? 'false' : 'true');
    if (!ok) {
      discordBtn.setAttribute('title', '登录暂不可用，请稍后重试或联系管理员');
    } else {
      discordBtn.removeAttribute('title');
    }
  }

  function setEmailAuthUi(st) {
    var box = document.getElementById('emailAuthBox');
    var tabReg = document.getElementById('tabAuthRegister');
    var enabled = !!(st && st.emailAuthEnabled);
    if (box) box.hidden = !enabled;
    if (!enabled) return;
    var regOpen = !!st.emailRegistrationOpen;
    if (tabReg) {
      tabReg.hidden = !regOpen;
      tabReg.disabled = !regOpen;
    }
    if (!regOpen) setAuthTab('login');
  }

  function setSidebarAuth(loggedIn) {
    document.body.classList.toggle('is-account-logged-in', !!loggedIn);
    if (typeof window.__refreshSidebarSyncEta__ === 'function') {
      try { window.__refreshSidebarSyncEta__(); } catch (e) { /* ignore */ }
    }
  }

  function showLoggedOut(st, tipText, tipErr) {
    var gate = document.getElementById('accountLoginGate');
    var body = document.getElementById('accountSessionBody');
    var tip = document.getElementById('authStatusTip');
    var devBox = document.getElementById('devLoginBox');
    if (body) body.hidden = true;
    if (gate) {
      gate.hidden = false;
      requestAnimationFrame(function() {
        gate.classList.add('is-ready');
      });
    }
    if (devBox) devBox.style.display = st && st.devLoginEnabled ? 'block' : 'none';
    setEmailAuthUi(st || {});
    setDiscordCta(st || {});
    if (tip) {
      tip.textContent = tipText || '';
      tip.classList.toggle('is-err', !!tipErr);
    }
    stopAutoSync();
    stopPanelCountdown();
    syncAutoSyncToggle(false);
    setUserPrefsSyncEnabled(false);
    setCloudEnabled(false);
    setSidebarAuth(false);
  }

  function showLoggedIn(st) {
    var gate = document.getElementById('accountLoginGate');
    var body = document.getElementById('accountSessionBody');
    var line = document.getElementById('authUserLine');
    var meta = document.getElementById('authUserMeta');
    if (gate) {
      gate.classList.remove('is-ready');
      gate.hidden = true;
    }
    if (body) body.hidden = false;
    if (line) {
      if (st.disabled) line.textContent = '账号已被禁用同步';
      else line.textContent = st.user.displayName || st.user.username || st.user.email || '已登录';
    }
    if (meta) {
      if (st.disabled) meta.textContent = '';
      else {
        var bits = [];
        if (st.user.email) bits.push(st.user.email);
        if (st.user.provider) bits.push(st.user.provider === 'email' ? '邮箱登录' : st.user.provider);
        meta.textContent = bits.join(' · ');
      }
    }
    if (!st.disabled) {
      setCloudEnabled(true);
      setUserPrefsSyncEnabled(true);
      pullUserPrefsFromCloud().then(function() {
        var tip = document.getElementById('userPrefsSyncTip');
        if (tip) {
          tip.textContent = '用户配置已与云端对齐；本地修改将自动上传';
          tip.classList.remove('is-err');
        }
        pushUserPrefsToCloudNow().catch(function() {});
      }).catch(function(e) {
        var tip = document.getElementById('userPrefsSyncTip');
        if (tip) {
          tip.textContent = '用户配置拉取失败：' + String(e && e.message || e);
          tip.classList.add('is-err');
        }
      });
      applyAutoSyncPref().then(function(on) {
        syncAutoSyncToggle(on);
        if (on) startPanelCountdown();
        else stopPanelCountdown();
        setSyncLine();
      }).catch(function() {
        syncAutoSyncToggle(false);
        stopAutoSync();
        stopPanelCountdown();
      });
      setSidebarAuth(true);
      refreshAccountPanelExtras();
    } else {
      setUserPrefsSyncEnabled(false);
      syncAutoSyncToggle(false);
      stopAutoSync();
      stopPanelCountdown();
      setSidebarAuth(false);
    }
  }

  function syncAutoSyncToggle(on) {
    var el = document.getElementById('autoSyncToggle');
    if (el) {
      el.checked = !!on;
      el.setAttribute('aria-checked', on ? 'true' : 'false');
    }
  }

  async function refreshAuthUi() {
    var tip = document.getElementById('authStatusTip');
    try {
      var st = await fetchAuthStatus();
      if (st.user) {
        showLoggedIn(st);
        if (tip) tip.textContent = '';
      } else {
        showLoggedOut(st, '');
      }
    } catch (e) {
      showLoggedOut({}, '暂时无法连接服务，请稍后重试。', true);
      if (tip) tip.textContent = '暂时无法连接服务，请稍后重试。';
    }
  }

  function fmtLastSync(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('zh-CN', { hour12: false });
    } catch (e) {
      return String(iso);
    }
  }

  function setSyncLine() {
    var el = document.getElementById('syncStatusLine');
    var tip = document.getElementById('syncTip');
    var eta = document.getElementById('syncCountdownLine');
    var st = getSyncStatus();
    if (!el) return;
    el.classList.remove('is-err');
    if (st.syncing) el.textContent = '对齐中…';
    else if (st.lastSyncError) {
      el.textContent = '对齐失败';
      el.classList.add('is-err');
      if (tip) {
        tip.textContent = friendlySyncError(st.lastSyncError);
        tip.classList.add('is-err');
      }
    } else if (st.lastSyncAt) {
      var extra = st.outboxSize ? (' · 待传 ' + st.outboxSize) : '';
      el.textContent = '上次对齐 ' + fmtLastSync(st.lastSyncAt) + extra;
      if (tip) {
        tip.textContent = '';
        tip.classList.remove('is-err');
      }
    } else {
      el.textContent = st.outboxSize
        ? ('离线队列待传 ' + st.outboxSize + ' 条')
        : '尚未对齐';
      if (tip && !tip.classList.contains('is-err')) {
        tip.textContent = st.outboxSize
          ? '点「刷新云端列表」处理离线队列（不上传本地卡包）'
          : '';
      }
    }

    var ms = getMsUntilNextSync();
    if (eta) {
      if (ms == null) {
        eta.hidden = true;
        eta.textContent = '';
      } else {
        eta.hidden = false;
        eta.textContent = '下次 ' + formatSyncCountdown(ms);
      }
    }
    refreshAccountPanelExtras();
  }

  function readLocalDraftsForSyncCenter() {
    try {
      return getDraftsMapSync() || {};
    } catch (e) {
      return {};
    }
  }

  async function refreshAccountPanelExtras() {
    var centerEl = document.getElementById('syncCenterBlock');
    var quotaEl = document.getElementById('quotaUsageBlock');
    if (!centerEl && !quotaEl) return;
    try {
      var snap = await buildSyncCenterSnapshot({
        getDrafts: readLocalDraftsForSyncCenter,
      });
      if (centerEl) {
        centerEl.textContent = snap.loggedIn
          ? (snap.summaryLine + (snap.outbox.failed ? ' · 其中失败 ' + snap.outbox.failed + ' 条' : ''))
          : '';
      }
      if (quotaEl) {
        var q = snap.quota || await fetchCloudQuota(false);
        quotaEl.textContent = quotaUsageHtml(q) || '—';
      }
    } catch (e) {
      if (centerEl) centerEl.textContent = '';
    }
    refreshDeviceTokensList();
  }

  async function refreshDeviceTokensList() {
    var ul = document.getElementById('deviceTokensList');
    if (!ul) return;
    try {
      var res = await fetchAuthTokens();
      var tokens = (res && res.tokens) || [];
      if (!tokens.length) {
        ul.innerHTML = '<li>暂无插件 Bearer 会话</li>';
        return;
      }
      ul.innerHTML = tokens.map(function(t) {
        var label = (t.displayName || t.username || t.id || '设备').slice(0, 40);
        var exp = t.expiresAt ? (' · 至 ' + fmtLastSync(t.expiresAt)) : '';
        return '<li>' + label + exp
          + ' <button type="button" class="btn-inline" data-revoke-token="'
          + encodeURIComponent(t.id) + '">吊销</button></li>';
      }).join('');
      ul.querySelectorAll('[data-revoke-token]').forEach(function(btn) {
        btn.addEventListener('click', async function() {
          var docId = decodeURIComponent(btn.getAttribute('data-revoke-token') || '');
          try {
            await revokeAuthToken(docId);
            await refreshDeviceTokensList();
          } catch (e) {
            alert('吊销失败：' + (e && e.message || e));
          }
        });
      });
    } catch (e) {
      ul.innerHTML = '<li>无法加载设备列表</li>';
    }
  }

  async function exportCloudDataJson() {
    var tip = document.getElementById('exportDataTip');
    if (tip) tip.textContent = '正在导出…';
    try {
      var data = await fetchCloudExport();
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'stcb-cloud-export-' + Date.now() + '.json';
      a.click();
      URL.revokeObjectURL(url);
      if (tip) tip.textContent = '已下载 JSON 导出（不含 AI 密钥明文）';
    } catch (e) {
      if (tip) {
        tip.textContent = '导出失败：' + (e && e.message || e);
        tip.classList.add('is-err');
      }
    }
  }

  function startPanelCountdown() {
    stopPanelCountdown();
    panelCountdownTimer = setInterval(function() { setSyncLine(); }, 1000);
    setSyncLine();
  }

  function stopPanelCountdown() {
    if (panelCountdownTimer) {
      clearInterval(panelCountdownTimer);
      panelCountdownTimer = null;
    }
    var eta = document.getElementById('syncCountdownLine');
    if (eta) {
      eta.hidden = true;
      eta.textContent = '';
    }
  }

  async function doSync() {
    var tip = document.getElementById('syncTip');
    // 进行中只由 #syncStatusLine 显示「同步中…」，避免 tip 再写一遍
    try {
      if (tip) {
        tip.textContent = '';
        tip.classList.remove('is-err');
      }
      await runSync({ refreshCred: true, force: true, hydrateAll: true });
      if (tip) tip.textContent = '云端列表已刷新';
    } catch (e) {
      if (tip) {
        tip.textContent = friendlySyncError(e);
        tip.classList.add('is-err');
      }
    }
    setSyncLine();
  }

  function setTip(msg, isErr) {
    var tip = document.getElementById('authStatusTip');
    if (!tip) return;
    tip.textContent = msg || '';
    tip.classList.toggle('is-err', !!isErr);
  }

  document.querySelectorAll('[data-auth-tab]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      setAuthTab(btn.getAttribute('data-auth-tab'));
      setTip('');
    });
  });

  document.getElementById('formEmailLogin')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    var email = (document.getElementById('emailLoginEmail') || {}).value || '';
    var password = (document.getElementById('emailLoginPassword') || {}).value || '';
    try {
      setTip('登录中…');
      await apiEmailLogin({ email: email, password: password });
      setTip('登录成功');
      await refreshAuthUi();
      await runSync({ refreshCred: true, force: true, hydrateAll: true }).catch(function() {});
      setSyncLine();
    } catch (err) {
      setTip(String(err && err.message || err), true);
    }
  });

  document.getElementById('formEmailRegister')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    var email = (document.getElementById('emailRegEmail') || {}).value || '';
    var password = (document.getElementById('emailRegPassword') || {}).value || '';
    var inviteCode = (document.getElementById('emailRegInvite') || {}).value || '';
    try {
      setTip('注册中…');
      await apiEmailRegister({ email: email, password: password, inviteCode: inviteCode });
      setTip('注册成功');
      await refreshAuthUi();
      await runSync({ refreshCred: true, force: true, hydrateAll: true }).catch(function() {});
      setSyncLine();
    } catch (err) {
      setTip(String(err && err.message || err), true);
    }
  });

  document.getElementById('btnDevLogin')?.addEventListener('click', async function() {
    var name = (document.getElementById('devLoginName') || {}).value || '';
    try {
      await apiDevLogin(name);
      setTip('调试登录成功');
      await refreshAuthUi();
      await runSync({ refreshCred: true, force: true, hydrateAll: true }).catch(function() {});
      setSyncLine();
    } catch (e) {
      setTip(String(e && e.message || e), true);
    }
  });

  document.getElementById('btnAuthLogout')?.addEventListener('click', async function() {
    await apiLogout();
    setCloudEnabled(false);
    stopAutoSync();
    syncAutoSyncToggle(false);
    setUserPrefsSyncEnabled(false);
    await refreshAuthUi();
  });

  document.getElementById('btnManualSync')?.addEventListener('click', function() { doSync(); });

  document.getElementById('btnGoCardManagerSync')?.addEventListener('click', function() {
    location.hash = 'card-manager';
  });
  document.getElementById('btnRetryOutbox')?.addEventListener('click', function() { doSync(); });
  document.getElementById('btnExportCloudData')?.addEventListener('click', function() {
    exportCloudDataJson();
  });

  window.addEventListener('card-local-saved', function() {
    refreshAccountPanelExtras();
  });
  onSyncEvent(function() {
    invalidateQuotaCache();
    refreshAccountPanelExtras();
  });

  document.getElementById('autoSyncToggle')?.addEventListener('change', async function(e) {
    var on = !!(e && e.target && e.target.checked);
    syncAutoSyncToggle(on);
    try {
      await setAutoSyncPref(on);
      if (on) {
        startAutoSync();
        startPanelCountdown();
      } else {
        stopAutoSync();
        stopPanelCountdown();
      }
      setSyncLine();
      if (typeof window.__refreshSidebarSyncEta__ === 'function') {
        try { window.__refreshSidebarSyncEta__(); } catch (err) { /* ignore */ }
      }
    } catch (err) {
      syncAutoSyncToggle(!on);
      var tip = document.getElementById('syncTip');
      if (tip) {
        tip.textContent = '自动同步偏好保存失败';
        tip.classList.add('is-err');
      }
    }
  });

  function secretsTip(msg, isErr) {
    var el = document.getElementById('aiSecretsSyncTip');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('is-err', !!isErr);
  }

  function readSecretsPassphrase() {
    var el = document.getElementById('aiSecretsPassphrase');
    return el ? String(el.value || '') : '';
  }

  document.getElementById('btnUploadAiSecrets')?.addEventListener('click', async function() {
    var pass = readSecretsPassphrase();
    if (pass.length < 6) {
      secretsTip('请先填写至少 6 位同步口令', true);
      return;
    }
    secretsTip('加密上传中…');
    try {
      await uploadAiSecretsToCloud(pass);
      secretsTip('已加密同步完整 API 配置到云端（服务端无法解密）');
    } catch (e) {
      secretsTip('失败：' + String(e && e.message || e), true);
    }
  });

  document.getElementById('btnDownloadAiSecrets')?.addEventListener('click', async function() {
    var pass = readSecretsPassphrase();
    if (pass.length < 6) {
      secretsTip('请先填写同步口令以解密', true);
      return;
    }
    secretsTip('拉取并解密中…');
    try {
      await downloadAiSecretsFromCloud(pass);
      secretsTip('已解密写入本地；正在刷新…');
      location.reload();
    } catch (e) {
      secretsTip('失败：' + String(e && e.message || e), true);
    }
  });

  document.getElementById('btnClearCloudAiSecrets')?.addEventListener('click', async function() {
    if (!confirm('确认清除云端 AI API 配置文档？本地配置不会删除。')) return;
    secretsTip('清除中…');
    try {
      await clearCloudAiSecrets();
      secretsTip('云端 AI API 配置已清除');
    } catch (e) {
      secretsTip('失败：' + String(e && e.message || e), true);
    }
  });

  onSyncEvent(function() {
    setSyncLine();
    if (typeof window.__refreshSidebarSyncEta__ === 'function') {
      try { window.__refreshSidebarSyncEta__(); } catch (e) { /* ignore */ }
    }
  });

  (async function boot() {
    var hash = String(location.hash || '');
    if (hash.indexOf('auth') >= 0) {
      history.replaceState(null, '', '#account-sync');
      window.dispatchEvent(new Event('hashchange'));
    }
    await refreshAuthUi();
    setSyncLine();
  })();
}
