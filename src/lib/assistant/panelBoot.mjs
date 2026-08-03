/**
 * 右栏助手面板 boot（从 AssistantPanel.astro 外提）
 */

import { createToolExecutor } from './executor.mjs';
import { parseReactStep } from './reactParse.mjs';
import {
    createAssistantSessionStore,
    createSnapshotStack,
    assistantSessionKeyFor,
    assistantSnapshotKeyFor,
    migrateLegacyAssistantSession,
  } from './session.mjs';
import { ASSISTANT_PRESET_CHIPS, getToolByName } from './tools.mjs';
import { normalizeCharacterFieldKey, normalizeCharacterPatch, CHARACTER_FIELD_HINT } from './characterFields.mjs';
import {
    buildToolUiMessage,
    summarizePendingConfirm,
    toolMessageSummary,
    parseToolNameFromLegacy,
    parseRiskFromLegacy,
  } from './toolTraceSummary.mjs';
import {
    estimateAssistantContext,
    formatAssistantContextLabel,
    formatAssistantContextTitle,
    buildAssistantContextSections,
  } from './tokenEstimate.mjs';
import { prepareAssistantMessages } from './contextManager.mjs';
import { isCatalogRelevantText, buildCatalogBlocks } from '../catalogSummaries.mjs';
import { renderAssistantMarkdown, escapeAssistantHtml } from './markdownRender.mjs';
import {
    buildRagPreviewPayload,
    buildUserModelContent,
    collectSnippetKeys,
    filterNewSnippets,
    formatRagPreviewMeta,
    messageContentForDisplay,
    pickRelatedEntities,
    formatRelationContextLines,
  } from './ragInject.mjs';
import { inferMvuCandidatesFromCard, corruptionProgressGap } from '../mvu/inferFromCard.mjs';
import { STATUS_BAR_EXT_KEY } from '../statusBar.mjs';
import { engineTryAllowed } from '../actionEngine/helpers.mjs';

export function initAssistantPanelShellMode() {
function initAssistantModeSwitch() {
    var panel = document.getElementById('assistantPanel');
    var switchEl = document.getElementById('assistantModeSwitch');
    var titleEl = document.getElementById('assistantPanelTitle');
    var subEl = document.getElementById('assistantPanelSub');
    var stageAssistant = document.getElementById('assistantStageAssistant');
    var stageChat = document.getElementById('assistantStageChat');
    if (!panel || !switchEl || !stageAssistant || !stageChat) return;

    var current = 'assistant';
    var busy = false;

    function setMode(next, opts) {
      opts = opts || {};
      next = next === 'chat' ? 'chat' : 'assistant';
      if (!opts.force && next === current) return;
      if (busy) return;
      var prev = current;
      current = next;
      busy = true;

      switchEl.setAttribute('data-mode', next);
      switchEl.querySelectorAll('[data-assistant-mode]').forEach(function(btn) {
        var on = btn.getAttribute('data-assistant-mode') === next;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      });

      if (titleEl) titleEl.textContent = next === 'chat' ? 'AI 试聊' : 'AI 助手';
      if (subEl) {
        subEl.textContent = next === 'chat'
          ? '按当前卡设定试聊 · 世界书/正则试运行'
          : '智能体对话 · 需要时调用工具';
      }
      panel.classList.toggle('is-chat-mode', next === 'chat');
      panel.setAttribute('aria-label', next === 'chat' ? 'AI 试聊' : 'AI 辅助助手');

      var leaving = prev === 'chat' ? stageChat : stageAssistant;
      var entering = next === 'chat' ? stageChat : stageAssistant;
      leaving.classList.remove('is-active');
      leaving.classList.add('is-exit-left');
      leaving.setAttribute('aria-hidden', 'true');
      entering.classList.remove('is-exit-left');
      entering.setAttribute('aria-hidden', 'false');
      // force reflow for enter animation
      void entering.offsetWidth;
      entering.classList.add('is-active');

      window.setTimeout(function() {
        leaving.classList.remove('is-exit-left');
        busy = false;
      }, 280);

      try {
        window.dispatchEvent(new CustomEvent('assistant-mode-changed', { detail: { mode: next } }));
      } catch (e) {}

      if (next === 'chat' && typeof window.__openAssistantSheet__ === 'function') {
        try {
          if (window.matchMedia('(max-width: 900px)').matches) window.__openAssistantSheet__();
        } catch (e2) {}
      }
    }

    switchEl.querySelectorAll('[data-assistant-mode]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        setMode(btn.getAttribute('data-assistant-mode'));
      });
    });

    window.__setAssistantPanelMode__ = function(mode) {
      setMode(mode, { force: false });
      if (mode === 'chat' && typeof window.__openAssistantSheet__ === 'function') {
        try { window.__openAssistantSheet__(); } catch (e) {}
      }
    };
    window.__getAssistantPanelMode__ = function() { return current; };

    switchEl.setAttribute('data-mode', 'assistant');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAssistantModeSwitch);
  } else {
    initAssistantModeSwitch();
  }
}

export function initAssistantPanelShellMobile() {
function initAssistantSheet() {
    var MOBILE_MQ = '(max-width: 900px)';
    var panel = document.getElementById('assistantPanel');
    var fab = document.getElementById('btnAssistantFab');
    var closeBtn = document.getElementById('btnAssistantClose');
    if (!panel || !fab) return;

    function isMobileShell() {
      return window.matchMedia(MOBILE_MQ).matches;
    }

    function syncBackdrop() {
      if (typeof window.__syncMobileBackdrop__ === 'function') {
        window.__syncMobileBackdrop__();
      } else {
        var backdrop = document.getElementById('appShellBackdrop');
        if (!backdrop) return;
        var show = isMobileShell() && (
          document.body.classList.contains('is-mobile-nav-open')
          || document.body.classList.contains('is-mobile-assistant-open')
        );
        backdrop.hidden = !show;
        backdrop.setAttribute('aria-hidden', show ? 'false' : 'true');
      }
    }

    function setOpen(open) {
      var on = !!open && isMobileShell();
      panel.classList.toggle('is-assistant-open', on);
      document.body.classList.toggle('is-mobile-assistant-open', on);
      fab.setAttribute('aria-expanded', on ? 'true' : 'false');
      panel.setAttribute('aria-modal', on ? 'true' : 'false');
      if (on) {
        panel.setAttribute('role', 'dialog');
      } else {
        panel.removeAttribute('role');
      }
      syncBackdrop();
      if (on) {
        var input = document.getElementById('assistantInput');
        if (input) {
          try { input.focus({ preventScroll: true }); } catch (e) { try { input.focus(); } catch (e2) {} }
        }
      } else {
        try { fab.focus({ preventScroll: true }); } catch (e) { try { fab.focus(); } catch (e2) {} }
      }
    }

    function openSheet() {
      if (typeof window.__closeMobileNav__ === 'function') {
        try { window.__closeMobileNav__(); } catch (e) {}
      }
      setOpen(true);
    }

    function closeSheet() {
      setOpen(false);
    }

    window.__openAssistantSheet__ = openSheet;
    window.__closeAssistantSheet__ = closeSheet;

    fab.addEventListener('click', function() {
      openSheet();
    });
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        closeSheet();
      });
    }

    document.addEventListener('keydown', function(e) {
      if (e.key !== 'Escape') return;
      if (document.body.classList.contains('is-mobile-assistant-open')) {
        closeSheet();
        e.preventDefault();
      }
    });

    window.addEventListener('resize', function() {
      if (!isMobileShell()) {
        panel.classList.remove('is-assistant-open');
        document.body.classList.remove('is-mobile-assistant-open');
        fab.setAttribute('aria-expanded', 'false');
        panel.removeAttribute('role');
        panel.removeAttribute('aria-modal');
        syncBackdrop();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAssistantSheet);
  } else {
    initAssistantSheet();
  }
}

