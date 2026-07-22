/**
 * 制卡主侧共享上下文（ctx）
 * 所有 panel 通过 ctx 访问共享状态、DOM、AI 基础设施
 */
import { escapeHtml } from '../../utils.mjs';

export function createCardBuilderContext(sm) {
  var $ = function(id) { return document.getElementById(id); };
  var val = function(id) { var el = $(id); return el ? String(el.value || '').trim() : ''; };
  if (!sm || !sm.state) {
    throw new Error('createCardBuilderContext: stateMachine 缺少 state（请确保 createCardStateMachine 返回 { state }）');
  }

  var ctx = {
    state: sm.state,
    sm: sm,
    $: $,
    val: val,

    escapeHtml: escapeHtml,

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

    panels: {},

    renderAll: function() {
      var ps = ctx.panels;
      if (ps.worldbook && ps.worldbook.renderEntriesList) ps.worldbook.renderEntriesList();
    },

    save: function() {
      sm.saveDebounced();
    },

    flushSave: function() {
      return sm.flushSave();
    },

    getCurrentDraftId: function() {
      return sm.getCurrentDraftId();
    },

    promptText: function(id, fallback) {
      if (window.__promptStore__ && window.__promptStore__.get) {
        var t = window.__promptStore__.get(id);
        if (t) return t;
      }
      return fallback || '';
    },

    showConfirmDialog: function(options) {
      var opts = options || {};
      var previousActiveElement = document.activeElement;
      var checks = Array.isArray(opts.checks) ? opts.checks : [];
      return new Promise(function(resolve) {
        var checksHtml = '';
        if (checks.length) {
          checksHtml = '<div class="app-confirm-checks">' + checks.map(function(c) {
            var id = String(c.id || '');
            var label = escapeHtml(c.label || id);
            var checked = c.checked ? ' checked' : '';
            return '<label class="app-confirm-check">'
              + '<input type="checkbox" data-confirm-check="' + escapeHtml(id) + '"' + checked + ' />'
              + '<span>' + label + '</span>'
              + '</label>';
          }).join('') + '</div>';
        }
        var overlay = document.createElement('div');
        overlay.className = 'app-confirm-overlay';
        overlay.setAttribute('role', 'presentation');
        overlay.setAttribute('tabindex', '-1');
        overlay.innerHTML =
          '<div class="app-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="appConfirmTitle" tabindex="-1">' +
            '<div class="app-confirm-head">' +
              '<div class="app-confirm-icon">' + escapeHtml(opts.icon || '⚠️') + '</div>' +
              '<div>' +
                '<h3 id="appConfirmTitle" class="app-confirm-title">' + escapeHtml(opts.title || '确认操作') + '</h3>' +
                '<p class="app-confirm-message">' + escapeHtml(opts.message || '这个操作需要确认。') + '</p>' +
              '</div>' +
            '</div>' +
            (opts.detail ? '<div class="app-confirm-body">' + escapeHtml(opts.detail) + '</div>' : '') +
            checksHtml +
            '<div class="app-confirm-actions">' +
              '<button type="button" class="app-confirm-btn" data-confirm="cancel">' + escapeHtml(opts.cancelText || '取消') + '</button>' +
              '<button type="button" class="app-confirm-btn danger" data-confirm="ok">' + escapeHtml(opts.okText || '确认') + '</button>' +
            '</div>' +
          '</div>';

        var focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

        function trapFocus(dialogEl) {
          dialogEl.addEventListener('keydown', function(e) {
            if (e.key !== 'Tab') return;
            var focusable = dialogEl.querySelectorAll(focusableSelector);
            if (focusable.length === 0) return;
            var first = focusable[0];
            var last = focusable[focusable.length - 1];
            if (e.shiftKey) {
              if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
              }
            } else {
              if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
              }
            }
          });
        }

        function restoreFocus() {
          if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
            try { previousActiveElement.focus(); } catch (_) {}
          }
        }

        function collectChecks() {
          var out = {};
          checks.forEach(function(c) {
            var el = overlay.querySelector('[data-confirm-check="' + String(c.id || '') + '"]');
            out[c.id] = !!(el && el.checked);
          });
          return out;
        }

        function close(value) {
          document.removeEventListener('keydown', onKeydown);
          overlay.remove();
          restoreFocus();
          resolve(value);
        }

        function confirmOk() {
          if (checks.length) {
            close({ confirmed: true, checks: collectChecks() });
          } else {
            close(true);
          }
        }

        function onKeydown(event) {
          if (event.key === 'Escape') { close(false); return; }
          if (event.key === 'Enter') {
            var tag = event.target && event.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            confirmOk();
          }
        }

        overlay.addEventListener('click', function(event) {
          if (event.target === overlay) close(false);
        });
        overlay.querySelector('[data-confirm="cancel"]').addEventListener('click', function() { close(false); });
        overlay.querySelector('[data-confirm="ok"]').addEventListener('click', function() { confirmOk(); });
        document.addEventListener('keydown', onKeydown);
        document.body.appendChild(overlay);
        var dialogEl = overlay.querySelector('.app-confirm-dialog');
        trapFocus(dialogEl);
        overlay.querySelector('[data-confirm="cancel"]').focus();
      });
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

    /** 完整 fetchAIContent（含 debug 日志、JSON 解析） */
    fetchAIContent: async function(options) {
      var opts = options || {};
      var requestBody = {
        model: opts.model,
        messages: opts.messages || [],
        temperature: opts.temperature
      };
      if (opts.extraBody && typeof opts.extraBody === 'object') {
        Object.keys(opts.extraBody).forEach(function(key) { requestBody[key] = opts.extraBody[key]; });
      }
      ctx.logAIDebug('request', {
        context: opts.context || 'unknown',
        url: opts.url,
        model: opts.model,
        temperature: opts.temperature,
        messages: requestBody.messages,
        hasAuth: !!(opts.headers && opts.headers.Authorization)
      });
      var res = await fetch(opts.url, {
        method: 'POST',
        headers: opts.headers,
        body: JSON.stringify(requestBody),
        signal: opts.signal
      });
      if (!res.ok) {
        ctx.logAIDebug('http_error', { context: opts.context || 'unknown', status: res.status, statusText: res.statusText });
        throw new Error((opts.httpErrorPrefix || '请求失败 HTTP ') + res.status);
      }
      var responseText = await res.text();
      var data;
      try {
        data = JSON.parse(responseText);
      } catch (err) {
        ctx.logAIDebug('api_json_parse_failed', {
          context: opts.context || 'unknown',
          error: err.message,
          responsePreview: ctx.safeDebugSlice(responseText)
        });
        ctx.updateAIDebugStatus('最近一次接口响应不是合法 JSON：' + (opts.context || 'unknown'), true);
        throw new Error('AI 接口返回了非 JSON 响应');
      }
      var content = (((data || {}).choices || [])[0] || {}).message ? (((data || {}).choices || [])[0].message.content || '') : '';
      ctx.logAIDebug('response', {
        context: opts.context || 'unknown',
        apiResponsePreview: ctx.safeDebugSlice(responseText),
        contentPreview: ctx.safeDebugSlice(content),
        usage: data && data.usage ? data.usage : null,
        finishReason: (((data || {}).choices || [])[0] || {}).finish_reason || null
      });
      return { data: data, content: content };
    },

    // ===== AI debug helpers =====
    safeDebugSlice: function(text) {
      var raw = String(text == null ? '' : text);
      return raw.length > 2400 ? raw.substring(0, 2400) + '\n...<truncated ' + (raw.length - 2400) + ' chars>' : raw;
    },

    isAIDebugEnabled: function() {
      var el = $('aiDebugEnable');
      return !!(el && el.checked);
    },

    updateAIDebugStatus: function(detail, isError) {
      var el = $('aiDebugStatus');
      if (!el) return;
      if (!ctx.isAIDebugEnabled()) {
        el.textContent = '关闭：仅显示常规错误。开启后可在 F12 Console 查看请求摘要、原始响应和 JSON 解析失败细节。';
        el.style.color = 'var(--color-text-muted)';
        return;
      }
      el.textContent = detail || '已开启：本次 AI 请求会在 Console 输出调试信息。';
      el.style.color = isError ? 'var(--color-danger)' : 'var(--color-accent-hover)';
    },

    logAIDebug: function(stage, payload) {
      var entry = { stage: stage, time: new Date().toISOString(), payload: payload || {} };
      if (!window.__aiDebugLog__) window.__aiDebugLog__ = [];
      window.__aiDebugLog__.push(entry);
      if (window.__aiDebugLog__.length > 50) window.__aiDebugLog__.shift();
      if (ctx.isAIDebugEnabled()) console.log('[AI Debug][' + stage + ']', entry);
      return entry;
    },

    buildJSONCandidates: function(text) {
      var raw = String(text == null ? '' : text);
      var candidates = [];
      var fenced = raw.match(/```json\s*([\s\S]*?)\s*```/i);
      if (fenced && fenced[1]) candidates.push({ source: 'fenced_json', raw: fenced[1].trim() });
      var fencedAny = raw.match(/```\s*([\s\S]*?)\s*```/);
      if (fencedAny && fencedAny[1]) candidates.push({ source: 'fenced_any', raw: fencedAny[1].trim() });
      var trimmed = raw.trim();
      if (trimmed) candidates.push({ source: 'full_text', raw: trimmed });
      var objStart = raw.indexOf('{');
      var objEnd = raw.lastIndexOf('}');
      if (objStart >= 0 && objEnd > objStart) candidates.push({ source: 'first_object_span', raw: raw.slice(objStart, objEnd + 1).trim() });
      var arrStart = raw.indexOf('[');
      var arrEnd = raw.lastIndexOf(']');
      if (arrStart >= 0 && arrEnd > arrStart) candidates.push({ source: 'first_array_span', raw: raw.slice(arrStart, arrEnd + 1).trim() });
      var seen = {};
      return candidates.filter(function(item) {
        if (!item.raw) return false;
        var key = item.source + '::' + item.raw;
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      });
    },

    parseJSONWithDebug: function(text, expectType, context) {
      var candidates = ctx.buildJSONCandidates(text);
      var errors = [];
      for (var i = 0; i < candidates.length; i++) {
        var item = candidates[i];
        try {
          var parsed = JSON.parse(item.raw);
          var normalized = expectType === 'array'
            ? (Array.isArray(parsed) ? parsed : [parsed])
            : ((Array.isArray(parsed) && parsed.length > 0) ? parsed[0] : parsed);
          ctx.logAIDebug('json_parse_success', {
            context: context || 'unknown',
            candidateSource: item.source,
            expectType: expectType,
            rawPreview: ctx.safeDebugSlice(text),
            candidatePreview: ctx.safeDebugSlice(item.raw),
            parsed: normalized
          });
          return normalized;
        } catch (err) {
          errors.push({ source: item.source, error: err.message, candidatePreview: ctx.safeDebugSlice(item.raw) });
        }
      }
      var payload = {
        context: context || 'unknown',
        expectType: expectType,
        rawPreview: ctx.safeDebugSlice(text),
        candidates: errors
      };
      ctx.logAIDebug('json_parse_failed', payload);
      ctx.updateAIDebugStatus('最近一次解析失败：' + (context || 'unknown') + '。请打开 F12 Console 查看原始响应。', true);
      var detail = errors.length ? errors.map(function(it) { return it.source + ': ' + it.error; }).join(' | ') : '无可解析 JSON 候选';
      throw new Error('AI 返回中没有有效 JSON 对象。' + detail);
    },

    extractJsonObj: function(text, context) {
      return ctx.parseJSONWithDebug(text, 'object', context || 'extractJsonObj');
    },

    extractJsonArray: function(text, context) {
      return ctx.parseJSONWithDebug(text, 'array', context || 'extractJsonArray');
    },
  };

  return ctx;
}
