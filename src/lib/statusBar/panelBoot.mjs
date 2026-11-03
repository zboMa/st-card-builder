/**
 * 状态栏桥：Vue 只读 store 快照；设计存 cardBuilderExtensions[STATUS_BAR_EXT_KEY]。
 * 生成 / 预览 / 提示词 / 样例楼层仍在本模块，DOM 不再参与状态真相。
 */
import {
  STATUS_BAR_MODULES,
  STATUS_BAR_MODULE_GROUPS,
  STATUS_BAR_EXT_KEY,
  STATUS_BAR_MVU_FILL_PROMPT,
  STATUS_BAR_LAYOUT_SHELL_PROMPT,
  getPresetById,
  defaultModuleFlags,
  resolveModuleFlags,
  describeEnabledModules,
  describeForbiddenModules,
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
  applyStatusBarVariableEdits,
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
import { engineTryAllowed } from '../actionEngine/helpers.mjs';
import { openTextPreview } from '../textPreviewModal.mjs';
import { setCardExtensionField } from '../store/cardActions.mjs';
import { cardState } from '../store/cardStore.mjs';
import { patchStatusBarStore } from '../store/statusBarStore.mjs';
import { buildStatusBarView } from '../card-builder/panels/statusBarViewModel.mjs';
import {
  applyStatusBarPromptTemplate,
  composeStatusBarPromptPreview,
  formatStatusBarPromptSections,
} from './statusBarPromptPreview.mjs';

export function initStatusBarPanel(ctx) {
  if (!ctx) throw new Error('initStatusBarPanel: 缺少 ctx');
  var state = normalizeDesign({});
  var samples = { activeFloor: 1, floors: null };
  var floorToastSent = false;
  var boundCardId = ctx.getCurrentDraftId ? ctx.getCurrentDraftId() : '';
  var view = 'preview';
  var busy = { vars: false, layout: false, sample: false };

  function toast(message, level) {
    ctx.appFeedback({ message: message, level: level || 'error', channel: 'toast' });
  }

  function currentCharName() {
    return String(ctx.state.charName || '').trim();
  }

  function worldbookEntries() {
    if (Array.isArray(ctx.state.worldbookEntries)) return ctx.state.worldbookEntries;
    return window.__getWorldbookEntries__ ? window.__getWorldbookEntries__() : [];
  }

  function selectedFemales() {
    return excludeCardNameFromCharacters(state.characters, currentCharName()).filter(function(c) {
      return c.selected === true;
    });
  }

  function clearSamples() {
    samples.floors = null;
    samples.activeFloor = 1;
    floorToastSent = false;
  }

  function readDesign() {
    var ext = cardState().cardBuilderExtensions;
    var raw = ext && ext[STATUS_BAR_EXT_KEY];
    return reconcileDesignWithCharName(normalizeDesign(raw || {}), currentCharName());
  }

  function persist() {
    state = normalizeDesign(state);
    setCardExtensionField(STATUS_BAR_EXT_KEY, state);
    if (ctx.save) ctx.save();
  }

  function loadCharactersFromWorldbook() {
    var prevSel = Object.create(null);
    (state.characters || []).forEach(function(c) {
      if (c && c.name) prevSel[c.name] = c.selected;
    });
    state.characters = collectPersonCharactersFromWorldbook(worldbookEntries(), {
      excludeName: currentCharName(),
    });
    state.characters.forEach(function(c) {
      if (c && c.name && prevSel[c.name] !== undefined) c.selected = prevSel[c.name];
    });
    state.characters = excludeCardNameFromCharacters(state.characters, currentCharName());
  }

  function readFormIntoState() {
    state = normalizeDesign(state);
  }

  function livePaths() {
    return buildPlaceholderPaths({
      includeProtagonist: state.includeProtagonist,
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

  function rawPathValue(p) {
    var floor = samples.floors ? samples.floors[samples.activeFloor - 1] : null;
    if (!floor) return (p.sample != null && p.sample !== '') ? p.sample : '—';
    var v = readFloorValue(floor, p);
    return (v == null || v === '') ? '—' : v;
  }

  function selectedFemaleNames() {
    return selectedFemales().map(function(c) { return String(c.name || '').trim(); }).filter(Boolean);
  }

  function hintText() {
    var parts = [];
    if (state.includeProtagonist) parts.push('主角');
    var picked = selectedFemales().length;
    if (picked) parts.push(picked + ' 名角色');
    var who = parts.length ? ('已勾 ' + parts.join('、')) : '未勾选主角或角色';
    var floor = samples.floors
      ? ('样例第 ' + samples.activeFloor + ' / 3 楼')
      : '尚无样例';
    return who + ' · ' + floor;
  }

  function snippetCode() {
    if (!state.snippetHtml) return '';
    var rx = buildStatusBarRegex({ snippetHtml: state.snippetHtml, mode: 'mvu' });
    return JSON.stringify({
      scriptName: rx.scriptName,
      findRegex: rx.findRegex,
      placement: rx.placement,
      replaceString: String(rx.replaceString || '').slice(0, 2400),
    }, null, 2);
  }

  function publish(extra) {
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
    var tree = buildVariableTree(paths, rawPathValue);
    var floorLabel = samples.floors
      ? ('第 ' + samples.activeFloor + ' / 3 楼')
      : '尚无样例';
    var snapshot = buildStatusBarView(state, {
      charName: currentCharName(),
      paths: paths,
      tree: tree,
      view: view,
      busy: busy,
      previewHtml: html,
      snippetCode: snippetCode(),
      hintText: hintText(),
      floorLabel: floorLabel,
      canPrev: !!samples.floors && samples.activeFloor > 1,
      canNext: !!samples.floors && samples.activeFloor < 3,
    });
    patchStatusBarStore(Object.assign({}, snapshot, extra || {}));
    return { paths: paths, tree: tree, html: html };
  }

  function refreshPreview() {
    return publish();
  }

  function paintFromState() {
    loadCharactersFromWorldbook();
    publish();
  }

  function applyDesignToPanel() {
    state = readDesign();
    loadCharactersFromWorldbook();
    publish();
    return true;
  }

  function setView(mode) {
    view = mode === 'vars' || mode === 'script' ? mode : 'preview';
    patchStatusBarStore({ view: view });
  }

  function setBusy(key, on) {
    busy = Object.assign({}, busy);
    busy[key] = !!on;
    publish();
  }

  function selectPreset(id) {
    var preset = getPresetById(id);
    state.presetId = preset.id;
    if (preset.nsfw) state.nsfw = true;
    state.moduleFlags = defaultModuleFlags(preset.id, state.nsfw);
    persist();
    publish();
  }

  function toggleNsfw(on) {
    state.nsfw = !!on;
    state.moduleFlags = resolveModuleFlags(state.presetId, state.moduleFlags, state.nsfw);
    persist();
    publish();
  }

  function toggleModule(id, on) {
    if (!id) return;
    state.moduleFlags[id] = !!on;
    state.moduleFlags = resolveModuleFlags(state.presetId, state.moduleFlags, state.nsfw);
    persist();
    publish();
  }

  function resetModules() {
    state.moduleFlags = defaultModuleFlags(state.presetId, state.nsfw);
    persist();
    publish();
  }

  function toggleProtagonist(on) {
    state.includeProtagonist = !!on;
    persist();
    publish();
  }

  function toggleCharacter(name, on) {
    var target = String(name || '');
    (state.characters || []).forEach(function(c) {
      if (c && c.name === target) c.selected = !!on;
    });
    persist();
    publish();
  }

  function setExtra(value) {
    state.extra = String(value == null ? '' : value);
    persist();
    publish();
  }

  function setLayoutPrompt(value) {
    state.layoutPrompt = String(value == null ? '' : value);
    persist();
    publish();
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
    var apiUrl = ctx.$('apiUrl');
    var apiKey = ctx.$('apiKey');
    var modelSel = ctx.$('modelSelect');
    if (!apiUrl || !modelSel) throw new Error('找不到 AI 配置面板');
    var model = modelSel.value;
    if (!model) throw new Error('请先在 AI 配置拉取并选择模型');
    return {
      url: String(apiUrl.value || '').replace(/\/$/, '') + '/chat/completions',
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
    var main = String(ctx.state.firstMes || '').trim();
    if (main) list.push({ label: '主开场', text: main });
    var alts = Array.isArray(ctx.state.altGreetings) ? ctx.state.altGreetings : [];
    alts.forEach(function(text, i) {
      var body = String(text || '').trim();
      if (!body) return;
      list.push({ label: '备选' + (i + 1), text: body });
    });
    return list;
  }

  function fillCardSnapshot() {
    return {
      name: currentCharName(),
      desc: ctx.state.charDesc || '',
      creatorNotes: ctx.state.creatorNotes || '',
      greetings: collectGreetingTexts(),
    };
  }

  function fillUserForBatch(batch, card, entries) {
    var profile = buildBatchProfileBlock(batch, card, entries, state.characters);
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
    var mvuTpl = ctx.promptText('statusBarMvuFill', (ps && ps.get('statusBarMvuFill')) || STATUS_BAR_MVU_FILL_PROMPT);
    var layoutTpl = ctx.promptText('statusBarLayoutShell', (ps && ps.get('statusBarLayoutShell')) || STATUS_BAR_LAYOUT_SHELL_PROMPT);
    var paths = pathsForPreview();
    var batches = planStatusBarBatches(paths);
    var card = fillCardSnapshot();
    var entries = worldbookEntries();
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
        ? fillUserForBatch(sampleBatch, card, entries)
        : '没有可填的字段。',
      layoutSys: applyTemplate(layoutTpl, layoutVars),
      layoutUser: '请按排版风格说明输出 JSON。角色只写一套 <template data-zb-repeat="npc">，路径用 NPC.{{name}}.字段。',
      mvuTpl: mvuTpl,
      layoutTpl: layoutTpl,
      mvuVars: mvuVars,
      layoutVars: layoutVars,
      paths: paths,
      batches: batches,
      card: card,
      worldbookEntries: entries,
    };
  }

  function stripUnsafe(html) {
    return String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  }

  function reportError(err) {
    if (ctx.isTrackedAbort && ctx.isTrackedAbort(err)) {
      toast('已取消', 'info');
      return;
    }
    toast((err && err.message) || String(err), 'error');
  }

  function gateDesign(opts) {
    readFormIntoState();
    return rejectStatusBarGenerate({
      includeProtagonist: state.includeProtagonist,
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

  function isTransportError(err) {
    if (ctx.isTrackedAbort && ctx.isTrackedAbort(err)) return true;
    if (err && (err.name === 'AbortError' || err.name === 'TimeoutError')) return true;
    var msg = String((err && err.message) || err || '');
    return msg.indexOf('API HTTP') >= 0
      || msg.indexOf('请求失败') >= 0
      || msg.indexOf('Failed to fetch') >= 0
      || msg.indexOf('NetworkError') >= 0
      || msg.indexOf('网络') >= 0;
  }

  function finishGenerate(opts, okToast, result) {
    publish();
    if (window.triggerGlobalUpdate) window.triggerGlobalUpdate();
    if (!opts.fromAssistant && okToast) toast(okToast, 'success');
    return result;
  }

  function failGenerate(opts, err) {
    if (opts.fromAssistant && isTransportError(err)) throw err;
    if (!opts.fromAssistant) reportError(err);
    return { ok: false, code: 'failed', error: (err && err.message) || String(err) };
  }

  function commitVariableDesign(design) {
    design.source = design.source || 'statusbar';
    if (!window.__assistantMvuApi__ || !window.__assistantMvuApi__.upsertVariables) {
      throw new Error('MVU 注入 API 不可用');
    }
    window.__assistantMvuApi__.upsertVariables({ design: design, inject: true });
    state.paths = pathsFromMvuDesign(design, { charName: currentCharName() });
    if (String(state.customBodyHtml || '').trim()) writeBoundSnippet();
    persist();
    return {
      ok: true,
      variableCount: design.variables.length,
      pathCount: state.paths.length,
    };
  }

  async function generateVariables(opts) {
    opts = opts || {};
    var reason = gateDesign({ requireLayout: false });
    if (reason) {
      if (!opts.fromAssistant) toast(reason, 'warn');
      return { ok: false, code: 'gate', error: reason };
    }
    if (!opts.fromAssistant) {
      var gate = engineTryAllowed('card.statusbar.generate');
      if (!gate.ok) return { ok: false, code: 'busy', error: gate.reason || '已有进行中的任务' };
      setBusy('vars', true);
    }
    var bundle = promptBundle();
    if (!bundle.batches.length) {
      if (!opts.fromAssistant) {
        setBusy('vars', false);
        toast('请至少开启一个模块', 'warn');
      }
      return { ok: false, code: 'gate', error: '请至少开启一个模块' };
    }
    async function run(signal, task) {
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
      clearSamples();
      return commitVariableDesign(design);
    }
    try {
      var result = opts.fromAssistant
        ? await run(opts.signal || null, null)
        : await ctx.runTracked({ type: 'statusbar_generate', title: '状态栏变量', target: currentCharName() }, function(task) {
          return run(task && task.signal, task);
        });
      return finishGenerate(opts, '已生成变量', result);
    } catch (err) {
      return failGenerate(opts, err);
    } finally {
      if (!opts.fromAssistant) setBusy('vars', false);
    }
  }

  async function generateLayout(revise, opts) {
    opts = opts || {};
    var reason = gateDesign(revise
      ? { requirePaths: true, requireMarkup: true }
      : { requirePaths: true });
    if (reason) {
      if (!opts.fromAssistant) toast(reason, 'warn');
      return { ok: false, code: 'gate', error: reason };
    }
    if (!opts.fromAssistant) {
      var gate = engineTryAllowed('card.statusbar.layout');
      if (!gate.ok) return { ok: false, code: 'busy', error: gate.reason || '已有进行中的任务' };
      setBusy('layout', true);
    }
    var bundle = promptBundle();
    var user = bundle.layoutUser;
    if (revise) {
      var source = layoutReviseSource(state.customBodyHtml, selectedFemaleNames());
      user = '在现有排版上修改，不要另起一套。保留没要求改的结构。补上字段清单里还没有的字段，去掉已关闭的字段。\n'
        + '角色只保留一套 <template data-zb-repeat="npc">，路径用 NPC.{{name}}.字段，不要把每个人展开。\n'
        + '姓名：' + (source.names.join('、') || '（无）') + '\n\n'
        + '【当前 CSS】\n' + String(state.customCss || '')
        + '\n\n【当前 HTML】\n' + source.html
        + '\n\n请输出 JSON。只用 data-zb-path 与 data-zb-meter。';
    }
    async function run(signal) {
      var layout = await fetchJson(bundle.layoutSys, user, signal);
      var css = stripUnsafe(String(layout.css || '').trim());
      var bodyHtml = stripUnsafe(String(layout.bodyHtml || layout.html || '').trim());
      if (!css || !bodyHtml) throw new Error('排版未生成');
      state.customCss = css;
      state.customBodyHtml = bodyHtml;
      writeBoundSnippet();
      persist();
      return { ok: true, revise: !!revise };
    }
    try {
      var result = opts.fromAssistant
        ? await run(opts.signal || null)
        : await ctx.runTracked({ type: 'statusbar_custom_layout', title: revise ? '状态栏排版修改' : '状态栏排版', target: currentCharName() }, function(task) {
          return run(task && task.signal);
        });
      return finishGenerate(opts, revise ? '已按现有排版修改' : '已重新生成排版', result);
    } catch (err) {
      return failGenerate(opts, err);
    } finally {
      if (!opts.fromAssistant) setBusy('layout', false);
    }
  }

  function currentMvuDesign() {
    var ext = cardState().cardBuilderExtensions;
    return ext ? ext.zmer_mvu_design : null;
  }

  function editVariables(changes) {
    var edited = applyStatusBarVariableEdits(currentMvuDesign(), changes);
    if (!edited.ok) return edited;
    try {
      var committed = commitVariableDesign(edited.design);
      publish();
      if (window.triggerGlobalUpdate) window.triggerGlobalUpdate();
      return committed;
    } catch (err) {
      return { ok: false, error: (err && err.message) || String(err) };
    }
  }

  function getSnapshot() {
    state = readDesign();
    loadCharactersFromWorldbook();
    var design = currentMvuDesign();
    var vars = design && Array.isArray(design.variables) ? design.variables : [];
    return {
      includeProtagonist: !!state.includeProtagonist,
      characters: (state.characters || []).map(function(c) {
        return { name: c.name, selected: c.selected === true };
      }),
      moduleFlags: state.moduleFlags,
      extra: state.extra || '',
      layoutPrompt: state.layoutPrompt || '',
      hasLayout: !!String(state.customBodyHtml || '').trim(),
      variables: vars.map(function(v) {
        return {
          path: String((v && (v.path || v.name)) || ''),
          type: v && v.type,
          default: v && v.default,
          description: v && v.description,
        };
      }),
    };
  }

  function applyOptions(patch) {
    patch = patch || {};
    state = readDesign();
    loadCharactersFromWorldbook();
    if (patch.includeProtagonist != null) state.includeProtagonist = !!patch.includeProtagonist;
    if (Array.isArray(patch.selectedNames)) {
      var known = Object.create(null);
      (state.characters || []).forEach(function(c) {
        if (c && c.name) known[c.name] = true;
      });
      var unknown = [];
      var want = Object.create(null);
      patch.selectedNames.forEach(function(raw) {
        var name = String(raw || '').trim();
        if (!name) return;
        if (!known[name]) unknown.push(name);
        else want[name] = true;
      });
      if (unknown.length) return { ok: false, error: '不是当前人物条目：' + unknown.join('、') };
      state.characters.forEach(function(c) {
        c.selected = !!want[c.name];
      });
    }
    if (patch.moduleFlags && typeof patch.moduleFlags === 'object') {
      var flags = state.moduleFlags || {};
      var bad = Object.keys(patch.moduleFlags).filter(function(k) {
        return !Object.prototype.hasOwnProperty.call(flags, k);
      });
      if (bad.length) return { ok: false, error: '不认识的模块：' + bad.join('、') };
      Object.keys(patch.moduleFlags).forEach(function(k) {
        flags[k] = !!patch.moduleFlags[k];
      });
      state.moduleFlags = flags;
    }
    if (patch.extra != null) state.extra = String(patch.extra);
    if (patch.layoutPrompt != null) state.layoutPrompt = String(patch.layoutPrompt);
    persist();
    publish();
    return { ok: true };
  }

  async function generateSampleFloors() {
    readFormIntoState();
    var reason = rejectStatusBarGenerate({
      includeProtagonist: state.includeProtagonist,
      characters: state.characters,
      charName: currentCharName(),
      moduleFlags: state.moduleFlags,
      layoutPrompt: state.layoutPrompt || '样例',
    });
    if (!state.includeProtagonist && !selectedFemales().length) {
      toast('请勾选主角或至少一名角色', 'warn');
      return;
    }
    if (reason === '请至少开启一个模块') {
      toast(reason, 'warn');
      return;
    }
    var gate = engineTryAllowed('card.statusbar.sampleFloors');
    if (!gate.ok) return;
    setBusy('sample', true);
    var checked = validateSampleFloors(buildLocalSampleFloors(pathsForPreview()));
    setBusy('sample', false);
    if (!checked.ok) {
      toast('样例楼层无效', 'error');
      return;
    }
    samples.floors = checked.floors;
    samples.activeFloor = 1;
    floorToastSent = false;
    publish();
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
    publish();
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

  var api = {
    getDesign: function() {
      state = readDesign();
      return normalizeDesign(state);
    },
    setDesign: function(d) {
      state = reconcileDesignWithCharName(normalizeDesign(d), currentCharName());
      clearSamples();
      persist();
      paintFromState();
      return normalizeDesign(state);
    },
    getSnapshot: getSnapshot,
    applyOptions: applyOptions,
    generateVariables: generateVariables,
    generateLayout: generateLayout,
    editVariables: editVariables,
    refresh: applyDesignToPanel,
    selectPreset: selectPreset,
    toggleNsfw: toggleNsfw,
    toggleModule: toggleModule,
    resetModules: resetModules,
    toggleProtagonist: toggleProtagonist,
    toggleCharacter: toggleCharacter,
    setExtra: setExtra,
    setLayoutPrompt: setLayoutPrompt,
    setView: setView,
    generateSampleFloors: generateSampleFloors,
    shiftFloor: shiftFloor,
    previewPrompt: openPromptPreview,
  };
  window.__statusBarApi__ = api;
  window.__statusBarPanelApi__ = api;

  state = readDesign();
  paintFromState();

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
    var next = ev && ev.detail && ev.detail.view;
    if (next !== 'statusbar') return;
    loadCharactersFromWorldbook();
    publish();
  });
  var charNameEl = ctx.$('charName');
  if (charNameEl) {
    charNameEl.addEventListener('input', function() {
      state = reconcileDesignWithCharName(state, currentCharName());
      persist();
      loadCharactersFromWorldbook();
      publish();
    });
  }

  return api;
}
