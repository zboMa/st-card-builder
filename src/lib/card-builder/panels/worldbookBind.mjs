/**
 * 世界书面板：Bind + 助手桥（拆自 worldbook）
 */

/** @param {object} ctx @param {object} s @param {object} panel */
export function attachWorldbookBind(ctx, s, panel) {
  function bind() {
    if (panel._modalsBound) return;
    panel._modalsBound = true;

    s.entriesList = ctx.$('entriesList');
    s.btnCreateEntry = ctx.$('btnCreateEntry');

    var wbSearchInput = ctx.$('wbSearchInput');
    var wbSearchClear = ctx.$('wbSearchClear');
    var wbScopeTitle = ctx.$('wbScopeTitle');
    var wbScopeKeys = ctx.$('wbScopeKeys');
    var wbScopeContent = ctx.$('wbScopeContent');

    if (wbSearchInput) {
      wbSearchInput.addEventListener('input', function() {
        s.renderWbSearchResults(wbSearchInput.value);
      });
    }
    if (wbSearchClear) {
      wbSearchClear.addEventListener('click', function() {
        var si = ctx.$('wbSearchInput');
        si.value = '';
        s.renderWbSearchResults('');
        si.focus();
      });
    }
    [wbScopeTitle, wbScopeKeys, wbScopeContent].forEach(function(cb) {
      if (cb) cb.addEventListener('change', function() {
        var si = ctx.$('wbSearchInput');
        s.renderWbSearchResults(si ? si.value : '');
      });
    });

    if (s.btnCreateEntry) s.btnCreateEntry.addEventListener('click', s.toggleCreateEntryForm);

    var btnOpenWbAiSingle = ctx.$('btnOpenWbAiSingle');
    var btnOpenWbAiOrganize = ctx.$('btnOpenWbAiOrganize');
    var btnOpenWbAiKeygen = ctx.$('btnOpenWbAiKeygen');
    if (btnOpenWbAiSingle) btnOpenWbAiSingle.addEventListener('click', function() { s.openWbModal('wbModalSingle'); });
    if (btnOpenWbAiOrganize) btnOpenWbAiOrganize.addEventListener('click', function() { s.openWbModal('wbModalOrganize'); });
    if (btnOpenWbAiKeygen) btnOpenWbAiKeygen.addEventListener('click', function() { s.openWbModal('wbModalKeygen'); });

    document.querySelectorAll('[data-wb-modal-close]').forEach(function(el) {
      el.addEventListener('click', function() {
        s.closeWbModal(el.getAttribute('data-wb-modal-close'));
      });
    });

    var btnWbModalSave = ctx.$('btnWbModalSave');
    if (btnWbModalSave) {
      btnWbModalSave.addEventListener('click', function() {
        s.saveInlineEntry(s.isCreatingEntry ? -1 : s.editingIndex);
      });
    }

    document.addEventListener('keydown', function(e) {
      if (e.key !== 'Escape') return;
      s.WB_MODAL_IDS.forEach(function(id) { s.closeWbModal(id); });
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
            await s.generateContextAwareWBEntry(wbSinglePrompt ? wbSinglePrompt.value.trim() : '', '\u5355\u6761\u8865\u5145\u3002', task.signal);
          });
          s.renderEntriesList();
          ctx.save();
          if (wbSinglePrompt) wbSinglePrompt.value = '';
          s.closeWbModal('wbModalSingle');
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
        s.closeWbModal('wbModalOrganize');
        var organizeStatus = ctx.$('organizeStatus');
        var organizePreview = ctx.$('organizePreview');
        s.setStatusBar(organizeStatus, '\uD83D\uDD0D \u6B63\u5728\u5206\u6790 ' + ctx.state.worldbookEntries.length + ' \u6761\u4E16\u754C\u4E66\u6761\u76EE...', '#38bdf8');
        if (organizePreview) organizePreview.style.display = 'none';
        s.pendingOrganizeData = null;

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
            suggestions = suggestions.map(s.normalizeOrganizeSuggestion).filter(Boolean);
            if (suggestions.length === 0) throw new Error('AI \u8FD4\u56DE\u4E2D\u6CA1\u6709\u6709\u6548\u6761\u76EE');
            s.pendingOrganizeData = suggestions;
            s.renderOrganizePreview(suggestions);
            s.setStatusBar(organizeStatus, '\u2705 \u5206\u6790\u5B8C\u6210\uFF01\u8BF7\u68C0\u67E5\u4E0B\u65B9\u9884\u89C8\uFF0C\u786E\u8BA4\u540E\u70B9\u51FB\u300C\u5E94\u7528\u300D', '#34d399');
          });
        } catch (err) {
          if (ctx.isTrackedAbort(err)) s.setStatusBar(organizeStatus, '\u23F9 \u5DF2\u53D6\u6D88', 'var(--color-text-muted)');
          else s.setStatusBar(organizeStatus, '\u274C \u6574\u7406\u5931\u8D25: ' + ctx.escapeHtml(err.message), 'var(--color-danger)');
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
        s.closeWbModal('wbModalKeygen');
        var keygenStatus = ctx.$('keygenStatus');
        s.setStatusBar(keygenStatus, '\uD83E\uDDE0 \u6B63\u5728\u5206\u6790 ' + targets.length + ' \u6761\u6761\u76EE\u7684\u89E6\u53D1\u8BCD...', '#38bdf8');

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
            var batches = s.splitTargetsForKeygen(targets, charBlock);
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
              var batchResult = await s.completeTriggerKeysBatch(batch, batchIndex, batches.length, processed, targets.length, task.signal);
              updated += batchResult.updated;
              if (batchResult.missing && batchResult.missing.length > 0) {
                unresolved = unresolved.concat(batchResult.missing.map(function(item) {
                  return item.entry.comment || ('#' + item.index);
                }));
              }
            }

            s.renderEntriesList();
            ctx.save();
            if (unresolved.length > 0) {
              s.setStatusBar(
                keygenStatus,
                '\u26A0\uFE0F \u5DF2\u4E3A <strong>' + updated + '</strong> \u6761\u4E16\u754C\u4E66\u66F4\u65B0\u89E6\u53D1\u8BCD\uFF0C\u4F46\u4ECD\u6709 <strong>' + unresolved.length + '</strong> \u6761\u672A\u8FD4\u56DE\u7ED3\u679C\uFF1A' + unresolved.slice(0, 3).map(ctx.escapeHtml).join('\u3001') + (unresolved.length > 3 ? '\u2026' : ''),
                'var(--color-warning)'
              );
            } else {
              s.setStatusBar(keygenStatus, '\u2705 \u5DF2\u4E3A <strong>' + updated + '</strong> \u6761\u4E16\u754C\u4E66\u66F4\u65B0\u89E6\u53D1\u8BCD', '#34d399');
            }
          });
        } catch (err) {
          if (ctx.isTrackedAbort(err)) s.setStatusBar(ctx.$('keygenStatus'), '\u23F9 \u5DF2\u53D6\u6D88', 'var(--color-text-muted)');
          else s.setStatusBar(ctx.$('keygenStatus'), '\u274C \u89E6\u53D1\u8BCD\u751F\u6210\u5931\u8D25: ' + ctx.escapeHtml(err.message), 'var(--color-danger)');
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
          await s.generateContextAwareWBEntry(opts.direction || opts.instruction || '', '\u52A9\u624B\u5355\u6761\u8865\u5145\u3002', task.signal);
        });
        s.renderEntriesList();
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
        await s.aiRewriteEntry(idx, instruction, fakeBtn);
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
        suggestions = (suggestions || []).map(s.normalizeOrganizeSuggestion).filter(Boolean);
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
        s.renderEntriesList();
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
        var batches = s.splitTargetsForKeygen(targets, charBlock);
        var updated = 0;
        var processed = 0;
        for (var bi = 0; bi < batches.length; bi++) {
          processed += batches[bi].length;
          var br = await s.completeTriggerKeysBatch(batches[bi], bi, batches.length, processed, targets.length);
          updated += br.updated;
        }
        s.renderEntriesList();
        ctx.save();
        return { updated: updated, targets: targets.length };
      },
    };
  }
  panel.bindModals = bind;
}
