/**
 * SillyTavern 扩展：从 ST Card Builder 分享链接导入角色卡
 * API 固定 https://card-api.taojiu.love（UI 不提供地址配置）
 */
(async function () {
  const EXT_NAME = 'sillytavern-card-share';
  const API_BASE = 'https://card-api.taojiu.love';
  const SETTINGS_KEY = 'stcbCardShare';

  const defaultSettings = {
    token: '',
    expiresAt: '',
    username: '',
    passwords: {},
    importedVersions: {},
  };

  function ctx() {
    return SillyTavern.getContext();
  }

  function ensureSettings() {
    const { extensionSettings } = ctx();
    if (!extensionSettings[SETTINGS_KEY]) {
      extensionSettings[SETTINGS_KEY] = JSON.parse(JSON.stringify(defaultSettings));
    }
    const s = extensionSettings[SETTINGS_KEY];
    if (!s.passwords || typeof s.passwords !== 'object') s.passwords = {};
    if (!s.importedVersions || typeof s.importedVersions !== 'object') s.importedVersions = {};
    return s;
  }

  function save() {
    ctx().saveSettingsDebounced();
  }

  function parseShareToken(input) {
    const s = String(input || '').trim();
    if (!s) return '';
    const m = s.match(/\/api\/share\/cards\/([^/?#]+)/i);
    if (m) return decodeURIComponent(m[1]);
    if (/^[A-Za-z0-9_-]{10,}$/.test(s)) return s;
    return '';
  }

  function authHeaders(extra) {
    const s = ensureSettings();
    const h = Object.assign({ Accept: 'application/json' }, extra || {});
    if (s.token) h.Authorization = 'Bearer ' + s.token;
    return h;
  }

  async function apiGet(path, opts) {
    opts = opts || {};
    const headers = authHeaders();
    if (opts.password) headers['X-Share-Password'] = opts.password;
    const res = await fetch(API_BASE + path, { method: 'GET', headers: headers });
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      const err = new Error(data.message || data.error || ('HTTP ' + res.status));
      err.status = res.status;
      err.code = data.error;
      throw err;
    }
    return data;
  }

  function setStatus(el, msg, isError) {
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('stcb-share-status--err', !!isError);
  }

  function toast(msg, type) {
    if (typeof toastr !== 'undefined') {
      if (type === 'error') toastr.error(msg);
      else if (type === 'success') toastr.success(msg);
      else toastr.info(msg);
    } else {
      console.log('[stcb-share]', msg);
    }
  }

  async function refreshMe(ui) {
    const s = ensureSettings();
    if (!s.token) {
      ui.userLabel.textContent = '未登录';
      return;
    }
    try {
      const data = await apiGet('/api/auth/plugin-me');
      s.username = (data.user && (data.user.displayName || data.user.username)) || '';
      save();
      ui.userLabel.textContent = '已登录：' + (s.username || '用户');
    } catch (e) {
      s.token = '';
      s.expiresAt = '';
      s.username = '';
      save();
      ui.userLabel.textContent = '登录已失效，请重新登录';
    }
  }

  function startLogin(ui) {
    const url = API_BASE + '/api/auth/discord?client=st_plugin';
    const w = window.open(url, 'stcb_plugin_login', 'width=520,height=720');
    if (!w) {
      toast('无法打开登录窗口（请允许弹窗）', 'error');
      return;
    }
    setStatus(ui.status, '等待 Discord 登录…');

    function onMsg(ev) {
      const data = ev && ev.data;
      if (!data || data.type !== 'stcb-plugin-auth' || !data.token) return;
      window.removeEventListener('message', onMsg);
      const s = ensureSettings();
      s.token = String(data.token);
      s.expiresAt = String(data.expiresAt || '');
      save();
      setStatus(ui.status, '登录成功');
      toast('登录成功', 'success');
      refreshMe(ui);
      try { w.close(); } catch (e) { /* ignore */ }
    }
    window.addEventListener('message', onMsg);
  }

  async function logout(ui) {
    const s = ensureSettings();
    if (s.token) {
      try {
        await fetch(API_BASE + '/api/auth/plugin-logout', {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
        });
      } catch (e) { /* ignore */ }
    }
    s.token = '';
    s.expiresAt = '';
    s.username = '';
    save();
    ui.userLabel.textContent = '未登录';
    setStatus(ui.status, '已退出登录');
  }

  function fillVersionSelect(select, info) {
    select.innerHTML = '';
    var list = (info && info.versions) ? info.versions.slice() : [];
    if (!list.length && info && info.characterVersion) {
      list.push({ version: info.characterVersion });
    }
    for (var i = 0; i < list.length; i++) {
      var v = list[i];
      var opt = document.createElement('option');
      opt.value = v.version;
      opt.textContent = v.version + (v.title ? (' · ' + v.title) : '');
      select.appendChild(opt);
    }
    if (info && info.characterVersion) select.value = info.characterVersion;
  }

  async function onPreview(ui) {
    const token = parseShareToken(ui.linkInput.value);
    if (!token) {
      setStatus(ui.status, '请粘贴有效的分享链接或 token', true);
      return null;
    }
    const s = ensureSettings();
    if (!s.token) {
      setStatus(ui.status, '请先登录（与构建器同一 Discord 账号）', true);
      return null;
    }
    var password = String(ui.passInput.value || '').trim();
    if (!password && s.passwords[token]) password = s.passwords[token];

    setStatus(ui.status, '读取分享信息…');
    try {
      const info = await apiGet('/api/share/cards/' + encodeURIComponent(token), { password: password });
      if (password) {
        s.passwords[token] = password;
        save();
      }
      fillVersionSelect(ui.verSelect, info);
      ui.previewBox.hidden = false;
      ui.previewTitle.textContent = info.title || '（无标题）';
      ui.previewMeta.textContent = '最新版本 ' + (info.characterVersion || '—')
        + (info.pngPublic ? ' · 支持 PNG 直链' : '')
        + (info.hasPassword ? ' · 需密码' : '');

      const prev = s.importedVersions[token];
      if (prev && info.characterVersion && prev !== info.characterVersion) {
        setStatus(ui.status, '有更新：本地曾导入 ' + prev + '，云端最新 ' + info.characterVersion);
        toast('分享卡有新版本：' + info.characterVersion, 'info');
      } else {
        setStatus(ui.status, '已加载分享信息');
      }
      return { token: token, password: password, info: info };
    } catch (e) {
      if (e.code === 'bad_password') setStatus(ui.status, '分享密码错误', true);
      else if (e.status === 401) setStatus(ui.status, '请先登录', true);
      else setStatus(ui.status, '读取失败：' + (e.message || e), true);
      return null;
    }
  }

  async function importViaTavern(file, fileType) {
    const c = ctx();
    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('file_type', fileType);
    const headers = c.getRequestHeaders({ omitContentType: true });
    const result = await fetch('/api/characters/import', {
      method: 'POST',
      body: formData,
      headers: headers,
      cache: 'no-cache',
    });
    if (!result.ok) throw new Error('酒馆导入失败：' + result.statusText);
    const data = await result.json();
    if (data.error) throw new Error('酒馆导入错误');
    await c.getCharacters();
    return data.file_name;
  }

  async function onImport(ui, preferPng) {
    const preview = await onPreview(ui);
    if (!preview) return;
    const token = preview.token;
    const password = preview.password;
    const info = preview.info;
    const version = ui.verSelect.value || info.characterVersion;
    const s = ensureSettings();

    setStatus(ui.status, '正在导入…');
    try {
      var fileName = '';
      if (preferPng && info.pngPublic && info.latest && info.latest.pngUrl) {
        const res = await fetch(info.latest.pngUrl);
        if (!res.ok) throw new Error('PNG 下载失败');
        const buf = await res.arrayBuffer();
        const file = new File([buf], 'shared-card.png', { type: 'image/png' });
        fileName = await importViaTavern(file, 'png');
      } else {
        const pack = await apiGet(
          '/api/share/cards/' + encodeURIComponent(token)
          + '/versions/' + encodeURIComponent(version) + '/json',
          { password: password },
        );
        const name = (info.title || version || 'shared-card')
          .replace(/[^\w\u4e00-\u9fff.-]+/g, '_')
          .slice(0, 64) || 'shared-card';
        const blob = new Blob([JSON.stringify(pack.card)], { type: 'application/json' });
        const file = new File([blob], name + '.json', { type: 'application/json' });
        fileName = await importViaTavern(file, 'json');
      }
      s.importedVersions[token] = version;
      if (password) s.passwords[token] = password;
      save();
      setStatus(ui.status, '已导入：' + (fileName || version));
      toast('角色卡已导入', 'success');
    } catch (e) {
      setStatus(ui.status, '导入失败：' + (e.message || e), true);
      toast(String(e.message || e), 'error');
    }
  }

  function buildSettingsHtml() {
    return ''
      + '<div id="stcb_share_panel" class="stcb-share-panel">'
      + '<h3>ST Card Builder 分享导入</h3>'
      + '<p class="stcb-share-tip">使用与构建器相同的 Discord 账号登录后，粘贴分享信息链接即可导入。'
      + '卡版本取自角色卡 character_version。API 已固定为官方地址。</p>'
      + '<div class="stcb-share-row">'
      + '<span id="stcb_share_user" class="stcb-share-user">未登录</span>'
      + '<button type="button" id="stcb_share_login" class="menu_button">Discord 登录</button>'
      + '<button type="button" id="stcb_share_logout" class="menu_button">退出</button>'
      + '</div>'
      + '<label>分享链接 / Token'
      + '<textarea id="stcb_share_link" class="text_pole" rows="2" '
      + 'placeholder="https://card-api.taojiu.love/api/share/cards/…"></textarea>'
      + '</label>'
      + '<label>分享密码（若有；可记住）'
      + '<input type="password" id="stcb_share_pass" class="text_pole" autocomplete="off" />'
      + '</label>'
      + '<div class="stcb-share-row">'
      + '<button type="button" id="stcb_share_preview" class="menu_button">读取信息</button>'
      + '<button type="button" id="stcb_share_import" class="menu_button">导入 JSON</button>'
      + '<button type="button" id="stcb_share_import_png" class="menu_button">导入 PNG 直链</button>'
      + '</div>'
      + '<div id="stcb_share_preview_box" class="stcb-share-preview" hidden>'
      + '<div id="stcb_share_preview_title" class="stcb-share-preview-title"></div>'
      + '<div id="stcb_share_preview_meta" class="stcb-share-preview-meta"></div>'
      + '<label>导入版本<select id="stcb_share_version" class="text_pole"></select></label>'
      + '</div>'
      + '<div id="stcb_share_status" class="stcb-share-status"></div>'
      + '</div>';
  }

  function bindUi(root) {
    const ui = {
      userLabel: root.querySelector('#stcb_share_user'),
      loginBtn: root.querySelector('#stcb_share_login'),
      logoutBtn: root.querySelector('#stcb_share_logout'),
      linkInput: root.querySelector('#stcb_share_link'),
      passInput: root.querySelector('#stcb_share_pass'),
      previewBtn: root.querySelector('#stcb_share_preview'),
      importBtn: root.querySelector('#stcb_share_import'),
      importPngBtn: root.querySelector('#stcb_share_import_png'),
      previewBox: root.querySelector('#stcb_share_preview_box'),
      previewTitle: root.querySelector('#stcb_share_preview_title'),
      previewMeta: root.querySelector('#stcb_share_preview_meta'),
      verSelect: root.querySelector('#stcb_share_version'),
      status: root.querySelector('#stcb_share_status'),
    };
    ui.loginBtn.addEventListener('click', function () { startLogin(ui); });
    ui.logoutBtn.addEventListener('click', function () { logout(ui); });
    ui.previewBtn.addEventListener('click', function () { onPreview(ui); });
    ui.importBtn.addEventListener('click', function () { onImport(ui, false); });
    ui.importPngBtn.addEventListener('click', function () { onImport(ui, true); });
    refreshMe(ui);
  }

  // 等待 SillyTavern 就绪
  function ready(fn) {
    if (window.SillyTavern && typeof SillyTavern.getContext === 'function') {
      fn();
      return;
    }
    var n = 0;
    var t = setInterval(function () {
      n += 1;
      if (window.SillyTavern && typeof SillyTavern.getContext === 'function') {
        clearInterval(t);
        fn();
      } else if (n > 200) {
        clearInterval(t);
        console.error('[' + EXT_NAME + '] SillyTavern.getContext 不可用');
      }
    }, 100);
  }

  ready(function () {
    ensureSettings();
    var html = buildSettingsHtml();
    var host = document.getElementById('extensions_settings2')
      || document.getElementById('extensions_settings')
      || document.getElementById('rm_extensions_block');
    if (host) {
      host.insertAdjacentHTML('beforeend', html);
    } else if (window.jQuery) {
      jQuery('#extensions_settings').append(html);
    } else {
      document.body.insertAdjacentHTML('beforeend', html);
    }
    var panel = document.getElementById('stcb_share_panel');
    if (panel) bindUi(panel);
    console.log('[' + EXT_NAME + '] ready →', API_BASE);
  });
})();
