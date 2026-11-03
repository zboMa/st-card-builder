import { cardState } from '../../store/cardStore.mjs';
import { setGreetingFields, setWorldbookEntries } from '../../store/cardActions.mjs';
import { greetingStore, patchGreetingUi } from '../../store/greetingStore.mjs';
import { buildGreetingView } from './greetingViewModel.mjs';
import {
  applyGreetingInitChange,
  applyGreetingTexts,
  baselineLeavesFromEntries,
  buildGreetingInitUserPrompt,
  interpretGreetingInitDraft,
  parseOverrideLines,
} from '../../mvu/greetingInit.mjs';
import { engineTryAllowed } from '../../actionEngine/helpers.mjs';
import { DEFAULT_PROMPTS } from '../../promptCanon.mjs';

function emptyDrafts() {
  return { main: null, alts: {} };
}

function draftCopy(drafts) {
  var src = drafts || emptyDrafts();
  return {
    main: src.main != null ? src.main : null,
    alts: Object.assign({}, src.alts || {}),
  };
}

function targetKey(target) {
  if (target === 'main') return 'main';
  if (typeof target === 'number') return 'alt:' + target;
  if (target && typeof target === 'object' && typeof target.alternate === 'number') return 'alt:' + target.alternate;
  if (target && typeof target === 'object' && typeof target.index === 'number') return 'alt:' + target.index;
  return '';
}

