/**
 * 世界书面板 Vue 桥：条目 CRUD、搜索、编辑与 AI 动作。
 */
import { setWorldbookEntries } from '../../store/cardActions.mjs';
import { patchWorldbook, patchWorldbookEditor, worldbookStore } from '../../store/worldbookStore.mjs';
import {
  buildWorldbookEditor,
  buildWorldbookView,
  organizePreview,
  worldbookSkipOrganize,
} from './worldbookViewModel.mjs';
import { getDefaultWBEntry, normalizeWBEntry, clampInt } from '../state.mjs';
import { toAiJsonEntry } from '../../worldbook/worldbookEntryBridge.mjs';
import { wbEntryTitle } from '../../worldbook/worldbookUi.mjs';
import { countTokens, formatTokenCount } from '../../tokenStats.mjs';
import { openWorldbookRelationGraphModal } from './wbRelationGraph.mjs';

function splitKeys(value) {
  return String(value || '').split(/[,，]/).map(function(k) { return k.trim(); }).filter(Boolean);
}

function runTracked(ctx, type, title, target, fn) {
  if (ctx.runTracked) {
    return ctx.runTracked({ type: type, title: title, target: target }, fn);
  }
  return fn({ signal: null });
}

export function attachWorldbookBridge(ctx, s, panel) {
  function ui() { return worldbookStore.get(); }

  function publish() {
    var view = buildWorldbookView(ctx.state, ui());
    patchWorldbook(view);
    refreshTokenCount();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('worldbook-changed'));
    }
  }

  function refreshTokenCount() {
    var entries = ctx.state.worldbookEntries || [];
    var total = 0;
    entries.forEach(function(entry) {
      total += countTokens(String(entry && entry.content || ''));
    });
    patchWorldbook({
      tokenText: entries.length + ' 条 · ' + formatTokenCount(total) + ' tok',
      tokenTitle: total + ' tokens',
    });
  }

  function saveEntries(next) {
    setWorldbookEntries(next);
    if (ctx.save) ctx.save();
    publish();
  }

  function closeModal() {
    patchWorldbook({ modal: '' });
    patchWorldbookEditor({ isNew: false, index: -1, error: '', editor: null });
  }

  function openEdit(index, isNew) {
    var entry = isNew ? getDefaultWBEntry() : (ctx.state.worldbookEntries[index] || getDefaultWBEntry());
    patchWorldbook({ modal: 'edit' });
    patchWorldbookEditor({
      isNew: !!isNew,
      index: isNew ? -1 : index,
      error: '',
      editor: buildWorldbookEditor(entry, isNew),
    });
  }

  function updateEditor(patch) {
    var cur = ui().edit.editor || {};
    patchWorldbookEditor({ editor: Object.assign({}, cur, patch || {}) });
  }

  function saveEditor() {
    var edit = ui().edit;
    var editor = edit.editor || {};
    if (!String(editor.content || '').trim()) {
      patchWorldbookEditor({ error: '内容不能为空' });
      return false;
    }
    var existing = edit.isNew ? null : ctx.state.worldbookEntries[edit.index];
    var next = normalizeWBEntry(Object.assign({}, existing || getDefaultWBEntry(), {
      displayName: String(editor.displayName || '').trim(),
      content: String(editor.content || '').trim(),
      keys: splitKeys(editor.keys),
      job: String(editor.job || '').trim(),
      group: String(editor.group || '').trim(),
      reads: String(editor.reads || '').trim(),
      strategy: editor.strategy || 'selective',
      position: clampInt(editor.position, 0, 0, 6),
      depth: clampInt(editor.depth, 4, 0, 999),
      role: clampInt(editor.role, 0, 0, 2),
      order: clampInt(editor.order, 100, 0, 999),
      prob: clampInt(editor.prob, 100, 1, 100),
    }));
    var list = (ctx.state.worldbookEntries || []).slice();
    if (edit.isNew) list.push(next);
    else list[edit.index] = next;
    saveEntries(list);
    closeModal();
    return true;
  }

  async function deleteEntry(index) {
    var ok = ctx.showConfirmDialog
      ? await ctx.showConfirmDialog({
        icon: '⚠',
        title: '删除世界书条目？',
        message: '确认删除当前世界书条目？此操作不可撤销。',
        okText: '删除',
        cancelText: '取消',
      })
      : confirm('确认删除当前世界书条目？');
    if (!ok) return false;
    var list = (ctx.state.worldbookEntries || []).slice();
    list.splice(index, 1);
    saveEntries(list);
    if (ui().edit.index === index) closeModal();
    return true;
  }

  async function rewriteEntry(index) {
    var old = ctx.state.worldbookEntries[index];
    if (!old) return;
    var isSkeleton = String(old.content || '').length < 60;
    var req = '';
    if (ctx.showPromptDialog) {
      var ans = await ctx.showPromptDialog({
        icon: isSkeleton ? '✨' : '✎',
        title: isSkeleton ? 'AI 展开骨架' : 'AI 重写条目',
        message: isSkeleton ? '可直接展开；也可填写补充要求。' : '填写重写要求（可留空）。',
        okText: isSkeleton ? '展开' : '开始重写',
        cancelText: '取消',
        defaultValue: '',
      });
      if (ans == null) return;
      req = String(ans || '').trim();
    }
    await s.aiRewriteEntry(index, req, null);
    setWorldbookEntries((ctx.state.worldbookEntries || []).slice());
    if (ctx.save) ctx.save();
    publish();
  }

  function openAi(kind) {
    patchWorldbook({ modal: kind });
  }

  function setSingle(patch) {
    patchWorldbook({ single: Object.assign({}, ui().single, patch || {}) });
  }

  async function runSingle() {
    var conf = ui().single;
    if (!ctx.val('modelSelect')) { alert('请先选择模型！'); return; }
    patchWorldbook({ single: Object.assign({}, conf, { busy: true }) });
    try {
      await runTracked(ctx, 'wb_single', '世界书单条生成', String(conf.prompt || '').slice(0, 40), async function(task) {
        await s.generateContextAwareWBEntry(
          conf.prompt || '',
          '单条补充。',
          task.signal,
          { includeCharData: conf.includeCharData, includeOtherEntries: conf.includeOtherEntries }
        );
      });
      setWorldbookEntries((ctx.state.worldbookEntries || []).slice());
      if (ctx.save) ctx.save();
      closeModal();
      patchWorldbook({ single: Object.assign({}, ui().single, { prompt: '', busy: false }) });
      publish();
    } catch (e) {
      patchWorldbook({ single: Object.assign({}, ui().single, { busy: false }) });
      if (!ctx.isTrackedAbort || !ctx.isTrackedAbort(e)) alert('生成失败: ' + e.message);
    }
  }

  async function runOrganize(applyLater) {
    var entries = ctx.state.worldbookEntries || [];
    if (!entries.length) { alert('世界书为空，没有可整理的条目！'); return; }
    if (!ctx.val('modelSelect')) { alert('请先选择 AI 模型！'); return; }
    patchWorldbook({ modal: '', organize: Object.assign({}, ui().organize, { busy: true, status: '🔍 正在分析 ' + entries.length + ' 条世界书条目...', statusKind: 'info', preview: [] }) });
    try {
      await runTracked(ctx, 'wb_organize', '世界书智能整理', entries.length + ' 条', async function(task) {
        var targets = entries.map(function(e, i) { return { e: e, i: i }; }).filter(function(x) { return !worldbookSkipOrganize(x.e); });
        if (!targets.length) throw new Error('当前全部为受控系统条目，无可整理参数');
        var summaries = targets.map(function(x) {
          return {
            index: x.i, title: wbEntryTitle(x.e) || '未命名',
            content_preview: String(x.e.content || '').substring(0, 150),
            strategy: x.e.strategy, keys: (x.e.keys || []).join(', '),
            current_position: x.e.position, current_role: x.e.role,
            current_depth: x.e.depth, current_order: x.e.order, current_prob: x.e.prob,
          };
        });
        var url = String(ctx.$('apiUrl').value).replace(/\/$/, '') + '/chat/completions';
        var key = ctx.val('apiKey');
        var headers = { 'Content-Type': 'application/json' };
        if (key) headers.Authorization = 'Bearer ' + key;
        var aiResp = await ctx.fetchAIContent({
          context: '世界书整理参数优化', url: url, headers: headers, model: ctx.val('modelSelect'),
          messages: [
            { role: 'system', content: ctx.promptText('wbOrganize', '') },
            { role: 'user', content: '以下是 ' + targets.length + ' 条世界书条目（已排除系统受控条目），请分析并优化参数：\n\n' + JSON.stringify(summaries, null, 2) },
          ],
          temperature: 0.3, httpErrorPrefix: 'HTTP ', signal: task.signal,
        });
        var suggestions;
        try { suggestions = ctx.extractJsonArray(aiResp.content, '世界书整理'); }
        catch (e) { suggestions = [ctx.extractJsonObj(aiResp.content, '世界书整理/fallback')]; }
        suggestions = (suggestions || []).map(s.normalizeOrganizeSuggestion).filter(Boolean);
        if (!suggestions.length) throw new Error('AI 返回中没有有效条目');
        var preview = organizePreview(entries, suggestions);
        patchWorldbook({ organize: Object.assign({}, ui().organize, { busy: false, status: '✅ 分析完成！请检查预览。', statusKind: 'ok', preview: preview, suggestions: suggestions }) });
        if (applyLater) applyOrganize(suggestions, false);
      });
    } catch (e) {
      patchWorldbook({ organize: Object.assign({}, ui().organize, { busy: false, status: '❌ 整理失败: ' + e.message, statusKind: 'err' }) });
    }
  }

  function applyOrganize(suggestions, notify) {
    var list = (ctx.state.worldbookEntries || []).slice();
    (suggestions || []).forEach(function(item) {
      var idx = item.index;
      if (idx === undefined || idx < 0 || idx >= list.length) return;
      ['position', 'role', 'depth', 'order', 'prob'].forEach(function(key) {
        if (item[key] !== undefined) list[idx][key] = item[key];
      });
    });
    saveEntries(list);
    patchWorldbook({ organize: Object.assign({}, ui().organize, { preview: [], suggestions: [], status: '已应用整理结果', statusKind: 'ok' }) });
    if (notify !== false) closeModal();
  }

  async function runKeygen() {
    if (!ctx.val('modelSelect')) { alert('请先选择模型！'); return; }
    patchWorldbook({ modal: '', keygen: Object.assign({}, ui().keygen, { busy: true, status: '🧠 正在生成触发词...', statusKind: 'info' }) });
    try {
      await runTracked(ctx, 'wb_keygen', '世界书触发词补全', '全部条目', async function(task) {
        var targets = (ctx.state.worldbookEntries || []).map(function(entry, index) { return { entry: entry, index: index }; })
          .filter(function(item) { return item.entry.strategy !== 'constant'; });
        if (!targets.length) throw new Error('当前条目都是常驻条目，没有需要生成触发词的目标。');
        var charBlock = { name: ctx.val('charName'), worldbook: ctx.val('wbName'), description_preview: ctx.val('charDesc').substring(0, 300) };
        var batches = s.splitTargetsForKeygen(targets, charBlock);
        var processed = 0;
        for (var i = 0; i < batches.length; i++) {
          if (task.signal && task.signal.aborted) throw new DOMException('已取消', 'AbortError');
          processed += batches[i].length;
          await s.completeTriggerKeysBatch(batches[i], i, batches.length, processed, targets.length, task.signal);
        }
      });
      setWorldbookEntries((ctx.state.worldbookEntries || []).slice());
      if (ctx.save) ctx.save();
      patchWorldbook({ keygen: Object.assign({}, ui().keygen, { busy: false, status: '✅ 已完成触发词补全', statusKind: 'ok' }) });
      publish();
    } catch (e) {
      patchWorldbook({ keygen: Object.assign({}, ui().keygen, { busy: false, status: '❌ 触发词生成失败: ' + e.message, statusKind: 'err' }) });
    }
  }

  function bind() {
    s.setPublisher(publish);
    publish();
    window.__worldbookPanelApi__ = {
      refresh: publish,
      setQuery: function(value) { patchWorldbook({ query: String(value || '') }); publish(); },
      setScope: function(key, value) {
        var patch = {};
        patch[key] = !!value;
        patchWorldbook(patch);
        publish();
      },
      setFamily: function(value) { patchWorldbook({ family: String(value || 'all') }); publish(); },
      openCreate: function() { openEdit(-1, true); },
      openEdit: function(index) { openEdit(index, false); },
      updateEditor: updateEditor,
      saveEditor: saveEditor,
      deleteEntry: deleteEntry,
      rewrite: rewriteEntry,
      openAi: openAi,
      closeModal: closeModal,
      setSingle: setSingle,
      runSingle: runSingle,
      runOrganize: runOrganize,
      applyOrganize: function(suggestions) { applyOrganize(suggestions || ui().organize.suggestions, true); },
      runKeygen: runKeygen,
      openRelation: openWorldbookRelationGraphModal,
      openAuditor: function() {
        if (window.__openWbAuditorModal__) window.__openWbAuditorModal__();
        else setTimeout(function() { if (window.__openWbAuditorModal__) window.__openWbAuditorModal__(); }, 0);
      },
    };

    window.__assistantWbAi__ = {
      generateEntry: async function(opts) {
        opts = opts || {};
        var before = ctx.state.worldbookEntries.length;
        await runTracked(ctx, 'wb_single', '助手·世界书单条生成', String(opts.direction || opts.instruction || '').slice(0, 40), async function(task) {
          await s.generateContextAwareWBEntry(opts.direction || opts.instruction || '', '助手调用。', task.signal, {
            includeCharData: true, includeOtherEntries: true,
          });
        });
        setWorldbookEntries((ctx.state.worldbookEntries || []).slice());
        publish();
        if (ctx.save) ctx.save();
        var last = ctx.state.worldbookEntries[ctx.state.worldbookEntries.length - 1];
        return { added: ctx.state.worldbookEntries.length - before, total: ctx.state.worldbookEntries.length, entry: last ? Object.assign({ contentLen: String(last.content || '').length }, toAiJsonEntry(last)) : null };
      },
      mutateEntry: async function(opts) {
        opts = opts || {};
        var idx = typeof opts.index === 'number' ? opts.index : -1;
        if (idx < 0 || idx >= ctx.state.worldbookEntries.length) throw new Error('条目索引无效');
        var instruction = opts.instruction || opts.direction || '';
        await s.aiRewriteEntry(idx, instruction, null);
        setWorldbookEntries((ctx.state.worldbookEntries || []).slice());
        if (ctx.save) ctx.save();
        publish();
        var e = ctx.state.worldbookEntries[idx];
        return Object.assign({ index: idx, contentLen: String(e.content || '').length, mode: opts.mode || 'expand' }, toAiJsonEntry(e));
      },
      organize: async function(opts) {
        opts = opts || {};
        if (!ctx.val('modelSelect')) throw new Error('请先选择 AI 模型');
        var entries = ctx.state.worldbookEntries || [];
        var targets = entries.map(function(e, i) { return { e: e, i: i }; }).filter(function(x) { return !worldbookSkipOrganize(x.e); });
        if (!targets.length) throw new Error('当前全部为受控系统条目，无可整理参数');
        var summaries = targets.map(function(x) {
          return { index: x.i, title: wbEntryTitle(x.e) || '未命名', content_preview: String(x.e.content || '').substring(0, 150), strategy: x.e.strategy, keys: (x.e.keys || []).join(', '), current_position: x.e.position, current_role: x.e.role, current_depth: x.e.depth, current_order: x.e.order, current_prob: x.e.prob };
        });
        var headers = { 'Content-Type': 'application/json' };
        var key = ctx.val('apiKey');
        if (key) headers.Authorization = 'Bearer ' + key;
        var aiResp = await ctx.fetchAIContent({
          context: '世界书整理参数优化/助手', url: String(ctx.$('apiUrl').value).replace(/\/$/, '') + '/chat/completions',
          headers: headers, model: ctx.val('modelSelect'),
          messages: [
            { role: 'system', content: ctx.promptText('wbOrganize', '') },
            { role: 'user', content: '以下是 ' + targets.length + ' 条世界书条目（已排除系统受控条目），请分析并优化参数：\n\n' + JSON.stringify(summaries, null, 2) },
          ],
          temperature: 0.3, httpErrorPrefix: 'HTTP ',
        });
        var suggestions;
        try { suggestions = ctx.extractJsonArray(aiResp.content, '世界书整理/助手'); }
        catch (e) { suggestions = [ctx.extractJsonObj(aiResp.content, '世界书整理/助手/fallback')]; }
        suggestions = (suggestions || []).map(s.normalizeOrganizeSuggestion).filter(Boolean);
        if (!suggestions.length) throw new Error('AI 返回中没有有效条目');
        var preview = organizePreview(entries, suggestions);
        if (opts.apply === false) return { applied: false, preview: preview, changeCount: preview.length };
        applyOrganize(suggestions, false);
        return { applied: true, appliedCount: preview.length, preview: preview };
      },
      batchFillKeys: async function(opts) {
        opts = opts || {};
        if (!ctx.val('modelSelect')) throw new Error('请先选择 AI 模型');
        var targets = (ctx.state.worldbookEntries || []).map(function(entry, index) { return { entry: entry, index: index }; })
          .filter(function(item) { return item.entry.strategy !== 'constant' && (!opts.onlyMissing || !item.entry.keys || !item.entry.keys.length); });
        if (!targets.length) return { updated: 0, note: '无目标条目' };
        var charBlock = { name: ctx.val('charName'), worldbook: ctx.val('wbName'), description_preview: ctx.val('charDesc').substring(0, 300) };
        var batches = s.splitTargetsForKeygen(targets, charBlock);
        var updated = 0;
        var processed = 0;
        for (var i = 0; i < batches.length; i++) {
          processed += batches[i].length;
          var br = await s.completeTriggerKeysBatch(batches[i], i, batches.length, processed, targets.length);
          updated += br.updated;
        }
        setWorldbookEntries((ctx.state.worldbookEntries || []).slice());
        if (ctx.save) ctx.save();
        publish();
        return { updated: updated, targets: targets.length };
      },
    };
  }

  return { bind: bind, publish: publish, closeModal: closeModal };
}
