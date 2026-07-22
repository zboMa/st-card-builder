/**
 * 状态栏面板 boot（从 StatusBarPanel.astro 外提）
 */
import {
    STATUS_BAR_MODULES,
    STATUS_BAR_EXT_KEY,
    STATUS_BAR_SCRIPT_NAME,
    STATUS_BAR_REGEX_NAME,
    STATUS_BAR_CHAR_SCAN_PROMPT,
    STATUS_BAR_MVU_DESIGN_PROMPT,
    STATUS_BAR_CUSTOM_LAYOUT_PROMPT,
    CUSTOM_DESIGN_ID,
    isCustomDesign,
    getDesignById,
    getDesignMeta,
    getPresetById,
    presetsForCast,
    layoutsForCast,
    defaultDesignId,
    designCss,
    defaultModuleFlags,
    resolveModuleFlags,
    describeEnabledModules,
    describeFemaleOnlyRule,
    normalizeCastCharacter,
    pathsFromMvuDesign,
    buildPlaceholderPaths,
    buildPreviewHtml,
    buildStatusBarSnippet,
    buildTavernHelperScript,
    buildStatusBarRegex,
    normalizeDesign,
  } from '../statusBar.mjs';

export function initStatusBarPanel() {
  (function() {
    var stage = 1;
    var state = normalizeDesign({
      castMode: 'single',
      presetId: 'single_daily',
      designId: 'sheet_attr',
    });
    var generatedOk = false;

    var extraEl = document.getElementById('sbExtra');
    var nsfwEl = document.getElementById('sbNsfw');
    var femaleOnlyEl = document.getElementById('sbFemaleOnly');
    var mainSel = document.getElementById('sbMainName');
    var presetGrid = document.getElementById('sbPresetGrid');
    var layoutGrid = document.getElementById('sbLayoutGrid');
    var customBox = document.getElementById('sbCustomBox');
    var customBaseRow = document.getElementById('sbCustomBaseRow');
    var customBaseSel = document.getElementById('sbCustomBase');
    var customPromptEl = document.getElementById('sbCustomPrompt');
    var btnCustomGenerate = document.getElementById('sbBtnCustomGenerate');
    var btnCustomRegenerate = document.getElementById('sbBtnCustomRegenerate');
    var moduleGrid = document.getElementById('sbModuleGrid');
    var charList = document.getElementById('sbCharList');
    var previewFrame = document.getElementById('sbPreviewFrame');
    var snippetCode = document.getElementById('sbSnippetCode');
    var btnInject = document.getElementById('sbBtnInject');

    /** 当前视觉方案 id（兼容旧 layoutId） */
    function currentDesignId() {
      return state.designId || state.layoutId || defaultDesignId(state.castMode);
    }

    /** 状态文案；tone: ok | warn | err | info */
    function setStatus(id, text, tone) {
      var el = document.getElementById(id);
      if (!el) return;
      el.textContent = text || '';
      el.classList.remove('is-ok', 'is-warn', 'is-err', 'is-info');
      if (tone) el.classList.add('is-' + tone);
    }

    function currentCharName() {
      return String((document.getElementById('charName') || {}).value || '').trim();
    }

    function refreshSinglePill() {
      var el = document.getElementById('sbSingleChar');
      var name = currentCharName();
      el.textContent = name || '（未填角色名）';
      if (state.castMode === 'single') state.mainName = name;
    }

    function getCastMode() {
      var checked = document.querySelector('input[name="sbCast"]:checked');
      return checked && checked.value === 'multi' ? 'multi' : 'single';
    }

    function syncCastUi() {
      var multi = state.castMode === 'multi';
      document.getElementById('sbSingleBox').hidden = multi;
      document.getElementById('sbMultiBox').hidden = !multi;
      var design = getDesignMeta(currentDesignId(), state.castMode);
      document.getElementById('sbPreviewHint').textContent = (multi ? '多人' : '单人')
        + '：' + design.label + (isCustomDesign(currentDesignId()) ? '（自定义）' : '（模块联动）');
      if (femaleOnlyEl) femaleOnlyEl.checked = state.femaleOnly !== false;
      refreshSinglePill();
      renderCharList();
      renderPresets();
      renderLayouts();
      renderModules();
    }

    /** 互斥切换分步：仅当前 stage 可见，顶栏 is-active / is-done 同步 */
    function setStage(n) {
      stage = n;
      document.querySelectorAll('[data-sb-stage]').forEach(function(el) {
        el.hidden = Number(el.getAttribute('data-sb-stage')) !== n;
      });
      document.querySelectorAll('.sb-step').forEach(function(btn) {
        var s = Number(btn.getAttribute('data-sb-step'));
        btn.classList.toggle('is-active', s === n);
        btn.classList.toggle('is-done', s < n);
      });
      if (n === 1) refreshSinglePill();
      if (n === 2) { renderPresets(); renderModules(); }
      if (n === 4) { renderLayouts(); syncCustomUi(); }
      refreshPreview();
    }

    function getCustomMode() {
      var checked = document.querySelector('input[name="sbCustomMode"]:checked');
      return checked && checked.value === 'scratch' ? 'scratch' : 'base';
    }

    function syncCustomUi() {
      if (!customBox) return;
      var isCustom = isCustomDesign(currentDesignId());
      customBox.hidden = !isCustom;
      if (customBaseRow) customBaseRow.hidden = getCustomMode() !== 'base';
      if (customPromptEl && state.customPrompt) customPromptEl.value = state.customPrompt;
      if (btnCustomRegenerate) {
        btnCustomRegenerate.hidden = !(isCustom && state.customBodyHtml);
      }
      populateCustomBaseSelect();
    }

    function populateCustomBaseSelect() {
      if (!customBaseSel) return;
      var cur = state.customBaseDesignId || defaultDesignId(state.castMode);
      customBaseSel.innerHTML = '';
      layoutsForCast(state.castMode).forEach(function(l) {
        if (isCustomDesign(l.id)) return;
        var opt = document.createElement('option');
        opt.value = l.id;
        opt.textContent = l.label;
        if (l.id === cur) opt.selected = true;
        customBaseSel.appendChild(opt);
      });
    }

    function describePathBlock(paths) {
      return (paths || []).map(function(p) {
        return '- ' + p.path + ' | ' + p.label + ' | sample:' + (p.sample || '—');
      }).join('\n') || '（无）';
    }

    function readFormIntoState() {
      state.castMode = getCastMode();
      state.nsfw = !!(nsfwEl && nsfwEl.checked);
      state.femaleOnly = !(femaleOnlyEl && !femaleOnlyEl.checked);
      state.extra = (extraEl.value || '').trim();
      // 视觉方案以 designId 为准（排版步点选；custom 单独存 HTML/CSS）
      if (!isCustomDesign(state.designId)) {
        var design = getDesignById(currentDesignId());
        if (design.cast !== state.castMode) {
          state.designId = defaultDesignId(state.castMode);
          state.layoutId = state.designId;
          state.styleId = state.designId;
        } else {
          state.designId = design.id;
          state.layoutId = design.id;
          state.styleId = design.id;
        }
      }
      if (state.castMode === 'single') {
        state.mainName = currentCharName();
        state.characters = state.mainName
          ? [normalizeCastCharacter({ name: state.mainName, identity: '当前卡主角', selected: true })]
          : [];
      } else {
        state.mainName = (mainSel.value || '').trim() || state.mainName;
      }
      state.moduleFlags = resolveModuleFlags(state.presetId, state.moduleFlags, state.nsfw);
    }

    function renderPresets() {
      var list = presetsForCast(state.castMode);
      presetGrid.innerHTML = '';
      list.forEach(function(p) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sb-preset-btn'
          + (p.id === state.presetId ? ' is-active' : '')
          + (p.nsfw ? ' is-nsfw' : '');
        btn.innerHTML = '<strong>' + p.label + '</strong><small>' + (p.hint || '') + '</small>';
        btn.addEventListener('click', function() {
          state.presetId = p.id;
          if (p.nsfw) {
            state.nsfw = true;
            nsfwEl.checked = true;
          }
          state.moduleFlags = defaultModuleFlags(p.id, state.nsfw);
          renderPresets();
          renderModules();
          refreshPreview();
        });
        presetGrid.appendChild(btn);
      });
    }

    function renderLayouts() {
      if (!layoutGrid) return;
      var list = layoutsForCast(state.castMode);
      layoutGrid.innerHTML = '';
      var cur = currentDesignId();
      // 当前方案不在列表则回落默认
      if (!list.some(function(l) { return l.id === cur; })) {
        state.designId = defaultDesignId(state.castMode);
        state.layoutId = state.designId;
        state.styleId = state.designId;
        cur = state.designId;
      }
      list.forEach(function(l) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sb-layout-btn'
          + (l.id === cur ? ' is-active' : '')
          + (l.cast === 'multi' ? ' is-multi' : '')
          + (isCustomDesign(l.id) ? ' is-custom' : '');
        var blurb = l.blurb || l.hint || '';
        var accent = l.accent || '#64748b';
        // 色点 + 名 + 一句说明
        btn.innerHTML = '<span class="sb-layout-dot" aria-hidden="true"></span>'
          + '<span class="sb-layout-meta"><strong>' + l.label + '</strong><small>' + blurb + '</small></span>';
        btn.style.setProperty('--sb-accent', accent);
        btn.addEventListener('click', function() {
          state.designId = l.id;
          state.layoutId = l.id;
          state.styleId = l.id;
          renderLayouts();
          syncCustomUi();
          refreshPreview();
        });
        layoutGrid.appendChild(btn);
      });
      syncCustomUi();
    }

    function renderModules() {
      moduleGrid.innerHTML = '';
      var flags = resolveModuleFlags(state.presetId, state.moduleFlags, state.nsfw);
      state.moduleFlags = flags;
      STATUS_BAR_MODULES.forEach(function(m) {
        // NSFW 关：整组隐藏
        if (m.nsfw && !state.nsfw) return;
        if (m.cast === 'multi' && state.castMode !== 'multi') return;
        if (m.cast === 'single' && state.castMode !== 'single') return;
        var lab = document.createElement('label');
        lab.className = 'sb-mod' + (m.nsfw ? ' is-nsfw' : '');
        lab.innerHTML = '<input type="checkbox" data-mod="' + m.id + '"'
          + (flags[m.id] ? ' checked' : '') + ' />'
          + '<span>' + m.label + '</span>';
        lab.title = m.hint || '';
        lab.querySelector('input').addEventListener('change', function(e) {
          state.moduleFlags[m.id] = !!e.target.checked;
          refreshPreview();
        });
        moduleGrid.appendChild(lab);
      });
    }

    /** 仅刷新主视角下拉，避免重绘勾选框打断交互 */
    function syncMainSelect() {
      var selected = collectSelectedCharacters();
      var prev = state.mainName;
      mainSel.innerHTML = '';
      selected.forEach(function(c) {
        var opt = document.createElement('option');
        opt.value = c.name;
        opt.textContent = c.name;
        if (c.name === prev) opt.selected = true;
        mainSel.appendChild(opt);
      });
      if (selected.length && !selected.some(function(c) { return c.name === state.mainName; })) {
        state.mainName = selected[0].name;
        mainSel.value = state.mainName;
      }
    }

    function renderCharList() {
      charList.innerHTML = '';
      if (!state.characters.length) {
        charList.innerHTML = '<div class="sb-tip">尚未识别人物，请点「AI 识别」。</div>';
      } else {
        state.characters.forEach(function(c, idx) {
          // label 包整卡：点击任意处切换勾选
          var card = document.createElement('label');
          card.className = 'sb-char-card';
          var checked = c.selected !== false;
          var idText = c.identity ? String(c.identity) : '';
          card.innerHTML = '<input type="checkbox" data-ci="' + idx + '"' + (checked ? ' checked' : '') + ' />'
            + '<span class="sb-char-card-body"><strong>' + escHtml(c.name) + '</strong>'
            + (idText
              ? '<small title="' + escHtml(idText) + '">' + escHtml(idText) + '</small>'
              : '')
            + '</span>';
          charList.appendChild(card);
        });
      }
      syncMainSelect();
    }

    function collectSelectedCharacters() {
      if (state.castMode === 'single') {
        var n = currentCharName();
        return n ? [normalizeCastCharacter({ name: n, identity: '当前卡主角', selected: true })] : [];
      }
      return state.characters.filter(function(c) { return c && c.selected !== false; });
    }

    /** 设计态预览路径：始终按当前模块重算，避免 state.paths 缓存阻断联动 */
    function previewPaths() {
      var flags = resolveModuleFlags(state.presetId, state.moduleFlags, state.nsfw);
      return buildPlaceholderPaths({
        castMode: state.castMode,
        mainName: state.mainName || currentCharName() || '角色',
        moduleFlags: flags,
        characters: collectSelectedCharacters(),
      });
    }

    function refreshPreview() {
      readFormIntoState();
      // 勾选模块 / 点刷新：一律按开启模块重绘（不读生成缓存）
      var paths = previewPaths();
      var chars = collectSelectedCharacters();
      var designId = currentDesignId();
      var html = buildPreviewHtml({
        designId: designId,
        castMode: state.castMode,
        paths: paths,
        characters: chars,
        mainName: state.mainName || (chars[0] && chars[0].name) || '',
        title: 'STATUS',
        customCss: state.customCss,
        customBodyHtml: state.customBodyHtml,
      });
      if (previewFrame) previewFrame.srcdoc = html;
      if (state.snippetHtml && snippetCode) snippetCode.textContent = state.helperScript || '';
      var design = getDesignMeta(designId, state.castMode);
      var hint = document.getElementById('sbPreviewHint');
      if (hint) {
        hint.textContent = (state.castMode === 'multi' ? '多人' : '单人')
          + '：' + design.label + (isCustomDesign(designId) ? '（自定义）' : '（模块联动）');
      }
    }

    function rebuildArtifacts() {
      readFormIntoState();
      if (!state.paths.length) state.paths = previewPaths();
      var chars = collectSelectedCharacters();
      var snippet = buildStatusBarSnippet({
        designId: currentDesignId(),
        castMode: state.castMode,
        paths: state.paths,
        mode: 'mvu',
        characters: chars,
        mainName: state.mainName,
        title: 'STATUS',
        customCss: state.customCss,
        customBodyHtml: state.customBodyHtml,
      });
      state.mode = 'mvu';
      state.snippetHtml = snippet;
      state.helperScript = buildTavernHelperScript({ snippetHtml: snippet, mode: 'mvu' });
      if (snippetCode) snippetCode.textContent = state.helperScript;
      refreshPreview();
      return snippet;
    }

    function saveDesignExt() {
      if (window.__setCardExtension__) {
        window.__setCardExtension__(STATUS_BAR_EXT_KEY, normalizeDesign(state));
      }
    }

    function loadDesignExt() {
      var raw = window.__getCardExtension__ ? window.__getCardExtension__(STATUS_BAR_EXT_KEY) : null;
      if (!raw) return;
      state = normalizeDesign(raw);
      extraEl.value = state.extra || '';
      nsfwEl.checked = !!state.nsfw;
      if (femaleOnlyEl) femaleOnlyEl.checked = state.femaleOnly !== false;
      if (customPromptEl) customPromptEl.value = state.customPrompt || '';
      var radio = document.querySelector('input[name="sbCast"][value="' + state.castMode + '"]');
      if (radio) radio.checked = true;
      generatedOk = !!(state.paths && state.paths.length && state.snippetHtml);
      btnInject.disabled = !generatedOk;
    }

    function extractJson(text) {
      var s = String(text || '');
      var fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fence) s = fence[1];
      var start = s.indexOf('{');
      var end = s.lastIndexOf('}');
      if (start < 0 || end <= start) throw new Error('AI 未返回 JSON');
      return JSON.parse(s.slice(start, end + 1));
    }

    function getAiConfig() {
      var apiUrl = document.getElementById('apiUrl');
      var apiKey = document.getElementById('apiKey');
      var modelSel = document.getElementById('modelSelect');
      if (!apiUrl || !modelSel) throw new Error('找不到 AI 配置面板');
      var model = modelSel.value;
      if (!model) throw new Error('请先在 AI 配置拉取并选择模型');
      return {
        url: apiUrl.value.replace(/\/$/, '') + '/chat/completions',
        key: (apiKey && apiKey.value || '').trim(),
        model: model,
      };
    }

    function applyTemplate(tpl, vars) {
      return String(tpl).replace(/\{\{(\w+)\}\}/g, function(_, k) {
        return vars[k] != null ? String(vars[k]) : '';
      });
    }

    function buildCharBlock() {
      var name = currentCharName();
      var desc = (document.getElementById('charDesc') || {}).value || '';
      var first = (document.getElementById('firstMes') || {}).value || '';
      return '角色名：' + name + '\n描述：' + String(desc).slice(0, 1000)
        + '\n开场白：' + String(first).slice(0, 400);
    }

    function buildWbBlock() {
      var wb = window.__getWorldbookEntries__ ? window.__getWorldbookEntries__() : [];
      return (wb || []).slice(0, 40).map(function(e, i) {
        return (i + 1) + '. 「' + (e.comment || e.name || '?') + '」'
          + String(e.content || '').slice(0, 120).replace(/\s+/g, ' ');
      }).join('\n') || '（世界书为空）';
    }

    async function runAiTask(type, title, userMsg, sysPrompt) {
      var cfg = getAiConfig();
      var headers = { 'Content-Type': 'application/json' };
      if (cfg.key) headers['Authorization'] = 'Bearer ' + cfg.key;
      var center = window.__aiTaskCenter__;
      var runBody = async function(task) {
        var res = await fetch(cfg.url, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            model: cfg.model,
            messages: [
              { role: 'system', content: sysPrompt },
              { role: 'user', content: userMsg },
            ],
            temperature: 0.25,
          }),
          signal: task && task.signal,
        });
        if (!res.ok) throw new Error('API HTTP ' + res.status);
        return extractJson((await res.json()).choices[0].message.content);
      };
      if (center && center.run) {
        return center.run({ type: type, title: title, target: currentCharName() }, runBody);
      }
      return runBody(null);
    }

    async function scanCharacters() {
      readFormIntoState();
      var ps = window.__promptStore__;
      var tpl = (ps && ps.get('statusBarCharScan')) || STATUS_BAR_CHAR_SCAN_PROMPT;
      var vars = {
        wbBlock: buildWbBlock(),
        charName: currentCharName() || '未知',
        femaleOnlyRule: describeFemaleOnlyRule(state.femaleOnly !== false),
      };
      var sys = ps ? ps.applyTemplate(tpl, vars) : applyTemplate(tpl, vars);
      var data = await runAiTask('statusbar_char_scan', '状态栏人物识别', '请输出人物 JSON。', sys);
      var list = Array.isArray(data.characters) ? data.characters : [];
      state.characters = list.map(function(raw) {
        return normalizeCastCharacter(Object.assign({}, raw, { selected: true }));
      }).filter(Boolean);
      if (!state.characters.length) throw new Error('未识别到人物条目');
      if (!state.mainName || !state.characters.some(function(c) { return c.name === state.mainName && c.selected !== false; })) {
        state.mainName = state.characters[0].name;
      }
      renderCharList();
      saveDesignExt();
      return state.characters;
    }

    async function generateVariableDesign() {
      readFormIntoState();
      var chars = collectSelectedCharacters();
      if (state.castMode === 'multi' && !chars.length) throw new Error('请先勾选至少一名人物');
      if (state.castMode === 'single' && !currentCharName()) throw new Error('请先填写角色名');
      state.moduleFlags = resolveModuleFlags(state.presetId, state.moduleFlags, state.nsfw);

      var ps = window.__promptStore__;
      var tpl = (ps && ps.get('statusBarMvuDesign')) || STATUS_BAR_MVU_DESIGN_PROMPT;
      var vars = {
        charBlock: buildCharBlock(),
        castMode: state.castMode === 'multi' ? '多人' : '单人',
        mainName: state.mainName || currentCharName() || '主角',
        castList: chars.map(function(c) { return c.name + (c.identity ? '(' + c.identity + ')' : ''); }).join('、') || '（仅主角）',
        design: '待定（下一步选择排版）',
        layout: '待定',
        style: '待定',
        moduleBlock: describeEnabledModules(state.moduleFlags),
        nsfw: state.nsfw ? '是' : '否',
        extra: state.extra || '无',
      };
      var sys = ps ? ps.applyTemplate(tpl, vars) : applyTemplate(tpl, vars);

      var data = await runAiTask(
        'statusbar_generate',
        '状态栏变量设计生成',
        '请输出完整 MVU 变量设计 JSON（将覆盖当前设计）。',
        sys
      );

      var design = {
        summary: String(data.summary || '状态栏生成的变量设计').slice(0, 80),
        variables: Array.isArray(data.variables) ? data.variables : [],
        source: 'statusbar',
      };
      if (!design.variables.length) throw new Error('AI 未返回 variables');

      if (!window.__assistantMvuApi__ || !window.__assistantMvuApi__.upsertVariables) {
        throw new Error('MVU 注入 API 不可用');
      }
      window.__assistantMvuApi__.upsertVariables({ design: design, inject: true });

      state.paths = pathsFromMvuDesign(design, { mainName: state.mainName, limit: 48 });
      rebuildArtifacts();
      saveDesignExt();
      generatedOk = true;
      btnInject.disabled = false;

      var sum = document.getElementById('sbGenSummary');
      sum.hidden = false;
      sum.textContent = '已覆盖 MVU：' + design.variables.length + ' 个变量 — ' + design.summary;
      fillChecklist(design);
      return design;
    }

    async function generateCustomLayout(isRegenerate) {
      readFormIntoState();
      if (!state.paths.length) throw new Error('请先在「生成」步骤完成变量设计');
      var prompt = (customPromptEl && customPromptEl.value || state.customPrompt || '').trim();
      if (!prompt) throw new Error('请输入排版描述');
      state.customPrompt = prompt;

      var mode = getCustomMode();
      var baseId = (customBaseSel && customBaseSel.value) || defaultDesignId(state.castMode);
      state.customBaseDesignId = mode === 'base' ? baseId : '';

      var paths = state.paths.length ? state.paths : previewPaths();
      var chars = collectSelectedCharacters();
      var baseBlock = '';
      if (mode === 'base' && baseId && !isCustomDesign(baseId)) {
        var baseDesign = getDesignById(baseId);
        var cssSample = designCss(baseId).slice(0, 3500);
        baseBlock = '【基准主题】' + baseDesign.label + ' / ' + (baseDesign.blurb || '')
          + '\n参考 CSS（节选）：\n' + cssSample + '\n';
      } else {
        baseBlock = '【基准主题】无（从零描述生成）\n';
      }

      var previousBlock = '';
      if (isRegenerate && state.customBodyHtml) {
        previousBlock = '【当前排版（请在此基础上修改）】\nCSS:\n' + state.customCss
          + '\nHTML:\n' + state.customBodyHtml + '\n';
      }

      var ps = window.__promptStore__;
      var tpl = (ps && ps.get('statusBarCustomLayout')) || STATUS_BAR_CUSTOM_LAYOUT_PROMPT;
      var vars = {
        charBlock: buildCharBlock(),
        castMode: state.castMode === 'multi' ? '多人' : '单人',
        mainName: state.mainName || currentCharName() || '主角',
        castList: chars.map(function(c) { return c.name; }).join('、') || '（仅主角）',
        nsfw: state.nsfw ? '是' : '否',
        moduleBlock: describeEnabledModules(state.moduleFlags),
        pathBlock: describePathBlock(paths),
        baseBlock: baseBlock,
        previousBlock: previousBlock,
        userPrompt: prompt,
      };
      var sys = ps ? ps.applyTemplate(tpl, vars) : applyTemplate(tpl, vars);
      var userMsg = isRegenerate
        ? '请在当前排版基础上按新要求输出 JSON。'
        : '请输出自定义排版 JSON。';

      var data = await runAiTask(
        'statusbar_custom_layout',
        isRegenerate ? '状态栏自定义排版（迭代）' : '状态栏自定义排版',
        userMsg,
        sys
      );

      var css = String(data.css || '').trim();
      var bodyHtml = String(data.bodyHtml || data.html || '').trim();
      if (!css || !bodyHtml) throw new Error('AI 未返回 css/bodyHtml');

      state.designId = CUSTOM_DESIGN_ID;
      state.layoutId = CUSTOM_DESIGN_ID;
      state.styleId = CUSTOM_DESIGN_ID;
      state.customCss = css;
      state.customBodyHtml = bodyHtml;
      rebuildArtifacts();
      renderLayouts();
      syncCustomUi();
      saveDesignExt();
      return { css: css, bodyHtml: bodyHtml };
    }

    function fillChecklist(design) {
      var list = document.getElementById('sbChecklist');
      var layoutLabel = isCustomDesign(currentDesignId())
        ? '自定义'
        : getDesignMeta(currentDesignId(), state.castMode).label;
      var items = [
        '人数：' + (state.castMode === 'multi' ? '多人' : '单人'),
        '预设：' + getPresetById(state.presetId).label,
        '排版：' + layoutLabel,
        'NSFW：' + (state.nsfw ? '开' : '关'),
        '变量：' + ((design && design.variables && design.variables.length) || state.paths.length) + ' 个',
        '展示脚本：' + STATUS_BAR_SCRIPT_NAME,
      ];
      list.innerHTML = items.map(function(t) { return '<li>' + t + '</li>'; }).join('');
    }

    function injectScripts() {
      if (!generatedOk && !state.paths.length) throw new Error('请先在「生成」步骤完成变量设计');
      if (isCustomDesign(currentDesignId()) && !state.customBodyHtml) {
        throw new Error('自定义排版尚未生成，请先点击「生成排版」');
      }
      rebuildArtifacts();
      if (!window.__setTavernHelperScript__) throw new Error('无法写入酒馆助手脚本');
      window.__setTavernHelperScript__(STATUS_BAR_SCRIPT_NAME, state.helperScript, true);
      if (state.mode === 'text' && window.__injectMvuEntries__) {
        window.__injectMvuEntries__([], [buildStatusBarRegex({ snippetHtml: state.snippetHtml })]);
      }
      saveDesignExt();
      if (window.triggerGlobalUpdate) window.triggerGlobalUpdate();
    }

    function escHtml(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    }

    // —— 事件 ——
    document.querySelectorAll('input[name="sbCast"]').forEach(function(r) {
      r.addEventListener('change', function() {
        state.castMode = getCastMode();
        var first = presetsForCast(state.castMode)[0];
        state.presetId = first.id;
        state.moduleFlags = defaultModuleFlags(first.id, state.nsfw);
        // 切换人数：校正到该模式默认视觉方案，并清空生成缓存
        state.designId = defaultDesignId(state.castMode);
        state.layoutId = state.designId;
        state.styleId = state.designId;
        state.paths = [];
        state.snippetHtml = '';
        state.helperScript = '';
        state.customCss = '';
        state.customBodyHtml = '';
        state.customPrompt = '';
        generatedOk = false;
        btnInject.disabled = true;
        syncCastUi();
        refreshPreview();
      });
    });

    nsfwEl.addEventListener('change', function() {
      state.nsfw = !!nsfwEl.checked;
      state.moduleFlags = resolveModuleFlags(state.presetId, state.moduleFlags, state.nsfw);
      renderModules();
      refreshPreview();
    });

    // 只识别女：独立勾选，仅改 flag，不触发 AI
    if (femaleOnlyEl) {
      femaleOnlyEl.addEventListener('click', function(e) {
        e.stopPropagation();
      });
      femaleOnlyEl.addEventListener('change', function(e) {
        e.stopPropagation();
        state.femaleOnly = !!femaleOnlyEl.checked;
        saveDesignExt();
      });
    }

    document.getElementById('sbBtnResetModules').addEventListener('click', function() {
      state.moduleFlags = defaultModuleFlags(state.presetId, state.nsfw);
      renderModules();
      setStatus('sbStatus2', '已重置为预设默认模块', 'ok');
      refreshPreview();
    });

    // 勾选变更写入 state.selected，只同步主视角下拉（不再强制全选重绘）
    charList.addEventListener('change', function(e) {
      var inp = e.target;
      if (!inp || !inp.hasAttribute('data-ci')) return;
      var c = state.characters[Number(inp.getAttribute('data-ci'))];
      if (c) c.selected = !!inp.checked;
      syncMainSelect();
      saveDesignExt();
      refreshPreview();
    });
    mainSel.addEventListener('change', function() {
      state.mainName = mainSel.value;
      refreshPreview();
    });

    extraEl.addEventListener('input', function() {
      state.extra = extraEl.value.trim();
    });

    document.querySelectorAll('.sb-step').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var n = Number(btn.getAttribute('data-sb-step'));
        if (n <= stage || n === 1) setStage(n);
        else if (n === 2 && stage >= 1) setStage(2);
        else if (n === 3 && stage >= 2) setStage(3);
        else if (n === 4 && stage >= 3) setStage(4);
      });
    });

    document.getElementById('sbBtnNext1').addEventListener('click', function() {
      readFormIntoState();
      if (state.castMode === 'single' && !currentCharName()) {
        return setStatus('sbStatus1', '请先在角色设定填写角色名', 'warn');
      }
      if (state.castMode === 'multi' && !collectSelectedCharacters().length) {
        return setStatus('sbStatus1', '请先识别并勾选人物', 'warn');
      }
      setStage(2);
    });
    document.getElementById('sbBtnBack2').addEventListener('click', function() { setStage(1); });
    document.getElementById('sbBtnNext2').addEventListener('click', function() {
      readFormIntoState();
      setStage(3);
    });
    document.getElementById('sbBtnBack3').addEventListener('click', function() { setStage(2); });
    document.getElementById('sbBtnNext3').addEventListener('click', function() {
      readFormIntoState();
      if (!generatedOk && !(state.paths && state.paths.length)) {
        return setStatus('sbStatus3', '请先生成并覆盖 MVU 变量设计', 'warn');
      }
      setStage(4);
    });
    document.getElementById('sbBtnBack4').addEventListener('click', function() { setStage(3); });

    document.querySelectorAll('input[name="sbCustomMode"]').forEach(function(r) {
      r.addEventListener('change', function() {
        syncCustomUi();
      });
    });
    if (customBaseSel) {
      customBaseSel.addEventListener('change', function() {
        state.customBaseDesignId = customBaseSel.value;
        saveDesignExt();
      });
    }
    if (customPromptEl) {
      customPromptEl.addEventListener('input', function() {
        state.customPrompt = customPromptEl.value.trim();
      });
    }

    document.getElementById('sbBtnScanChars').addEventListener('click', async function() {
      var btn = document.getElementById('sbBtnScanChars');
      btn.disabled = true;
      var old = btn.textContent;
      btn.textContent = '识别中…';
      setStatus('sbStatus1', '正在识别世界书人物…', 'info');
      try {
        var list = await scanCharacters();
        setStatus('sbStatus1', '已识别 ' + list.length + ' 人，请勾选并指定主视角', 'ok');
        refreshPreview();
      } catch (err) {
        if (window.__isAiAbortError__ && window.__isAiAbortError__(err)) {
          setStatus('sbStatus1', '已取消', 'info');
        } else {
          setStatus('sbStatus1', (err && err.message) || String(err), 'err');
        }
      } finally {
        btn.disabled = false;
        btn.textContent = old;
      }
    });

    document.getElementById('sbBtnGenerate').addEventListener('click', async function() {
      var btn = document.getElementById('sbBtnGenerate');
      btn.disabled = true;
      var old = btn.textContent;
      btn.textContent = '生成中…';
      setStatus('sbStatus3', '正在生成变量设计并覆盖 MVU…', 'info');
      try {
        var design = await generateVariableDesign();
        setStatus('sbStatus3', '已覆盖 MVU（' + design.variables.length + '），可进入排版步骤', 'ok');
      } catch (err) {
        if (window.__isAiAbortError__ && window.__isAiAbortError__(err)) {
          setStatus('sbStatus3', '已取消', 'info');
        } else {
          setStatus('sbStatus3', (err && err.message) || String(err), 'err');
        }
      } finally {
        btn.disabled = false;
        btn.textContent = old;
      }
    });

    async function runCustomLayoutTask(isRegenerate) {
      var btn = isRegenerate ? btnCustomRegenerate : btnCustomGenerate;
      if (!btn) return;
      btn.disabled = true;
      var old = btn.textContent;
      btn.textContent = '生成中…';
      setStatus('sbStatus4', isRegenerate ? '正在迭代自定义排版…' : '正在生成自定义排版…', 'info');
      try {
        await generateCustomLayout(isRegenerate);
        setStatus('sbStatus4', '自定义排版已就绪，可注入状态栏', 'ok');
        refreshPreview();
      } catch (err) {
        if (window.__isAiAbortError__ && window.__isAiAbortError__(err)) {
          setStatus('sbStatus4', '已取消', 'info');
        } else {
          setStatus('sbStatus4', (err && err.message) || String(err), 'err');
        }
      } finally {
        btn.disabled = false;
        btn.textContent = old;
      }
    }

    if (btnCustomGenerate) {
      btnCustomGenerate.addEventListener('click', function() { runCustomLayoutTask(false); });
    }
    if (btnCustomRegenerate) {
      btnCustomRegenerate.addEventListener('click', function() { runCustomLayoutTask(true); });
    }

    btnInject.addEventListener('click', function() {
      try {
        injectScripts();
        fillChecklist(null);
        setStatus('sbStatus4', '已注入 ' + STATUS_BAR_SCRIPT_NAME, 'ok');
      } catch (err) {
        setStatus('sbStatus4', (err && err.message) || String(err), 'err');
      }
    });

    document.getElementById('sbBtnRefreshPreview').addEventListener('click', refreshPreview);

    loadDesignExt();
    syncCastUi();
    setStage(1);
    refreshPreview();

    window.__statusBarApi__ = {
      getDesign: function() { return normalizeDesign(state); },
      setDesign: function(d) {
        state = normalizeDesign(d);
        saveDesignExt();
        syncCastUi();
        refreshPreview();
        return state;
      },
    };
  })();
}