export function createGreetingBridge(ctx) {
  var installed = false;
  var tokenTimer = null;

  function ui() {
    return greetingStore.get();
  }

  function feedback(message, level) {
    if (ctx.appFeedback) {
      ctx.appFeedback({ message: message, level: level || 'info', channel: 'toast' });
      return;
    }
    if (message) window.alert(message);
  }

  function readFlavorTip() {
    var cfg = null;
    try {
      cfg = window.__getNsfwConfig__ ? window.__getNsfwConfig__() : null;
    } catch (e) {
      cfg = null;
    }
    if (!cfg || (!cfg.enabled && !cfg.ntlEnabled && !cfg.corruptionEnabled)) return '';
    return '卡级成人配置已开启（见侧栏「成人配置」），用于世界书人物 / 恶堕档案；本页主角开场白不会注入 NSFW/NTL。';
  }

  function publish(opts) {
    var options = opts || {};
    if (options.resetDrafts) patchGreetingUi({ initDrafts: emptyDrafts() });
    if (!options.keepTokenTimer && tokenTimer) {
      clearTimeout(tokenTimer);
      tokenTimer = null;
    }
    var view = buildGreetingView(cardState(), greetingStore.get(), {
      flavorTip: readFlavorTip(),
      withTokens: options.withTokens !== false,
    });
    patchGreetingUi(view);
    return view;
  }

  function publishFast(opts) {
    var view = publish(Object.assign({}, opts || {}, {
      withTokens: false,
      keepTokenTimer: true,
    }));
    if (tokenTimer) clearTimeout(tokenTimer);
    tokenTimer = setTimeout(function() {
      tokenTimer = null;
      publish();
    }, 200);
    return view;
  }

  function saveSoon() {
    if (ctx.save) ctx.save();
  }

  function resetOpenAlts(count) {
    var arr = [];
    for (var i = 0; i < count; i++) arr.push(false);
    patchGreetingUi({ openAlts: arr });
  }

  function clearDraft(target) {
    var key = targetKey(target);
    var drafts = draftCopy(ui().initDrafts);
    if (key === 'main') {
      drafts.main = null;
    } else if (key.indexOf('alt:') === 0) {
      delete drafts.alts[key.slice(4)];
    }
    patchGreetingUi({ initDrafts: drafts });
  }

  function setFirstMes(text) {
    setGreetingFields({ firstMes: String(text == null ? '' : text) });
    publishFast();
    saveSoon();
  }

  function updateAltText(index, text) {
    var list = (cardState().altGreetings || []).slice();
    if (index < 0 || index >= list.length) return;
    list[index] = String(text == null ? '' : text);
    setGreetingFields({ altGreetings: list });
    publishFast();
    saveSoon();
  }

  function addAlt() {
    var state = cardState();
    var list = (state.altGreetings || []).slice();
    var inits = (state.greetingInitAlts || []).slice();
    while (inits.length < list.length) inits.push({});
    list.push('');
    inits.push({});
    setGreetingFields({ altGreetings: list, greetingInitAlts: inits });
    patchGreetingUi({ openAlts: (ui().openAlts || []).concat([false]) });
    publish();
    saveSoon();
    return list.length - 1;
  }

  function removeAlt(index) {
    var state = cardState();
    var list = (state.altGreetings || []).slice();
    var inits = (state.greetingInitAlts || []).slice();
    if (index < 0 || index >= list.length) return;
    while (inits.length < list.length) inits.push({});
    list.splice(index, 1);
    inits.splice(index, 1);
    setGreetingFields({ altGreetings: list, greetingInitAlts: inits });
    resetOpenAlts(list.length);
    publish({ resetDrafts: true });
    saveSoon();
  }

  function moveAlt(index, direction) {
    var state = cardState();
    var list = (state.altGreetings || []).slice();
    var inits = (state.greetingInitAlts || []).slice();
    while (inits.length < list.length) inits.push({});
    var next = index + direction;
    if (index < 0 || index >= list.length || next < 0 || next >= list.length) return;
    var text = list[index];
    list[index] = list[next];
    list[next] = text;
    var init = inits[index];
    inits[index] = inits[next];
    inits[next] = init;
    setGreetingFields({ altGreetings: list, greetingInitAlts: inits });
    resetOpenAlts(list.length);
    publish({ resetDrafts: true });
    saveSoon();
  }

  function setMainInitText(text) {
    var raw = String(text == null ? '' : text);
    var drafts = draftCopy(ui().initDrafts);
    drafts.main = raw;
    setGreetingFields({ greetingInitMain: parseOverrideLines(raw) });
    patchGreetingUi({ initDrafts: drafts });
    publishFast();
    saveSoon();
  }

  function setAltInitText(index, text) {
    var state = cardState();
    var inits = (state.greetingInitAlts || []).slice();
    var list = (state.altGreetings || []).slice();
    while (inits.length < list.length) inits.push({});
    if (index < 0 || index >= list.length) return;
    var raw = String(text == null ? '' : text);
    var drafts = draftCopy(ui().initDrafts);
    drafts.alts[index] = raw;
    inits[index] = parseOverrideLines(raw);
    setGreetingFields({ greetingInitAlts: inits });
    patchGreetingUi({ initDrafts: drafts });
    publishFast();
    saveSoon();
  }

  function warnIfNoBaseline() {
    var baseline = baselineLeavesFromEntries(cardState().worldbookEntries || []);
    if (Object.keys(baseline).length) return;
    feedback('请先生成变量。没有保底时，这里写上的值会成为这个开局的全部初始值。', 'warn');
  }

  function toggleMainInit() {
    var open = !ui().mainInitOpen;
    patchGreetingUi({ mainInitOpen: open });
    if (open) warnIfNoBaseline();
    publish();
  }

  function toggleAltInit(index) {
    var list = (ui().openAlts || []).slice();
    list[index] = !list[index];
    patchGreetingUi({ openAlts: list });
    if (list[index]) warnIfNoBaseline();
    publish();
  }

  function openPreview(title, text) {
    if (typeof window.__openTextPreview__ === 'function') {
      window.__openTextPreview__({ title: title, text: text });
    }
  }

  function readAiConfig() {
    var read = function(id) {
      var el = ctx.$(id);
      return el && el.value != null ? String(el.value).trim() : '';
    };
    return {
      url: read('apiUrl').replace(/\/$/, ''),
      key: read('apiKey'),
      model: read('modelSelect'),
    };
  }

  function applyInitChange(opts) {
    var state = cardState();
    var result = applyGreetingInitChange({
      greetingInitMain: state.greetingInitMain || {},
      greetingInitAlts: state.greetingInitAlts || [],
      altCount: (state.altGreetings || []).length,
      baseline: baselineLeavesFromEntries(state.worldbookEntries || []),
    }, opts || {});
    if (!result.ok) throw new Error(result.error || '设置开场初始值失败');
    setGreetingFields({
      greetingInitMain: result.greetingInitMain,
      greetingInitAlts: result.greetingInitAlts,
    });
    clearDraft(result.target);
    publish();
    saveSoon();
    return result;
  }

  async function generateGreetingInit(target, prose) {
    var baseline = baselineLeavesFromEntries(cardState().worldbookEntries || []);
    if (!Object.keys(baseline).length) {
      feedback('请先生成变量', 'warn');
      return false;
    }
    if (!String(prose || '').trim()) {
      feedback('先写这一条开场白', 'warn');
      return false;
    }
    if (!engineTryAllowed('card.greeting.init').ok) return false;
    var cfg = readAiConfig();
    if (!cfg.url || !cfg.model) {
      feedback('请先在「AI 配置」填写接口与模型', 'warn');
      return false;
    }
    var key = targetKey(target);
    patchGreetingUi({ busyTarget: key });
    publish();
    try {
      var draft = await ctx.runTracked({
        type: 'greeting_init_generate',
        title: '开场初始值',
        target: '开场初始值',
      }, async function(task) {
        var headers = { 'Content-Type': 'application/json' };
        if (cfg.key) headers.Authorization = 'Bearer ' + cfg.key;
        var res = await ctx.fetchAIContent({
          context: '开场初始值',
          url: cfg.url + '/chat/completions',
          headers: headers,
          model: cfg.model,
          messages: [
            { role: 'system', content: ctx.promptText('greetingInitGen', DEFAULT_PROMPTS.greetingInitGen) },
            { role: 'user', content: buildGreetingInitUserPrompt(prose, baseline) },
          ],
          temperature: 0.2,
          httpErrorPrefix: 'API HTTP ',
          signal: task && task.signal,
        });
        return interpretGreetingInitDraft(res && res.content, baseline);
      });
      if (!draft || draft.empty) {
        applyInitChange({ target: target, clear: true });
        if (draft && draft.dropped && draft.dropped.length) feedback('模型写的路径不在保底里，没有写入', 'warn');
        else feedback('这条开场和保底一致', 'info');
        return true;
      }
      applyInitChange({ target: target, clear: true, overrides: draft.overrides });
      feedback('已生成 ' + Object.keys(draft.overrides).length + ' 项初始值', 'success');
      return true;
    } catch (err) {
      if (ctx.isTrackedAbort && ctx.isTrackedAbort(err)) {
        feedback('已取消', 'info');
        return false;
      }
      feedback((err && err.message) || String(err), 'error');
      return false;
    } finally {
      patchGreetingUi({ busyTarget: '' });
      publish();
    }
  }

  function setWorldbookFromImport(entries) {
    if (typeof window.__setWorldbookEntries__ === 'function') {
      window.__setWorldbookEntries__(entries);
      return;
    }
    setWorldbookEntries(entries);
  }

  function acceptGreetingTexts(firstMes, altGreetings, mode) {
    var state = cardState();
    var result = applyGreetingTexts({
      firstMes: firstMes == null ? (state.firstMes || '') : firstMes,
      altGreetings: altGreetings == null ? (state.altGreetings || []).slice() : altGreetings,
      entries: state.worldbookEntries || [],
      previousMain: state.greetingInitMain || {},
      previousAlts: state.greetingInitAlts || [],
      resetMain: mode !== 'keep' && firstMes != null,
      resetAlts: mode !== 'keep' && altGreetings != null,
    });
    if (result.baselineInstalled) setWorldbookFromImport(result.entries);
    setGreetingFields({
      firstMes: result.firstMes,
      greetingInitMain: result.greetingInitMain,
      greetingInitAlts: result.greetingInitAlts,
      altGreetings: result.altGreetings,
    });
    resetOpenAlts(result.altGreetings.length);
    publish({ resetDrafts: true });
    saveSoon();
    return result;
  }

  function setGreetingInit(opts) {
    var result = applyInitChange(opts || {});
    return {
      target: result.target,
      overrides: result.overrides,
      cleared: result.cleared,
    };
  }

  function installGlobals() {
    if (installed) return;
    installed = true;

    var legacyAlts = Array.isArray(window.__altGreetings__) ? window.__altGreetings__.slice() : null;
    var legacyMain = window.__greetingInitMain__ && typeof window.__greetingInitMain__ === 'object'
      ? Object.assign({}, window.__greetingInitMain__)
      : null;
    var legacyAltsInit = Array.isArray(window.__greetingInitAlts__)
      ? window.__greetingInitAlts__.map(function(item) { return Object.assign({}, item || {}); })
      : null;
    var state = cardState();
    var adopt = {};
    if (legacyAlts && legacyAlts.length && !(state.altGreetings || []).length) adopt.altGreetings = legacyAlts;
    if (legacyMain && Object.keys(legacyMain).length && !Object.keys(state.greetingInitMain || {}).length) adopt.greetingInitMain = legacyMain;
    if (legacyAltsInit && legacyAltsInit.length && !(state.greetingInitAlts || []).length) adopt.greetingInitAlts = legacyAltsInit;
    if (Object.keys(adopt).length) setGreetingFields(adopt);

    Object.defineProperty(window, '__altGreetings__', {
      configurable: true,
      enumerable: true,
      get: function() { return cardState().altGreetings || []; },
      set: function(value) {
        setGreetingFields({ altGreetings: Array.isArray(value) ? value : [] });
        publish({ resetDrafts: true });
      },
    });
    Object.defineProperty(window, '__greetingInitMain__', {
      configurable: true,
      enumerable: true,
      get: function() { return cardState().greetingInitMain || {}; },
      set: function(value) {
        setGreetingFields({ greetingInitMain: value && typeof value === 'object' ? value : {} });
        publish({ resetDrafts: true });
      },
    });
    Object.defineProperty(window, '__greetingInitAlts__', {
      configurable: true,
      enumerable: true,
      get: function() { return cardState().greetingInitAlts || []; },
      set: function(value) {
        setGreetingFields({ greetingInitAlts: Array.isArray(value) ? value : [] });
        publish({ resetDrafts: true });
      },
    });

    window.__acceptGreetingTexts__ = acceptGreetingTexts;
    window.__setGreetingInit__ = setGreetingInit;
    window.__renderAltGreetings__ = function() {
      resetOpenAlts((cardState().altGreetings || []).length);
      patchGreetingUi({ mainInitOpen: false });
      publish({ resetDrafts: true });
    };
  }

  function bind() {
    installGlobals();

    window.__greetingPanelApi__ = {
      refresh: function() { publish({ resetDrafts: true }); },
      setFirstMes: setFirstMes,
      updateAltText: updateAltText,
      addAlt: addAlt,
      removeAlt: removeAlt,
      moveAlt: moveAlt,
      setMainInitText: setMainInitText,
      setAltInitText: setAltInitText,
      toggleMainInit: toggleMainInit,
      toggleAltInit: toggleAltInit,
      previewMain: function() { openPreview('主开场白', cardState().firstMes || ''); },
      previewAlt: function(index) {
        var text = (cardState().altGreetings || [])[index] || '';
        openPreview('开场白 #' + (index + 2), text);
      },
      generateMainInit: function() { return generateGreetingInit('main', cardState().firstMes || ''); },
      generateAltInit: function(index) {
        var text = (cardState().altGreetings || [])[index] || '';
        return generateGreetingInit({ alternate: index }, text);
      },
      warnIfNoBaseline: warnIfNoBaseline,
    };

    window.addEventListener('nsfw-config-changed', function() { publish(); });
    window.addEventListener('worldbook-changed', function() { publish(); });
    window.addEventListener('app-view-changed', function() { publish(); });
    window.addEventListener('card-builder-data-changed', function() { publish({ resetDrafts: true }); });
    window.addEventListener('card-draft-changed', function() {
      patchGreetingUi({
        mainInitOpen: false,
        openAlts: [],
        initDrafts: emptyDrafts(),
        busyTarget: '',
      });
      publish();
    });

    publish({ resetDrafts: true });
  }

  return { bind: bind, publish: publish };
}
