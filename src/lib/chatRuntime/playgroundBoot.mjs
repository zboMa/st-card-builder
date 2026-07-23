/**
 * 试聊 playground boot（从 ChatPlayground.astro 外提）
 */
import {
  buildTrialChatMessages,
  formatWbTriggerTags,
  applyDisplayRegex,
  ST_PARITY_VERSION,
} from './browserChat.mjs';
import { engineTryAllowed } from '../actionEngine/helpers.mjs';

export function initChatPlayground() {
  var chatConversation = document.getElementById('chatConversation');
  var chatMessages = document.getElementById('chatMessages');
  var chatInput = document.getElementById('chatInput');
  var btnChatStart = document.getElementById('btnChatStart');
  var btnChatSend = document.getElementById('btnChatSend');
  var btnChatReset = document.getElementById('btnChatReset');
  var btnChatRegenerate = document.getElementById('btnChatRegenerate');
  var btnChatConfig = document.getElementById('btnChatConfig');
  var chatConfigDrawer = document.getElementById('chatConfigDrawer');
  var chatInputRow = document.getElementById('chatInputRow');
  var chatTemperature = document.getElementById('chatTemperature');
  var chatTempValue = document.getElementById('chatTempValue');
  var chatMaxTokens = document.getElementById('chatMaxTokens');
  var chatShowPrompt = document.getElementById('chatShowPrompt');
  var chatPromptDebug = document.getElementById('chatPromptDebug');
  var chatTypingIndicator = document.getElementById('chatTypingIndicator');
  var chatWbIndicator = document.getElementById('chatWbIndicator');
  var chatTokenIndicator = document.getElementById('chatTokenIndicator');
  var chatWbTriggerBar = document.getElementById('chatWbTriggerBar');
  var chatWbTriggerList = document.getElementById('chatWbTriggerList');
  var chatScanDepth = document.getElementById('chatScanDepth');
  var chatUserName = document.getElementById('chatUserName');

  function setChatConfigOpen(open) {
    if (!chatConfigDrawer || !btnChatConfig) return;
    if (open) {
      chatConfigDrawer.hidden = false;
      chatConfigDrawer.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(function() {
        chatConfigDrawer.classList.add('is-open');
      });
      btnChatConfig.setAttribute('aria-expanded', 'true');
    } else {
      chatConfigDrawer.classList.remove('is-open');
      btnChatConfig.setAttribute('aria-expanded', 'false');
      chatConfigDrawer.setAttribute('aria-hidden', 'true');
      window.setTimeout(function() {
        if (!chatConfigDrawer.classList.contains('is-open')) {
          chatConfigDrawer.hidden = true;
        }
      }, 280);
    }
  }

  if (btnChatConfig && chatConfigDrawer) {
    btnChatConfig.addEventListener('click', function() {
      var open = btnChatConfig.getAttribute('aria-expanded') !== 'true';
      setChatConfigOpen(open);
    });
    chatConfigDrawer.querySelectorAll('[data-chat-config-close]').forEach(function(el) {
      el.addEventListener('click', function() { setChatConfigOpen(false); });
    });
  }

  /** 滚到对话区底部（触发标签与消息同层滚动） */
  function scrollChatToBottom() {
    var el = chatConversation || chatMessages;
    if (el) el.scrollTop = el.scrollHeight;
  }

  
  
  
  var chatHistory = [];
  var chatStarted = false;
  var chatBusy = false;

  
  
  

  
  chatTemperature.addEventListener('input', function() {
    chatTempValue.textContent = chatTemperature.value;
  });

  
  var tokenBtns = document.querySelectorAll('.token-btn');
  var chatMaxTokensSlider = document.getElementById('chatMaxTokensSlider');
  var chatMaxTokensInput = document.getElementById('chatMaxTokensInput');

  function syncTokenValue(val) {
    val = Math.max(100, Math.min(16000, parseInt(val) || 2000));
    chatMaxTokensSlider.value = val;
    chatMaxTokensInput.value = val;
    chatMaxTokens.innerHTML = '<option value="' + val + '" selected>' + val + '</option>';
    chatMaxTokens.value = val;
  }

  chatMaxTokensSlider.addEventListener('input', function() {
    syncTokenValue(chatMaxTokensSlider.value);
  });

  chatMaxTokensInput.addEventListener('change', function() {
    syncTokenValue(chatMaxTokensInput.value);
  });

  chatMaxTokensInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); syncTokenValue(chatMaxTokensInput.value); chatMaxTokensInput.blur(); }
  });

  
  chatShowPrompt.addEventListener('change', function() {
    if (!chatShowPrompt.checked && chatPromptDebug) {
      chatPromptDebug.style.display = 'none';
    }
  });

  
  
  
  function getCurrentCharData() {
    if (typeof window.__getChatCharacterPayload__ === 'function') {
      try {
        var p = window.__getChatCharacterPayload__() || {};
        return {
          name: p.name || '角色',
          description: p.description || '',
          personality: p.personality || '',
          scenario: p.scenario || '',
          mesExample: p.mesExample || p.mes_example || '',
          systemPrompt: p.systemPrompt || p.system_prompt || '',
          creatorNotes: p.creatorNotes || '',
          firstMes: p.firstMes || '你好。',
        };
      } catch (err) { /* fall through */ }
    }
    return {
      name: (document.getElementById('charName') || {}).value || '角色',
      description: (document.getElementById('charDesc') || {}).value || '',
      personality: '',
      scenario: '',
      mesExample: '',
      systemPrompt: '',
      creatorNotes: (document.getElementById('creatorNotes') || {}).value || '',
      firstMes: (document.getElementById('firstMes') || {}).value || '你好。',
    };
  }

  function getWorldbookEntries() {
    if (window.__getWorldbookEntries__) return window.__getWorldbookEntries__();
    return [];
  }

  function getRegexScripts() {
    if (window.__getRegexScripts__) return window.__getRegexScripts__() || [];
    return [];
  }

  function getPresetMessages() {
    if (window.__getActivePresetMessages__) return window.__getActivePresetMessages__();
    if (window.__getActivePresetsStr__) {
      var str = window.__getActivePresetsStr__();
      if (str) return [{ role: 'system', content: str }];
    }
    return [];
  }

  function getScanDepth() {
    var n = chatScanDepth ? parseInt(chatScanDepth.value, 10) : 2;
    return isNaN(n) ? 2 : Math.max(0, n);
  }

  function getUserName() {
    var v = chatUserName && chatUserName.value != null ? String(chatUserName.value).trim() : '';
    return v || 'User';
  }

  function getRpCoreText(char) {
    var name = (char && char.name) || 'Character';
    if (window.__promptStore__ && typeof window.__promptStore__.applyTemplate === 'function') {
      try {
        return window.__promptStore__.applyTemplate(
          window.__promptStore__.get('chatRpCore'),
          { charName: name, user: '{{user}}' }
        ) || '';
      } catch (e) { /* fall through */ }
    }
    return (
      'Write ' + name + '\'s next reply in a fictional roleplay chat between ' + name + ' and {{user}}.\n'
      + 'Write 1 reply only in internet RP style, italicize actions, and avoid quotation marks. '
      + 'Use markdown. Be proactive, creative, and drive the plot and conversation forward. '
      + 'Write at least 1 paragraph, up to 4. Always stay in character and avoid repetition.\n'
      + 'IMPORTANT: 每次回复至少写3-5段，包含详细的动作描写、心理活动、环境描述和对话。不要只回复一句话。'
    );
  }

  function updateWbTriggerDisplay(debug) {
    var triggered = formatWbTriggerTags(debug);
    if (triggered.length === 0) {
      chatWbTriggerBar.style.display = 'none';
      chatWbIndicator.textContent = 'WB 0';
      chatWbIndicator.classList.remove('active');
      return [];
    }

    chatWbIndicator.textContent = 'WB ' + triggered.length;
    chatWbIndicator.classList.add('active');
    chatWbTriggerBar.style.display = 'block';
    chatWbTriggerList.innerHTML = triggered.map(function(t) {
      return '<span class="wb-trigger-tag active">'
        + '✅ ' + (t.comment || '未命名')
        + (t.strategy === 'constant' ? ' [常驻]' : '') + '</span>';
    }).join('');

    return triggered;
  }

  function buildTrialMessages() {
    var char = getCurrentCharData();
    return buildTrialChatMessages({
      getChar: getCurrentCharData,
      getWb: getWorldbookEntries,
      getRegex: getRegexScripts,
      getPresets: getPresetMessages,
      history: chatHistory,
      scanDepth: getScanDepth(),
      userName: getUserName(),
      rpCoreText: getRpCoreText(char),
    });
  }

  function estimateTokens(text) {
    var cn = (text.match(/[\u4e00-\u9fff\u3040-\u30ff]/g) || []).length;
    return Math.round(cn * 2 + (text.length - cn) * 0.4);
  }

  
  
  
  function renderMessage(role, name, text, streaming) {
    var div = document.createElement('div');
    div.className = 'chat-msg ' + (role === 'user' ? 'user' : '');
    var avClass = role === 'user' ? 'user-av' : 'char';
    var avEmoji = role === 'user' ? '👤' : '🎭';
    var bbClass = role === 'user' ? 'user' : 'char';

    div.innerHTML = '<div class="chat-avatar ' + avClass + '">' + avEmoji + '</div>'
      + '<div class="chat-bubble ' + bbClass + '">'
      + '<span class="chat-name">' + esc(name) + '</span>'
      + '<span class="chat-text' + (streaming ? ' streaming-cursor' : '') + '">' + esc(text) + '</span>'
      + '</div>';

    chatMessages.appendChild(div);
    scrollChatToBottom();
    return div;
  }

  function updateLastMessage(div, text, done) {
    var el = div.querySelector('.chat-text');
    if (!el) return;
    if (done) {
      el.classList.remove('streaming-cursor');
      renderChatText(el, text);
    } else {
      el.textContent = text;
      el.classList.add('streaming-cursor');
    }
    scrollChatToBottom();
  }

  var UV_RE = /<UpdateVariable>\s*<Analysis>([\s\S]*?)<\/Analysis>\s*<JSONPatch>([\s\S]*?)<\/JSONPatch>\s*<\/UpdateVariable>/;

  function decodeJsonPointerPart(part) {
    return String(part || '').replace(/~1/g, '/').replace(/~0/g, '~');
  }

  function splitPatchPath(path) {
    return String(path || '')
      .replace(/^\/+/, '')
      .split('/')
      .filter(Boolean)
      .map(decodeJsonPointerPart);
  }

  function compactPatchValue(value) {
    if (value === undefined) return '未提供';
    if (value === null) return 'null';
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    var text = typeof value === 'string' ? value : JSON.stringify(value);
    return text.length > 64 ? text.slice(0, 61) + '...' : text;
  }

  function patchOpLabel(op) {
    var map = {
      replace: '已更新',
      insert: '已新增',
      delta: '数值变化',
      remove: '已移除',
      move: '已移动'
    };
    return map[op] || '状态变更';
  }

  function patchDisplayValue(item) {
    if (!item || !item.op) return '未知';
    if (item.op === 'delta') {
      var num = Number(item.value);
      if (Number.isFinite(num)) return (num > 0 ? '+' : '') + num;
      return compactPatchValue(item.value);
    }
    if (item.op === 'remove') return '已移除';
    if (item.op === 'move') {
      var target = splitPatchPath(item.to).join(' / ');
      return target ? '→ ' + target : '已移动';
    }
    return compactPatchValue(item.value);
  }

  function getMvuVariableMetaMap() {
    if (!window.__getCardExtension__) return {};
    var data = window.__getCardExtension__('zmer_mvu_design');
    var vars = data && Array.isArray(data.variables) ? data.variables : [];
    var map = {};
    vars.forEach(function(v) {
      var path = String(v && v.path || '').trim();
      if (!path) return;
      var patchPath = '/' + path.split('.').filter(Boolean).map(function(part) {
        return String(part).replace(/~/g, '~0').replace(/\//g, '~1');
      }).join('/');
      map[patchPath] = {
        description: String(v.description || '').trim(),
        check: Array.isArray(v.check) ? v.check.map(String).filter(Boolean) : []
      };
    });
    return map;
  }

  function parsePatchCards(patchText) {
    try {
      var parsed = JSON.parse(patchText);
      if (!Array.isArray(parsed)) return [];
      var metaMap = getMvuVariableMetaMap();
      return parsed.map(function(item) {
        var rawPath = item.path || item.to || '';
        var pathParts = splitPatchPath(rawPath);
        var leaf = pathParts[pathParts.length - 1] || item.op || '变量';
        var group = pathParts.slice(0, -1).join(' / ') || '根节点';
        var matched = metaMap[String(rawPath || '').trim()] || null;
        var note = '';
        if (matched) {
          note = matched.description || (matched.check && matched.check[0]) || '';
          if (!note && matched.check && matched.check.length) note = matched.check[0];
        }
        return {
          label: leaf,
          value: patchDisplayValue(item),
          meta: patchOpLabel(item.op) + ' · ' + group,
          note: note
        };
      });
    } catch (err) {
      return [];
    }
  }

  function renderChatText(el, text) {
    var m = text.match(UV_RE);
    if (!m) { el.textContent = text; return; }

    el.textContent = '';
    var idx = text.indexOf('<UpdateVariable>');
    var endTag = '</UpdateVariable>';
    var endIdx = text.indexOf(endTag);
    var before = text.substring(0, idx);
    var after  = text.substring(endIdx + endTag.length);

    if (before.trim()) {
      var bs = document.createElement('span');
      bs.textContent = before;
      el.appendChild(bs);
    }

    var card = document.createElement('div');
    card.className = 'chat-var-update';
    var hdr = document.createElement('div');
    hdr.className = 'cvu-header';
    hdr.innerHTML = '<div class="cvu-header-main"><span class="cvu-header-dot"></span><span>STATUS REPORT</span></div>'
      + '<span class="cvu-header-tag">MVU LIVE</span>';
    var body = document.createElement('div');
    body.className = 'cvu-body open';
    var ana = document.createElement('div');
    ana.className = 'cvu-analysis';
    ana.innerHTML = '<span class="cvu-analysis-label">Sync Summary</span>';
    ana.appendChild(document.createTextNode(m[1].trim()));
    body.appendChild(ana);
    var cards = parsePatchCards(m[2].trim());
    if (cards.length) {
      var grid = document.createElement('div');
      grid.className = 'cvu-grid';
      cards.forEach(function(item) {
        var stat = document.createElement('article');
        stat.className = 'cvu-stat';
        var label = document.createElement('span');
        label.className = 'cvu-stat-label';
        label.textContent = item.label;
        var value = document.createElement('span');
        value.className = 'cvu-stat-value';
        value.textContent = item.value;
        var meta = document.createElement('span');
        meta.className = 'cvu-stat-path';
        meta.textContent = item.meta;
        stat.appendChild(label);
        stat.appendChild(value);
        stat.appendChild(meta);
        if (item.note) {
          var note = document.createElement('span');
          note.className = 'cvu-stat-note';
          note.textContent = item.note;
          stat.appendChild(note);
        }
        grid.appendChild(stat);
      });
      body.appendChild(grid);
    } else {
      var empty = document.createElement('div');
      empty.className = 'cvu-empty';
      empty.textContent = '本轮没有可提炼成状态卡的结构化字段，已保留原始补丁供调试查看。';
      body.appendChild(empty);
    }
    var debug = document.createElement('details');
    debug.className = 'cvu-debug';
    var debugSummary = document.createElement('summary');
    debugSummary.textContent = '查看原始补丁（调试）';
    var patch = document.createElement('pre');
    patch.className = 'cvu-patch';
    patch.textContent = m[2].trim();
    debug.appendChild(debugSummary);
    debug.appendChild(patch);
    body.appendChild(debug);
    card.appendChild(hdr);
    card.appendChild(body);
    el.appendChild(card);

    if (after.trim()) {
      var as = document.createElement('span');
      as.textContent = after;
      el.appendChild(as);
    }
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  
  
  
  async function sendToAI(messages, useStream, signal) {
    var url = (document.getElementById('apiUrl').value || '').replace(/\/$/, '') + '/chat/completions';
    var key = (document.getElementById('apiKey').value || '').trim();
    var model = (document.getElementById('modelSelect').value || '');
    if (!model) throw new Error('请先在 AI 引擎中选择模型');

    var headers = { 'Content-Type': 'application/json' };
    if (key) headers['Authorization'] = 'Bearer ' + key;

    var temp = parseFloat(chatTemperature.value) || 0.85;
    var maxTk = parseInt(chatMaxTokens.value) || 2000;

    var body = { model: model, messages: messages, temperature: temp, max_tokens: maxTk };
    if (useStream) body.stream = true;

    var res = await fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body), signal: signal });
    if (!res.ok) {
      var errText = ''; try { errText = await res.text(); } catch(e) {}
      throw new Error('HTTP ' + res.status + (errText ? ': ' + errText.substring(0, 200) : ''));
    }
    return res;
  }

  
  
  
  async function streamResponse(response, msgDiv) {
    var ct = response.headers.get('content-type') || '';

    
    if (ct.indexOf('text/event-stream') === -1 && ct.indexOf('stream') === -1) {
      var json = await response.json();
      var text = '';
      var fr = null;
      if (json.choices && json.choices[0]) {
        text = (json.choices[0].message && json.choices[0].message.content) || json.choices[0].text || '';
        fr = json.choices[0].finish_reason;
      }
      if (fr === 'length') text += '\n\n⚠️ [回复被 max_tokens 截断！请点击上方「长/超长/MAX」按钮增大回复长度]';
      updateLastMessage(msgDiv, text, true);
      return text;
    }

    
    var reader = response.body.getReader();
    var decoder = new TextDecoder('utf-8');
    var fullText = '';
    var buffer = '';
    var finishReason = null;

    while (true) {
      var result = await reader.read();
      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });

      while (true) {
        var nl = buffer.indexOf('\n');
        if (nl === -1) break;
        var line = buffer.substring(0, nl).trim();
        buffer = buffer.substring(nl + 1);
        if (!line || line === 'data: [DONE]' || !line.startsWith('data: ')) continue;
        try {
          var chunk = JSON.parse(line.substring(6));
          if (chunk.choices && chunk.choices[0]) {
            var d = chunk.choices[0].delta;
            if (d && d.content) { fullText += d.content; updateLastMessage(msgDiv, fullText, false); }
            if (chunk.choices[0].finish_reason) finishReason = chunk.choices[0].finish_reason;
          }
        } catch(e) {}
      }
    }

    
    if (buffer.trim()) {
      var rem = buffer.trim();
      if (rem.startsWith('data: ') && rem !== 'data: [DONE]') {
        try {
          var lc = JSON.parse(rem.substring(6));
          if (lc.choices && lc.choices[0]) {
            if (lc.choices[0].delta && lc.choices[0].delta.content) fullText += lc.choices[0].delta.content;
            if (lc.choices[0].finish_reason) finishReason = lc.choices[0].finish_reason;
          }
        } catch(e) {}
      }
      if (!fullText) {
        try {
          var fb = JSON.parse(rem);
          if (fb.choices && fb.choices[0] && fb.choices[0].message) {
            fullText = fb.choices[0].message.content || '';
            finishReason = fb.choices[0].finish_reason;
          }
        } catch(e) {}
      }
    }

    if (finishReason === 'length') {
      fullText += '\n\n⚠️ [回复被 max_tokens 截断！请点击上方「长/超长/MAX」按钮增大回复长度]';
    }

    updateLastMessage(msgDiv, fullText, true);
    return fullText;
  }

  
  
  
  async function chat(userText) {
    if (chatBusy) return;
    if (!engineTryAllowed('card.chat.reply').ok) return;
    chatBusy = true;
    btnChatSend.disabled = true;
    chatTypingIndicator.style.display = 'inline';

    var char = getCurrentCharData();
    var userLabel = getUserName();

    if (userText) {
      chatHistory.push({ role: 'user', content: userText });
      renderMessage('user', userLabel, userText);
    }

    var built = buildTrialMessages();
    var messages = built.messages;
    updateWbTriggerDisplay(built.debug);

    var totalText = messages.map(function(m) { return m.content; }).join('');
    var tokens = estimateTokens(totalText);
    chatTokenIndicator.textContent = '~' + tokens + ' tok';

    if (chatShowPrompt.checked) {
      chatPromptDebug.style.display = 'block';
      var activatedComments = ((built.debug && built.debug.activated) || []).map(function(e) {
        return e.comment || e.id || '?';
      });
      chatPromptDebug.textContent = messages.map(function(m, i) {
        return '--- [' + i + '] ' + m.role.toUpperCase() + ' (' + m.content.length + '字) ---\n' + m.content;
      }).join('\n\n')
        + '\n\n=== ST_PARITY_VERSION: ' + (built.parityVersion || ST_PARITY_VERSION)
        + ' | activated: ' + (activatedComments.length ? activatedComments.join(', ') : '(none)')
        + ' | 消息数: ' + messages.length + ' | Token: ~' + tokens
        + ' | max_tokens: ' + (parseInt(chatMaxTokens.value) || 2000) + ' ===';
    }

    var msgDiv = renderMessage('assistant', char.name, '', true);
    var center = window.__aiTaskCenter__;
    var chatTask = center ? center.create({
      type: 'chat_reply',
      title: '角色试聊',
      target: String(userText || '').slice(0, 40),
    }) : null;

    try {
      var response = await sendToAI(messages, true, chatTask && chatTask.signal);
      var aiText = await streamResponse(response, msgDiv);

      if (!aiText || aiText.trim().length === 0) {
        updateLastMessage(msgDiv, '⏳ 流式失败，重试中...', false);
        var r2 = await sendToAI(messages, false, chatTask && chatTask.signal);
        var j2 = await r2.json();
        aiText = '';
        if (j2.choices && j2.choices[0] && j2.choices[0].message) {
          aiText = j2.choices[0].message.content || '';
          if (j2.choices[0].finish_reason === 'length') aiText += '\n\n⚠️ [回复被截断！请点击「超长」或「MAX」]';
        }
        updateLastMessage(msgDiv, aiText, true);
      }

      if (aiText) {
        var clean = aiText.replace(/\n\n⚠️ \[.*?\]/g, '');
        // history：prompt 侧（未做 display/markdownOnly 替换），供后续扫描
        chatHistory.push({ role: 'assistant', content: clean });
        var displayText = applyDisplayRegex(clean, getRegexScripts());
        updateLastMessage(msgDiv, displayText, true);
        var afterBuilt = buildTrialMessages();
        updateWbTriggerDisplay(afterBuilt.debug);
      }
      if (center && chatTask) center.succeed(chatTask.id);
    } catch(err) {
      var aborted = window.__isAiAbortError__ && window.__isAiAbortError__(err);
      if (aborted) {
        updateLastMessage(msgDiv, '⏹ 已取消', true);
        if (center && chatTask && chatTask.status !== 'cancelled') center.cancel(chatTask.id);
      } else {
        updateLastMessage(msgDiv, '❌ 出错了: ' + err.message, true);
        if (center && chatTask) center.fail(chatTask.id, err);
      }
    } finally {
      chatBusy = false;
      btnChatSend.disabled = false;
      chatTypingIndicator.style.display = 'none';
    }
  }

  
  
  
  btnChatStart.addEventListener('click', function() {
    var char = getCurrentCharData();
    if (!char.description && !char.firstMes) {
      alert('请先在角色面板填写角色描述或让 AI 生成！');
      return;
    }
    chatStarted = true;
    chatHistory = [];
    chatMessages.innerHTML = '';
    btnChatStart.style.display = 'none';
    chatInputRow.style.display = 'block';

    var fm = char.firstMes || '（' + char.name + '出现在你面前）';
    chatHistory.push({ role: 'assistant', content: fm });
    var displayFm = applyDisplayRegex(fm, getRegexScripts());
    renderMessage('assistant', char.name, displayFm);
    var startBuilt = buildTrialMessages();
    updateWbTriggerDisplay(startBuilt.debug);
    chatInput.focus();
  });

  btnChatSend.addEventListener('click', function() {
    var text = chatInput.value.trim();
    if (!text || chatBusy) return;
    chatInput.value = '';
    chat(text);
  });

  chatInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); btnChatSend.click(); }
  });

  btnChatReset.addEventListener('click', function() {
    if (chatBusy) return;
    chatHistory = [];
    chatStarted = false;
    btnChatStart.style.display = 'block';
    chatInputRow.style.display = 'none';
    chatWbTriggerBar.style.display = 'none';
    chatPromptDebug.style.display = 'none';
    chatWbIndicator.textContent = 'WB 0';
    chatWbIndicator.classList.remove('active');
    chatTokenIndicator.textContent = '~0 tok';
    chatMessages.innerHTML = '<div class="chat-empty-hint"><div style="color:var(--color-text-muted);font-size:0.82rem;">点击「开始试聊」加载开场白</div><div style="color:var(--color-text-muted);font-size:0.72rem;margin-top:4px;">世界书/正则按 SillyTavern 1.18.0 规则试运行</div></div>';
  });

  btnChatRegenerate.addEventListener('click', async function() {
    if (chatBusy || chatHistory.length === 0) return;
    if (chatHistory[chatHistory.length - 1].role === 'assistant') {
      chatHistory.pop();
      var last = chatMessages.querySelector('.chat-msg:last-child');
      if (last) last.remove();
    }
    await chat(null);
  });

  // 右栏助手：试聊回流只读桥接
  window.__getChatPlaygroundState__ = function(opts) {
    var max = (opts && opts.maxMessages) || 40;
    return {
      started: chatStarted,
      busy: chatBusy,
      messageCount: chatHistory.length,
      messages: chatHistory.slice(-max).map(function(m) {
        return { role: m.role, content: String(m.content || '').slice(0, 2000) };
      }),
    };
  };
}
