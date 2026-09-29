/**
 * 状态栏面板：四步同屏。变量与排版分开生成。样例楼层只在内存。
 */
import {
  STATUS_BAR_MODULES,
  STATUS_BAR_MODULE_GROUPS,
  STATUS_BAR_EXT_KEY,
  STATUS_BAR_PRESETS,
  STATUS_BAR_REGEX_NAME,
  STATUS_BAR_CHAR_SCAN_PROMPT,
  STATUS_BAR_MVU_FILL_PROMPT,
  STATUS_BAR_LAYOUT_SHELL_PROMPT,
  getPresetById,
  defaultModuleFlags,
  resolveModuleFlags,
  describeEnabledModules,
  describeForbiddenModules,
  describeFemaleOnlyRule,
  normalizeCastCharacter,
  collectPersonCharactersFromWorldbook,
  excludeCardNameFromCharacters,
  pathsFromMvuDesign,
  buildPlaceholderPaths,
  buildPreviewHtml,
  buildStatusBarSnippet,
  buildStatusBarRegex,
  normalizeDesign,
  reconcileDesignWithCharName,
  rejectStatusBarGenerate,
  validateSampleFloors,
  readFloorValue,
  keepMarkupPaths,
  buildVariableTree,
  appendStylePreset,
  planStatusBarBatches,
  fillStatusBarVariables,
  buildBatchProfileBlock,
  describeLayoutFields,
  expandStatusBarTemplate,
  layoutReviseSource,
  buildLocalSampleFloors,
} from '../statusBar.mjs';
import { appFeedback } from '../ui/appMessage.mjs';
import { engineTryAllowed } from '../actionEngine/helpers.mjs';
import { openTextPreview } from '../textPreviewModal.mjs';
import {
  applyStatusBarPromptTemplate,
  composeStatusBarPromptPreview,
  formatStatusBarPromptSections,
} from './statusBarPromptPreview.mjs';

