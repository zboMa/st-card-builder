/**
 * 小说工坊共享上下文（ctx）
 * 所有 panel 通过 ctx 访问共享状态，不再依赖闭包变量。
 */

export function createNovelAppContext(sm, opts) {
  var o = opts || {};
  var $ = function(id) { return document.getElementById(id); };
  var val = function(id) { var el = $(id); return el ? String(el.value || '').trim() : ''; };

  var ctx = {
    // ===== 状态 =====
    state: sm.state,
    sm: sm,

    // ===== DOM 访问 =====
    $: $,
    val: val,

    // ===== UI 工具 =====
    setBtnBusy: function(btn, busy, loadingText) {
      if (!btn) return;
      if (busy) {
        if (btn.dataset.idleLabel == null) btn.dataset.idleLabel = btn.textContent || '';
        btn.disabled = true;
        if (loadingText) btn.textContent = loadingText;
      } else {
        btn.disabled = false;
        if (btn.dataset.idleLabel != null) {
          btn.textContent = btn.dataset.idleLabel;
          delete btn.dataset.idleLabel;
        }
      }
    },

    iconBtn: function(attrs, icon, title, extraClass) {
      return '<button type="button" class="novel-icon-btn' + (extraClass ? ' ' + extraClass : '')
        + '" title="' + title + '" aria-label="' + title + '" ' + attrs + '>' + icon + '</button>';
    },

    /** 轻量提示（message toast） */
    showAppMessage: function(message, options) {
      var opts = options || {};
      var text = String(message || '').trim();
      if (!text || typeof document === 'undefined') return;
      var host = document.getElementById('appToastHost');
      if (!host) {
        host = document.createElement('div');
        host.id = 'appToastHost';
        host.className = 'app-toast-host';
        host.setAttribute('aria-live', 'polite');
        document.body.appendChild(host);
      }
      var toast = document.createElement('div');
      toast.className = 'app-toast' + (opts.level === 'error' ? ' is-error' : (opts.level === 'warn' ? ' is-warn' : ''));
      toast.textContent = text;
      host.appendChild(toast);
      var ms = opts.duration != null ? opts.duration : 2600;
      setTimeout(function() {
        toast.classList.add('is-leaving');
        setTimeout(function() { toast.remove(); }, 220);
      }, ms);
    },

    /** 面板状态行：写入对应 DOM；空文案不占高度（见 .novel-status-text:empty） */
    setStatus: function(id, msg) {
      var el = $(id);
      if (!el) return;
      el.textContent = msg || '';
    },

    isUnexpandedWbContent: function(content) {
      var c = String(content || '').trim();
      return c.length < 60 || c.indexOf('待展开') >= 0;
    },

    // ===== 弹窗 =====
    NOVEL_MODAL_IDS: [
      'novelModalChapter', 'novelModalProfile', 'novelModalExpandConfirm',
      'novelModalWb', 'novelModalEntity',
      'novelModalSplit', 'novelModalAnalyze', 'novelModalSetup', 'novelModalGreet', 'novelModalStyle',
      'novelModalCharScan', 'novelModalWbExtract', 'novelModalChapterRename', 'novelModalAnalyzeClear',
      'novelModalAnalyzeFails',
    ],

    openNovelModal: function(id) {
      var el = $(id);
      if (!el) return;
      if (!el._novelModalHome) el._novelModalHome = el.parentNode;
      document.body.appendChild(el);
      el.hidden = false;
      el.setAttribute('aria-hidden', 'false');
      document.body.classList.add('novel-modal-open');
    },

    closeNovelModal: function(id) {
      var el = $(id);
      if (!el) return;
      el.hidden = true;
      el.setAttribute('aria-hidden', 'true');
      if (el._novelModalHome && el.parentNode !== el._novelModalHome) {
        el._novelModalHome.appendChild(el);
      }
      if (id === 'novelModalProfile') ctx.editState.editingCharId = null;
      if (id === 'novelModalWb') {
        ctx.editState.editingWbIndex = -1;
        ctx.editState.isCreatingWbEntry = false;
      }
      if (id === 'novelModalEntity') ctx.editState.editingEntityId = null;
      if (id === 'novelModalChapterRename') ctx.editState.renamingChapterId = null;
      if (id === 'novelModalExpandConfirm' && ctx.editState.pendingExpandConfirm) {
        ctx.editState.pendingExpandConfirm.resolve(false);
        ctx.editState.pendingExpandConfirm = null;
      }
      var anyOpen = ctx.NOVEL_MODAL_IDS.some(function(mid) {
        var m = $(mid);
        return m && !m.hidden;
      });
      if (!anyOpen) document.body.classList.remove('novel-modal-open');
    },

    confirmExpandRecall: function(innerOpts) {
      var iopts = innerOpts || {};
      if (iopts.silent || iopts.skipConfirm) return Promise.resolve(true);
      var titleEl = $('novelModalExpandTitle');
      var metaEl = $('novelModalExpandMeta');
      var bodyEl = $('novelModalExpandBody');
      if (!bodyEl) return Promise.resolve(true);
      if (titleEl) titleEl.textContent = iopts.title || 'AI 扩展确认';
      if (metaEl) {
        metaEl.textContent = '将使用原文约 ' + (iopts.totalChars || 0) + ' tok'
          + (iopts.snippetCount != null ? '（' + iopts.snippetCount + ' 片段）' : '')
          + (iopts.truncated ? ' · 已按预算抽样' : '')
          + (iopts.terms && iopts.terms.length ? ' · 匹配词：' + iopts.terms.join('、') : '');
      }
      var bodyText = iopts.body || '（无摘录）';
      if ('value' in bodyEl && bodyEl.tagName === 'TEXTAREA') bodyEl.value = bodyText;
      else bodyEl.textContent = bodyText;
      return new Promise(function(resolve) {
        if (ctx.editState.pendingExpandConfirm) ctx.editState.pendingExpandConfirm.resolve(false);
        ctx.editState.pendingExpandConfirm = { resolve: resolve };
        ctx.openNovelModal('novelModalExpandConfirm');
      });
    },

    bindNovelModals: function() {
      document.querySelectorAll('[data-novel-modal-close]').forEach(function(el) {
        el.addEventListener('click', function() {
          ctx.closeNovelModal(el.getAttribute('data-novel-modal-close'));
        });
      });
      var confirmBtn = $('btnNovelExpandConfirmOk') || $('btnNovelExpandConfirm');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', function() {
          var pending = ctx.editState.pendingExpandConfirm;
          ctx.editState.pendingExpandConfirm = null;
          ctx.closeNovelModal('novelModalExpandConfirm');
          if (pending) pending.resolve(true);
        });
      }
      document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape') return;
        ctx.NOVEL_MODAL_IDS.forEach(function(id) { ctx.closeNovelModal(id); });
      });
    },

    // ===== 编辑态（可变 primitive，用 { value } 包装以便跨 module 共享引用） =====
    editState: {
      editingCharId: null,
      editingWbIndex: -1,
      isCreatingWbEntry: false,
      editingEntityId: null,
      novelWbSearchQuery: '',
      novelWbTypeFilter: '',
      novelCharSearchQuery: '',
      novelChapterSearchQuery: '',
      renamingChapterId: null,
      pendingExpandConfirm: null,
      /** 图谱：只显示人物节点及其关系 */
      graphPersonOnly: false,
      /** 图谱：选中高亮关系跳数（默认 2） */
      graphHighlightDepth: 2,
    },

    // ===== 忙碌标记 =====
    busyFlags: {
      charScan: false,
      wbExtract: false,
      styleDistill: false,
      charSetup: false,
      greetings: false,
      ragIndex: false,
      analyzeSkeleton: false,
      analyzeEnrich: false,
      analyzeRelations: false,
      analyzeAll: false,
    },

    // ===== 面板方法引用（面板 register 后赋值） =====
    panels: {},
    /**
     * 刷新所有面板（替代 renderAll）
     */
    renderAll: function() {
      var ps = ctx.panels;
      if (ps.source) ps.source.render();
      if (ps.chapters) ps.chapters.render();
      if (ps.setup) { ps.setup.renderSetup(); ps.setup.renderGreetings(); }
      if (ps.analyze) ps.analyze.render();
      if (ps.characters) ps.characters.render();
      if (ps.worldbook) ps.worldbook.render();
      if (ps.style) ps.style.render();
      if (ps.analyze && ps.analyze.renderGraph) ps.analyze.renderGraph();
      if (ctx.panels.shared) ctx.panels.shared.updateEstimates();
      // 门控 / 按钮预估由 browserApp 在 initNovelWorkshop 中注入，须在此一并刷新，
      // 否则「导入原始资料」等操作后拆章/角色/世界书等门控提示不会消失（见 #上传小说后仍提示上传）。
      if (typeof ctx.renderGatesFn === 'function') ctx.renderGatesFn();
      if (typeof ctx.updateExtractCallEstimates === 'function') ctx.updateExtractCallEstimates();
    },

    // ===== 卡片写回 =====
    setCharacterFields: function(opts) {
      if (!opts) return;
      var $charName = $('charName'), $wbName = $('wbName'), $desc = $('charDesc'), $notes = $('creatorNotes');
      if (opts.charName != null && $charName) $charName.value = opts.charName;
      if (opts.wbName != null && $wbName) $wbName.value = opts.wbName;
      if (opts.charDesc != null && $desc) $desc.value = opts.charDesc;
      if (opts.creatorNotes != null && $notes) $notes.value = opts.creatorNotes;
      window.dispatchEvent(new CustomEvent('card-builder-data-changed'));
    },

    setGreetingFields: function(opts) {
      if (!opts) return;
      var $fm = $('firstMes');
      if (opts.firstMes != null && $fm) $fm.value = opts.firstMes;
      if (opts.alternateGreetings != null && window.__altGreetings__) {
        window.__altGreetings__.length = 0;
        opts.alternateGreetings.forEach(function(g) { window.__altGreetings__.push(g); });
      }
      if (typeof window.__renderAltGreetings__ === 'function') {
        try { window.__renderAltGreetings__(); } catch (e) { console.warn('Rendering alternate greetings failed', e); }
      }
      window.dispatchEvent(new CustomEvent('card-builder-data-changed'));
    },

    // ===== save 快捷方法 =====
    save: function() {
      ctx.sm.saveDebounced();
      window.dispatchEvent(new CustomEvent('novel-state-changed', { detail: {} }));
    },

    // ===== cardId =====
    currentCardId: function() {
      if (typeof window.__getCurrentDraftId__ === 'function') {
        return String(window.__getCurrentDraftId__() || '').trim();
      }
      return ctx.sm.getBoundCardId();
    },

    bindCard: function(cardId, renderOpts) {
      var nextId = String(cardId || '').trim();
      if (!nextId) return Promise.resolve();
      if (ctx.sm.getBoundCardId() && ctx.sm.getBoundCardId() === nextId && !(renderOpts && renderOpts.force)) return Promise.resolve();
      return ctx.sm.bindCard(nextId).then(function() {
        ctx.state = ctx.sm.state;
        ctx.editState.editingCharId = null;
        ctx.syncRagOptionsToAiPanel();
        // 切卡后立即落盘（含空桶标记），避免 debounce 期间再切卡写串桶
        if (!(renderOpts && renderOpts.skipSave) && typeof ctx.sm.save === 'function') ctx.sm.save();
        if (!(renderOpts && renderOpts.render === false)) ctx.renderAll();
      }).catch(function(err) {
        console.warn('[novel] bindCard failed', err);
      });
    },

    // ===== RAG 同步 =====
    syncRagOptionsToAiPanel: function() {
      var s = ctx.state;
      if (!s.rag) return;
      try {
        var enableEl = $('assistantNovelRagEnable');
        var budgetEl = $('assistantNovelRagBudget');
        if (enableEl) enableEl.checked = s.rag.enabled !== false;
        if (budgetEl) budgetEl.value = String(s.rag.budget || 12000);
        localStorage.setItem('st_v3_builder_novel_rag', JSON.stringify({
          enabled: s.rag.enabled !== false,
          budget: s.rag.budget || 12000,
        }));
      } catch (e) { /* ignore */ }
    },

    applyRagOptionsFromUi: function(opts) {
      var s = ctx.state;
      var o = opts || {};
      if (!s.rag) s.rag = {};
      if (o.enabled != null) s.rag.enabled = !!o.enabled;
      if (o.budget != null) s.rag.budget = Math.max(2000, Math.floor(Number(o.budget) || 12000));
      ctx.save();
    },

    // ===== AI 基础设施 =====
    promptText: function(id, fallback) {
      if (window.__promptStore__ && window.__promptStore__.get) {
        var t = window.__promptStore__.get(id);
        if (t) return t;
      }
      return fallback || '';
    },

    callAI: async function(userContent, systemExtra, signal) {
      var apiUrlEl = $('apiUrl');
      var apiKeyEl = $('apiKey');
      var modelEl = $('modelSelect');
      if (!apiUrlEl || !modelEl || !modelEl.value) throw new Error('未配置 AI 模型（请先到「AI 配置」）');
      var messages = [];
      if (systemExtra) messages.push({ role: 'system', content: systemExtra });
      messages.push({ role: 'user', content: userContent });
      var res = await fetch(String(apiUrlEl.value).replace(/\/$/, '') + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + (apiKeyEl ? apiKeyEl.value.trim() : ''),
        },
        body: JSON.stringify({ model: modelEl.value, messages: messages, temperature: 0.2 }),
        signal: signal,
      });
      if (!res.ok) throw new Error(res.status === 429 ? '429 限流' : 'HTTP ' + res.status);
      var data = await res.json();
      var text = data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : '';
      text = String(text || '').trim();
      if (!text) throw new Error('模型返回空内容（可能被安全过滤或上下文过长）');
      return text;
    },

    runTracked: function(meta, fn) {
      var center = window.__aiTaskCenter__;
      if (center && typeof center.run === 'function') return center.run(meta, fn);
      return fn({ signal: undefined, id: null });
    },

    isTrackedAbort: function(err) {
      if (window.__isAiAbortError__) return window.__isAiAbortError__(err);
      return !!(err && (err.name === 'AbortError' || /abort|取消|已停止/i.test(String(err.message || ''))));
    },

    // ===== 门控（由 browserApp 在 initNovelWorkshop 中注入） =====
    gates: null,
    renderGatesFn: null,
    syncOutputs: null,
    updateExtractCallEstimates: null,
  };

  return ctx;
}
