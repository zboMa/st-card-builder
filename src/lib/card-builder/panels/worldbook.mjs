/**
 * 世界书面板 — 提取自 index.astro lines 2195–3342
 * 注册为 ctx.panels.worldbook；在 bind() 中挂载 DOM 事件与 window.__assistantWbAi__
 */
import { getDefaultWBEntry, normalizeWBEntry, clampInt } from '../state.mjs';
import { strategyLabelZh } from '../../utils.mjs';
import { buildWorldviewHint } from '../../presets/worldviews/index.mjs';

export function registerWorldbook(ctx) {
  var escapeHtml = ctx.escapeHtml;
  var entriesList, btnCreateEntry;

  // ============================================================
  //  本地可变状态
  // ============================================================
  var editingIndex = -1;
  var isCreatingEntry = false;
  var pendingOrganizeData = null;
  var cachedSearchResults = null;
  var KEYGEN_BATCH_CHAR_LIMIT = 20000;
  var KEYGEN_BATCH_ITEM_LIMIT = 8;
  var KEYGEN_MAX_RETRY_ROUNDS = 3;

  function getWorldviewHintBlock() {
    var id = '';
    if (ctx.panels.aiEngine && typeof ctx.panels.aiEngine.getWorldviewPresetId === 'function') {
      id = ctx.panels.aiEngine.getWorldviewPresetId() || '';
    } else {
      var el = ctx.$('aiWorldviewPreset');
      if (el) id = String(el.value || '').trim();
    }
    return buildWorldviewHint(id, { stage: 'worldbook' }) || '';
  }

  // ============================================================
  //  工具函数
  // ============================================================
  function truncatePreviewLine(text, maxLen) {
    var cap = maxLen || 100;
    var one = String(text || '').replace(/\s+/g, ' ').trim();
    if (!one) return '';
    return one.length > cap ? one.slice(0, cap) + '\u2026' : one;
  }

  function setStatusBar(el, text, color) {
    if (!el) return;
    if (!text) {
      el.style.display = 'none';
      el.textContent = '';
      return;
    }
    el.style.display = 'flex';
    el.innerHTML = text;
    if (color) el.style.color = color;
  }

  // ============================================================
  //  弹窗管理
  // ============================================================
  var WB_MODAL_IDS = ['wbModalSingle', 'wbModalOrganize', 'wbModalKeygen', 'wbModalEdit'];

  function openWbModal(id) {
    var el = ctx.$(id);
    if (!el) return;
    if (!el._wbModalHome) el._wbModalHome = el.parentNode;
    document.body.appendChild(el);
    el.hidden = false;
    el.setAttribute('aria-hidden', 'false');
    document.body.classList.add('wb-modal-open');
  }

  function closeWbModal(id) {
    var el = ctx.$(id);
    if (!el) return;
    el.hidden = true;
    el.setAttribute('aria-hidden', 'true');
    if (el._wbModalHome && el.parentNode !== el._wbModalHome) {
      el._wbModalHome.appendChild(el);
    }
    if (id === 'wbModalEdit') {
      editingIndex = -1;
      isCreatingEntry = false;
      updateCreateEntryButtonState();
    }
    var anyOpen = WB_MODAL_IDS.some(function(mid) {
      var m = ctx.$(mid);
      return m && !m.hidden;
    });
    if (!anyOpen) document.body.classList.remove('wb-modal-open');
  }

  // ============================================================
  //  编辑器表单渲染 / 读写
  // ============================================================
  function renderSelectOptions(options, selectedValue) {
    var selected = String(selectedValue);
    var html = '';
    options.forEach(function(option) {
      html += '<option value="' + escapeHtml(option.value) + '"' + (selected === String(option.value) ? ' selected' : '') + '>' + escapeHtml(option.label) + '</option>';
    });
    return html;
  }

  function strategyTagClass(strategy) {
    if (strategy === 'constant') return 'is-constant';
    if (strategy === 'vectorized') return 'is-vectorized';
    return 'is-selective';
  }

  function renderStrategyTag(strategy) {
    var s = strategy || 'selective';
    return '<span class="wb-strategy-tag ' + strategyTagClass(s) + '">'
      + '<span class="wb-strategy-dot" aria-hidden="true"></span>'
      + escapeHtml(strategyLabelZh(s))
      + '</span>';
  }

  function renderWbEditorFields(index, entry, isNew) {
    entry = normalizeWBEntry(entry);
    var editorId = isNew ? 'wb_editor_new' : 'wb_editor_' + index;
    var strategyOptions = renderSelectOptions([
      { value: 'constant', label: '\u5E38\u9A7B' },
      { value: 'selective', label: '\u53EF\u9009' },
      { value: 'vectorized', label: '\u5411\u91CF\u5316' },
    ], entry.strategy);
    var positionOptions = renderSelectOptions([
      { value: '0', label: '0 \u2014 \u89D2\u8272\u5B9A\u4E49\u4E4B\u524D' },
      { value: '1', label: '1 \u2014 \u89D2\u8272\u5B9A\u4E49\u4E4B\u540E' },
      { value: '2', label: '2 \u2014 \u793A\u4F8B\u6D88\u606F\u4E4B\u524D' },
      { value: '3', label: '3 \u2014 \u793A\u4F8B\u6D88\u606F\u4E4B\u540E' },
      { value: '4', label: '4 \u2014 \u6309\u6DF1\u5EA6\u63D2\u5165' },
      { value: '5', label: '5 \u2014 \u4F5C\u8005\u6CE8\u91CA\u4E4B\u524D' },
      { value: '6', label: '6 \u2014 \u4F5C\u8005\u6CE8\u91CA\u4E4B\u540E' },
    ], entry.position);
    var roleOptions = renderSelectOptions([
      { value: '0', label: '\u7CFB\u7EDF' },
      { value: '1', label: '\u7528\u6237' },
      { value: '2', label: '\u52A9\u624B' },
    ], entry.role);
    return ''
      + '<div class="wb-inline-editor" id="' + editorId + '" data-editor-index="' + index + '">'
      +   '<div class="form-group">'
      +     '<label>\u6761\u76EE\u6807\u9898</label>'
      +     '<input type="text" data-field="comment" placeholder="\u4F8B\u5982\uFF1A===\u7279\u6B8A\u6B66\u5668===" value="' + escapeHtml(entry.comment) + '" />'
      +   '</div>'
      +   '<div class="form-group">'
      +     '<label>\u8BBE\u5B9A\u5185\u5BB9</label>'
      +     '<textarea data-field="content" placeholder="\u5177\u4F53\u8BBE\u5B9A\u8BE6\u60C5...">' + escapeHtml(entry.content) + '</textarea>'
      +   '</div>'
      +   '<div class="form-group">'
      +     '<label>\u89E6\u53D1\u8BCD \u2014 \u591A\u4E2A\u7528\u82F1\u6587\u9017\u53F7\u9694\u5F00</label>'
      +     '<input type="text" data-field="keys" placeholder="\u7A7A\u4E3A\u5E38\u9A7B\uFF0C\u6709\u8BCD\u4E3A\u89E6\u53D1" value="' + escapeHtml((entry.keys || []).join(', ')) + '" />'
      +   '</div>'
      +   '<div class="grid-2">'
      +     '<div class="form-group">'
      +       '<label>\u89E6\u53D1\u7B56\u7565</label>'
      +       '<select data-field="strategy">' + strategyOptions + '</select>'
      +     '</div>'
      +     '<div class="form-group">'
      +       '<label>\u63D2\u5165\u4F4D\u7F6E</label>'
      +       '<select data-field="position">' + positionOptions + '</select>'
      +     '</div>'
      +   '</div>'
      +   '<div class="grid-3">'
      +     '<div class="form-group">'
      +       '<label>\u6DF1\u5EA6</label>'
      +       '<input type="number" data-field="depth" value="' + escapeHtml(entry.depth) + '" min="0" />'
      +     '</div>'
      +     '<div class="form-group">'
      +       '<label>\u89D2\u8272</label>'
      +       '<select data-field="role">' + roleOptions + '</select>'
      +     '</div>'
      +     '<div class="form-group">'
      +       '<label>\u987A\u5E8F</label>'
      +       '<input type="number" data-field="order" value="' + escapeHtml(entry.order) + '" />'
      +     '</div>'
      +   '</div>'
      +   '<div class="form-group">'
      +     '<label>\u6982\u7387 (%)</label>'
      +     '<input type="number" data-field="prob" value="' + escapeHtml(entry.prob) + '" min="1" max="100" />'
      +   '</div>'
      + '</div>';
  }

  function getInlineEditorRoot(index) {
    return document.getElementById(index < 0 ? 'wb_editor_new' : 'wb_editor_' + index);
  }

  function readInlineEditorValue(root, field) {
    var el = root ? root.querySelector('[data-field="' + field + '"]') : null;
    return el ? el.value : '';
  }

  function readInlineEditorEntry(root) {
    var base = getDefaultWBEntry();
    return {
      comment: readInlineEditorValue(root, 'comment').trim(),
      content: readInlineEditorValue(root, 'content').trim(),
      keys: readInlineEditorValue(root, 'keys').split(/[,，]/).map(function(k) { return k.trim(); }).filter(function(k) { return k; }),
      strategy: readInlineEditorValue(root, 'strategy') || base.strategy,
      position: clampInt(readInlineEditorValue(root, 'position'), base.position, 0, 6),
      depth: clampInt(readInlineEditorValue(root, 'depth'), base.depth, 0, 999),
      role: clampInt(readInlineEditorValue(root, 'role'), base.role, 0, 2),
      order: clampInt(readInlineEditorValue(root, 'order'), base.order, 0, 999),
      prob: clampInt(readInlineEditorValue(root, 'prob'), base.prob, 1, 100),
    };
  }

  function focusWbModalEditor() {
    setTimeout(function() {
      var body = ctx.$('wbModalEditBody');
      if (!body) return;
      var target = body.querySelector('[data-field="comment"]');
      if (target) target.focus();
    }, 0);
  }

  function openWbEditModal(index, entry, isNew) {
    var titleEl = ctx.$('wbModalEditTitle');
    var tipEl = ctx.$('wbModalEditTip');
    var bodyEl = ctx.$('wbModalEditBody');
    var saveBtn = ctx.$('btnWbModalSave');
    if (!bodyEl) return;
    if (titleEl) titleEl.textContent = isNew ? '\u65B0\u5EFA\u4E16\u754C\u4E66\u6761\u76EE' : '\u7F16\u8F91\u4E16\u754C\u4E66\u6761\u76EE';
    if (tipEl) tipEl.textContent = isNew
      ? '\u624B\u52A8\u5F55\u5165\u4F1A\u63D2\u5165\u5230\u6761\u76EE\u5217\u8868 \u00B7 Esc / \u906E\u7F69\u5173\u95ED'
      : '\u4FDD\u5B58\u540E\u8986\u76D6\u672C\u6761 \u00B7 Esc / \u906E\u7F69\u5173\u95ED';
    if (saveBtn) saveBtn.textContent = isNew ? '\u4FDD\u5B58\u65B0\u6761\u76EE' : '\u4FDD\u5B58\u4FEE\u6539';
    bodyEl.innerHTML = renderWbEditorFields(index, entry, isNew);
    openWbModal('wbModalEdit');
    focusWbModalEditor();
  }

  // ============================================================
  //  条目 CRUD 辅助
  // ============================================================
  function updateCreateEntryButtonState() {
    if (!btnCreateEntry) return;
    btnCreateEntry.textContent = isCreatingEntry ? '\u53D6\u6D88\u65B0\u5EFA' : '\u65B0\u5EFA';
  }

  function resetWBForm() {
    editingIndex = -1;
    isCreatingEntry = false;
    updateCreateEntryButtonState();
  }

  function toggleCreateEntryForm() {
    if (isCreatingEntry) {
      closeWbModal('wbModalEdit');
      return;
    }
    editingIndex = -1;
    isCreatingEntry = true;
    updateCreateEntryButtonState();
    openWbEditModal(-1, getDefaultWBEntry(), true);
  }

  function editEntry(index) {
    if (editingIndex === index && !isCreatingEntry) {
      closeWbModal('wbModalEdit');
      return;
    }
    editingIndex = index;
    isCreatingEntry = false;
    updateCreateEntryButtonState();
    openWbEditModal(index, ctx.state.worldbookEntries[index] || getDefaultWBEntry(), false);
  }

  function cancelInlineEdit() {
    closeWbModal('wbModalEdit');
  }

  function saveInlineEntry(index) {
    var editorRoot = getInlineEditorRoot(index);
    if (!editorRoot) return;
    var nextEntry = readInlineEditorEntry(editorRoot);
    if (!nextEntry.content.trim()) return alert('\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A\uFF01');
    if (index >= 0) ctx.state.worldbookEntries[index] = nextEntry;
    else ctx.state.worldbookEntries.push(nextEntry);
    closeWbModal('wbModalEdit');
    renderEntriesList();
    ctx.save();
  }

  // ============================================================
  //  NSFW / NTL 提示构建
  // ============================================================
  function buildNsfwFlavorHint() {
    if (typeof window.__buildAdultPromptHints__ === 'function') {
      var hints = window.__buildAdultPromptHints__() || {};
      return hints.nsfw || '';
    }
    var data = window.__nsfwFlavorData__;
    if (!ctx.state.nsfwEnabled || !data) return '';
    var items = Array.isArray(ctx.state.nsfwFlavorItems) ? ctx.state.nsfwFlavorItems : [];
    if (!items.length && ctx.state.nsfwFlavor) items = [{ id: ctx.state.nsfwFlavor, note: '' }];
    if (!items.length) return '';
    if (typeof data.buildHintFromItems === 'function') {
      return data.buildHintFromItems(items);
    }
    return '';
  }

  function buildNtlHintForPrompt() {
    if (typeof window.__buildAdultPromptHints__ === 'function') {
      var hints = window.__buildAdultPromptHints__() || {};
      return hints.ntl || '';
    }
    var data = window.__nsfwFlavorData__;
    if (!ctx.state.ntlEnabled || !data) return '';
    var items = Array.isArray(ctx.state.ntlTabooItems) && ctx.state.ntlTabooItems.length
      ? ctx.state.ntlTabooItems
      : (ctx.state.ntlTabooTypes || []).map(function(id) { return { id: id, note: '' }; });
    if (!items.length) return '';
    if (typeof data.buildNtlHintFromTypes === 'function') {
      return data.buildNtlHintFromTypes(items, { tabooTypes: data.tabooTypes });
    }
    var lines = ['\n\u3010NTL \u7981\u5FCC\u65B9\u5411\u3011'];
    items.forEach(function(it) {
      var id = it && it.id ? it.id : it;
      var info = data.tabooTypes[id];
      if (info) {
        lines.push('- ' + info.label + '\uFF1A' + info.description
          + (it && it.note ? '\uFF1B\u7528\u6237\u8865\u5145\uFF1A' + it.note : ''));
      }
    });
    return lines.join('\n');
  }

  function buildAdultCanonHint() {
    if (typeof window.__buildAdultPromptHints__ === 'function') {
      var hints = window.__buildAdultPromptHints__() || {};
      return hints.canon || '';
    }
    return '';
  }

  // ============================================================
  //  预设 / 联网搜索
  // ============================================================
  function getActivePresetsStr() {
    var list = window.__parsedPresetList__ || [];
    return list.filter(function(p) { return p.enabled; })
      .map(function(p) { return '[\u89C4\u5219: ' + p.name + ']\n' + p.content; }).join('\n\n');
  }

  function buildAINativeSearchPrompt(query) {
    var ps = window.__promptStore__;
    if (!ps) return '';
    var text = ps.get('aiNativeSearch') || '';
    if (text && ps.applyTemplate) {
      return ps.applyTemplate(text, { query: query });
    }
    return text;
  }

  async function performSearchIfEnabled(userQuery) {
    var sc = window.__searchConfig__;
    if (!sc || !sc.isEnabled()) return { searchText: '', searchResults: null, mode: 'off' };
    var engine = sc.getEngine();
    var customQuery = sc.getCustomQuery();
    var query = customQuery || userQuery;
    var count = sc.getResultCount();
    var lang = sc.getLang();
    if (engine !== 'none') {
      try {
        var results = await sc.executeSearch(query, count, lang);
        if (results && results.length > 0) {
          cachedSearchResults = results;
          return { searchText: sc.formatForPrompt(results), searchResults: results, mode: 'engine' };
        }
      } catch (err) {
        return { searchText: buildAINativeSearchPrompt(query), searchResults: null, mode: 'ai_fallback', error: err.message };
      }
    }
    return { searchText: buildAINativeSearchPrompt(query), searchResults: null, mode: 'ai_native' };
  }

  // ============================================================
  //  AI 单条生成（供 UI 按钮 + 助手复用）
  // ============================================================
  async function generateContextAwareWBEntry(customDirection, stepInfo, signal) {
    if (!stepInfo) stepInfo = '';
    var url = String(ctx.$('apiUrl').value).replace(/\/$/, '') + '/chat/completions';
    var key = ctx.val('apiKey');
    var model = ctx.val('modelSelect');
    var searchInjection = '';
    if (window.__searchConfig__ && window.__searchConfig__.isEnabled()) {
      var sq = customDirection || ctx.val('charName') + ' ' + ctx.val('charDesc').substring(0, 100);
      var sr = await performSearchIfEnabled(sq);
      searchInjection = sr.searchText || '';
    }
    var wbIncludeOtherEntries = ctx.$('wbIncludeOtherEntries');
    var includeOthers = !wbIncludeOtherEntries || wbIncludeOtherEntries.checked;
    var existingCtx = includeOthers
      ? ctx.state.worldbookEntries.map(function(e) { return '[\u6807\u9898:' + e.comment + '] (\u7B56\u7565:' + e.strategy + '): ' + e.content; }).join('\n-----\n')
      : '';
    var ctxStr = includeOthers
      ? (existingCtx ? '\n\u3010\u5DF2\u6709\u8BBE\u5B9A(\u4E0D\u53EF\u91CD\u590D)\u3011\uFF1A\n' + existingCtx : '\n\u3010\u5F53\u524D\u4E16\u754C\u4E66\u4E3A\u7A7A\u3011')
      : '\n\u3010\u5DF2\u8DF3\u8FC7\u878D\u5408\u5DF2\u6709\u4E16\u754C\u4E66\u6761\u76EE\u3011';
    var presetsStr = getActivePresetsStr();
    var presetBlock = presetsStr ? '\n\n\u3010\u6587\u98CE\u7EA6\u675F\u3011\uFF1A\n' + presetsStr : '';
    var wbIncludeCharData = ctx.$('wbIncludeCharData');
    var includeChar = wbIncludeCharData && wbIncludeCharData.checked;
    var charBlock = includeChar
      ? '\n【高级·主角背景参考】：' + ctx.val('charName') + ' | ' + String(ctx.val('charDesc') || '').slice(0, 2000) + '\n'
      : '\n【管道】世界书与主角角色设定分离；默认不读取主角 Description。\n';
    var adultHints = (typeof window.__buildAdultPromptHints__ === 'function')
      ? (window.__buildAdultPromptHints__() || {})
      : {};
    var wvHint = getWorldviewHintBlock();
    var sysPrompt = ctx.promptText('wbSingle', '') + stepInfo + charBlock + '\n' + ctxStr + '\n' + presetBlock
      + buildNsfwFlavorHint() + buildNtlHintForPrompt()
      + (adultHints.vessel || '') + buildAdultCanonHint()
      + (wvHint || '')
      + '\n【冲突处理】若「用户额外要求」与「世界观预设」冲突，以用户额外要求为准。'
      + searchInjection
      + '\n\u3010\u8F93\u51FA\u3011\uFF1A1\u4E2AJSON\u5BF9\u8C61 { "comment": "\u6807\u9898", "content": "\u8BE6\u7EC6\u8BBE\u5B9A(\u81F3\u5C11100\u5B57)", "keys": ["\u89E6\u53D1\u8BCD"], "strategy": "selective \u6216 constant", "position": 4 }';
    var userPrompt = customDirection ? '\u3010\u65B9\u5411\u00B7\u4F18\u5148\u3011\uFF1A' + customDirection : '\u3010\u81EA\u7531\u53D1\u6325\uFF0C\u62D2\u7EDD\u91CD\u590D\uFF1B\u6709\u4E16\u754C\u89C2\u9884\u8BBE\u5219\u7D27\u8D34\u8BED\u6C47\u3011';
    var headers = { 'Content-Type': 'application/json' };
    if (key) headers['Authorization'] = 'Bearer ' + key;
    var aiResp = await ctx.fetchAIContent({
      context: '\u4E16\u754C\u4E66\u5355\u6761\u751F\u6210',
      url: url,
      headers: headers,
      model: model,
      messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: userPrompt }],
      temperature: 0.8,
      httpErrorPrefix: '\u8BF7\u6C42\u5931\u8D25 HTTP ',
      signal: signal,
    });
    var entry = ctx.extractJsonObj(aiResp.content, '\u4E16\u754C\u4E66\u5355\u6761\u751F\u6210');
    ctx.state.worldbookEntries.push({
      comment: entry.comment || '\u62D3\u5C55\u8BBE\u5B9A',
      content: entry.content || '',
      keys: Array.isArray(entry.keys) ? entry.keys : [],
      strategy: entry.strategy || 'selective',
      position: parseInt(entry.position) || 4,
      depth: 4,
      role: 0,
      order: 100,
      prob: 100,
    });
  }

  // ============================================================
  //  AI 重写 / 扩写
  // ============================================================
  async function aiRewriteEntry(index, req, btn) {
    var url = String(ctx.$('apiUrl').value).replace(/\/$/, '') + '/chat/completions';
    var key = ctx.val('apiKey');
    var model = ctx.val('modelSelect');
    if (!model) {
      alert('\u8BF7\u5148\u9009\u62E9\u6A21\u578B\uFF01');
      throw new Error('\u8BF7\u5148\u9009\u62E9\u6A21\u578B');
    }
    var old = ctx.state.worldbookEntries[index];
    var oldText = btn && btn.textContent;
    if (btn) { btn.disabled = true; btn.textContent = '\u23F3 \u91CD\u94F8\u4E2D...'; }
    var isSkeleton = old.content.length < 60;
    var taskType = isSkeleton ? 'wb_expand' : 'wb_rewrite';
    try {
      await ctx.runTracked({
        type: taskType,
        title: isSkeleton ? '\u4E16\u754C\u4E66\u6269\u5199' : '\u4E16\u754C\u4E66\u91CD\u5199',
        target: old.comment || ('#' + index),
      }, async function(task) {
        var presetsStr = getActivePresetsStr();
        var expandHint = isSkeleton ? '\n\n\u3010\u91CD\u8981\u3011\uFF1A\u539F\u6761\u76EE\u662F\u9AA8\u67B6\u6982\u8981\uFF0C\u8BF7\u5C55\u5F00\u4E3A\u5B8C\u6574\u8BE6\u7EC6\u7684\u4E16\u754C\u4E66\u8BBE\u5B9A\u8BCD\u6761\uFF08\u81F3\u5C11150\u5B57\uFF09\uFF0C\u4FDD\u7559\u65B9\u5411\u4F46\u5927\u5E45\u6269\u5145\u3002' : '';
        var searchInjection = '';
        if (window.__searchConfig__ && window.__searchConfig__.isEnabled()) {
          var sq = old.comment + ' ' + (req || '');
          var sr = await performSearchIfEnabled(sq);
          searchInjection = sr.searchText || '';
        }
        var wvHint = getWorldviewHintBlock();
        var sys = ctx.promptText('wbRewrite', '') + '\n\u3010\u539F\u8BCD\u6761\u3011: \u6807\u9898: ' + old.comment + ' | \u7B56\u7565: ' + old.strategy + ' | \u89E6\u53D1\u8BCD: ' + old.keys.join(',') + '\n\u5185\u5BB9: ' + old.content + (presetsStr ? '\n\u3010\u6587\u98CE\u3011\uFF1A\n' + presetsStr : '') + expandHint + (wvHint || '') + '\n【冲突处理】若「用户额外要求」与「世界观预设」冲突，以用户额外要求为准。' + searchInjection + '\n\u3010\u4EFB\u52A1\u3011\uFF1A\u91CD\u5199\u3002\u8F93\u51FAJSON\uFF1A{ "comment": "\u6807\u9898", "content": "\u8BE6\u7EC6\u8BBE\u5B9A", "keys": ["\u89E6\u53D1\u8BCD"], "strategy": "selective \u6216 constant", "position": ' + old.position + ' }';
        var h = { 'Content-Type': 'application/json' };
        if (key) h['Authorization'] = 'Bearer ' + key;
        var aiResp = await ctx.fetchAIContent({
          context: '\u4E16\u754C\u4E66\u91CD\u5199/\u7D22\u5F15' + index,
          url: url,
          headers: h,
          model: model,
          messages: [{ role: 'system', content: sys }, { role: 'user', content: isSkeleton ? '\u5C06\u9AA8\u67B6\u5C55\u5F00\u4E3A\u5B8C\u6574\u8BBE\u5B9A\u3002' + (req ? ' \u989D\u5916\u8981\u6C42\uFF1A' + req : '') : '\u4FEE\u6539\u8981\u6C42\uFF1A' + req }],
          temperature: 0.8,
          httpErrorPrefix: 'HTTP ',
          signal: task.signal,
        });
        var ed = ctx.extractJsonObj(aiResp.content, '\u4E16\u754C\u4E66\u91CD\u5199/\u7D22\u5F15' + index);
        ctx.state.worldbookEntries[index].comment = ed.comment || old.comment;
        ctx.state.worldbookEntries[index].content = ed.content || old.content;
        if (ed.keys) ctx.state.worldbookEntries[index].keys = Array.isArray(ed.keys) ? ed.keys : [];
        if (ed.strategy) ctx.state.worldbookEntries[index].strategy = ed.strategy;
        renderEntriesList();
        ctx.save();
      });
    } catch (err) {
      if (!ctx.isTrackedAbort(err)) {
        alert('\u91CD\u5199\u5931\u8D25: ' + err.message);
        throw err;
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = oldText || '\u2728 AI\u91CD\u5199'; }
    }
  }

  // ============================================================
  //  核心渲染：条目列表
  // ============================================================
  function renderEntriesList() {
    entriesList.innerHTML = '';
    entriesList.style.display = '';
    var posMap = ['\u89D2\u8272\u524D', '\u89D2\u8272\u540E', '\u793A\u4F8B\u524D', '\u793A\u4F8B\u540E', '\u6309\u6DF1\u5EA6', '\u6CE8\u91CA\u524D', '\u6CE8\u91CA\u540E'];
    var wbEntries = ctx.state.worldbookEntries;
    if (!wbEntries.length) {
      var empty = document.createElement('div');
      empty.className = 'wb-entries-empty';
      empty.textContent = '\u6682\u65E0\u4E16\u754C\u4E66\u6761\u76EE\uFF0C\u70B9\u51FB\u53F3\u4E0A\u300C\u65B0\u5EFA\u300D\u6216\u300C\u5355\u6761\u751F\u6210\u300D';
      entriesList.appendChild(empty);
    }
    wbEntries.forEach(function(entry, index) {
      entry = normalizeWBEntry(entry);
      var isSk = entry.content.length < 60 || String(entry.content || '').indexOf('\u5F85\u5C55\u5F00') >= 0;
      var safeComment = escapeHtml(entry.comment || '\u672A\u547D\u540D');
      var previewLine = truncatePreviewLine(entry.content);
      var metaLine = '\u4F4D\u7F6E: ' + (posMap[entry.position] || entry.position) + ' | \u987A\u5E8F: ' + entry.order + ' | \u6DF1\u5EA6: ' + entry.depth + ' | \u6982\u7387: ' + entry.prob + '%';
      var skBadge = isSk ? '<span style="font-size:0.6rem;background:rgba(245,158,11,0.15);color:#f59e0b;padding:1px 6px;border-radius:99px;border:1px solid rgba(245,158,11,0.25);">\uD83E\uDDB4 \u9AA8\u67B6</span>' : '';
      var strategyBadge = renderStrategyTag(entry.strategy);
      var aiTitle = isSk ? 'AI \u5C55\u5F00\uFF08\u672A\u6269\u5C55\uFF09' : 'AI \u91CD\u5199';
      var actionsHtml =
        '<div class="entry-actions">' +
          '<button class="entry-icon-btn btn-edit" data-index="' + index + '" type="button" title="\u7F16\u8F91" aria-label="\u7F16\u8F91">\u270E</button>' +
          '<button class="entry-icon-btn btn-toggle-reroll' + (isSk ? ' btn-ai-expand' : '') + '" data-index="' + index + '" type="button" title="' + aiTitle + '" aria-label="' + aiTitle + '">\u2726</button>' +
          '<button class="entry-icon-btn is-danger btn-delete" data-index="' + index + '" type="button" title="\u5220\u9664" aria-label="\u5220\u9664">\u00D7</button>' +
        '</div>';
      var div = document.createElement('div');
      div.className = 'entry-item fade-in';
      div.setAttribute('data-entry-index', String(index));
      div.innerHTML =
        '<div class="entry-item-header">' +
          '<div class="entry-info">' +
            '<div class="entry-info-title-row"><button type="button" class="entry-title-btn btn-edit" data-index="' + index + '" title="\u7F16\u8F91\u6761\u76EE">' + safeComment + '</button>' + strategyBadge + skBadge + '</div>' +
            (previewLine ? '<p class="entry-preview-line">' + escapeHtml(previewLine) + '</p>' : '') +
            '<p class="entry-meta-line">' + escapeHtml(metaLine) + '</p>' +
          '</div>' +
          actionsHtml +
        '</div>' +
        '<div id="reroll_area_' + index + '" style="display:none;width:100%;margin-top:12px;padding-top:12px;border-top:1px dashed var(--color-surface-elevated);">' +
          '<input type="text" id="reroll_prompt_' + index + '" placeholder="' + (isSk ? '\u53EF\u7559\u7A7A\u76F4\u63A5\u5C55\u5F00\uFF0C\u6216\u8F93\u5165\u989D\u5916\u8981\u6C42...' : '\u600E\u4E48\u4FEE\u6539\uFF1F') + '" style="width:100%;padding:8px;margin-bottom:8px;" />' +
          '<button class="btn btn-submit-reroll" data-index="' + index + '" type="button" style="background:linear-gradient(135deg,var(--color-accent),#6d28d9);padding:8px;font-size:0.85rem;">' +
            (isSk ? '\uD83E\uDDB4\u2192\uD83D\uDCD6 \u5C55\u5F00\u4E3A\u5B8C\u6574\u8BBE\u5B9A' : '\uD83C\uDFB2 \u786E\u5B9A\u8986\u76D6\u91CD\u5199') +
          '</button>' +
        '</div>';
      entriesList.appendChild(div);
    });
    updateCreateEntryButtonState();

    document.querySelectorAll('.btn-edit').forEach(function(b) {
      b.addEventListener('click', function(e) {
        e.stopPropagation();
        editEntry(parseInt(e.currentTarget.getAttribute('data-index'), 10));
      });
    });
    document.querySelectorAll('.btn-toggle-reroll').forEach(function(b) {
      b.addEventListener('click', function(e) {
        e.stopPropagation();
        var idx = e.currentTarget.getAttribute('data-index');
        var a = document.getElementById('reroll_area_' + idx);
        a.style.display = a.style.display === 'none' ? 'block' : 'none';
      });
    });
    document.querySelectorAll('.btn-submit-reroll').forEach(function(b) {
      b.addEventListener('click', async function(e) {
        e.stopPropagation();
        var idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
        var req = document.getElementById('reroll_prompt_' + idx).value.trim();
        var isSk = ctx.state.worldbookEntries[idx].content.length < 60;
        if (!isSk && !req) return alert('\u8BF7\u586B\u5199\u4FEE\u6539\u8981\u6C42\uFF01');
        await aiRewriteEntry(idx, req, e.currentTarget);
      });
    });
    document.querySelectorAll('.btn-delete').forEach(function(b) {
      b.addEventListener('click', function(e) {
        e.stopPropagation();
        if (!confirm('确认删除该世界书条目？')) return;
        var idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
        ctx.state.worldbookEntries.splice(idx, 1);
        if (editingIndex === idx) closeWbModal('wbModalEdit');
        else if (editingIndex > idx) editingIndex--;
        renderEntriesList();
        ctx.flushSave();
      });
    });
    window.dispatchEvent(new CustomEvent('worldbook-changed'));
    var wbSearchInput = ctx.$('wbSearchInput');
    if (wbSearchInput && wbSearchInput.value) renderWbSearchResults(wbSearchInput.value);
  }

  // ============================================================
  //  搜索
  // ============================================================
  function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlightMatch(text, query) {
    var safeText = escapeHtml(text || '');
    if (!query) return safeText;
    var safeQuery = escapeHtml(query);
    if (!safeQuery) return safeText;
    var re;
    try { re = new RegExp(escapeRegex(safeQuery), 'gi'); }
    catch (e) { return safeText; }
    return safeText.replace(re, function(m) { return '<mark>' + m + '</mark>'; });
  }

  function buildWbHitSnippet(text, q, queryLen) {
    var raw = String(text || '');
    if (!raw) return '';
    var idx = raw.toLowerCase().indexOf(q);
    if (idx === -1) {
      return raw.length > 72 ? raw.substring(0, 72) + '\u2026' : raw;
    }
    var start = Math.max(0, idx - 24);
    var end = Math.min(raw.length, idx + queryLen + 40);
    return (start > 0 ? '\u2026' : '') + raw.substring(start, end) + (end < raw.length ? '\u2026' : '');
  }

  function renderWbSearchResults(query) {
    var wbSearchResults = ctx.$('wbSearchResults');
    var wbSearchCount = ctx.$('wbSearchCount');
    var wbSearchClear = ctx.$('wbSearchClear');
    var wbSearchInput = ctx.$('wbSearchInput');
    if (!wbSearchResults) return;
    var trimmed = query ? query.trim() : '';
    if (!trimmed) {
      wbSearchResults.style.display = 'none';
      wbSearchResults.innerHTML = '';
      if (wbSearchCount) wbSearchCount.textContent = '';
      if (wbSearchClear) wbSearchClear.style.display = 'none';
      return;
    }
    if (wbSearchClear) wbSearchClear.style.display = 'flex';
    var q = trimmed.toLowerCase();
    var wbScopeTitle = ctx.$('wbScopeTitle');
    var wbScopeKeys = ctx.$('wbScopeKeys');
    var wbScopeContent = ctx.$('wbScopeContent');
    var scopeTitle = !wbScopeTitle || wbScopeTitle.checked;
    var scopeKeys = !wbScopeKeys || wbScopeKeys.checked;
    var scopeContent = !wbScopeContent || wbScopeContent.checked;
    if (!scopeTitle && !scopeKeys && !scopeContent) {
      scopeTitle = scopeKeys = scopeContent = true;
    }
    var matches = [];
    ctx.state.worldbookEntries.forEach(function(rawEntry, index) {
      var entry = normalizeWBEntry(rawEntry);
      var comment = entry.comment || '';
      var keysText = (entry.keys || []).join(', ');
      var content = entry.content || '';
      var titleMatch = scopeTitle && comment.toLowerCase().indexOf(q) !== -1;
      var keysMatch = scopeKeys && keysText.toLowerCase().indexOf(q) !== -1;
      var contentMatch = scopeContent && content.toLowerCase().indexOf(q) !== -1;
      if (titleMatch || keysMatch || contentMatch) {
        matches.push({ index: index, entry: entry, keysText: keysText, titleMatch: titleMatch, keysMatch: keysMatch, contentMatch: contentMatch });
      }
    });

    if (wbSearchCount) wbSearchCount.textContent = '\u547D\u4E2D ' + matches.length + ' / ' + ctx.state.worldbookEntries.length + ' \u6761';
    wbSearchResults.style.display = 'flex';

    if (matches.length === 0) {
      wbSearchResults.innerHTML = '<div class="wb-search-empty">\u65E0\u547D\u4E2D</div>';
      return;
    }

    var html = matches.map(function(m) {
      var entry = m.entry;
      var fields = [];
      if (m.titleMatch) fields.push('<strong>\u6807\u9898</strong>');
      if (m.keysMatch) fields.push('<strong>\u89E6\u53D1\u8BCD</strong>');
      if (m.contentMatch) fields.push('<strong>\u5185\u5BB9</strong>');
      var snippetSrc = '';
      if (m.contentMatch) snippetSrc = entry.content || '';
      else if (m.keysMatch) snippetSrc = m.keysText || '';
      else snippetSrc = entry.content || m.keysText || '';
      var snippet = buildWbHitSnippet(snippetSrc, q, trimmed.length);
      var titleHtml = highlightMatch(entry.comment || '\u672A\u547D\u540D', trimmed);
      var snippetHtml = highlightMatch(snippet, trimmed);
      return '<div class="wb-search-hit" role="button" tabindex="0" data-jump-index="' + m.index + '" title="\u8DF3\u8F6C\u5E76\u5C55\u5F00\u8BE5\u6761\u76EE">' +
        '<div class="wb-search-hit-main">' +
          '<span class="wb-search-hit-title" title="' + escapeHtml(entry.comment || '') + '">' + titleHtml + '</span>' +
          renderStrategyTag(entry.strategy) +
          '<span class="wb-search-hit-fields">' + fields.join(' \u00B7 ') + '</span>' +
        '</div>' +
        (snippet ? '<div class="wb-search-hit-snippet">' + snippetHtml + '</div>' : '') +
      '</div>';
    }).join('');
    wbSearchResults.innerHTML = html;

    wbSearchResults.querySelectorAll('.wb-search-hit').forEach(function(row) {
      function go() {
        var idx = parseInt(row.getAttribute('data-jump-index'), 10);
        jumpToWbEntry(idx);
      }
      row.addEventListener('click', go);
      row.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go();
        }
      });
    });
  }

  function jumpToWbEntry(idx) {
    if (!Number.isFinite(idx) || idx < 0 || idx >= ctx.state.worldbookEntries.length) return;
    renderEntriesList();
    var targetDiv = entriesList.querySelector('.entry-item[data-entry-index="' + idx + '"]');
    if (targetDiv) {
      targetDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetDiv.classList.add('is-search-focus');
      targetDiv.style.transition = 'box-shadow 0.3s ease';
      targetDiv.style.boxShadow = '0 0 0 2px rgba(56, 189, 248, 0.6)';
      setTimeout(function() {
        targetDiv.style.boxShadow = '';
        targetDiv.classList.remove('is-search-focus');
      }, 1800);
    } else {
      entriesList.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    editEntry(idx);
  }

  // ============================================================
  //  AI 批量触发词生成
  // ============================================================
  function sanitizeGeneratedKeys(keys, oldKeys) {
    var source = Array.isArray(keys) ? keys : [];
    var merged = source.concat(Array.isArray(oldKeys) ? oldKeys : []);
    var out = [];
    var seen = {};
    merged.forEach(function(k) {
      var t = String(k || '').trim();
      if (!t) return;
      if (t.length > 24) return;
      var low = t.toLowerCase();
      if (seen[low]) return;
      seen[low] = true;
      out.push(t);
    });
    return out.slice(0, 8);
  }

  function buildKeygenCompactEntries(batch) {
    return batch.map(function(item) {
      return {
        index: item.index,
        comment: item.entry.comment || '',
        current_keys: item.entry.keys || [],
        content_preview: (item.entry.content || '').trim().substring(0, 240),
      };
    });
  }

  function estimateKeygenPayloadChars(charBlock, batch) {
    var compactEntries = buildKeygenCompactEntries(batch);
    var userPrompt = '\u89D2\u8272\u53C2\u8003\uFF1A\n' + JSON.stringify(charBlock, null, 2)
      + '\n\n\u8BF7\u4E3A\u4EE5\u4E0B\u4E16\u754C\u4E66\u6761\u76EE\u751F\u6210\u66F4\u5408\u9002\u7684\u89E6\u53D1\u8BCD\uFF1A\n'
      + JSON.stringify(compactEntries, null, 2);
    return userPrompt.length;
  }

  function splitTargetsForKeygen(targets, charBlock) {
    var batches = [];
    var current = [];

    targets.forEach(function(item) {
      var tentative = current.concat([item]);
      var size = estimateKeygenPayloadChars(charBlock, tentative);
      if (current.length > 0 && (size > KEYGEN_BATCH_CHAR_LIMIT || tentative.length > KEYGEN_BATCH_ITEM_LIMIT)) {
        batches.push(current);
        current = [item];
        return;
      }
      current = tentative;
    });

    if (current.length > 0) batches.push(current);
    return batches;
  }

  async function generateTriggerKeysBatch(batch, signal) {
    var url = String(ctx.$('apiUrl').value).replace(/\/$/, '') + '/chat/completions';
    var key = ctx.val('apiKey');
    var model = ctx.val('modelSelect');
    if (!model) throw new Error('\u8BF7\u5148\u9009\u62E9 AI \u6A21\u578B\uFF01');

    var headers = { 'Content-Type': 'application/json' };
    if (key) headers['Authorization'] = 'Bearer ' + key;

    var charBlock = {
      name: ctx.val('charName'),
      worldbook: ctx.val('wbName'),
      description_preview: ctx.val('charDesc').substring(0, 300),
    };

    var compactEntries = buildKeygenCompactEntries(batch);

    var sysPrompt = ctx.promptText('wbTriggerKeys', '');

    var userPrompt = '\u89D2\u8272\u53C2\u8003\uFF1A\n' + JSON.stringify(charBlock, null, 2)
      + '\n\n\u8BF7\u4E3A\u4EE5\u4E0B\u4E16\u754C\u4E66\u6761\u76EE\u751F\u6210\u66F4\u5408\u9002\u7684\u89E6\u53D1\u8BCD\uFF1A\n'
      + JSON.stringify(compactEntries, null, 2);

    var aiResp = await ctx.fetchAIContent({
      context: '\u4E16\u754C\u4E66\u89E6\u53D1\u8BCD\u6279\u6B21',
      url: url,
      headers: headers,
      model: model,
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      httpErrorPrefix: 'HTTP ',
      signal: signal,
    });
    var raw = aiResp.content;
    var arr;
    try {
      arr = ctx.extractJsonArray(raw, '\u4E16\u754C\u4E66\u89E6\u53D1\u8BCD\u6279\u6B21');
    } catch (pe) {
      arr = [ctx.extractJsonObj(raw, '\u4E16\u754C\u4E66\u89E6\u53D1\u8BCD\u6279\u6B21/fallback')];
    }

    if (!Array.isArray(arr)) throw new Error('AI \u8FD4\u56DE\u683C\u5F0F\u5F02\u5E38');
    return arr;
  }

  function applyTriggerKeySuggestions(suggestions) {
    var applied = 0;
    var matched = {};
    (Array.isArray(suggestions) ? suggestions : []).forEach(function(item) {
      var idx = Number(item && item.index);
      if (!Number.isFinite(idx) || idx < 0 || idx >= ctx.state.worldbookEntries.length) return;
      var prevKeys = (ctx.state.worldbookEntries[idx].keys || []).join('||');
      var nextKeys = sanitizeGeneratedKeys(item.keys, ctx.state.worldbookEntries[idx].keys);
      if (!nextKeys.length) return;
      matched[idx] = true;
      ctx.state.worldbookEntries[idx].keys = nextKeys;
      if (prevKeys !== nextKeys.join('||')) applied++;
    });
    return { applied: applied, matched: matched };
  }

  async function completeTriggerKeysBatch(batch, batchIndex, batchCount, processed, totalTargets, signal) {
    var pending = batch.slice();
    var round = 0;
    var updated = 0;
    var matchedAny = {};
    var keygenStatus = ctx.$('keygenStatus');

    while (pending.length > 0 && round < KEYGEN_MAX_RETRY_ROUNDS) {
      if (signal && signal.aborted) throw new DOMException('\u5DF2\u53D6\u6D88', 'AbortError');
      round++;
      var retryHint = round > 1 ? '\uFF0C\u8865\u8DD1\u7B2C ' + round + ' \u8F6E\uFF08\u5269\u4F59 ' + pending.length + ' \u6761\uFF09' : '';
      setStatusBar(keygenStatus, '\uD83E\uDDE0 \u6B63\u5728\u751F\u6210\u89E6\u53D1\u8BCD... ' + processed + '/' + totalTargets + '\uFF08\u7B2C ' + (batchIndex + 1) + '/' + batchCount + ' \u6279' + retryHint + '\uFF09', '#38bdf8');
      var suggestions = await generateTriggerKeysBatch(pending, signal);
      var result = applyTriggerKeySuggestions(suggestions);
      updated += result.applied;
      Object.keys(result.matched).forEach(function(idx) { matchedAny[idx] = true; });
      pending = pending.filter(function(item) { return !matchedAny[item.index]; });
    }

    return {
      updated: updated,
      missing: pending,
    };
  }

  // ============================================================
  //  AI 智能整理
  // ============================================================
  function normalizeOrganizeSuggestion(item) {
    var idx = Number(item && item.index);
    if (!Number.isFinite(idx) || idx < 0 || idx >= ctx.state.worldbookEntries.length) return null;
    var entry = ctx.state.worldbookEntries[idx];
    var position = clampInt(item.position, entry.position != null ? entry.position : 4, 0, 6);
    var role = clampInt(item.role, entry.role != null ? entry.role : 0, 0, 2);
    return {
      index: idx,
      position: position,
      role: role,
      depth: clampInt(item.depth, entry.depth != null ? entry.depth : 4, 0, 999),
      order: clampInt(item.order, entry.order != null ? entry.order : 100, 0, 999),
      prob: clampInt(item.prob != null ? item.prob : item.probability, entry.prob != null ? entry.prob : 100, 1, 100),
      reason: String(item.reason || '').trim() || '\u2014',
    };
  }

  function positionLabel(position) {
    return ({
      0: '\u2191 Char',
      1: '\u2193 Char',
      2: '\u2191 EM',
      3: '\u2193 EM',
      4: '@D',
      5: '\u2191 AN',
      6: '\u2193 AN',
    })[Number(position)] || '@D';
  }

  function roleLabel(role) {
    return ({
      0: '\u7CFB\u7EDF\u2699',
      1: '\u7528\u6237\uD83D\uDC64',
      2: 'AI\uD83E\uDD16',
    })[Number(role)] || '\u7CFB\u7EDF\u2699';
  }

  function formatInsertSlot(position, role) {
    position = Number(position);
    if (position === 4) return roleLabel(role) + ' @D';
    return positionLabel(position);
  }

  function renderOrgValue(oldValue, newValue) {
    return oldValue !== newValue
      ? '<span class="org-old">' + oldValue + '</span><span class="org-changed">' + newValue + '</span>'
      : String(oldValue);
  }

  function renderOrganizePreview(suggestions) {
    var organizePreview = ctx.$('organizePreview');
    var organizeStatus = ctx.$('organizeStatus');
    if (!organizePreview) return;

    var changeCount = 0;
    suggestions.forEach(function(s) {
      var idx = s.index;
      if (idx === undefined || idx < 0 || idx >= ctx.state.worldbookEntries.length) return;
      var e = ctx.state.worldbookEntries[idx];
      if (e.position !== s.position || e.role !== s.role || e.depth !== s.depth || e.order !== s.order || e.prob !== s.prob) changeCount++;
    });

    var html = '<div class="organize-preview-header">';
    html += '<span class="preview-header-title">\uD83D\uDCCA \u53C2\u6570\u4F18\u5316\u9884\u89C8</span>';
    html += '<span class="preview-header-badge">\u5171 ' + suggestions.length + ' \u6761</span>';
    html += '</div>';
    html += '<div class="organize-table-wrap"><table class="organize-table">';
    html += '<thead><tr><th>\u6761\u76EE</th><th>\u63D2\u5165\u4F4D\u7F6E</th><th>\u6DF1\u5EA6</th><th>\u987A\u5E8F</th><th>\u6982\u7387</th><th>AI \u5EFA\u8BAE</th></tr></thead>';
    html += '<tbody>';
    suggestions.forEach(function(s) {
      var idx = s.index;
      if (idx === undefined || idx < 0 || idx >= ctx.state.worldbookEntries.length) return;
      var e = ctx.state.worldbookEntries[idx];
      var oldSlot = formatInsertSlot(e.position, e.role);
      var newSlot = formatInsertSlot(s.position, s.role);
      var dC = e.depth !== s.depth, oC = e.order !== s.order, pC = e.prob !== s.prob;
      html += '<tr>';
      html += '<td class="org-name-cell" title="' + (e.comment || '').replace(/"/g, '&quot;') + '">' + (e.comment || '\u672A\u547D\u540D') + '</td>';
      html += '<td class="org-value-cell">' + renderOrgValue(oldSlot, newSlot) + '</td>';
      html += '<td class="org-value-cell">' + (dC ? '<span class="org-old">' + e.depth + '</span><span class="org-changed">' + s.depth + '</span>' : e.depth) + '</td>';
      html += '<td class="org-value-cell">' + (oC ? '<span class="org-old">' + e.order + '</span><span class="org-changed">' + s.order + '</span>' : e.order) + '</td>';
      html += '<td class="org-value-cell">' + (pC ? '<span class="org-old">' + e.prob + '%</span><span class="org-changed">' + s.prob + '%</span>' : e.prob + '%') + '</td>';
      html += '<td class="org-reason-cell">' + (s.reason || '\u2014') + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    html += '<div class="organize-footer">';
    html += '<span class="organize-stats">\u53D1\u73B0 <strong>' + changeCount + '</strong> \u5904\u53EF\u4F18\u5316\u53C2\u6570</span>';
    html += '<div class="organize-actions">';
    html += '<button class="btn-org-cancel" id="btnOrgCancel">\u53D6\u6D88</button>';
    html += '<button class="btn-org-apply" id="btnOrgApply">\u2705 \u5E94\u7528\u4F18\u5316</button>';
    html += '</div></div>';

    organizePreview.innerHTML = html;
    organizePreview.style.display = 'block';

    var btnOrgApply = document.getElementById('btnOrgApply');
    if (btnOrgApply) {
      btnOrgApply.addEventListener('click', function() {
        if (!pendingOrganizeData) return;
        var applied = 0;
        pendingOrganizeData.forEach(function(s) {
          var idx = s.index;
          if (idx === undefined || idx < 0 || idx >= ctx.state.worldbookEntries.length) return;
          var changed = false;
          if (s.position !== undefined && s.position !== ctx.state.worldbookEntries[idx].position) { ctx.state.worldbookEntries[idx].position = s.position; changed = true; }
          if (s.role !== undefined && s.role !== ctx.state.worldbookEntries[idx].role) { ctx.state.worldbookEntries[idx].role = s.role; changed = true; }
          if (s.depth !== undefined && s.depth !== ctx.state.worldbookEntries[idx].depth) { ctx.state.worldbookEntries[idx].depth = s.depth; changed = true; }
          if (s.order !== undefined && s.order !== ctx.state.worldbookEntries[idx].order) { ctx.state.worldbookEntries[idx].order = s.order; changed = true; }
          if (s.prob !== undefined && s.prob !== ctx.state.worldbookEntries[idx].prob) { ctx.state.worldbookEntries[idx].prob = s.prob; changed = true; }
          if (changed) applied++;
        });
        renderEntriesList();
        ctx.save();
        organizePreview.style.display = 'none';
        pendingOrganizeData = null;
        setStatusBar(organizeStatus, '\uD83C\uDF89 \u5DF2\u5E94\u7528 <strong>' + applied + '</strong> \u5904\u4F18\u5316\uFF01', '#34d399');
        setTimeout(function() { setStatusBar(organizeStatus, ''); }, 3000);
      });
    }

    var btnOrgCancel = document.getElementById('btnOrgCancel');
    if (btnOrgCancel) {
      btnOrgCancel.addEventListener('click', function() {
        organizePreview.style.display = 'none';
        pendingOrganizeData = null;
        setStatusBar(organizeStatus, '\u5DF2\u53D6\u6D88', 'var(--color-text-muted)');
        setTimeout(function() { setStatusBar(organizeStatus, ''); }, 2000);
      });
    }
  }

  // ============================================================
  //  bind — 事件绑定 + window.__assistantWbAi__
  // ============================================================
  function bind() {
    entriesList = ctx.$('entriesList');
    btnCreateEntry = ctx.$('btnCreateEntry');

    var wbSearchInput = ctx.$('wbSearchInput');
    var wbSearchClear = ctx.$('wbSearchClear');
    var wbScopeTitle = ctx.$('wbScopeTitle');
    var wbScopeKeys = ctx.$('wbScopeKeys');
    var wbScopeContent = ctx.$('wbScopeContent');

    if (wbSearchInput) {
      wbSearchInput.addEventListener('input', function() {
        renderWbSearchResults(wbSearchInput.value);
      });
    }
    if (wbSearchClear) {
      wbSearchClear.addEventListener('click', function() {
        var si = ctx.$('wbSearchInput');
        si.value = '';
        renderWbSearchResults('');
        si.focus();
      });
    }
    [wbScopeTitle, wbScopeKeys, wbScopeContent].forEach(function(cb) {
      if (cb) cb.addEventListener('change', function() {
        var si = ctx.$('wbSearchInput');
        renderWbSearchResults(si ? si.value : '');
      });
    });

    if (btnCreateEntry) btnCreateEntry.addEventListener('click', toggleCreateEntryForm);

    var btnOpenWbAiSingle = ctx.$('btnOpenWbAiSingle');
    var btnOpenWbAiOrganize = ctx.$('btnOpenWbAiOrganize');
    var btnOpenWbAiKeygen = ctx.$('btnOpenWbAiKeygen');
    if (btnOpenWbAiSingle) btnOpenWbAiSingle.addEventListener('click', function() { openWbModal('wbModalSingle'); });
    if (btnOpenWbAiOrganize) btnOpenWbAiOrganize.addEventListener('click', function() { openWbModal('wbModalOrganize'); });
    if (btnOpenWbAiKeygen) btnOpenWbAiKeygen.addEventListener('click', function() { openWbModal('wbModalKeygen'); });

    document.querySelectorAll('[data-wb-modal-close]').forEach(function(el) {
      el.addEventListener('click', function() {
        closeWbModal(el.getAttribute('data-wb-modal-close'));
      });
    });

    var btnWbModalSave = ctx.$('btnWbModalSave');
    if (btnWbModalSave) {
      btnWbModalSave.addEventListener('click', function() {
        saveInlineEntry(isCreatingEntry ? -1 : editingIndex);
      });
    }

    document.addEventListener('keydown', function(e) {
      if (e.key !== 'Escape') return;
      WB_MODAL_IDS.forEach(closeWbModal);
    });

    // ---- 单条生成按钮 ----
    var btnAiSingleWb = ctx.$('btnAiSingleWb');
    if (btnAiSingleWb) {
      btnAiSingleWb.addEventListener('click', async function() {
        if (!ctx.val('modelSelect')) return alert('\u8BF7\u5148\u9009\u62E9\u6A21\u578B\uFF01');
        btnAiSingleWb.disabled = true;
        btnAiSingleWb.textContent = '\u23F3 Roll\u4E2D...';
        var wbSinglePrompt = ctx.$('wbSinglePrompt');
        try {
          await ctx.runTracked({
            type: 'wb_single',
            title: '\u4E16\u754C\u4E66\u5355\u6761\u751F\u6210',
            target: (wbSinglePrompt ? wbSinglePrompt.value.trim() : '').slice(0, 40),
          }, async function(task) {
            await generateContextAwareWBEntry(wbSinglePrompt ? wbSinglePrompt.value.trim() : '', '\u5355\u6761\u8865\u5145\u3002', task.signal);
          });
          renderEntriesList();
          ctx.save();
          if (wbSinglePrompt) wbSinglePrompt.value = '';
          closeWbModal('wbModalSingle');
        } catch (err) {
          if (!ctx.isTrackedAbort(err)) alert('\u751F\u6210\u5931\u8D25: ' + err.message);
        } finally {
          btnAiSingleWb.disabled = false;
          btnAiSingleWb.textContent = '\u751F\u6210 1 \u6761';
        }
      });
    }

    // ---- AI 整理 ----
    var btnAiOrganize = ctx.$('btnAiOrganize');
    if (btnAiOrganize) {
      btnAiOrganize.addEventListener('click', async function() {
        if (ctx.state.worldbookEntries.length === 0) return alert('\u4E16\u754C\u4E66\u4E3A\u7A7A\uFF0C\u6CA1\u6709\u53EF\u6574\u7406\u7684\u6761\u76EE\uFF01');
        if (!ctx.val('modelSelect')) return alert('\u8BF7\u5148\u9009\u62E9 AI \u6A21\u578B\uFF01');
        btnAiOrganize.disabled = true;
        btnAiOrganize.textContent = '\u23F3 AI \u5206\u6790\u4E2D...';
        closeWbModal('wbModalOrganize');
        var organizeStatus = ctx.$('organizeStatus');
        var organizePreview = ctx.$('organizePreview');
        setStatusBar(organizeStatus, '\uD83D\uDD0D \u6B63\u5728\u5206\u6790 ' + ctx.state.worldbookEntries.length + ' \u6761\u4E16\u754C\u4E66\u6761\u76EE...', '#38bdf8');
        if (organizePreview) organizePreview.style.display = 'none';
        pendingOrganizeData = null;

        var entrySummaries = ctx.state.worldbookEntries.map(function(e, i) {
          return { index: i, title: e.comment || '\u672A\u547D\u540D', content_preview: (e.content || '').substring(0, 150), strategy: e.strategy, keys: (e.keys || []).join(', '), current_position: e.position, current_role: e.role, current_depth: e.depth, current_order: e.order, current_prob: e.prob };
        });

        var sysPrompt = ctx.promptText('wbOrganize', '');
        var userPrompt = '\u4EE5\u4E0B\u662F ' + ctx.state.worldbookEntries.length + ' \u6761\u4E16\u754C\u4E66\u6761\u76EE\uFF0C\u8BF7\u5206\u6790\u5E76\u4F18\u5316\u53C2\u6570\uFF1A\n\n' + JSON.stringify(entrySummaries, null, 2);
        var url = String(ctx.$('apiUrl').value).replace(/\/$/, '') + '/chat/completions';
        var key = ctx.val('apiKey');
        var model = ctx.val('modelSelect');

        try {
          await ctx.runTracked({
            type: 'wb_organize',
            title: '\u4E16\u754C\u4E66\u667A\u80FD\u6574\u7406',
            target: ctx.state.worldbookEntries.length + ' \u6761',
          }, async function(task) {
            var headers = { 'Content-Type': 'application/json' };
            if (key) headers['Authorization'] = 'Bearer ' + key;
            var aiResp = await ctx.fetchAIContent({
              context: '\u4E16\u754C\u4E66\u6574\u7406\u53C2\u6570\u4F18\u5316',
              url: url,
              headers: headers,
              model: model,
              messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: userPrompt }],
              temperature: 0.3,
              httpErrorPrefix: 'HTTP ',
              signal: task.signal,
            });
            var rawContent = aiResp.content;
            var suggestions;
            try { suggestions = ctx.extractJsonArray(rawContent, '\u4E16\u754C\u4E66\u6574\u7406\u53C2\u6570\u4F18\u5316'); }
            catch (pe) { suggestions = [ctx.extractJsonObj(rawContent, '\u4E16\u754C\u4E66\u6574\u7406\u53C2\u6570\u4F18\u5316/fallback')]; }
            if (!Array.isArray(suggestions) || suggestions.length === 0) throw new Error('AI \u8FD4\u56DE\u683C\u5F0F\u5F02\u5E38');
            suggestions = suggestions.map(normalizeOrganizeSuggestion).filter(Boolean);
            if (suggestions.length === 0) throw new Error('AI \u8FD4\u56DE\u4E2D\u6CA1\u6709\u6709\u6548\u6761\u76EE');
            pendingOrganizeData = suggestions;
            renderOrganizePreview(suggestions);
            setStatusBar(organizeStatus, '\u2705 \u5206\u6790\u5B8C\u6210\uFF01\u8BF7\u68C0\u67E5\u4E0B\u65B9\u9884\u89C8\uFF0C\u786E\u8BA4\u540E\u70B9\u51FB\u300C\u5E94\u7528\u300D', '#34d399');
          });
        } catch (err) {
          if (ctx.isTrackedAbort(err)) setStatusBar(organizeStatus, '\u23F9 \u5DF2\u53D6\u6D88', 'var(--color-text-muted)');
          else setStatusBar(organizeStatus, '\u274C \u6574\u7406\u5931\u8D25: ' + escapeHtml(err.message), 'var(--color-danger)');
          if (organizePreview) organizePreview.style.display = 'none';
        } finally {
          btnAiOrganize.disabled = false;
          btnAiOrganize.textContent = '\u4E00\u952E\u6574\u7406';
        }
      });
    }

    // ---- 一键生成触发词 ----
    var btnAiGenerateKeys = ctx.$('btnAiGenerateKeys');
    if (btnAiGenerateKeys) {
      btnAiGenerateKeys.addEventListener('click', async function() {
        if (ctx.state.worldbookEntries.length === 0) return alert('\u4E16\u754C\u4E66\u4E3A\u7A7A\uFF0C\u6CA1\u6709\u53EF\u751F\u6210\u89E6\u53D1\u8BCD\u7684\u6761\u76EE\uFF01');
        if (!ctx.val('modelSelect')) return alert('\u8BF7\u5148\u9009\u62E9 AI \u6A21\u578B\uFF01');

        var targets = ctx.state.worldbookEntries
          .map(function(entry, index) { return { entry: entry, index: index }; })
          .filter(function(item) { return item.entry.strategy !== 'constant'; });

        if (targets.length === 0) return alert('\u5F53\u524D\u6761\u76EE\u90FD\u662F\u5E38\u9A7B\u6761\u76EE\uFF0C\u6CA1\u6709\u9700\u8981\u751F\u6210\u89E6\u53D1\u8BCD\u7684\u76EE\u6807\u3002');

        btnAiGenerateKeys.disabled = true;
        btnAiGenerateKeys.textContent = '\u23F3 \u751F\u6210\u4E2D...';
        closeWbModal('wbModalKeygen');
        var keygenStatus = ctx.$('keygenStatus');
        setStatusBar(keygenStatus, '\uD83E\uDDE0 \u6B63\u5728\u5206\u6790 ' + targets.length + ' \u6761\u6761\u76EE\u7684\u89E6\u53D1\u8BCD...', '#38bdf8');

        try {
          await ctx.runTracked({
            type: 'wb_keygen',
            title: '\u4E16\u754C\u4E66\u8865\u5168\u89E6\u53D1\u8BCD',
            target: targets.length + ' \u6761',
          }, async function(task) {
            var charBlock = {
              name: ctx.val('charName'),
              worldbook: ctx.val('wbName'),
              description_preview: ctx.val('charDesc').substring(0, 300),
            };
            var batches = splitTargetsForKeygen(targets, charBlock);
            var updated = 0;
            var processed = 0;
            var unresolved = [];
            for (var batchIndex = 0; batchIndex < batches.length; batchIndex++) {
              if (task.signal && task.signal.aborted) throw new DOMException('\u5DF2\u53D6\u6D88', 'AbortError');
              var batch = batches[batchIndex];
              processed += batch.length;
              if (window.__aiTaskCenter__) {
                window.__aiTaskCenter__.setProgress(task.id, processed / targets.length, '\u6279\u6B21 ' + (batchIndex + 1) + '/' + batches.length);
              }
              var batchResult = await completeTriggerKeysBatch(batch, batchIndex, batches.length, processed, targets.length, task.signal);
              updated += batchResult.updated;
              if (batchResult.missing && batchResult.missing.length > 0) {
                unresolved = unresolved.concat(batchResult.missing.map(function(item) {
                  return item.entry.comment || ('#' + item.index);
                }));
              }
            }

            renderEntriesList();
            ctx.save();
            if (unresolved.length > 0) {
              setStatusBar(
                keygenStatus,
                '\u26A0\uFE0F \u5DF2\u4E3A <strong>' + updated + '</strong> \u6761\u4E16\u754C\u4E66\u66F4\u65B0\u89E6\u53D1\u8BCD\uFF0C\u4F46\u4ECD\u6709 <strong>' + unresolved.length + '</strong> \u6761\u672A\u8FD4\u56DE\u7ED3\u679C\uFF1A' + unresolved.slice(0, 3).map(escapeHtml).join('\u3001') + (unresolved.length > 3 ? '\u2026' : ''),
                'var(--color-warning)'
              );
            } else {
              setStatusBar(keygenStatus, '\u2705 \u5DF2\u4E3A <strong>' + updated + '</strong> \u6761\u4E16\u754C\u4E66\u66F4\u65B0\u89E6\u53D1\u8BCD', '#34d399');
            }
          });
        } catch (err) {
          if (ctx.isTrackedAbort(err)) setStatusBar(ctx.$('keygenStatus'), '\u23F9 \u5DF2\u53D6\u6D88', 'var(--color-text-muted)');
          else setStatusBar(ctx.$('keygenStatus'), '\u274C \u89E6\u53D1\u8BCD\u751F\u6210\u5931\u8D25: ' + escapeHtml(err.message), 'var(--color-danger)');
        } finally {
          btnAiGenerateKeys.disabled = false;
          btnAiGenerateKeys.textContent = '\u4E00\u952E\u8865\u89E6\u53D1\u8BCD';
        }
      });
    }

    // ============================================================
    //  window.__assistantWbAi__ — 助手世界书 AI
    // ============================================================
    window.__assistantWbAi__ = {
      generateEntry: async function(opts) {
        opts = opts || {};
        var before = ctx.state.worldbookEntries.length;
        await ctx.runTracked({
          type: 'wb_single',
          title: '\u52A9\u624B\u00B7\u4E16\u754C\u4E66\u5355\u6761\u751F\u6210',
          target: String(opts.direction || opts.instruction || '').slice(0, 40),
        }, async function(task) {
          await generateContextAwareWBEntry(opts.direction || opts.instruction || '', '\u52A9\u624B\u5355\u6761\u8865\u5145\u3002', task.signal);
        });
        renderEntriesList();
        ctx.save();
        var last = ctx.state.worldbookEntries[ctx.state.worldbookEntries.length - 1];
        return {
          added: ctx.state.worldbookEntries.length - before,
          total: ctx.state.worldbookEntries.length,
          entry: last ? { comment: last.comment, contentLen: String(last.content || '').length } : null,
        };
      },

      mutateEntry: async function(opts) {
        opts = opts || {};
        var idx = typeof opts.index === 'number' ? opts.index : -1;
        if (idx < 0 || idx >= ctx.state.worldbookEntries.length) throw new Error('\u6761\u76EE\u7D22\u5F15\u65E0\u6548');
        var mode = opts.mode || 'expand';
        var instruction = opts.instruction || opts.direction || '';
        if (mode === 'expand' && !instruction) instruction = '\u5C06\u9AA8\u67B6/\u77ED\u5185\u5BB9\u5C55\u5F00\u4E3A\u5B8C\u6574\u8BE6\u7EC6\u8BBE\u5B9A';
        if (mode === 'rewrite' && !instruction) instruction = '\u6309\u539F\u610F\u91CD\u5199\uFF0C\u63D0\u5347\u6E05\u6670\u5EA6\u4E0E\u53EF\u7528\u6027';
        if (mode === 'patch' && instruction) instruction = '\u5B9A\u5411\u4FEE\u6539\uFF1A' + instruction + '\uFF08\u4FDD\u7559\u672A\u8981\u6C42\u6539\u52A8\u7684\u90E8\u5206\uFF09';
        var fakeBtn = { textContent: '', disabled: false };
        await aiRewriteEntry(idx, instruction, fakeBtn);
        var e = ctx.state.worldbookEntries[idx];
        return { index: idx, comment: e.comment, contentLen: String(e.content || '').length, mode: mode };
      },

      organize: async function(opts) {
        opts = opts || {};
        if (ctx.state.worldbookEntries.length === 0) throw new Error('\u4E16\u754C\u4E66\u4E3A\u7A7A');
        var url = String(ctx.$('apiUrl').value).replace(/\/$/, '') + '/chat/completions';
        var key = ctx.val('apiKey');
        var model = ctx.val('modelSelect');
        if (!model) throw new Error('\u8BF7\u5148\u9009\u62E9 AI \u6A21\u578B');
        var entrySummaries = ctx.state.worldbookEntries.map(function(e, i) {
          return {
            index: i, title: e.comment || '\u672A\u547D\u540D',
            content_preview: (e.content || '').substring(0, 150),
            strategy: e.strategy, keys: (e.keys || []).join(', '),
            current_position: e.position, current_role: e.role,
            current_depth: e.depth, current_order: e.order, current_prob: e.prob,
          };
        });
        var headers = { 'Content-Type': 'application/json' };
        if (key) headers.Authorization = 'Bearer ' + key;
        var aiResp = await ctx.fetchAIContent({
          context: '\u4E16\u754C\u4E66\u6574\u7406\u53C2\u6570\u4F18\u5316/\u52A9\u624B',
          url: url,
          headers: headers,
          model: model,
          messages: [
            { role: 'system', content: ctx.promptText('wbOrganize', '') },
            { role: 'user', content: '\u4EE5\u4E0B\u662F ' + ctx.state.worldbookEntries.length + ' \u6761\u4E16\u754C\u4E66\u6761\u76EE\uFF0C\u8BF7\u5206\u6790\u5E76\u4F18\u5316\u53C2\u6570\uFF1A\n\n' + JSON.stringify(entrySummaries, null, 2) },
          ],
          temperature: 0.3,
          httpErrorPrefix: 'HTTP ',
        });
        var suggestions;
        try { suggestions = ctx.extractJsonArray(aiResp.content, '\u4E16\u754C\u4E66\u6574\u7406/\u52A9\u624B'); }
        catch (pe) { suggestions = [ctx.extractJsonObj(aiResp.content, '\u4E16\u754C\u4E66\u6574\u7406/\u52A9\u624B/fallback')]; }
        suggestions = (suggestions || []).map(normalizeOrganizeSuggestion).filter(Boolean);
        if (!suggestions.length) throw new Error('AI \u8FD4\u56DE\u4E2D\u6CA1\u6709\u6709\u6548\u6761\u76EE');
        var preview = suggestions.map(function(s) {
          var e = ctx.state.worldbookEntries[s.index] || {};
          return {
            index: s.index, title: e.comment || '',
            position: s.position, role: s.role, depth: s.depth, order: s.order, prob: s.prob,
            reason: s.reason || '',
          };
        });
        if (opts.apply === false) return { applied: false, preview: preview, changeCount: preview.length };
        var applied = 0;
        suggestions.forEach(function(s) {
          var idx = s.index;
          if (idx === undefined || idx < 0 || idx >= ctx.state.worldbookEntries.length) return;
          var changed = false;
          ['position', 'role', 'depth', 'order', 'prob'].forEach(function(k) {
            if (s[k] !== undefined && s[k] !== ctx.state.worldbookEntries[idx][k]) {
              ctx.state.worldbookEntries[idx][k] = s[k];
              changed = true;
            }
          });
          if (changed) applied++;
        });
        renderEntriesList();
        ctx.save();
        return { applied: true, appliedCount: applied, preview: preview };
      },

      batchFillKeys: async function(opts) {
        opts = opts || {};
        if (!ctx.val('modelSelect')) throw new Error('\u8BF7\u5148\u9009\u62E9 AI \u6A21\u578B');
        var targets = ctx.state.worldbookEntries
          .map(function(entry, index) { return { entry: entry, index: index }; })
          .filter(function(item) {
            if (item.entry.strategy === 'constant') return false;
            if (opts.onlyMissing) return !item.entry.keys || !item.entry.keys.length;
            return true;
          });
        if (!targets.length) return { updated: 0, note: '\u65E0\u76EE\u6807\u6761\u76EE' };
        var charBlock = {
          name: ctx.val('charName'),
          worldbook: ctx.val('wbName'),
          description_preview: ctx.val('charDesc').substring(0, 300),
        };
        var batches = splitTargetsForKeygen(targets, charBlock);
        var updated = 0;
        var processed = 0;
        for (var bi = 0; bi < batches.length; bi++) {
          processed += batches[bi].length;
          var br = await completeTriggerKeysBatch(batches[bi], bi, batches.length, processed, targets.length);
          updated += br.updated;
        }
        renderEntriesList();
        ctx.save();
        return { updated: updated, targets: targets.length };
      },
    };
  }

  // ===== 公开面板 API =====
  ctx.panels.worldbook = {
    renderEntriesList: renderEntriesList,
    renderSearchResults: renderWbSearchResults,
    renderOrganizePreview: renderOrganizePreview,
    generateTriggerKeysBatch: generateTriggerKeysBatch,
    applyTriggerKeySuggestions: applyTriggerKeySuggestions,
    openWbModal: openWbModal,
    closeWbModal: closeWbModal,
    bindModals: bind,
  };

  // 立即绑定事件
  bind();
}