export function initStatusBarPanel() {
  var state = normalizeDesign({});
  var samples = { activeFloor: 1, floors: null };
  var floorToastSent = false;

  var extraEl = document.getElementById('sbExtra');
  var layoutEl = document.getElementById('sbLayoutPrompt');
  var nsfwEl = document.getElementById('sbNsfw');
  var protagEl = document.getElementById('sbIncludeProtagonist');
  var femalesEl = document.getElementById('sbIncludeFemales');
  var femaleOnlyBtn = document.getElementById('sbFemaleOnly');
  var presetGrid = document.getElementById('sbPresetGrid');
  var moduleGrid = document.getElementById('sbModuleGrid');
  var charList = document.getElementById('sbCharList');
  var varTree = document.getElementById('sbVarTree');
  var previewFrame = document.getElementById('sbPreviewFrame');
  var snippetCode = document.getElementById('sbSnippetCode');
  var varsBtn = document.getElementById('sbBtnVars');
  var layoutRegenBtn = document.getElementById('sbBtnLayoutRegen');
  var layoutReviseBtn = document.getElementById('sbBtnLayoutRevise');
  var treeOpen = Object.create(null);

  function toast(message, level) {
    appFeedback(null, { message: message, level: level || 'error', channel: 'toast' });
  }

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function currentCharName() {
    return String((document.getElementById('charName') || {}).value || '').trim();
  }

  function selectedFemales() {
    return excludeCardNameFromCharacters(state.characters, currentCharName()).filter(function(c) {
      return c.selected !== false;
    });
  }

  function clearSamples() {
    samples.floors = null;
    samples.activeFloor = 1;
    floorToastSent = false;
  }

  function syncGenerateLabel() {
    if (!varsBtn) return;
    var again = !!(state.paths && state.paths.length);
    varsBtn.textContent = again ? '重新生成' : '生成';
  }

  function refreshCharName() {
    var el = document.getElementById('sbCharName');
    if (el) el.textContent = '#' + (currentCharName() || '');
  }

  function syncStepMarks() {
    var flags = state.moduleFlags || {};
    var anyMod = Object.keys(flags).some(function(k) { return !!flags[k]; });
    var done = {
      1: !!(state.includeProtagonist || (state.includeFemales && selectedFemales().length)),
      2: anyMod,
      3: pathsForPreview().length > 0,
      4: !!String(state.layoutPrompt || '').trim(),
    };
    document.querySelectorAll('[data-sb-mark]').forEach(function(el) {
      var n = Number(el.getAttribute('data-sb-mark'));
      el.classList.toggle('is-done', !!done[n]);
    });
  }

  function readFormIntoState() {
    state.includeProtagonist = !!(protagEl && protagEl.checked);
    state.includeFemales = !!(femalesEl && femalesEl.checked);
    state.nsfw = !!(nsfwEl && nsfwEl.checked);
    state.extra = extraEl ? extraEl.value.trim() : state.extra;
    state.layoutPrompt = layoutEl ? layoutEl.value.trim() : state.layoutPrompt;
    if (moduleGrid) {
      moduleGrid.querySelectorAll('input[data-mod]').forEach(function(input) {
        var id = input.getAttribute('data-mod');
        if (id) state.moduleFlags[id] = !!input.checked;
      });
    }
    state.moduleFlags = resolveModuleFlags(state.presetId, state.moduleFlags, state.nsfw);
    state.characters = excludeCardNameFromCharacters(state.characters, currentCharName());
  }

  function livePaths() {
    return buildPlaceholderPaths({
      includeProtagonist: state.includeProtagonist,
      includeFemales: state.includeFemales,
      charName: currentCharName(),
      characters: state.characters,
      moduleFlags: state.moduleFlags,
    });
  }

  function pathsForPreview() {
    var live = livePaths();
    if (!state.paths || !state.paths.length) return live;
    var allow = Object.create(null);
    live.forEach(function(p) { allow[p.path] = p; });
    var out = [];
    var used = Object.create(null);
    state.paths.forEach(function(p) {
      if (p && allow[p.path]) {
        out.push(p);
        used[p.path] = true;
      }
    });
    live.forEach(function(p) {
      if (!used[p.path]) out.push(p);
    });
    return out;
  }

  function previewValueMap(paths) {
    var map = {};
    var floor = samples.floors ? samples.floors[samples.activeFloor - 1] : null;
    paths.forEach(function(p) {
      if (!floor) {
        map[p.path] = p.sample || '—';
        return;
      }
      var v = readFloorValue(floor, p);
      map[p.path] = (v == null || v === '') ? '—' : String(v);
    });
    return map;
  }

  function renderPresets() {
    if (!presetGrid) return;
    presetGrid.innerHTML = '';
    STATUS_BAR_PRESETS.forEach(function(p) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-inline' + (p.id === state.presetId ? ' is-active' : '');
      btn.textContent = p.label;
      btn.addEventListener('click', function() {
        state.presetId = p.id;
        if (p.nsfw) {
          state.nsfw = true;
          if (nsfwEl) nsfwEl.checked = true;
        }
        state.moduleFlags = defaultModuleFlags(p.id, state.nsfw);
        renderPresets();
        renderModules();
        refreshPreview();
        saveDesignExt();
      });
      presetGrid.appendChild(btn);
    });
  }

  function renderModules() {
    if (!moduleGrid) return;
    moduleGrid.innerHTML = '';
    var flags = resolveModuleFlags(state.presetId, state.moduleFlags, state.nsfw);
    state.moduleFlags = flags;
    STATUS_BAR_MODULE_GROUPS.forEach(function(group) {
      var mods = STATUS_BAR_MODULES.filter(function(m) {
        if (m.group !== group.id) return false;
        if (m.nsfw && !state.nsfw) return false;
        return true;
      });
      if (!mods.length) return;
      var block = document.createElement('div');
      block.className = 'sb-module-group';
      var title = document.createElement('div');
      title.className = 'sb-k';
      title.textContent = group.label;
      var items = document.createElement('div');
      items.className = 'sb-module-group__items';
      mods.forEach(function(m) {
        var lab = document.createElement('label');
        lab.className = 'sb-check';
        lab.innerHTML = '<input type="checkbox" data-mod="' + m.id + '"'
          + (flags[m.id] ? ' checked' : '') + ' /><span>' + escHtml(m.label) + '</span>';
        lab.title = m.hint || '';
        lab.querySelector('input').addEventListener('change', function(e) {
          state.moduleFlags[m.id] = !!e.target.checked;
          refreshPreview();
        });
        items.appendChild(lab);
      });
      block.appendChild(title);
      block.appendChild(items);
      moduleGrid.appendChild(block);
    });
  }

  function renderCharList() {
    if (!charList) return;
    charList.innerHTML = '';
    var list = excludeCardNameFromCharacters(state.characters, currentCharName());
    state.characters = list;
    if (!list.length) {
      charList.innerHTML = '<p class="ui-hint">世界书暂无其他人物。可点「AI 识别」补充。</p>';
      return;
    }
    list.forEach(function(c, idx) {
      var lab = document.createElement('label');
      lab.className = 'sb-check';
      lab.innerHTML = '<input type="checkbox" data-ci="' + idx + '"'
        + (c.selected !== false ? ' checked' : '') + ' /><span>' + escHtml(c.name) + '</span>';
      charList.appendChild(lab);
    });
  }

  function rawPathValue(p) {
    var floor = samples.floors ? samples.floors[samples.activeFloor - 1] : null;
    if (!floor) return (p.sample != null && p.sample !== '') ? p.sample : '—';
    var v = readFloorValue(floor, p);
    return (v == null || v === '') ? '—' : v;
  }

  function isTreeNumber(value) {
    if (typeof value === 'number' && isFinite(value)) return true;
    return typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim());
  }

  function renderTreeValue(parent, key, value, pathKey, depth) {
    var branch = value && typeof value === 'object';
    if (!branch) {
      var row = document.createElement('div');
      row.className = 'sb-tree-row';
      var label = document.createElement('span');
      label.className = 'sb-tree-key';
      label.textContent = key;
      var sep = document.createElement('span');
      sep.className = 'sb-tree-sep';
      sep.textContent = ':';
      var text = document.createElement('span');
      text.className = isTreeNumber(value) ? 'sb-tree-num' : 'sb-tree-str';
      text.textContent = value == null ? '—' : String(value);
      row.appendChild(label);
      row.appendChild(sep);
      row.appendChild(text);
      parent.appendChild(row);
      return;
    }
    var node = document.createElement('details');
    node.className = 'sb-tree-node';
    if (treeOpen[pathKey] == null) treeOpen[pathKey] = depth < 1;
    node.open = !!treeOpen[pathKey];
    node.addEventListener('toggle', function() { treeOpen[pathKey] = node.open; });
    var sum = document.createElement('summary');
    var name = document.createElement('span');
    name.className = 'sb-tree-key';
    name.textContent = key;
    sum.appendChild(name);
    if (Array.isArray(value)) {
      var meta = document.createElement('span');
      meta.className = 'sb-tree-meta';
      meta.textContent = value.length + ' 项';
      sum.appendChild(meta);
    }
    node.appendChild(sum);
    var body = document.createElement('div');
    body.className = 'sb-tree-body';
    if (Array.isArray(value)) {
      value.forEach(function(item, index) {
        renderTreeValue(body, String(index), item, pathKey + '.' + index, depth + 1);
      });
    } else {
      Object.keys(value).forEach(function(child) {
        renderTreeValue(body, child, value[child], pathKey + '.' + child, depth + 1);
      });
    }
    node.appendChild(body);
    parent.appendChild(node);
  }

  function renderVarTree() {
    if (!varTree) return;
    var tree = buildVariableTree(pathsForPreview(), rawPathValue);
    varTree.textContent = '';
    var keys = Object.keys(tree);
    if (!keys.length) {
      var empty = document.createElement('p');
      empty.className = 'ui-hint';
      empty.textContent = '勾选主角或女角色并开启模块后，这里显示变量结构。';
      varTree.appendChild(empty);
      return;
    }
    keys.forEach(function(key) {
      renderTreeValue(varTree, key, tree[key], key, 0);
    });
  }

  function setStatusView(mode) {
    var sw = document.getElementById('sbViewSwitch');
    if (sw) sw.setAttribute('data-mode', mode);
    if (sw) {
      sw.querySelectorAll('[data-sb-view]').forEach(function(btn) {
        var on = btn.getAttribute('data-sb-view') === mode;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    }
    document.querySelectorAll('#statusbarPanel [data-sb-view-pane]').forEach(function(pane) {
      pane.hidden = pane.getAttribute('data-sb-view-pane') !== mode;
    });
  }

  function hintText() {
    var parts = [];
    if (state.includeProtagonist) parts.push('主角');
    if (state.includeFemales) parts.push('女角色');
    var who = parts.length ? ('已勾 ' + parts.join('、')) : '未勾选主角或女角色';
    var floor = samples.floors
      ? ('样例第 ' + samples.activeFloor + ' / 3 楼')
      : '尚无样例';
    return who + ' · ' + floor;
  }

  function refreshPreview() {
    readFormIntoState();
    refreshCharName();
    if (femaleOnlyBtn) femaleOnlyBtn.setAttribute('aria-pressed', state.femaleOnly !== false ? 'true' : 'false');
    var paths = pathsForPreview();
    var values = previewValueMap(paths);
    var body = state.customBodyHtml
      ? keepMarkupPaths(expandStatusBarTemplate(state.customBodyHtml, selectedFemaleNames()), paths)
      : '';
    var html = buildPreviewHtml({
      paths: paths,
      values: values,
      customCss: state.customCss,
      customBodyHtml: body,
    });
    if (previewFrame) previewFrame.srcdoc = html;
    var hint = document.getElementById('sbPreviewHint');
    if (hint) hint.textContent = hintText();
    var floorLabel = document.getElementById('sbFloorLabel');
    if (floorLabel) {
      floorLabel.textContent = samples.floors
        ? ('第 ' + samples.activeFloor + ' / 3 楼')
        : '尚无样例';
    }
    renderVarTree();
    if (snippetCode) {
      if (state.snippetHtml) {
        var rx = buildStatusBarRegex({ snippetHtml: state.snippetHtml, mode: 'mvu' });
        snippetCode.textContent = JSON.stringify({
          scriptName: rx.scriptName,
          findRegex: rx.findRegex,
          placement: rx.placement,
          replaceString: String(rx.replaceString || '').slice(0, 2400),
        }, null, 2);
      } else {
        snippetCode.textContent = '';
      }
    }
    syncStepMarks();
    syncGenerateLabel();
  }

  function saveDesignExt() {
    if (window.__setCardExtension__) {
      window.__setCardExtension__(STATUS_BAR_EXT_KEY, normalizeDesign(state));
    }
  }

  function paintFromState() {
    if (protagEl) protagEl.checked = !!state.includeProtagonist;
    if (femalesEl) femalesEl.checked = !!state.includeFemales;
    if (nsfwEl) nsfwEl.checked = !!state.nsfw;
    if (extraEl) extraEl.value = state.extra || '';
    if (layoutEl) layoutEl.value = state.layoutPrompt || '';
    if (femaleOnlyBtn) femaleOnlyBtn.setAttribute('aria-pressed', state.femaleOnly !== false ? 'true' : 'false');
    loadCharactersFromWorldbook();
    renderPresets();
    renderModules();
    renderCharList();
    refreshPreview();
  }

  function loadCharactersFromWorldbook() {
    var wb = window.__getWorldbookEntries__ ? window.__getWorldbookEntries__() : [];
    var prevSel = Object.create(null);
    (state.characters || []).forEach(function(c) {
      if (c && c.name) prevSel[c.name] = c.selected;
    });
    var aiOnly = (state.characters || []).filter(function(c) {
      return c && c.name && c.source && c.source !== 'worldbook';
    });
    state.characters = collectPersonCharactersFromWorldbook(wb, {
      excludeName: currentCharName(),
      merge: aiOnly,
    });
    state.characters.forEach(function(c) {
      if (c && c.name && prevSel[c.name] !== undefined) c.selected = prevSel[c.name];
    });
    state.characters = excludeCardNameFromCharacters(state.characters, currentCharName());
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
    var ps = window.__promptStore__;
    if (ps && ps.applyTemplate) return ps.applyTemplate(tpl, vars);
    return applyStatusBarPromptTemplate(tpl, vars);
  }

  function activePresetText() {
    var bridge = typeof window !== 'undefined' ? window.__getActivePresetsStr__ : null;
    if (typeof bridge !== 'function') return '';
    try { return String(bridge() || ''); } catch (e) { return ''; }
  }

  async function fetchJson(sys, user, signal) {
    var cfg = getAiConfig();
    var headers = { 'Content-Type': 'application/json' };
    if (cfg.key) headers.Authorization = 'Bearer ' + cfg.key;
    var res = await fetch(cfg.url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: 'system', content: appendStylePreset(sys, activePresetText()) },
          { role: 'user', content: user },
        ],
        temperature: 0.25,
      }),
      signal: signal,
    });
    if (!res.ok) throw new Error('API HTTP ' + res.status);
    var data = await res.json();
    var message = data && data.choices && data.choices[0] && data.choices[0].message;
    var text = message && message.content;
    if (!String(text == null ? '' : text).trim()) throw new Error('模型返回空内容');
    return extractJson(text);
  }

  function collectGreetingTexts() {
    var list = [];
    var main = String((document.getElementById('firstMes') || {}).value || '').trim();
    if (main) list.push({ label: '主开场', text: main });
    var alts = window.__altGreetings__;
    if (!Array.isArray(alts)) return list;
    alts.forEach(function(text, i) {
      var body = String(text || '').trim();
      if (!body) return;
      list.push({ label: '备选' + (i + 1), text: body });
    });
    return list;
  }

  function selectedFemaleNames() {
    return selectedFemales().map(function(c) { return String(c.name || '').trim(); }).filter(Boolean);
  }

  function fillCardSnapshot() {
    return {
      name: currentCharName(),
      desc: (document.getElementById('charDesc') || {}).value || '',
      creatorNotes: (document.getElementById('creatorNotes') || {}).value || '',
      greetings: collectGreetingTexts(),
    };
  }

  function fillUserForBatch(batch, card, worldbookEntries) {
    var profile = buildBatchProfileBlock(batch, card, worldbookEntries, state.characters);
    var fields = (batch.paths || []).map(function(p) {
      var leaf = String(p.path || '').split('.').pop();
      var note = leaf === '关系阶段' ? '（枚举，选项必须含未结识）' : (p.meter ? '（数字）' : '');
      return '- ' + leaf + note;
    }).join('\n');
    return profile
      + '\n\n【这一批要填的字段】\n' + (fields || '（无）')
      + '\n\n只输出 JSON：{"defaults":{"字段名":"短值"},"enums":{"关系阶段":["未结识"]}}。'
      + '不要输出 path、type、description、check。不认识的字段不要写。每个值不超过一句。';
  }

  function promptBundle() {
    readFormIntoState();
    var ps = window.__promptStore__;
    var mvuTpl = (ps && ps.get('statusBarMvuFill')) || STATUS_BAR_MVU_FILL_PROMPT;
    var layoutTpl = (ps && ps.get('statusBarLayoutShell')) || STATUS_BAR_LAYOUT_SHELL_PROMPT;
    var paths = pathsForPreview();
    var batches = planStatusBarBatches(paths);
    var card = fillCardSnapshot();
    var worldbookEntries = window.__getWorldbookEntries__ ? window.__getWorldbookEntries__() : [];
    var moduleBlock = describeEnabledModules(state.moduleFlags);
    var mvuVars = {
      moduleBlock: moduleBlock,
      forbiddenModuleBlock: describeForbiddenModules(state.moduleFlags, { nsfwEnabled: state.nsfw }),
      nsfw: state.nsfw ? '是' : '否',
      extra: state.extra || '无',
    };
    var layoutVars = {
      nsfw: state.nsfw ? '是' : '否',
      moduleBlock: moduleBlock,
      fieldBlock: describeLayoutFields(paths),
      userPrompt: state.layoutPrompt || '',
    };
    var sampleBatch = batches[0];
    return {
      mvuSys: applyTemplate(mvuTpl, mvuVars),
      mvuUser: sampleBatch
        ? fillUserForBatch(sampleBatch, card, worldbookEntries)
        : '没有可填的字段。',
      layoutSys: applyTemplate(layoutTpl, layoutVars),
      layoutUser: '请按排版风格说明输出 JSON。女角色只写一套 <template data-zb-repeat="npc">，路径用 NPC.{{name}}.字段。',
      mvuTpl: mvuTpl,
      layoutTpl: layoutTpl,
      mvuVars: mvuVars,
      layoutVars: layoutVars,
      paths: paths,
      batches: batches,
      card: card,
      worldbookEntries: worldbookEntries,
    };
  }

  function stripUnsafe(html) {
    return String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  }

  async function runInCenter(type, title, fn) {
    var center = window.__aiTaskCenter__;
    if (center && center.run) {
      return center.run({ type: type, title: title, target: currentCharName() }, fn);
    }
    return fn(null);
  }

  function reportError(err) {
    if (window.__isAiAbortError__ && window.__isAiAbortError__(err)) {
      toast('已取消', 'info');
      return;
    }
    toast((err && err.message) || String(err), 'error');
  }

  function gateDesign(opts) {
    readFormIntoState();
    return rejectStatusBarGenerate({
      includeProtagonist: state.includeProtagonist,
      includeFemales: state.includeFemales,
      characters: state.characters,
      charName: currentCharName(),
      moduleFlags: state.moduleFlags,
      layoutPrompt: state.layoutPrompt,
      paths: state.paths,
      customBodyHtml: state.customBodyHtml,
    }, opts);
  }

  function writeBoundSnippet() {
    if (!String(state.customCss || '').trim() || !String(state.customBodyHtml || '').trim()) return;
    var paths = state.paths || [];
    var body = keepMarkupPaths(expandStatusBarTemplate(state.customBodyHtml, selectedFemaleNames()), paths);
    state.mode = 'mvu';
    state.snippetHtml = buildStatusBarSnippet({
      paths: paths,
      customCss: state.customCss,
      customBodyHtml: body,
      mode: 'mvu',
    });
    if (!window.__injectMvuEntries__) throw new Error('无法写入正则脚本');
    var rx = buildStatusBarRegex({ snippetHtml: state.snippetHtml, mode: 'mvu' });
    window.__injectMvuEntries__([], [rx]);
  }

  async function generateVariables() {
    var reason = gateDesign({ requireLayout: false });
    if (reason) {
      toast(reason, 'warn');
      return;
    }
    var gate = engineTryAllowed('card.statusbar.generate');
    if (!gate.ok) return;
    var bundle = promptBundle();
    if (!bundle.batches.length) {
      toast('请至少开启一个模块', 'warn');
      return;
    }
    try {
      await runInCenter('statusbar_generate', '状态栏变量', async function(task) {
        var signal = task && task.signal;
        var design = await fillStatusBarVariables({
          batches: bundle.batches,
          signal: signal,
          onProgress: function(progress, text) {
            var center = window.__aiTaskCenter__;
            if (center && task) center.setProgress(task.id, progress, text);
          },
          fetchBatch: function(batch) {
            return fetchJson(
              bundle.mvuSys,
              fillUserForBatch(batch, bundle.card, bundle.worldbookEntries),
              signal
            );
          },
        });
        if (!design.variables.length) throw new Error('没有可写入的变量');
        design.source = 'statusbar';
        if (!window.__assistantMvuApi__ || !window.__assistantMvuApi__.upsertVariables) {
          throw new Error('MVU 注入 API 不可用');
        }
        window.__assistantMvuApi__.upsertVariables({ design: design, inject: true });
        state.paths = pathsFromMvuDesign(design, { charName: currentCharName() });
        clearSamples();
        if (String(state.customBodyHtml || '').trim()) writeBoundSnippet();
        saveDesignExt();
      });
      refreshPreview();
      if (window.triggerGlobalUpdate) window.triggerGlobalUpdate();
      toast('已生成变量', 'success');
    } catch (err) {
      reportError(err);
    }
  }

  async function generateLayout(revise) {
    var reason = gateDesign(revise
      ? { requirePaths: true, requireMarkup: true }
      : { requirePaths: true });
    if (reason) {
      toast(reason, 'warn');
      return;
    }
    var gate = engineTryAllowed('card.statusbar.layout');
    if (!gate.ok) return;
    var bundle = promptBundle();
    var user = bundle.layoutUser;
    if (revise) {
      var source = layoutReviseSource(state.customBodyHtml, selectedFemaleNames());
      user = '在现有排版上修改，不要另起一套。保留没要求改的结构。补上字段清单里还没有的字段，去掉已关闭的字段。\n'
        + '女角色只保留一套 <template data-zb-repeat="npc">，路径用 NPC.{{name}}.字段，不要把每个人展开。\n'
        + '姓名：' + (source.names.join('、') || '（无）') + '\n\n'
        + '【当前 CSS】\n' + String(state.customCss || '')
        + '\n\n【当前 HTML】\n' + source.html
        + '\n\n请输出 JSON。只用 data-zb-path 与 data-zb-meter。';
    }
    try {
      await runInCenter('statusbar_custom_layout', revise ? '状态栏排版修改' : '状态栏排版', async function(task) {
        var signal = task && task.signal;
        var layout = await fetchJson(bundle.layoutSys, user, signal);
        var css = stripUnsafe(String(layout.css || '').trim());
        var bodyHtml = stripUnsafe(String(layout.bodyHtml || layout.html || '').trim());
        if (!css || !bodyHtml) throw new Error('排版未生成');
        state.customCss = css;
        state.customBodyHtml = bodyHtml;
        writeBoundSnippet();
        saveDesignExt();
      });
      refreshPreview();
      if (window.triggerGlobalUpdate) window.triggerGlobalUpdate();
      toast(revise ? '已按现有排版修改' : '已重新生成排版', 'success');
    } catch (err) {
      reportError(err);
    }
  }

  function buildWbBlock() {
    var wb = window.__getWorldbookEntries__ ? window.__getWorldbookEntries__() : [];
    return (wb || []).map(function(e, i) {
      var title = e.comment || e.name || '?';
      return (i + 1) + '. 「' + title + '」\n' + String(e.content || '');
    }).join('\n\n') || '（世界书为空）';
  }

  async function scanCharacters() {
    readFormIntoState();
    var gate = engineTryAllowed('card.statusbar.charScan');
    if (!gate.ok) return;
    var ps = window.__promptStore__;
    var tpl = (ps && ps.get('statusBarCharScan')) || STATUS_BAR_CHAR_SCAN_PROMPT;
    var sys = applyTemplate(tpl, {
      wbBlock: buildWbBlock(),
      charName: currentCharName() || '未知',
      femaleOnlyRule: describeFemaleOnlyRule(state.femaleOnly !== false),
    });
    try {
      var data = await runInCenter('statusbar_char_scan', '状态栏人物识别', function(task) {
        return fetchJson(sys, '请输出人物 JSON。不要包含当前卡角色本人。', task && task.signal);
      });
      var cardName = currentCharName();
      var list = (Array.isArray(data.characters) ? data.characters : []).map(function(raw) {
        return normalizeCastCharacter(Object.assign({}, raw, { selected: true, source: 'ai' }));
      }).filter(function(c) { return c && c.name !== cardName; });
      var seen = Object.create(null);
      state.characters.forEach(function(c) { if (c && c.name) seen[c.name] = c; });
      list.forEach(function(c) {
        if (seen[c.name]) seen[c.name].selected = true;
        else state.characters.push(c);
      });
      state.characters = excludeCardNameFromCharacters(state.characters, cardName);
      renderCharList();
      saveDesignExt();
      refreshPreview();
    } catch (err) {
      reportError(err);
    }
  }

  async function generateSampleFloors() {
    readFormIntoState();
    var reason = rejectStatusBarGenerate({
      includeProtagonist: state.includeProtagonist,
      includeFemales: state.includeFemales,
      characters: state.characters,
      charName: currentCharName(),
      moduleFlags: state.moduleFlags,
      layoutPrompt: state.layoutPrompt || '样例',
    });
    if (!state.includeProtagonist && !state.includeFemales) {
      toast('请勾选主角或女角色', 'warn');
      return;
    }
    if (reason === '请至少开启一个模块') {
      toast(reason, 'warn');
      return;
    }
    var gate = engineTryAllowed('card.statusbar.sampleFloors');
    if (!gate.ok) return;
    var checked = validateSampleFloors(buildLocalSampleFloors(pathsForPreview()));
    if (!checked.ok) {
      toast('样例楼层无效', 'error');
      return;
    }
    samples.floors = checked.floors;
    samples.activeFloor = 1;
    floorToastSent = false;
    refreshPreview();
    toast('已生成本地样例', 'success');
  }

  function shiftFloor(delta) {
    if (!samples.floors) {
      if (!floorToastSent) {
        floorToastSent = true;
        toast('尚无样例', 'info');
      }
      return;
    }
    var next = samples.activeFloor + delta;
    if (next < 1) next = 1;
    if (next > 3) next = 3;
    samples.activeFloor = next;
    refreshPreview();
  }

  function openPromptPreview() {
    try {
      var bundle = promptBundle();
      var presetsStr = activePresetText();
      var mvu = composeStatusBarPromptPreview({
        dialogTitle: '状态栏 · 生成提示词',
        promptId: 'statusBarMvuFill',
        taskType: 'statusbar_generate',
        metaLines: ['预设：' + getPresetById(state.presetId).label],
        systemTpl: bundle.mvuTpl,
        vars: bundle.mvuVars,
        userMessage: bundle.mvuUser,
        presetsStr: presetsStr,
        applyTemplate: applyTemplate,
      });
      var layout = composeStatusBarPromptPreview({
        dialogTitle: '状态栏 · 排版提示词',
        promptId: 'statusBarLayoutShell',
        taskType: 'statusbar_custom_layout',
        systemTpl: bundle.layoutTpl,
        vars: bundle.layoutVars,
        userMessage: bundle.layoutUser,
        presetsStr: presetsStr,
        applyTemplate: applyTemplate,
      });
      openTextPreview({
        title: '状态栏 · 查看提示词',
        text: formatStatusBarPromptSections([
          { title: '变量填值', body: mvu.text },
          { title: '排版', body: layout.text },
        ]),
      });
    } catch (err) {
      toast((err && err.message) || String(err), 'error');
    }
  }

  function applyDesignToPanel() {
    var raw = window.__getCardExtension__ ? window.__getCardExtension__(STATUS_BAR_EXT_KEY) : null;
    if (!raw) return false;
    state = reconcileDesignWithCharName(normalizeDesign(raw), currentCharName());
    paintFromState();
    return true;
  }

  if (protagEl) protagEl.addEventListener('change', function() { refreshPreview(); saveDesignExt(); });
  if (femalesEl) femalesEl.addEventListener('change', function() { refreshPreview(); saveDesignExt(); });
  if (nsfwEl) nsfwEl.addEventListener('change', function() {
    state.nsfw = !!nsfwEl.checked;
    state.moduleFlags = resolveModuleFlags(state.presetId, state.moduleFlags, state.nsfw);
    renderModules();
    refreshPreview();
  });
  if (femaleOnlyBtn) {
    femaleOnlyBtn.addEventListener('click', function() {
      state.femaleOnly = femaleOnlyBtn.getAttribute('aria-pressed') !== 'true';
      femaleOnlyBtn.setAttribute('aria-pressed', state.femaleOnly ? 'true' : 'false');
      saveDesignExt();
    });
  }
  if (charList) {
    charList.addEventListener('change', function(e) {
      var inp = e.target;
      if (!inp || !inp.hasAttribute('data-ci')) return;
      var c = state.characters[Number(inp.getAttribute('data-ci'))];
      if (c) c.selected = !!inp.checked;
      refreshPreview();
      saveDesignExt();
    });
  }
  var resetBtn = document.getElementById('sbBtnResetModules');
  if (resetBtn) {
    resetBtn.addEventListener('click', function() {
      state.moduleFlags = defaultModuleFlags(state.presetId, state.nsfw);
      renderModules();
      refreshPreview();
      saveDesignExt();
    });
  }
  if (extraEl) extraEl.addEventListener('input', function() { state.extra = extraEl.value.trim(); });
  if (layoutEl) layoutEl.addEventListener('input', function() {
    state.layoutPrompt = layoutEl.value.trim();
    syncStepMarks();
  });
  var scanBtn = document.getElementById('sbBtnScanChars');
  if (scanBtn) scanBtn.addEventListener('click', function() { scanCharacters(); });
  var previewBtn = document.getElementById('sbBtnPreviewPrompt');
  if (previewBtn) previewBtn.addEventListener('click', openPromptPreview);
  if (varsBtn) varsBtn.addEventListener('click', function() { generateVariables(); });
  if (layoutRegenBtn) layoutRegenBtn.addEventListener('click', function() { generateLayout(false); });
  if (layoutReviseBtn) layoutReviseBtn.addEventListener('click', function() { generateLayout(true); });
  var sampleBtn = document.getElementById('sbBtnSampleFloors');
  if (sampleBtn) sampleBtn.addEventListener('click', function() { generateSampleFloors(); });
  var prevFloor = document.getElementById('sbFloorPrev');
  var nextFloor = document.getElementById('sbFloorNext');
  if (prevFloor) prevFloor.addEventListener('click', function() { shiftFloor(-1); });
  if (nextFloor) nextFloor.addEventListener('click', function() { shiftFloor(1); });
  var viewSwitch = document.getElementById('sbViewSwitch');
  if (viewSwitch) {
    viewSwitch.addEventListener('click', function(ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('[data-sb-view]') : null;
      if (!btn) return;
      setStatusView(btn.getAttribute('data-sb-view'));
    });
  }

  var charNameEl = document.getElementById('charName');
  if (charNameEl) {
    charNameEl.addEventListener('input', function() {
      state = reconcileDesignWithCharName(state, currentCharName());
      loadCharactersFromWorldbook();
      renderCharList();
      refreshPreview();
    });
  }

  paintFromState();
  applyDesignToPanel();

  window.addEventListener('card-builder-data-changed', function onReady() {
    if (applyDesignToPanel()) window.removeEventListener('card-builder-data-changed', onReady);
  });
  window.addEventListener('card-draft-changed', function(ev) {
    var id = ev && ev.detail && ev.detail.cardId ? String(ev.detail.cardId) : '';
    if (id && id === boundCardId) return;
    boundCardId = id;
    clearSamples();
    applyDesignToPanel();
  });
  window.addEventListener('app-view-changed', function(ev) {
    var view = ev && ev.detail && ev.detail.view;
    if (view !== 'statusbar') return;
    loadCharactersFromWorldbook();
    renderCharList();
    refreshPreview();
  });

  var host = document.getElementById('statusbarPanel');
  if (host) {
    host.addEventListener('change', function() { saveDesignExt(); });
  }

  window.__statusBarApi__ = {
    getDesign: function() { return normalizeDesign(state); },
    setDesign: function(d) {
      state = reconcileDesignWithCharName(normalizeDesign(d), currentCharName());
      clearSamples();
      saveDesignExt();
      paintFromState();
      return state;
    },
  };
}