export function initAssistantPanelMain() {
    var boot = window.__assistantBoot__ || {};
    var toolListText = boot.toolListText || '';
    var catalogOverviewText = boot.catalogOverviewText || '';
    var catalogIndexText = boot.catalogIndexText || '';
    var catalogDataJson = boot.catalogDataJson || '';
    var chips = ASSISTANT_PRESET_CHIPS;
    try {
      if (boot.chipsJson) chips = typeof boot.chipsJson === 'string' ? JSON.parse(boot.chipsJson) : boot.chipsJson;
    } catch (e) {}

    var panel = document.getElementById('assistantPanel');
    var messagesEl = document.getElementById('assistantMessages');
    var inputEl = document.getElementById('assistantInput');
    var actionBtn = document.getElementById('assistantActionBtn');
    var clearBtn = document.getElementById('assistantClearBtn');
    var undoBtn = document.getElementById('assistantUndoBtn');
    var readyDot = document.getElementById('assistantReadyDot');
    var statusTip = document.getElementById('assistantStatusTip');
    var quickBtn = document.getElementById('assistantQuickBtn');
    var quickMenu = document.getElementById('assistantQuickMenu');
    var ragPreviewBtn = document.getElementById('assistantRagPreviewBtn');
    var ragModal = document.getElementById('assistantRagModal');
    var ragModalMeta = document.getElementById('assistantRagModalMeta');
    var ragModalPreview = document.getElementById('assistantRagModalPreview');
    var ragModalClose = document.getElementById('assistantRagModalClose');
    var contextModal = document.getElementById('assistantContextModal');
    var contextModalMeta = document.getElementById('assistantContextModalMeta');
    var contextModalBody = document.getElementById('assistantContextModalBody');
    var contextModalClose = document.getElementById('assistantContextModalClose');
    var pendingBox = document.getElementById('assistantPendingBox');
    var pendingSummary = document.getElementById('assistantPendingSummary');
    var pendingPreview = document.getElementById('assistantPendingPreview');
    var applyBtn = document.getElementById('assistantApplyBtn');
    var rejectBtn = document.getElementById('assistantRejectBtn');
    var tokenCountEl = document.getElementById('assistantTokenCount');
    var tokenCountTimer = null;

    if (!panel || !messagesEl || !inputEl) return;

    var sessionStore = createAssistantSessionStore(window.localStorage, function() {
      return assistantSessionKeyFor(currentCardId());
    });
    var snapStack = createSnapshotStack(window.localStorage, function() {
      return assistantSnapshotKeyFor(currentCardId());
    });
    var uiMessages = [];
    var sessionRagInjected = new Set();
    var busy = false;
    var abortFlag = false;
    var pending = null;
    var ragPreviewBusy = false;
    var MAX_REACT_STEPS = 20;
    var reactTask = null;      // 当前 react 运行的任务中心任务
    var reactPaused = false;   // 大改等待用户确认中（暂停续接）
    var reactResume = null;    // 确认后从哪一步续接
    var catalogRelevant = false; // 本轮是否注入完整目录概览（方案 B 混合注入）
    var catalogLocked = false;   // 本会话一旦注入过完整 overview 即锁定，不再降级 index（省缓存重写）；切卡/清空会话重置
    var catalogDataParsed = null; // get_adult_catalog 懒解析结果

    var ragSearchIconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/><path d="M8 11h6M11 8v6"/></svg>';

    /** 发送/停止同一按钮切换（最右圆形主操作） */
    function syncActionBtn() {
      if (!actionBtn) return;
      if (busy) {
        actionBtn.classList.add('is-stop');
        actionBtn.setAttribute('aria-label', '停止');
        actionBtn.title = '停止';
      } else {
        actionBtn.classList.remove('is-stop');
        actionBtn.setAttribute('aria-label', '发送');
        actionBtn.title = '发送';
      }
      var canSend = !busy && !!(inputEl.value || '').trim();
      actionBtn.disabled = busy ? false : !canSend;
      if (clearBtn) clearBtn.disabled = busy;
      if (undoBtn) undoBtn.disabled = busy;
      if (ragPreviewBtn) ragPreviewBtn.disabled = ragPreviewBusy;
    }

    /** 就绪绿点 + 非就绪时的轻量 tip（不占独立就绪文案位） */
    function setStatus(text, isWarn) {
      var tip = text || '';
      var idle = !tip || tip === '就绪';
      if (readyDot) {
        readyDot.classList.remove('is-ready', 'is-busy', 'is-warn');
        if (busy) {
          readyDot.classList.add('is-busy');
          readyDot.title = tip || '处理中';
        } else if (isWarn) {
          readyDot.classList.add('is-warn');
          readyDot.title = tip || '提示';
        } else {
          readyDot.classList.add('is-ready');
          readyDot.title = '就绪';
        }
        readyDot.setAttribute('aria-label', readyDot.title);
      }
      if (statusTip) {
        if (idle && !isWarn) {
          statusTip.hidden = true;
          statusTip.textContent = '';
          statusTip.classList.remove('is-warn');
        } else {
          statusTip.hidden = false;
          statusTip.textContent = tip;
          statusTip.classList.toggle('is-warn', !!isWarn);
        }
      }
    }

    function el(tag, cls, text) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    }

    function riskBadgeClass(risk) {
      if (risk === 'auto') return 'assistant-tool-card__risk--auto';
      if (risk === 'confirm') return 'assistant-tool-card__risk--confirm';
      if (risk === 'none') return 'assistant-tool-card__risk--none';
      return '';
    }

    function fmtCacheTokens(n) {
      var v = Number(n) || 0;
      if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
      return String(v);
    }

    function formatToolArgs(args) {      if (!args || typeof args !== 'object') return '';
      var keys = Object.keys(args);
      if (!keys.length) return '';
      try {
        var json = JSON.stringify(args, null, 2);
        return json.length > 900 ? json.slice(0, 900) + '\n…(参数过长已截断)' : json;
      } catch (e) {
        return '';
      }
    }

    function renderToolTraceNode(m) {
      var toolName = m.toolName || parseToolNameFromLegacy(m.content) || 'tool';
      var toolMeta = getToolByName(toolName);
      var displayName = (toolMeta && toolMeta.title) || toolName;
      var risk = m.risk || parseRiskFromLegacy(m.content) || '?';
      var summaryText = toolMessageSummary(m);
      var detailText = m.detail || m.content || '';

      var cardCls = 'assistant-tool-card';
      if (m.error) cardCls += ' assistant-tool-card--error';
      else if (m.pendingConfirm) cardCls += ' assistant-tool-card--pending';

      var card = document.createElement('details');
      card.className = cardCls;

      var head = document.createElement('summary');
      head.className = 'assistant-tool-card__head';

      var headerRow = el('div', 'assistant-tool-card__header-row');
      var nameEl = el('span', 'assistant-tool-card__name', displayName);
      var riskEl = el('span', 'assistant-tool-card__risk ' + riskBadgeClass(risk), risk);
      headerRow.appendChild(nameEl);
      headerRow.appendChild(riskEl);

      var sumEl = el('div', 'assistant-tool-card__summary', summaryText);

      head.appendChild(headerRow);
      head.appendChild(sumEl);

      var detail = el('div', 'assistant-tool-card__detail');
      var argsText = formatToolArgs(m.toolArgs);
      if (argsText) {
        var argsPre = el('pre', 'assistant-tool-card__args');
        argsPre.textContent = '执行参数: ' + argsText;
        detail.appendChild(argsPre);
      }
      var body = el('pre', 'assistant-tool-card__body');
      body.textContent = detailText;
      detail.appendChild(body);

      card.appendChild(head);
      card.appendChild(detail);
      if (m.pendingConfirm) card.open = true;
      return card;
    }

    function renderUserMessageNode(m) {
      var wrap = el('div', 'assistant-msg-wrap assistant-msg-wrap--user');
      var node = el('div', 'assistant-msg assistant-msg--user', messageContentForDisplay(m));
      wrap.appendChild(node);
      var actions = el('div', 'assistant-msg-actions');
      var ragBtn = el('button', 'btn-icon btn-icon--sm assistant-msg-rag-btn');
      ragBtn.type = 'button';
      ragBtn.title = '查看本回合 RAG';
      ragBtn.setAttribute('aria-label', '查看本回合 RAG');
      ragBtn.innerHTML = ragSearchIconSvg;
      ragBtn.addEventListener('click', function() {
        openRagPreviewForMessage(m);
      });
      actions.appendChild(ragBtn);
      wrap.appendChild(actions);
      return wrap;
    }

    function setRagModalOpen(open) {
      if (!ragModal) return;
      ragModal.hidden = !open;
      ragModal.setAttribute('aria-hidden', open ? 'false' : 'true');
      document.body.classList.toggle('assistant-rag-modal-open', open);
      if (open && ragModalClose) ragModalClose.focus();
    }

    function setContextModalOpen(open) {
      if (!contextModal) return;
      contextModal.hidden = !open;
      contextModal.setAttribute('aria-hidden', open ? 'false' : 'true');
      document.body.classList.toggle('assistant-rag-modal-open', open);
      if (open && contextModalClose) contextModalClose.focus();
    }

    function escapeHtmlLite(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function latestRagInfo() {
      for (var i = uiMessages.length - 1; i >= 0; i--) {
        var m = uiMessages[i];
        if (m && m.role === 'user' && m.ragPreview && m.ragPreview.ragBody) {
          return { body: String(m.ragPreview.ragBody), index: i };
        }
      }
      return { body: '', index: -1 };
    }

    function openContextModal() {
      var systemRaw = promptText('assistantSystem')
        || '你是 SillyTavern 卡片构建器的 AI 辅助助手。\n【可用工具】\n{{toolList}}\n\n{{catalogOverview}}\n\n{{characterFieldHint}}';
      var prepared = prepareAssistantMessages({
        systemPrompt: buildSystemPrompt(''),
        uiMessages: uiMessages,
        pendingInput: (inputEl && inputEl.value || '').trim(),
      });
      var history = prepared.historyForUi;
      var pending = (inputEl && inputEl.value || '').trim();
      var breakdown = prepared.breakdown;
      breakdown.level = prepared.level;
      var relevant = catalogRelevant || (inputEl && isCatalogRelevantText(String(inputEl.value || '')));
      var catalogData = parseCatalogData();
      var catalogBlocks = catalogData
        ? buildCatalogBlocks(catalogData, relevant ? 'overview' : 'index')
        : [];
      // 模板中 {{catalogOverview}} 出现次数 → 真实送模份数（applyTemplate 全量替换）
      var catalogRepeat = Math.max(1, (String(systemRaw).match(/\{\{catalogOverview\}\}/g) || []).length);
      var ragInfo = latestRagInfo();
      var histCount = uiMessages.length;
      var histNote = prepared.level === 'hard'
        ? '激进压缩：仅保留最近若干轮；旧工具结果只留摘要、旧 user RAG 已剥离。'
        : (prepared.level === 'soft'
          ? '已启动压缩：旧工具结果按 token 截断，近端保留完整。'
          : '未压缩。');
      var sections = buildAssistantContextSections({
        systemPrompt: systemRaw,
        systemNote: '原始模板（未替换变量）：{{toolList}} / {{characterFieldHint}} / {{catalogOverview}} / {{buildGuide}} 由 tools / fields / catalog / guide 分区填充；送模时拼接。',
        toolList: toolListText,
        toolNote: '经变量 {{toolList}} 并入系统提示，此处独立展示便于审阅。',
        catalogBlocks: catalogBlocks,
        catalogRepeat: catalogRepeat,
        catalogNote: catalogBlocks.length
          ? (relevant
            ? '完整概览（当前输入/近期上下文命中目录关键词时注入）'
            : '紧凑索引（未命中关键词，省 token）')
          : '',
        characterFieldHint: CHARACTER_FIELD_HINT,
        fieldNote: '经变量 {{characterFieldHint}} 并入系统提示，此处独立展示便于审阅。',
        buildGuide: promptText('assistantBuildGuide') || '',
        guideNote: '经变量 {{buildGuide}} 并入系统提示，此处独立展示便于审阅；可在「提示词配置 → AI 助手」单独编辑。',
        historyMessages: history,
        historyNote: histNote + '（原始 ' + histCount + ' 条 · 送模 ' + history.length + ' 条）',
        pendingInput: pending,
        ragBody: ragInfo.body,
        ragNote: ragInfo.index >= 0
          ? '已绑定到历史第 ' + (ragInfo.index + 1) + ' 条 user 消息的送模内容（modelContent），非独立注入段。'
          : '',
      });
      if (contextModalMeta) {
        var cacheLine = '';
        var lastCache = window.__aiLastPromptCacheUsage__;
        if (lastCache && (lastCache.hit || lastCache.miss)) {
          cacheLine = ' · 最近请求缓存命中 ' + fmtCacheTokens(lastCache.hit)
            + ' / ' + fmtCacheTokens(lastCache.hit + lastCache.miss);
        }
        contextModalMeta.textContent = formatAssistantContextLabel(breakdown.total)
          + ' · 系统 ' + breakdown.system
          + ' · 历史 ' + breakdown.history
          + ' · 待发送 ' + breakdown.pending
          + (prepared.level && prepared.level !== 'none'
            ? ' · ' + (prepared.level === 'hard' ? '激进压缩后' : '已启动压缩')
            : '')
          + cacheLine
          + '（tiktoken）';
      }
      if (contextModalBody) {
        var tabsEl = document.getElementById('assistantContextTabs');
        if (!sections.length) {
          if (tabsEl) tabsEl.innerHTML = '';
          contextModalBody.innerHTML = '<p class="assistant-context-empty">当前无可展示上下文</p>';
        } else {
          var shortTitle = function(title) {
            return String(title || '')
              .replace(/（[^）]*）/g, '')
              .replace(/\([^)]*\)/g, '')
              .trim()
              .slice(0, 8) || '段';
          };
          if (tabsEl) {
            tabsEl.innerHTML = sections.map(function(sec, i) {
              return '<button type="button" class="ui-tabs__tab' + (i === 0 ? ' is-active' : '')
                + '" role="tab" aria-selected="' + (i === 0 ? 'true' : 'false')
                + '" data-context-tab="' + escapeHtmlLite(sec.id) + '" title="'
                + escapeHtmlLite(sec.title) + ' ≈ ' + sec.tokens + ' tok">'
                + escapeHtmlLite(shortTitle(sec.title))
                + '</button>';
            }).join('');
          }
          contextModalBody.innerHTML = sections.map(function(sec, i) {
            var childrenHtml = (sec.children && sec.children.length)
              ? '<div class="assistant-context-section__scroll">' + sec.children.map(function(ch) {
                  return '<div class="assistant-context-sub">'
                    + '<div class="assistant-context-sub__head">'
                    + '<span class="assistant-context-sub__title">' + escapeHtmlLite(ch.title) + '</span>'
                    + '<span class="assistant-context-sub__tokens">≈ ' + ch.tokens + ' tok</span></div>'
                    + '<pre class="assistant-context-sub__pre">' + escapeHtmlLite(ch.body) + '</pre>'
                    + '</div>';
                }).join('') + '</div>'
              : '<pre class="assistant-context-section__pre">' + escapeHtmlLite(sec.body) + '</pre>';
            return '<section class="assistant-context-section' + (i === 0 ? ' is-active' : '')
              + '" data-section="' + escapeHtmlLite(sec.id) + '" role="tabpanel">'
              + '<div class="assistant-context-section__head"><span>' + escapeHtmlLite(sec.title) + '</span>'
              + '<span class="assistant-context-section__tokens">≈ ' + sec.tokens + ' tok</span></div>'
              + (sec.note ? '<p class="assistant-context-section__note">' + escapeHtmlLite(sec.note) + '</p>' : '')
              + childrenHtml
              + '</section>';
          }).join('');
          if (tabsEl) {
            tabsEl.querySelectorAll('[data-context-tab]').forEach(function(tab) {
              tab.addEventListener('click', function() {
                var id = tab.getAttribute('data-context-tab');
                tabsEl.querySelectorAll('[data-context-tab]').forEach(function(t) {
                  var on = t === tab;
                  t.classList.toggle('is-active', on);
                  t.setAttribute('aria-selected', on ? 'true' : 'false');
                });
                contextModalBody.querySelectorAll('.assistant-context-section').forEach(function(sec) {
                  sec.classList.toggle('is-active', sec.getAttribute('data-section') === id);
                });
              });
            });
          }
        }
      }
      setContextModalOpen(true);
    }

    function showRagPreviewPayload(payload) {
      if (!payload) {
        setStatus('无 RAG 预览数据', true);
        return;
      }
      if (ragModalMeta) ragModalMeta.textContent = formatRagPreviewMeta(payload);
      if (ragModalPreview) ragModalPreview.textContent = payload.ragBody || '（未命中）';
      setRagModalOpen(true);
    }

    function getComposerRagQuery() {
      var text = (inputEl.value || '').trim();
      if (text) return text;
      for (var i = uiMessages.length - 1; i >= 0; i--) {
        if (uiMessages[i].role === 'user') {
          return String(uiMessages[i].content || '').trim();
        }
      }
      return '';
    }

    function getNovelRagOptions() {
      return typeof window.__getNovelRagOptions__ === 'function'
        ? window.__getNovelRagOptions__()
        : { enabled: false, budget: 12000 };
    }

    async function resolveAssistantRag(userText, previewOnly) {
      var ragOpt = getNovelRagOptions();
      if (ragOpt.enabled === false) return null;
      if (!window.__novelWorkshopBridge__ || !window.__novelWorkshopBridge__.searchPassages) {
        throw new Error('小说检索桥接未就绪');
      }
      var pass = await window.__novelWorkshopBridge__.searchPassages(userText, { budget: ragOpt.budget });
      var allSnippets = pass.snippets || [];
      var freshSnippets = previewOnly ? allSnippets : filterNewSnippets(allSnippets, sessionRagInjected);
      if (!previewOnly) {
        collectSnippetKeys(freshSnippets).forEach(function(k) { sessionRagInjected.add(k); });
        persistSessionRagInjected();
      }
      var rawState = window.__novelWorkshopBridge__.getRawState
        ? window.__novelWorkshopBridge__.getRawState()
        : null;
      var relations = rawState && Array.isArray(rawState.relations) ? rawState.relations : [];
      var fullEntities = rawState && Array.isArray(rawState.entities) ? rawState.entities : [];
      var ents = window.__novelWorkshopBridge__.listEntities
        ? window.__novelWorkshopBridge__.listEntities({})
        : fullEntities;
      var related = pickRelatedEntities(userText, fullEntities.length ? fullEntities : ents, {
        relations: relations,
        limit: 12,
      });
      var relationLines = formatRelationContextLines(related, relations, fullEntities.length ? fullEntities : ents);
      var ragHint = promptText('assistantNovelRagHint') || '';
      var indexMeta = {
        indexStatus: pass.indexStatus || 'idle',
        indexStale: !!pass.indexStale,
        indexReady: !!pass.indexReady,
        chunkCount: pass.chunkCount || 0,
        enabledChapterCount: pass.enabledChapterCount || 0,
      };
      return buildRagPreviewPayload({
        snippets: freshSnippets,
        allSnippets: allSnippets,
        previewOnly: previewOnly,
        mode: pass.mode || 'keyword',
        relatedEntities: related,
        relationLines: relationLines,
        ragHint: ragHint,
        indexMeta: indexMeta,
        source: previewOnly ? 'preview' : 'injected',
        query: userText,
      });
    }

    async function openComposerRagPreview() {
      if (ragPreviewBusy) return;
      var query = getComposerRagQuery();
      if (!query) {
        setStatus('请输入内容或先发送一条消息', true);
        return;
      }
      ragPreviewBusy = true;
      syncActionBtn();
      setStatus('检索 RAG 预览…');
      try {
        var payload = await resolveAssistantRag(query, true);
        if (!payload) {
          setStatus('RAG 已关闭', true);
          return;
        }
        showRagPreviewPayload(payload);
        setStatus('就绪');
      } catch (err) {
        setStatus((err && err.message) || 'RAG 预览失败', true);
      } finally {
        ragPreviewBusy = false;
        syncActionBtn();
      }
    }

    async function openRagPreviewForMessage(msg) {
      if (ragPreviewBusy || !msg) return;
      var query = String(msg.content || '').trim();
      if (!query) {
        setStatus('该消息无可用检索文本', true);
        return;
      }
      ragPreviewBusy = true;
      syncActionBtn();
      setStatus('检索本回合 RAG…');
      try {
        var payload = await resolveAssistantRag(query, true);
        if (!payload) {
          setStatus('RAG 已关闭', true);
          return;
        }
        showRagPreviewPayload(Object.assign({}, payload, { source: 'rerun' }));
        setStatus('就绪');
      } catch (err) {
        setStatus((err && err.message) || 'RAG 预览失败', true);
      } finally {
        ragPreviewBusy = false;
        syncActionBtn();
      }
    }

    function renderMessages() {
      messagesEl.innerHTML = '';
      uiMessages.forEach(function(m) {
        if (m.role === 'tool') {
          messagesEl.appendChild(renderToolTraceNode(m));
          return;
        }
        if (m.role === 'user') {
          messagesEl.appendChild(renderUserMessageNode(m));
          return;
        }
        var cls = 'assistant-msg assistant-msg--' + (m.role || 'assistant');
        if (m.error) cls += ' assistant-msg--error';
        var node = document.createElement('div');
        node.className = cls;
        // assistant 回复渲染 markdown（安全壳：HTML 转义 + 链接 scheme 过滤）；错误消息按纯文本转义展示
        node.innerHTML = m.error
          ? escapeAssistantHtml(messageContentForDisplay(m))
          : renderAssistantMarkdown(messageContentForDisplay(m));
        messagesEl.appendChild(node);
      });
      if (pendingHintText) {
        messagesEl.appendChild(buildPendingHintNode(pendingHintText));
      }
      messagesEl.scrollTop = messagesEl.scrollHeight;
      updateTokenCount();
    }

    var pendingHintText = '';

    function buildPendingHintNode(text) {
      var wrap = el('div', 'assistant-msg assistant-msg--pending');
      var dots = el('span', 'assistant-typing-dots');
      dots.innerHTML = '<span></span><span></span><span></span>';
      wrap.appendChild(dots);
      wrap.appendChild(document.createTextNode(' ' + String(text || '处理中…')));
      wrap.setAttribute('aria-live', 'polite');
      return wrap;
    }

    function setPendingHint(text) {
      pendingHintText = text ? String(text) : '';
      setStatus(pendingHintText || (busy ? '处理中…' : '就绪'));
      renderMessages();
    }

    function clearPendingHint() {
      if (!pendingHintText) return;
      pendingHintText = '';
      renderMessages();
    }

    function persistSessionRagInjected() {
      sessionStore.setRagInjectedIds(Array.from(sessionRagInjected));
    }

    function pushUi(msg) {
      uiMessages.push(msg);
      sessionStore.setMessages(uiMessages);
      renderMessages();
    }

    function val(id) {
      var n = document.getElementById(id);
      return n && 'value' in n ? String(n.value || '') : '';
    }
    function setVal(id, v) {
      var n = document.getElementById(id);
      if (n && 'value' in n) n.value = v == null ? '' : String(v);
    }

    /** 当前卡 draftId：优先制卡桥；无桥时回退 localStorage CURRENT_KEY */
    function currentCardId() {
      if (window.__getCurrentDraftId__ && typeof window.__getCurrentDraftId__ === 'function') {
        var id = window.__getCurrentDraftId__();
        if (id) return String(id);
      }
      try {
        return String(window.localStorage.getItem('st_v3_builder_current_id') || '').trim();
      } catch (e) {
        return '';
      }
    }

    function getCharacter() {
      return {
        charName: val('charName'),
        wbName: val('wbName'),
        charDesc: val('charDesc'),
        firstMes: val('firstMes'),
        creatorNotes: val('creatorNotes'),
        // 与 ST tags / data.tags 同步
        tags: window.__getCharTags__ ? window.__getCharTags__() : [],
        altGreetings: Array.isArray(window.__altGreetings__) ? window.__altGreetings__.slice() : [],
      };
    }

    function setCharacter(fields) {
      var norm = normalizeCharacterPatch(fields || {});
      var f = norm.fields;
      if (f.charName != null) setVal('charName', f.charName);
      if (f.wbName != null) setVal('wbName', f.wbName);
      if (f.charDesc != null) setVal('charDesc', f.charDesc);
      if (f.firstMes != null) setVal('firstMes', f.firstMes);
      if (f.creatorNotes != null) setVal('creatorNotes', f.creatorNotes);
      if (Array.isArray(f.tags) || Array.isArray(f.charTags)) {
        if (window.__setCharTags__) window.__setCharTags__(f.tags || f.charTags);
      }
      if (Array.isArray(f.altGreetings)) {
        window.__altGreetings__ = f.altGreetings.slice();
        if (window.__renderAltGreetings__) window.__renderAltGreetings__();
      }
      if (window.triggerGlobalUpdate) window.triggerGlobalUpdate();
    }

    function getWorldbook() {
      return window.__getWorldbookEntries__ ? window.__getWorldbookEntries__() : [];
    }
    function setWorldbook(entries) {
      if (window.__setWorldbookEntries__) window.__setWorldbookEntries__(entries);
    }

    function captureSnapshot() {
      var novel = null;
      try {
        if (window.__novelWorkshopBridge__ && window.__novelWorkshopBridge__.captureBucket) {
          novel = window.__novelWorkshopBridge__.captureBucket();
        }
      } catch (e) {}
      var nsfw = null;
      try {
        if (typeof window.__getNsfwConfig__ === 'function') nsfw = window.__getNsfwConfig__();
      } catch (e) {}
      return {
        character: getCharacter(),
        worldbook: getWorldbook(),
        mvuDesign: window.__getCardExtension__ ? window.__getCardExtension__('zmer_mvu_design') : null,
        novel: novel,
        nsfw: nsfw,
        engine: {
          skeletonCount: window.__getSkeletonCount__ ? window.__getSkeletonCount__() : null,
          tagContextChars: window.__getTagContextChars__ ? window.__getTagContextChars__() : null,
        },
        at: Date.now(),
      };
    }

    function restoreSnapshot(snap) {
      if (!snap) return;
      if (snap.character) setCharacter(snap.character);
      if (Array.isArray(snap.worldbook)) setWorldbook(snap.worldbook);
      if (snap.mvuDesign !== undefined && window.__setCardExtension__) {
        window.__setCardExtension__('zmer_mvu_design', snap.mvuDesign);
      }
      // 撤销时恢复成人配置（set_adult_config 等确认级写入可被撤销）
      if (snap.nsfw && typeof window.__setNsfwConfig__ === 'function') {
        try { window.__setNsfwConfig__(snap.nsfw); } catch (e) { /* ignore */ }
      }
      if (snap.engine) {
        if (snap.engine.skeletonCount != null && window.__setSkeletonCount__) {
          try { window.__setSkeletonCount__(snap.engine.skeletonCount); } catch (e) {}
        }
        if (snap.engine.tagContextChars != null && window.__setTagContextChars__) {
          try {
            window.__setTagContextChars__(snap.engine.tagContextChars);
            if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
          } catch (e) {}
        }
      }
      // 撤销时恢复小说桶
      if (snap.novel && window.__novelWorkshopBridge__ && window.__novelWorkshopBridge__.restoreBucket) {
        window.__novelWorkshopBridge__.restoreBucket(snap.novel);
      }
    }

    function resolveWbIndex(args) {
      var entries = getWorldbook();
      var t = args && args.target != null ? args.target : args;
      if (typeof t === 'number') return t;
      if (t && typeof t.index === 'number') return t.index;
      if (t && t.id) {
        for (var i = 0; i < entries.length; i++) {
          if (String(entries[i].uid || entries[i].id || '') === String(t.id)) return i;
        }
      }
      var comment = (t && (t.comment || t.titleMatch || t.title)) || (args && args.comment);
      if (comment) {
        for (var j = 0; j < entries.length; j++) {
          if ((entries[j].comment || '') === comment) return j;
        }
        var q = String(comment).toLowerCase();
        for (var k = 0; k < entries.length; k++) {
          if (String(entries[k].comment || '').toLowerCase().indexOf(q) >= 0) return k;
        }
      }
      if (typeof args.index === 'number') return args.index;
      return -1;
    }

    function getAiConfig() {
      return {
        url: (val('apiUrl') || '').replace(/\/$/, ''),
        key: val('apiKey').trim(),
        model: val('modelSelect'),
      };
    }

    /** 发送前校验：未配置则仅 tip 提示，不发起对话 */
    function ensureAiConfigured() {
      var cfg = getAiConfig();
      if (cfg.url && cfg.model) return true;
      setStatus('请先在「AI 配置」填写接口与模型', true);
      return false;
    }

    async function callChat(messages, temperature, signal) {
      var cfg = getAiConfig();
      if (!cfg.url || !cfg.model) throw new Error('请先在「AI 配置」填写接口与模型');
      var headers = { 'Content-Type': 'application/json' };
      if (cfg.key) headers.Authorization = 'Bearer ' + cfg.key;
      // 复用主引擎封装（若已挂载）
      if (window.__assistantFetchAI__) {
        var r = await window.__assistantFetchAI__({
          context: 'AI助手',
          url: cfg.url + '/chat/completions',
          headers: headers,
          model: cfg.model,
          messages: messages,
          temperature: temperature == null ? 0.4 : temperature,
          signal: signal,
        });
        return r.content || '';
      }
      var res = await fetch(cfg.url + '/chat/completions', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ model: cfg.model, messages: messages, temperature: temperature == null ? 0.4 : temperature }),
        signal: signal,
      });
      if (!res.ok) throw new Error('助手请求失败 HTTP ' + res.status);
      var data = await res.json();
      return ((((data || {}).choices || [])[0] || {}).message || {}).content || '';
    }

    function promptText(id, vars) {
      var ps = window.__promptStore__;
      if (!ps) return '';
      var text = ps.get(id);
      return vars ? ps.applyTemplate(text, vars) : text;
    }

    function parseCatalogData() {
      if (catalogDataParsed) return catalogDataParsed;
      if (!catalogDataJson) return null;
      try {
        catalogDataParsed = JSON.parse(catalogDataJson);
      } catch (e) {
        catalogDataParsed = null;
      }
      return catalogDataParsed;
    }

    /** get_adult_catalog 目录查询：按 kinds/groups/query 过滤 */
    function queryAdultCatalog(a) {
      a = a || {};
      var data = parseCatalogData();
      if (!data) return { available: false, note: '目录数据未就绪' };
      var kinds = a.kinds ? (Array.isArray(a.kinds) ? a.kinds : [a.kinds]) : Object.keys(data);
      var groupFilter = a.groups ? (Array.isArray(a.groups) ? a.groups : [a.groups]) : null;
      var q = String(a.query || '').toLowerCase();
      var withSummary = a.withSummary !== false;
      var out = {};
      kinds.forEach(function(kind) {
        if (!data[kind]) return;
        var list = data[kind];
        var result;
        if (Array.isArray(list)) {
          result = list.filter(function(it) {
            return !q
              || String(it.label || '').toLowerCase().indexOf(q) >= 0
              || String(it.id || '').toLowerCase().indexOf(q) >= 0;
          });
        } else {
          result = list.map(function(g) {
            if (groupFilter && groupFilter.indexOf(g.group) < 0) return null;
            var items = g.items.filter(function(it) {
              return !q
                || String(it.label || '').toLowerCase().indexOf(q) >= 0
                || String(it.id || '').toLowerCase().indexOf(q) >= 0;
            });
            if (!items.length) return null;
            return { group: g.group, items: items };
          }).filter(Boolean);
        }
        if (!result.length) return;
        out[kind] = withSummary ? result : stripCatalogSummaries(result);
      });
      return { available: true, totalKinds: Object.keys(out).length, kinds: out };
    }

    function stripCatalogSummaries(list) {
      if (Array.isArray(list) && list[0] && list[0].id != null) {
        return list.map(function(it) { return { id: it.id, label: it.label }; });
      }
      return list.map(function(g) {
        return { group: g.group, items: g.items.map(function(it) { return { id: it.id, label: it.label }; }) };
      });
    }

    function localAudit() {
      if (window.__runWorldbookQuickCheck__) return window.__runWorldbookQuickCheck__();
      var entries = getWorldbook();
      var issues = [];
      var skeleton = entries.filter(function(e) { return String(e.content || '').length < 60; }).length;
      var noKeys = entries.filter(function(e) { return e.strategy !== 'constant' && (!e.keys || !e.keys.length); }).length;
      if (!entries.length) issues.push({ level: 'critical', title: '世界书为空' });
      if (skeleton) issues.push({ level: 'warning', title: skeleton + ' 条骨架未展开' });
      if (noKeys) issues.push({ level: 'critical', title: noKeys + ' 条缺少触发词' });
      return { issues: issues, total: entries.length, skeleton: skeleton, noKeys: noKeys };
    }

    function lintCard() {
      var issues = [];
      var c = getCharacter();
      if (!c.charName) issues.push({ level: 'critical', code: 'no_name', message: '缺少角色名' });
      if (String(c.charDesc || '').length < 80) issues.push({ level: 'warning', code: 'short_desc', message: '角色描述偏短' });
      if (!c.firstMes) issues.push({ level: 'warning', code: 'no_first_mes', message: '缺少开场白' });
      var audit = localAudit();
      (audit.issues || []).forEach(function(i) {
        issues.push({ level: i.level || 'info', code: 'wb_' + (i.title || ''), message: i.title || i.desc || '' });
      });
      return { ok: issues.filter(function(x) { return x.level === 'critical'; }).length === 0, issues: issues };
    }

    function getExportPreview(opts) {
      var maxChars = (opts && opts.maxChars) || 2000;
      var c = getCharacter();
      var wb = getWorldbook();
      var preview = {
        name: c.charName,
        descriptionLen: String(c.charDesc || '').length,
        firstMesLen: String(c.firstMes || '').length,
        worldbookCount: wb.length,
        sampleEntries: wb.slice(0, 5).map(function(e) { return e.comment; }),
      };
      try {
        var rough = JSON.stringify({ data: { name: c.charName, description: c.charDesc, character_book: { entries: wb } } });
        preview.jsonChars = rough.length;
        preview.jsonPreview = rough.slice(0, maxChars);
      } catch (e) {
        preview.jsonError = e.message;
      }
      return preview;
    }

    var bridge = {
      getCharacter: getCharacter,
      setCharacter: setCharacter,
      getWorldbook: getWorldbook,
      setWorldbook: setWorldbook,
      getMvu: function() {
        return {
          design: window.__getCardExtension__ ? window.__getCardExtension__('zmer_mvu_design') : null,
          runtime: window.__getCardExtension__ ? window.__getCardExtension__('zmer_mvu_runtime_graph') : null,
        };
      },
      inferMvuVariables: function() {
        if (window.__assistantMvuApi__ && window.__assistantMvuApi__.inferVariables) {
          return window.__assistantMvuApi__.inferVariables();
        }
        if (window.__mvuInferApi__ && window.__mvuInferApi__.infer) {
          var cardLike = window.__mvuInferApi__.buildCardLike
            ? window.__mvuInferApi__.buildCardLike()
            : null;
          return {
            candidates: window.__mvuInferApi__.infer(cardLike),
            corruptionGap: window.__mvuInferApi__.gap
              ? window.__mvuInferApi__.gap(cardLike)
              : null,
          };
        }
        var ch = getCharacter();
        var card = {
          name: ch.charName || '',
          description: ch.charDesc || '',
          worldbook: getWorldbook(),
          adultConfig: (typeof window.__getNsfwConfig__ === 'function') ? window.__getNsfwConfig__() : {},
          statusBarDesign: window.__getCardExtension__
            ? window.__getCardExtension__(STATUS_BAR_EXT_KEY)
            : null,
          mvuDesign: window.__getCardExtension__
            ? window.__getCardExtension__('zmer_mvu_design')
            : null,
        };
        return {
          candidates: inferMvuCandidatesFromCard(card),
          corruptionGap: corruptionProgressGap(card),
        };
      },
      upsertMvu: function(design) {
        if (window.__assistantMvuApi__) {
          return window.__assistantMvuApi__.upsertVariables({ design: design, inject: true });
        }
        if (!window.__applyExternalVariableDesign__) throw new Error('MVU 面板未就绪');
        return window.__applyExternalVariableDesign__({ design: design, source: 'assistant', inject: true });
      },
      upsertMvuDesign: function(payload) {
        if (!window.__assistantMvuApi__) throw new Error('MVU 面板未就绪');
        return window.__assistantMvuApi__.upsertDesign(payload || {});
      },
      upsertMvuVariables: function(payload) {
        if (!window.__assistantMvuApi__) throw new Error('MVU 面板未就绪');
        return window.__assistantMvuApi__.upsertVariables(payload || {});
      },
      clearMvu: function() {
        if (!window.__assistantMvuApi__) throw new Error('MVU 面板未就绪');
        return window.__assistantMvuApi__.clear();
      },
      patchMvuNode: function(opts) {
        if (!window.__assistantMvuApi__) throw new Error('MVU 面板未就绪');
        return window.__assistantMvuApi__.patchNode(opts || {});
      },
      getNovel: function() {
        return window.__novelWorkshopBridge__ ? window.__novelWorkshopBridge__.getState() : { available: false };
      },
      listNovelOutputs: function() {
        if (!window.__novelWorkshopBridge__) return { available: false };
        return window.__novelWorkshopBridge__.listOutputs
          ? window.__novelWorkshopBridge__.listOutputs()
          : window.__novelWorkshopBridge__.getState();
      },
      setNovelSource: function(payload) {
        if (!window.__novelWorkshopBridge__) throw new Error('小说工坊未就绪');
        return window.__novelWorkshopBridge__.setSource(payload || {});
      },
      runNovelExtract: async function(opts) {
        if (!window.__novelWorkshopBridge__) throw new Error('小说工坊未就绪');
        var r = await window.__novelWorkshopBridge__.runExtract(opts || {});
        if (r && r.started && !r.chapterCount && !r.characterCount && !r.draftCount && !r.styleLen) {
          throw new Error('小说抽取未真正 await 完成（started-only）');
        }
        return r;
      },
      searchNovelPassages: async function(query, opts) {
        if (!window.__novelWorkshopBridge__ || !window.__novelWorkshopBridge__.searchPassages) {
          throw new Error('小说检索桥接未就绪');
        }
        return window.__novelWorkshopBridge__.searchPassages(query, opts || {});
      },
      listNovelEntities: function(opts) {
        if (!window.__novelWorkshopBridge__ || !window.__novelWorkshopBridge__.listEntities) {
          throw new Error('知识库桥接未就绪');
        }
        return window.__novelWorkshopBridge__.listEntities(opts || {});
      },
      getNovelEntity: function(idOrName) {
        if (!window.__novelWorkshopBridge__ || !window.__novelWorkshopBridge__.getEntity) {
          throw new Error('知识库桥接未就绪');
        }
        return window.__novelWorkshopBridge__.getEntity(idOrName);
      },
      patchNovelEntity: function(opts) {
        if (!window.__novelWorkshopBridge__ || !window.__novelWorkshopBridge__.patchEntity) {
          throw new Error('知识库桥接未就绪');
        }
        return window.__novelWorkshopBridge__.patchEntity(opts || {});
      },
      mergeNovelEntities: function(opts) {
        if (!window.__novelWorkshopBridge__ || !window.__novelWorkshopBridge__.mergeEntities) {
          throw new Error('知识库桥接未就绪');
        }
        return window.__novelWorkshopBridge__.mergeEntities(opts || {});
      },
      runNovelRagIndex: async function(opts) {
        if (!window.__novelWorkshopBridge__ || !window.__novelWorkshopBridge__.runRagIndex) {
          throw new Error('RAG 索引桥接未就绪');
        }
        return window.__novelWorkshopBridge__.runRagIndex(opts || {});
      },
      runNovelAnalyze: async function(phase) {
        if (!window.__novelWorkshopBridge__ || !window.__novelWorkshopBridge__.runAnalyze) {
          throw new Error('小说分析桥接未就绪');
        }
        return window.__novelWorkshopBridge__.runAnalyze(phase);
      },
      enrichNovelEntity: async function(opts) {
        if (!window.__novelWorkshopBridge__ || !window.__novelWorkshopBridge__.enrichEntity) {
          throw new Error('实体丰满桥接未就绪');
        }
        return window.__novelWorkshopBridge__.enrichEntity(opts || {});
      },
      setNovelAdultMode: function(on) {
        if (!window.__novelWorkshopBridge__ || !window.__novelWorkshopBridge__.setAdultMode) {
          throw new Error('小说工坊未就绪');
        }
        return window.__novelWorkshopBridge__.setAdultMode(on);
      },
      setNovelNtlMode: function(on) {
        if (!window.__novelWorkshopBridge__ || !window.__novelWorkshopBridge__.setNtlMode) {
          throw new Error('小说工坊未就绪');
        }
        return window.__novelWorkshopBridge__.setNtlMode(on);
      },
      draftNsfwStatusBar: function(opts) {
        if (!window.__novelWorkshopBridge__ || !window.__novelWorkshopBridge__.buildNsfwStatusDraft) {
          throw new Error('小说工坊未就绪');
        }
        return window.__novelWorkshopBridge__.buildNsfwStatusDraft(opts || {});
      },
      syncNovelEntities: function(opts) {
        if (!window.__novelWorkshopBridge__) throw new Error('小说工坊未就绪');
        if (window.__novelWorkshopBridge__.syncEntities) {
          return window.__novelWorkshopBridge__.syncEntities(opts || {});
        }
        return window.__novelWorkshopBridge__.syncOutputs(Object.assign({ target: 'entities' }, opts || {}));
      },
      patchNovelChapters: function(opts) {
        if (!window.__novelWorkshopBridge__ || !window.__novelWorkshopBridge__.patchChapters) {
          throw new Error('章节补丁未就绪');
        }
        return window.__novelWorkshopBridge__.patchChapters(opts || {});
      },
      mutateNovelCharacter: async function(opts) {
        if (!window.__novelWorkshopBridge__) throw new Error('小说工坊未就绪');
        var api = window.__novelWorkshopBridge__.mutateCharacter || window.__novelWorkshopBridge__.expandCharacter;
        if (!api) throw new Error('人物扩展桥接未就绪');
        return api(opts || {});
      },
      expandNovelWorldbook: async function(opts) {
        if (!window.__novelWorkshopBridge__) throw new Error('小说工坊未就绪');
        var api = window.__novelWorkshopBridge__.expandWorldbookEntry;
        if (!api) throw new Error('世界书条目扩展桥接未就绪');
        return api(opts || {});
      },
      syncNovelOutputs: function(opts) {
        if (!window.__novelWorkshopBridge__) throw new Error('小说工坊未就绪');
        if (window.__novelWorkshopBridge__.syncOutputs) {
          return window.__novelWorkshopBridge__.syncOutputs(opts || {});
        }
        return window.__novelWorkshopBridge__.applyResult(opts || {});
      },
      applyNovel: function(opts) {
        if (!window.__novelWorkshopBridge__) throw new Error('小说工坊未就绪');
        return window.__novelWorkshopBridge__.applyResult(opts || {});
      },
      getExportPreview: getExportPreview,
      exportCardCheck: function() {
        if (window.__assistantCardApi__ && window.__assistantCardApi__.exportCheck) {
          return window.__assistantCardApi__.exportCheck();
        }
        return getExportPreview({});
      },
      auditWorldbook: localAudit,
      lintCard: lintCard,
      getChatFeedback: function(opts) {
        if (window.__getChatPlaygroundState__) return window.__getChatPlaygroundState__(opts || {});
        return { messages: [], started: false, note: '试聊面板未暴露状态' };
      },
      analyzeChatFeedback: async function() {
        var feedback = bridge.getChatFeedback({});
        var char = getCharacter();
        var wb = getWorldbook().slice(0, 40).map(function(e, i) {
          return { index: i, comment: e.comment, keys: e.keys, contentLen: String(e.content || '').length };
        });
        var sys = promptText('assistantChatFeedback')
          || '根据试聊与卡面诊断问题，输出 JSON：{ issues:[], fixes:[{tool,args,reason}] }。fixes 须可被 apply_chat_feedback_fixes 执行。';
        var user = JSON.stringify({
          character: {
            charName: char.charName,
            charDesc: String(char.charDesc || '').slice(0, 1200),
            firstMes: String(char.firstMes || '').slice(0, 400),
            altCount: (char.altGreetings || []).length,
          },
          worldbook: wb,
          chat: (feedback.messages || []).slice(-16),
        });
        var raw = await callChat([
          { role: 'system', content: sys + '\n只输出一个 JSON 对象。' },
          { role: 'user', content: user },
        ], 0.3);
        var data = null;
        try { data = JSON.parse(raw); } catch (e) {
          var m = raw.match(/\{[\s\S]*\}/);
          if (m) data = JSON.parse(m[0]);
        }
        if (!data) throw new Error('试聊分析未返回 JSON');
        return {
          messageCount: (feedback.messages || []).length,
          issues: data.issues || [],
          fixes: data.fixes || data.suggestedFixes || [],
          summary: data.summary || '',
          source: 'llm',
        };
      },
      openModule: function(view) {
        window.__setAppView__(view);
      },
      listCards: function() {
        if (!window.__assistantCardApi__) throw new Error('多卡桥接未就绪');
        return window.__assistantCardApi__.list();
      },
      manageCard: async function(action, args) {
        var api = window.__assistantCardApi__;
        if (!api) throw new Error('多卡桥接未就绪');
        args = args || {};
        if (action === 'switch_card') return api.switchTo(args.id || args.name);
        if (action === 'create_card') return api.create(args);
        if (action === 'duplicate_card') return api.duplicate(args.id);
        if (action === 'rename_card') return api.rename(args.id, args.name);
        if (action === 'delete_card') return api.delete(args.id);
        if (action === 'import_card') return api.importJson(args.cardJson || args.json);
        throw new Error('未知多卡操作: ' + action);
      },
      getEngineOptions: function() {
        return {
          skeletonCount: window.__getSkeletonCount__ ? window.__getSkeletonCount__() : 6,
          tagContextChars: window.__getTagContextChars__ ? window.__getTagContextChars__() : 12000,
          model: val('modelSelect') || '',
          hasApiUrl: !!(val('apiUrl') || '').trim(),
          note: '不含 API Key',
        };
      },
      setEngineOptions: function(opts) {
        opts = opts || {};
        var out = {};
        if (opts.skeletonCount != null && window.__setSkeletonCount__) {
          out.skeleton = window.__setSkeletonCount__(opts.skeletonCount);
        }
        if (opts.tagContextChars != null && window.__setTagContextChars__) {
          out.tagContext = window.__setTagContextChars__(opts.tagContextChars);
          if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
        }
        return out;
      },
      getPromptIds: function() {
        var ps = window.__promptStore__;
        if (ps && typeof ps.listIds === 'function') return { ids: ps.listIds() };
        if (ps && ps.defaults) return { ids: Object.keys(ps.defaults) };
        return { ids: ['assistantSystem', 'assistantReactHint', 'assistantChatFeedback'] };
      },
      getAdultConfig: function() {
        if (typeof window.__getNsfwConfig__ === 'function') return window.__getNsfwConfig__();
        return {};
      },
      getNsfwConfig: function() {
        if (typeof window.__getNsfwConfig__ === 'function') return window.__getNsfwConfig__();
        return {};
      },
      getAdultCatalog: function(args) {
        return queryAdultCatalog(args);
      },
      setAdultConfig: function(cfg) {
        if (typeof window.__setNsfwConfig__ !== 'function') throw new Error('成人配置桥接未就绪');
        window.__setNsfwConfig__(cfg || {});
        return window.__getNsfwConfig__ ? window.__getNsfwConfig__() : (cfg || {});
      },
      setNsfwConfig: function(cfg) {
        if (typeof window.__setNsfwConfig__ !== 'function') throw new Error('成人配置桥接未就绪');
        window.__setNsfwConfig__(cfg || {});
        return window.__getNsfwConfig__ ? window.__getNsfwConfig__() : (cfg || {});
      },
      generateCharacter: async function(opts) {
        if (window.__assistantGenerateCharacter__) {
          return window.__assistantGenerateCharacter__(opts || {});
        }
        var prompt = (opts && opts.prompt) || val('aiPrompt') || (getCharacter().charName + ' 角色卡');
        var sys = promptText('charGen');
        var content = await callChat([
          { role: 'system', content: sys },
          { role: 'user', content: prompt },
        ], 0.85);
        var data = null;
        try { data = JSON.parse(content); } catch (e) {
          var m = content.match(/\{[\s\S]*\}/);
          if (m) data = JSON.parse(m[0]);
        }
        if (!data) throw new Error('角色生成未返回合法 JSON');
        setCharacter({
          charName: data.charName || '',
          wbName: data.wbName || '',
          charDesc: data.charDesc || '',
          firstMes: data.firstMes || '',
          creatorNotes: data.creatorNotes || '',
          altGreetings: Array.isArray(data.altGreetings) ? data.altGreetings : [],
        });
        return { charName: data.charName, note: '已写入角色字段（未清空世界书）' };
      },
      generateSkeleton: async function(opts) {
        if (window.__assistantGenerateSkeleton__) {
          return window.__assistantGenerateSkeleton__(opts || {});
        }
        var count = Math.min(Math.max((opts && opts.count) || (window.__getSkeletonCount__ ? window.__getSkeletonCount__() : 5), 1), 15);
        var direction = (opts && opts.direction) || val('wbPrompt') || '';
        var c = getCharacter();
        var existing = getWorldbook();
        var sys = promptText('wbSkeleton', { batchSize: count })
          + '\n【角色】：' + c.charName + ' | ' + String(c.charDesc || '').slice(0, 300)
          + (direction ? '\n【方向】：' + direction : '')
          + '\n【输出】：JSON数组 [{ "comment","content","keys","strategy" }, ...]';
        var content = await callChat([
          { role: 'system', content: sys },
          { role: 'user', content: '生成' + count + '条骨架' },
        ], 0.9);
        var arr = null;
        try { arr = JSON.parse(content); } catch (e) {
          var m = content.match(/\[[\s\S]*\]/);
          if (m) arr = JSON.parse(m[0]);
        }
        if (!Array.isArray(arr)) throw new Error('骨架生成未返回数组');
        var next = existing.slice();
        arr.forEach(function(sk) {
          if (!sk || !sk.comment) return;
          next.push({
            comment: sk.comment,
            content: sk.content || '(待展开)',
            keys: Array.isArray(sk.keys) ? sk.keys : [],
            strategy: sk.strategy || 'selective',
            position: 4, depth: 4, role: 0, order: 100, prob: 100, enabled: true,
          });
        });
        setWorldbook(next);
        return { added: arr.length, total: next.length };
      },
      generateWorldbookEntry: async function(opts) {
        if (!window.__assistantWbAi__) throw new Error('世界书 AI 桥接未就绪');
        return window.__assistantWbAi__.generateEntry(opts || {});
      },
      organizeWorldbook: async function(opts) {
        if (!window.__assistantWbAi__) throw new Error('世界书 AI 桥接未就绪');
        return window.__assistantWbAi__.organize(opts || {});
      },
      batchFillWorldbookKeys: async function(opts) {
        if (!window.__assistantWbAi__) throw new Error('世界书 AI 桥接未就绪');
        return window.__assistantWbAi__.batchFillKeys(opts || {});
      },
      mutateWorldbookEntry: async function(opts) {
        opts = opts || {};
        var idx = resolveWbIndex(opts);
        if (idx < 0) throw new Error('条目未找到（请用 index / titleMatch / comment / id）');
        if (window.__assistantWbAi__) {
          return window.__assistantWbAi__.mutateEntry({
            index: idx,
            mode: opts.mode || 'expand',
            instruction: opts.instruction || opts.direction || '',
          });
        }
        return bridge.expandEntry(Object.assign({}, opts, { index: idx }));
      },
      expandEntry: async function(opts) {
        opts = opts || {};
        if (window.__assistantExpandEntry__) {
          return window.__assistantExpandEntry__(opts);
        }
        var idx = resolveWbIndex(opts);
        if (idx < 0) throw new Error('条目未找到');
        if (window.__assistantWbAi__) {
          return window.__assistantWbAi__.mutateEntry({
            index: idx,
            mode: opts.mode || 'expand',
            instruction: opts.instruction || opts.direction || '',
          });
        }
        // 无面板桥时本地 LLM 扩写
        var entries = getWorldbook();
        var target = entries[idx];
        var c = getCharacter();
        var sys = promptText('wbRewrite')
          + '\n【角色】：' + c.charName
          + '\n【原条目】：' + JSON.stringify(target)
          + (opts.direction || opts.instruction ? '\n【方向】：' + (opts.instruction || opts.direction) : '')
          + '\n【输出】：JSON对象 { comment, content, keys, strategy, position }';
        var content = await callChat([
          { role: 'system', content: sys },
          { role: 'user', content: '请展开/重写该条目' },
        ], 0.75);
        var entry = null;
        try { entry = JSON.parse(content); } catch (e) {
          var m = content.match(/\{[\s\S]*\}/);
          if (m) entry = JSON.parse(m[0]);
        }
        if (!entry) throw new Error('展开失败：无 JSON');
        var next = entries.slice();
        next[idx] = Object.assign({}, target, {
          comment: entry.comment || target.comment,
          content: entry.content || target.content,
          keys: Array.isArray(entry.keys) ? entry.keys : target.keys,
          strategy: entry.strategy || target.strategy,
          position: entry.position != null ? entry.position : target.position,
        });
        setWorldbook(next);
        return { index: idx, comment: next[idx].comment };
      },
      expandCharacterField: async function(opts) {
        opts = opts || {};
        var field = normalizeCharacterFieldKey(opts.field);
        if (!field) throw new Error('未识别的角色字段: ' + opts.field);
        var c = getCharacter();
        var cur = c[field] != null ? String(c[field]) : '';
        var mode = opts.mode || 'expand';
        var sys = '你是角色卡文案助手。按字段「' + field + '」' + (mode === 'rewrite' ? '重写' : '扩写')
          + '内容。只输出纯文本正文，不要 JSON/Markdown 围栏。';
        var content = await callChat([
          { role: 'system', content: sys },
          {
            role: 'user',
            content: '角色名：' + (c.charName || '')
              + '\n现有内容：\n' + cur
              + (opts.instruction ? '\n要求：' + opts.instruction : '')
              + '\n请输出改写后的完整字段文本。',
          },
        ], 0.7);
        var patch = {};
        patch[field] = String(content || '').trim();
        setCharacter(patch);
        return { field: field, mode: mode, length: patch[field].length };
      },
      mutateGreeting: async function(opts) {
        opts = opts || {};
        var mode = opts.mode || 'rewrite';
        var c = getCharacter();
        var target = opts.target;
        var altIndex = null;
        var isMain = target == null || target === 'main'
          || (target && (target.main === true || target.kind === 'main'));
        if (!isMain) {
          if (typeof target === 'number') altIndex = target;
          else if (target && typeof target.alternate === 'number') altIndex = target.alternate;
          else if (target && typeof target.index === 'number') altIndex = target.index;
          else if (typeof opts.index === 'number') altIndex = opts.index;
          else isMain = true;
        }
        var cur = isMain ? String(c.firstMes || '') : String((c.altGreetings || [])[altIndex] || '');
        if (!isMain && (altIndex < 0 || altIndex >= (c.altGreetings || []).length)) {
          throw new Error('备选开场白序号越界');
        }
        var sys = '你是开场白写手。' + (mode === 'expand' ? '扩写' : '重写')
          + '开场白，贴合人设，只输出正文。开场白属于主角互动，禁止写成恶堕进度说明或 NTL 调教手册。';
        var text = await callChat([
          { role: 'system', content: sys },
          {
            role: 'user',
            content: '角色：' + (c.charName || '') + '\n人设摘要：' + String(c.charDesc || '').slice(0, 600)
              + '\n当前开场白：\n' + cur
              + (opts.instruction ? '\n要求：' + opts.instruction : '')
              + '\n目标：' + (isMain ? '主开场白 firstMes' : ('备选第 ' + altIndex + ' 条')),
          },
        ], 0.75);
        text = String(text || '').trim();
        if (isMain) {
          setCharacter({ firstMes: text });
          return { target: 'main', mode: mode, length: text.length };
        }
        var alts = (c.altGreetings || []).slice();
        alts[altIndex] = text;
        setCharacter({ altGreetings: alts });
        return { target: { alternate: altIndex }, mode: mode, length: text.length };
      },
      captureSnapshot: captureSnapshot,
      restoreSnapshot: restoreSnapshot,
    };

    var executor = createToolExecutor(bridge, {
      pushSnapshot: function(s) { return snapStack.push(s); },
      popSnapshot: function() { return snapStack.pop(); },
      peekSnapshot: function() { return snapStack.peek(); },
    });

    function buildReactTaskDetail(messages) {
      return (messages || []).map(function(m) {
        return '[' + (m.role || 'msg') + ']\n' + String(m.content || '');
      }).join('\n\n———\n\n');
    }

    function buildDialogBackground(maxLen) {      var parts = [];
      var max = maxLen || 20000;
      for (var i = uiMessages.length - 1; i >= 0 && parts.length < 10; i--) {
        var m = uiMessages[i];
        if (!m) continue;
        if (m.role !== 'user' && m.role !== 'assistant') continue;
        var text = m.role === 'user'
          ? (m.modelContent || m.content || '')
          : (m.displayContent || m.content || '');
        text = String(text).trim();
        if (!text) continue;
        parts.unshift((m.role === 'user' ? '用户: ' : '助手: ') + text);
      }
      var joined = parts.join('\n');
      return joined.length > max ? joined.slice(0, max) : joined;
    }

    function injectDialogBackground(args, toolName) {
      if (!args || typeof args !== 'object') args = {};
      var meta = getToolByName(toolName);
      if (!meta || meta.kind !== 'generate') return args;
      var bg = buildDialogBackground(20000);
      if (!bg) return args;
      var marker = '【用户对话背景】';
      var targetKey = null;
      ['instruction', 'direction', 'prompt'].forEach(function(k) {
        if (targetKey == null && args[k] != null && String(args[k]).length) targetKey = k;
      });
      if (!targetKey) targetKey = 'instruction';
      var cur = String(args[targetKey] || '');
      if (cur.indexOf(marker) >= 0) return args; // 已注入过（确认后 apply 复用，防重复）
      args[targetKey] = (cur ? cur + '\n\n' : '') + marker + '\n' + bg;
      return args;
    }

    function stripDialogBackground(args) {
      if (!args || typeof args !== 'object') return args;
      var out = Object.assign({}, args);
      ['instruction', 'direction', 'prompt'].forEach(function(k) {
        if (typeof out[k] === 'string') {
          var idx = out[k].indexOf('\n\n【用户对话背景】');
          if (idx >= 0) {
            out[k] = out[k].slice(0, idx).trim();
            if (!out[k]) delete out[k];
          }
        }
      });
      return out;
    }

    function showPending(p) {
      pending = p;
      if (!pendingBox) return;
      pendingBox.hidden = !p;
      if (p) {
        if (pendingSummary) {
          pendingSummary.textContent = summarizePendingConfirm(p.tool, p.args, p.preview);
        }
        pendingPreview.textContent = p.preview || JSON.stringify(p, null, 2);
      } else {
        if (pendingSummary) pendingSummary.textContent = '待确认变更';
        pendingPreview.textContent = '';
      }
    }

    async function runTool(toolName, args, force) {
      var effectiveArgs = injectDialogBackground(args || {}, toolName);
      var result = await executor.invoke(toolName, effectiveArgs, { forceApply: !!force });
      if (result.pendingConfirm) {
        showPending({ tool: toolName, args: effectiveArgs, preview: result.preview });
        return result;
      }
      pushUi(buildToolUiMessage(toolName, stripDialogBackground(effectiveArgs), result));
      if (result && result.ok) {
        try {
          window.dispatchEvent(new CustomEvent('assistant-change-summary', {
            detail: { tool: toolName, cardId: currentCardId() },
          }));
        } catch (eEv) { /* ignore */ }
      }
      return result;
    }

    function buildSystemPrompt(userExtra) {
      // 方案 B 混合注入：目录相关时给完整概览（识别不退化），否则给紧凑索引省 token
      var relevant = catalogRelevant;
      if (!relevant && inputEl) relevant = isCatalogRelevantText(String(inputEl.value || ''));
      var overview = relevant ? catalogOverviewText : catalogIndexText;
      var guide = promptText('assistantBuildGuide') || '';
      var base = promptText('assistantSystem', {
        toolList: toolListText,
        characterFieldHint: CHARACTER_FIELD_HINT,
        catalogOverview: overview,
        buildGuide: guide,
      }) || (
        '你是卡片构建助手。默认用自然语言中文回复用户；只有需要读卡/改卡时才输出一个 tool JSON。\n工具：\n' + toolListText
        + (overview ? '\n\n' + overview : '')
        + (guide ? '\n\n【建卡引导】\n' + guide : '')
      );
      if (userExtra) base += '\n\n' + userExtra;
      return base;
    }

    function updateTokenCount() {
      if (!tokenCountEl) return;
      var breakdown = estimateAssistantContext({
        systemPrompt: buildSystemPrompt(''),
        uiMessages: uiMessages,
        pendingInput: (inputEl.value || '').trim(),
      });
      tokenCountEl.textContent = formatAssistantContextLabel(breakdown.total);
      tokenCountEl.title = formatAssistantContextTitle(breakdown);
    }

    function scheduleTokenCountUpdate() {
      if (tokenCountTimer) clearTimeout(tokenCountTimer);
      tokenCountTimer = setTimeout(updateTokenCount, 200);
    }

    async function reactLoop(userText) {
      if (busy) return;
      if (!engineTryAllowed('card.assistant.react').ok) return;
      abortFlag = false;
      busy = true;
      syncActionBtn();
      setPendingHint('正在思考…');

      pushUi({ role: 'user', content: userText, modelContent: userText });

      // 方案 B：目录形态会话内锁定——一旦注入过完整 overview 即保持，避免反复切换打断前缀缓存
      catalogRelevant = catalogLocked || isCatalogRelevantText(userText);
      if (!catalogRelevant) {
        var crStart = Math.max(0, uiMessages.length - 9);
        for (var crIdx = uiMessages.length - 1; crIdx >= crStart; crIdx--) {
          if (uiMessages[crIdx] && isCatalogRelevantText(String(uiMessages[crIdx].content || ''))) {
            catalogRelevant = true;
            break;
          }
        }
      }
      if (catalogRelevant) catalogLocked = true;

      var extra = '';
      if (/试聊|回流|反馈/.test(userText)) {
        extra = promptText('assistantChatFeedback') || '';
      }
      // 小说 RAG：检索原文 + 相关实体，绑定到本回合 user 消息（非 system extra）
      try {
        var ragOpt = getNovelRagOptions();
        if (ragOpt.enabled === true && window.__novelWorkshopBridge__ && window.__novelWorkshopBridge__.searchPassages) {
          setPendingHint('正在检索小说原文…');
          var ragPayload = await resolveAssistantRag(userText, false);
          if (ragPayload) {
            var ragBlock = ragPayload.ragBody;
            var modelContent = buildUserModelContent(userText, ragBlock);
            uiMessages[uiMessages.length - 1].modelContent = modelContent;
            uiMessages[uiMessages.length - 1].ragPreview = ragPayload;
            uiMessages[uiMessages.length - 1].ragInjectedIds = ragPayload.injectedKeys.slice();
            sessionStore.setMessages(uiMessages);
            renderMessages();
          }
        }
      } catch (ragErr) {
        console.warn('[assistant] novel RAG inject failed', ragErr);
      }

      await reactSteps(0, false, extra);
    }

    /**
     * 分步执行 assistant ReAct：startStep>0 为确认大改后的续接（复用任务、不新建）。
     * pendingConfirm 时暂停：任务保持 running、busy 保持 true，等用户确认后再续接。
     */
    async function reactSteps(startStep, isContinuation, extra) {
      var center = window.__aiTaskCenter__;
      if (isContinuation && reactTask && (reactTask.status === 'running' || reactTask.status === 'queued')) {
        // 复用当前任务
      } else {
        var targetText = '';
        for (var ti = uiMessages.length - 1; ti >= 0; ti--) {
          if (uiMessages[ti].role === 'user') {
            targetText = String(uiMessages[ti].content || '').slice(0, 40);
            break;
          }
        }
        reactTask = center ? center.create({
          type: 'assistant_react',
          title: 'AI 助手',
          target: targetText,
        }) : null;
      }
      var task = reactTask;
      var reactSignal = task && task.signal;
      var gotFinal = false;

      try {
        for (var step = startStep; step < MAX_REACT_STEPS; step++) {
          if (abortFlag || (reactSignal && reactSignal.aborted)) {
            clearPendingHint();
            pushUi({ role: 'assistant', content: '已停止。' });
            if (center && task && task.status !== 'cancelled') center.cancel(task.id);
            break;
          }
          var stepLabel = step === 0 ? '正在回复…' : ('继续处理（' + (step + 1) + '/' + MAX_REACT_STEPS + '）…');
          if (center && task) center.setProgress(task.id, (step + 1) / MAX_REACT_STEPS, stepLabel);
          var stepHint = '';
          if (step > 0) {
            stepHint = promptText('assistantReactHint')
              || '根据工具结果继续：仍需工具则输出 tool JSON，否则用自然语言直接回复用户。';
          }
          if (step === MAX_REACT_STEPS - 1) {
            stepHint = (stepHint ? stepHint + '\n' : '')
              + '这是本轮最后一次工具调用机会：处理完请务必用自然语言总结当前进度与已应用内容，不要遗留未说明的工具意图。';
          }
          var prepared = prepareAssistantMessages({
            systemPrompt: buildSystemPrompt(extra),
            uiMessages: uiMessages,
            extraSystem: stepHint,
          });
          if (prepared.level === 'soft') stepLabel = '正在整理上下文…';
          if (prepared.level === 'hard') stepLabel = '上下文较长，正在压缩…';
          setPendingHint(stepLabel);
          var messages = prepared.messages;
          if (center && task && task.id) center.setDetail(task.id, buildReactTaskDetail(messages));
          var raw = await callChat(messages, 0.35, reactSignal);
          var parsed = parseReactStep(raw);

          if (parsed.type === 'tool' && parsed.tool) {
            clearPendingHint();
            // 送模：raw 原样；UI：只展示 thought（无则短提示）
            var toolDisplay = parsed.thought
              ? ('💭 ' + String(parsed.thought))
              : ('💭 调用工具 ' + parsed.tool);
            pushUi({
              role: 'assistant',
              content: toolDisplay,
              displayContent: toolDisplay,
              modelContent: raw || '',
            });
            setPendingHint('正在执行 ' + parsed.tool + '…');
            var tr = await runTool(parsed.tool, parsed.args || {}, false);
            if (tr.pendingConfirm) {
              clearPendingHint();
              // 暂停等待确认；任务保持 running、busy 保持 true
              reactPaused = true;
              reactResume = function() { reactSteps(step + 1, true, extra); };
              setStatus('等待确认大改…');
              return;
            }
            continue;
          }

          if (parsed.type === 'final') {
            gotFinal = true;
            clearPendingHint();
            var finalText = String(parsed.final != null ? parsed.final : '').trim()
              || String(raw || '').trim()
              || '（无输出）';
            pushUi({
              role: 'assistant',
              content: finalText,
              displayContent: finalText,
              modelContent: raw || finalText,
            });
            break;
          }

          // 无法解析则把原文当回复
          gotFinal = true;
          clearPendingHint();
          pushUi({ role: 'assistant', content: raw || '（无输出）' });
          break;
        }
        // 达到步数上限仍未收尾 → 提示可「继续」
        if (step >= MAX_REACT_STEPS && !gotFinal) {
          pushUi({
            role: 'assistant',
            content: '已达单轮工具调用上限（' + MAX_REACT_STEPS + ' 步）。如需继续处理，回复「继续」。',
          });
        }
        if (center && task && task.status === 'running') center.succeed(task.id);
        reactTask = null;
      } catch (err) {
        var aborted = (window.__isAiAbortError__ && window.__isAiAbortError__(err))
          || (err && err.name === 'AbortError')
          || abortFlag;
        reactPaused = false;
        reactResume = null;
        clearPendingHint();
        if (aborted) {
          pushUi({ role: 'assistant', content: '已停止。' });
          if (center && task && task.status !== 'cancelled') center.cancel(task.id);
          setStatus('已停止');
        } else {
          // 运行期失败才写入对话；未配置已在发送前拦截
          pushUi({ role: 'assistant', content: '错误：' + (err && err.message ? err.message : String(err)), error: true });
          setStatus(err.message || '失败', true);
          if (center && task) center.fail(task.id, err);
        }
        reactTask = null;
      } finally {
        if (!reactPaused) {
          clearPendingHint();
          busy = false;
          syncActionBtn();
          setStatus('就绪');
        }
      }
    }

    function sendCurrent() {
      if (busy) return;
      var text = (inputEl.value || '').trim();
      if (!text) return;
      if (!ensureAiConfigured()) return;
      inputEl.value = '';
      updateTokenCount();
      reactLoop(text);
    }

    function setQuickOpen(open) {
      if (!quickBtn || !quickMenu) return;
      quickMenu.hidden = !open;
      quickBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    // 快捷：默认收起；点击展开；选中/点外/再点按钮关闭
    if (quickBtn && quickMenu) {
      setQuickOpen(false);
      quickMenu.innerHTML = '';
      chips.forEach(function(chip) {
        var b = el('button', 'assistant-quick-item', chip.label);
        b.type = 'button';
        b.setAttribute('role', 'option');
        if (chip.tool) b.setAttribute('data-tool', chip.tool);
        b.addEventListener('click', function() {
          // 挂真实工具：prompt 已点名；附带 preferredTool 供 ReAct 优先
          var text = chip.prompt || '';
          if (chip.tool && text.indexOf(chip.tool) < 0) {
            text += '\n（请优先调用工具 ' + chip.tool
              + (chip.args ? '，args=' + JSON.stringify(chip.args) : '') + '）';
          }
          inputEl.value = text;
          inputEl.focus();
          scheduleTokenCountUpdate();
          setQuickOpen(false);
        });
        quickMenu.appendChild(b);
      });
      quickBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        setQuickOpen(quickMenu.hidden);
      });
      document.addEventListener('click', function(e) {
        if (!quickMenu.hidden && !quickMenu.contains(e.target) && e.target !== quickBtn) {
          setQuickOpen(false);
        }
      });
    }

    if (ragPreviewBtn) {
      ragPreviewBtn.addEventListener('click', function() {
        openComposerRagPreview();
      });
    }
    if (ragModal) {
      ragModal.querySelectorAll('[data-assistant-rag-close]').forEach(function(el) {
        el.addEventListener('click', function() { setRagModalOpen(false); });
      });
      if (ragModalClose) {
        ragModalClose.addEventListener('click', function() { setRagModalOpen(false); });
      }
    }
    if (contextModal) {
      contextModal.querySelectorAll('[data-assistant-context-close]').forEach(function(el) {
        el.addEventListener('click', function() { setContextModalOpen(false); });
      });
      if (contextModalClose) {
        contextModalClose.addEventListener('click', function() { setContextModalOpen(false); });
      }
    }
    if (tokenCountEl) {
      tokenCountEl.addEventListener('click', function() { openContextModal(); });
      tokenCountEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openContextModal();
        }
      });
    }
    document.addEventListener('keydown', function(e) {
      if (e.key !== 'Escape') return;
      if (contextModal && !contextModal.hidden) {
        setContextModalOpen(false);
        return;
      }
      if (ragModal && !ragModal.hidden) setRagModalOpen(false);
    });

    if (actionBtn) {
      actionBtn.addEventListener('click', function() {
        if (busy) {
          abortFlag = true;
          if (reactPaused) {
            // 确认等待中停止：清空待确认并复位
            showPending(null);
            reactPaused = false;
            reactResume = null;
            var cp = window.__aiTaskCenter__;
            if (cp && reactTask && reactTask.status !== 'cancelled') cp.cancel(reactTask.id);
            reactTask = null;
            clearPendingHint();
            busy = false;
            syncActionBtn();
            setStatus('已停止');
            pushUi({ role: 'assistant', content: '已停止。' });
            return;
          }
          setStatus('正在停止…');
          var center = window.__aiTaskCenter__;
          if (center) {
            var snap = center.snapshot();
            (snap.tasks || []).forEach(function(t) {
              if (t.type === 'assistant_react' && (t.status === 'running' || t.status === 'queued')) {
                center.cancel(t.id);
              }
            });
          }
          return;
        }
        sendCurrent();
      });
    }
    inputEl.addEventListener('input', function() {
      syncActionBtn();
      scheduleTokenCountUpdate();
    });
    inputEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!busy) sendCurrent();
      }
    });
    if (clearBtn) clearBtn.addEventListener('click', function() {
      uiMessages = [];
      sessionRagInjected = new Set();
      catalogLocked = false; // 清空会话：目录形态锁定一并复位
      sessionStore.clear();
      showPending(null);
      renderMessages();
      setStatus('会话已清空');
      setTimeout(function() { if (!busy) setStatus('就绪'); }, 1200);
    });
    if (undoBtn) undoBtn.addEventListener('click', function() {
      runTool('undo_last_bundle', {}, true).then(function(r) {
        pushUi({
          role: 'assistant',
          content: r.ok ? '已撤销上一补丁包。' : ('撤销失败：' + (r.error || '')),
          error: !r.ok,
        });
      });
    });
    applyBtn.addEventListener('click', async function() {
      if (!pending) return;
      var p = pending;
      showPending(null);
      var r = null;
      try {
        r = await runTool(p.tool, p.args, true);
      } catch (errApply) {
        pushUi({
          role: 'assistant',
          content: '应用失败：' + (errApply && errApply.message ? errApply.message : String(errApply)),
          error: true,
        });
      }
      if (r && !r.ok) {
        pushUi({
          role: 'assistant',
          content: '应用失败：' + (r.error || ''),
          error: true,
        });
      }
      // 续接：确认后让模型继续总结 / 继续下一步工具调用
      var resume = reactResume;
      var wasPaused = reactPaused;
      reactResume = null;
      reactPaused = false;
      if (resume && !abortFlag) {
        setPendingHint('正在继续…');
        resume();
      } else if (wasPaused) {
        clearPendingHint();
        busy = false;
        syncActionBtn();
        setStatus('就绪');
      }
    });
    rejectBtn.addEventListener('click', function() {
      showPending(null);
      pushUi({ role: 'assistant', content: '已拒绝本次大改。' });
      if (reactPaused) {
        reactPaused = false;
        reactResume = null;
        var centerR = window.__aiTaskCenter__;
        if (centerR && reactTask && reactTask.status !== 'cancelled') centerR.cancel(reactTask.id);
        reactTask = null;
        clearPendingHint();
        busy = false;
        syncActionBtn();
        setStatus('就绪');
      }
    });

    /** 从当前卡会话恢复 UI（卡片切换 / 初始恢复共用） */
    function loadSessionIntoView() {
      catalogLocked = false; // 切卡/恢复会话 = 新起点，目录形态重新判定
      var saved = sessionStore.read();
      if (saved.ragInjectedIds && saved.ragInjectedIds.length) {
        sessionRagInjected = new Set(saved.ragInjectedIds);
      } else {
        sessionRagInjected = new Set();
      }
      uiMessages = Array.isArray(saved.messages) ? saved.messages.slice() : [];
      showPending(null);
      renderMessages();
    }

    // 恢复会话：旧全局会话一次性迁移到首张卡，再读当前卡会话
    try {
      migrateLegacyAssistantSession(window.localStorage, currentCardId());
    } catch (eMig) { /* ignore */ }
    loadSessionIntoView();
    setStatus('就绪');
    syncActionBtn();

    // 切卡 → 重载该卡会话；进行中任务对切卡已硬禁，此处再兜底
    window.addEventListener('card-draft-changed', function() {
      if (busy) return;
      try { migrateLegacyAssistantSession(window.localStorage, currentCardId()); } catch (eM) { /* ignore */ }
      loadSessionIntoView();
      setStatus('已切换到 ' + (currentCardId() ? '当前卡片会话' : '全局会话'));
      setTimeout(function() { if (!busy) setStatus('就绪'); }, 1200);
    });

    window.__assistantPanel__ = {
      send: function(text) {
        if (busy || !text) return;
        if (!ensureAiConfigured()) return;
        reactLoop(String(text));
      },
      invokeTool: function(name, args, force) { return runTool(name, args, force); },
    };
}

export function initAssistantPanel() {
  initAssistantPanelShellMode();
  initAssistantPanelShellMobile();
  initAssistantPanelMain();
}
