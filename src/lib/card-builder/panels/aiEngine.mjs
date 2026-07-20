import { generateCardJSON } from '../state.mjs';
import {
  normalizeCharTags,
  mergeCharTags,
  buildTagGenContext,
  parseTagsFromAiText,
  DEFAULT_TAG_CONTEXT_CHARS,
} from '../../charTags.mjs';

const AI_KEY = 'st_v3_builder_ai_config';

export function registerAiEngine(ctx) {
  var parsedPresetList = [];
  var cachedSearchResults = null;

  // ====================================================================
  //  Internal helpers
  // ====================================================================

  function buildNsfwFlavorHint() {
    var nsfwConfig = window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {};
    var data = window.__nsfwFlavorData__;
    if (!nsfwConfig.enabled || !nsfwConfig.flavor || !data) return '';
    var p = data.presets[nsfwConfig.flavor];
    if (!p) return '';
    return '\n【生成风格·' + p.label + '】' + p.description
      + '\n温度=' + p.palette.temperature + ' | 触感=' + p.palette.texture
      + '\n重点：' + p.focus.join(' / ')
      + '\n避免：' + p.avoid.join(' / ');
  }

  function buildNtlHintForPrompt() {
    var nsfwConfig = window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {};
    var data = window.__nsfwFlavorData__;
    if (!nsfwConfig.ntlEnabled || !nsfwConfig.ntlTabooTypes || !nsfwConfig.ntlTabooTypes.length || !data) return '';
    var lines = ['\n【NTL 禁忌方向】'];
    nsfwConfig.ntlTabooTypes.forEach(function(t) {
      var info = data.tabooTypes[t];
      if (info) lines.push('- ' + info.label + '：' + info.description);
    });
    return lines.join('\n');
  }

  function getTagContextChars() {
    var el = ctx.$('tagContextChars');
    return el ? (parseInt(el.value, 10) || DEFAULT_TAG_CONTEXT_CHARS) : DEFAULT_TAG_CONTEXT_CHARS;
  }

  function renderCharTags() {
    var charTagsList = ctx.$('charTagsList');
    if (!charTagsList) return;
    var tags = normalizeCharTags(ctx.state.charTags);
    ctx.state.charTags = tags;
    charTagsList.innerHTML = tags.map(function(tag, i) {
      return (
        '<span class="char-tag-chip" data-tag-index="' + i + '">' +
          '<span class="char-tag-chip-text">' + ctx.escapeHtml(tag) + '</span>' +
          '<button type="button" class="char-tag-chip-remove" data-tag-action="remove" data-tag-index="' + i + '" title="移除" aria-label="移除标签">×</button>' +
        '</span>'
      );
    }).join('');
  }

  function setCharTags(next, opts) {
    ctx.state.charTags = normalizeCharTags(next);
    renderCharTags();
    if (!opts || opts.save !== false) ctx.save();
  }

  function setCharTagsAiTip(text, kind) {
    var tipEl = ctx.$('charTagsAiTip');
    if (!tipEl) return;
    tipEl.textContent = text || '';
    tipEl.classList.remove('is-warn', 'is-ok', 'is-err');
    if (kind) tipEl.classList.add('is-' + kind);
  }

  function sleep(ms) {
    return new Promise(function(r) { setTimeout(r, ms); });
  }

  function saveAiConfig() {
    var nsfwConfig = window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {};
    localStorage.setItem(AI_KEY, JSON.stringify({
      url:        (ctx.$('apiUrl') ? ctx.$('apiUrl').value.trim() : ''),
      key:        (ctx.$('apiKey') ? ctx.$('apiKey').value.trim() : ''),
      model:      (ctx.$('modelSelect') ? ctx.$('modelSelect').value : ''),
      debug:      !!(ctx.$('aiDebugEnable') && ctx.$('aiDebugEnable').checked),
      tagContextChars: getTagContextChars(),
      embeddingModel: (ctx.$('embeddingModel') ? ctx.$('embeddingModel').value : '') || '',
      embeddingApiUrl: (ctx.$('embeddingApiUrl') ? ctx.$('embeddingApiUrl').value : '') || '',
      embeddingApiKey: (ctx.$('embeddingApiKey') ? ctx.$('embeddingApiKey').value : '') || '',
      novelRag: window.__getNovelRagOptions__
        ? window.__getNovelRagOptions__()
        : (function() {
            try { var v = JSON.parse(localStorage.getItem('st_v3_builder_novel_rag')); return v || { enabled: true, budget: 12000 }; } catch(e) { return { enabled: true, budget: 12000 }; }
          })(),
      presetList: parsedPresetList,
      nsfwEnabled:   !!nsfwConfig.enabled,
      nsfwFlavor:    nsfwConfig.flavor || '',
      ntlEnabled:    !!nsfwConfig.ntlEnabled,
      ntlTabooTypes: (nsfwConfig.ntlTabooTypes || []).slice(),
    }));
  }

  function closeWbModalSingle() {
    var modal = ctx.$('wbModalSingle');
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    if (modal._wbModalHome && modal.parentNode !== modal._wbModalHome) {
      modal._wbModalHome.appendChild(modal);
    }
    var WB_MODAL_IDS = ['wbModalSingle', 'wbModalOrganize', 'wbModalKeygen', 'wbModalEdit'];
    var anyOpen = WB_MODAL_IDS.some(function(mid) {
      var m = document.getElementById(mid);
      return m && !m.hidden;
    });
    if (!anyOpen) document.body.classList.remove('wb-modal-open');
  }

  function formatCharRefForPrompt(charData) {
    if (!charData) return '';
    return '\n【阶段1已生成角色参考】\n'
      + JSON.stringify({
        charName: charData.charName || '',
        wbName: charData.wbName || '',
        charDesc: String(charData.charDesc || '').substring(0, 600),
        creatorNotes: String(charData.creatorNotes || '').substring(0, 240),
        tags: charData.tags || charData.charTags || [],
      });
  }

  function formatWbSkeletonRef(entries) {
    if (!entries || !entries.length) return '';
    var lines = entries.map(function(e) {
      return '- ' + (e.comment || '未命名') + ': ' + String(e.content || '').substring(0, 100);
    }).join('\n');
    return '\n【阶段2已生成世界书骨架参考（勿重复，可补充关联）】\n' + lines;
  }

  // ====================================================================
  //  AI Engine Panel
  // ====================================================================

  ctx.panels.aiEngine = {

    // ===== 预设 =====

    renderPresetList: function() {
      var container = ctx.$('presetListContainer');
      var statusEl = ctx.$('presetStatus');
      if (!parsedPresetList.length) {
        if (container) container.style.display = 'none';
        if (statusEl) statusEl.textContent = '未找到可用规则';
        return;
      }
      if (container) container.style.display = 'block';
      if (statusEl) statusEl.textContent = '\u2705 预设载入成功！已加载 ' + parsedPresetList.length + ' 条规则';
      var html = parsedPresetList.map(function(it, i) {
        var typeBadge = '';
        var nm = (it.name || '').toLowerCase();
        if (nm.indexOf('example') >= 0 || nm.indexOf('dialogue') >= 0 || nm.indexOf('\u793a\u4f8b') >= 0) {
          typeBadge = ' <span style="font-size:0.6rem;color:#34d399;background:rgba(16,185,129,0.1);padding:1px 5px;border-radius:4px;">\u793a\u4f8b\u5bf9\u8bdd</span>';
        } else if (nm.indexOf('jailbreak') >= 0 || nm.indexOf('nsfw') >= 0 || nm.indexOf('\u8d8a\u72f1') >= 0) {
          typeBadge = ' <span style="font-size:0.6rem;color:#f59e0b;background:rgba(245,158,11,0.1);padding:1px 5px;border-radius:4px;">JB</span>';
        } else {
          typeBadge = ' <span style="font-size:0.6rem;color:var(--color-text-muted);background:rgba(100,116,139,0.1);padding:1px 5px;border-radius:4px;">system</span>';
        }
        return '<div class="preset-item"><input type="checkbox" id="preset_chk_' + i + '" data-index="' + i + '"' + (it.enabled ? ' checked' : '') + ' /><label for="preset_chk_' + i + '">' + it.name + typeBadge + '</label></div>';
      }).join('');

      if (container) {
        container.innerHTML = html;
        container.querySelectorAll('input[type="checkbox"]').forEach(function(chk) {
          chk.addEventListener('change', function(e) {
            parsedPresetList[parseInt(e.target.getAttribute('data-index'))].enabled = e.target.checked;
            saveAiConfig();
          });
        });
      }
    },

    getActivePresetsStr: function() {
      return parsedPresetList.filter(function(p) { return p.enabled; })
        .map(function(p) { return '[\u89c4\u5219: ' + p.name + ']\n' + p.content; }).join('\n\n');
    },

    getActivePresetMessages: function() {
      return parsedPresetList.filter(function(p) { return p.enabled; })
        .map(function(p) { return { role: p.role || 'system', content: p.content }; });
    },

    loadPresetsFromConfig: function(presets) {
      if (presets && Array.isArray(presets) && presets.length > 0) {
        parsedPresetList = presets;
        ctx.panels.aiEngine.renderPresetList();
      }
    },

    getParsedPresetList: function() {
      return parsedPresetList;
    },

    // ===== 搜索 =====

    performSearchIfEnabled: async function(query) {
      var sc = window.__searchConfig__;
      if (!sc || !sc.isEnabled()) return { searchText: '', searchResults: null, mode: 'off' };
      var engine = sc.getEngine();
      var customQuery = sc.getCustomQuery();
      var effective = customQuery || query;
      var count = sc.getResultCount();
      var lang = sc.getLang();
      if (engine !== 'none') {
        try {
          var results = await sc.executeSearch(effective, count, lang);
          if (results && results.length > 0) {
            cachedSearchResults = results;
            return { searchText: sc.formatForPrompt(results), searchResults: results, mode: 'engine' };
          }
        } catch (err) {
          return { searchText: ctx.promptText('aiNativeSearch', effective), searchResults: null, mode: 'ai_fallback', error: err.message };
        }
      }
      return { searchText: ctx.promptText('aiNativeSearch', effective), searchResults: null, mode: 'ai_native' };
    },

    // ===== AI 模型拉取 =====

    fetchModels: async function() {
      var apiUrlEl = ctx.$('apiUrl');
      var apiKeyEl = ctx.$('apiKey');
      var modelEl = ctx.$('modelSelect');
      // 主反馈在 API 配置页；aiStatus 仅在引擎弹窗内，避免「点了没反应」
      var statusEl = ctx.$('fetchModelsStatus') || ctx.$('aiStatus');
      var btnEl = ctx.$('btnFetchModels');
      var escape = ctx.escapeHtml || function(s) { return String(s == null ? '' : s); };

      function setFetchStatus(msg, ok) {
        if (!statusEl) return;
        statusEl.textContent = msg || '';
        statusEl.style.color = ok === true ? '#10b981' : (ok === false ? '#ef4444' : 'var(--color-text-muted)');
      }

      var base = apiUrlEl ? String(apiUrlEl.value || '').trim() : '';
      if (!base) {
        setFetchStatus('请先填写 API 接口地址', false);
        return;
      }
      // 兼容用户填到 /v1 或 /v1/chat/completions
      base = base.replace(/\/$/, '');
      if (/\/chat\/completions$/i.test(base)) base = base.replace(/\/chat\/completions$/i, '');
      var url = base + '/models';
      var key = apiKeyEl ? apiKeyEl.value.trim() : '';

      ctx.setBtnBusy(btnEl, true, '\u23f3...');
      setFetchStatus('正在拉取模型列表…', null);
      try {
        var h = { 'Content-Type': 'application/json' };
        if (key) h['Authorization'] = 'Bearer ' + key;
        var res = await fetch(url, { headers: h });
        var rawText = await res.text();
        var result = null;
        try {
          result = rawText ? JSON.parse(rawText) : null;
        } catch (parseErr) {
          throw new Error(
            '接口未返回 JSON（HTTP ' + res.status + '）。请确认地址形如 https://api.example.com/v1'
          );
        }
        if (!res.ok) {
          var errMsg = (result && (result.error && result.error.message || result.message || result.error)) || ('HTTP ' + res.status);
          throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
        }
        var models = Array.isArray(result && result.data)
          ? result.data.map(function(m) { return m && (m.id || m.name); }).filter(Boolean)
          : Array.isArray(result) ? result.map(function(m) { return m && (m.id || m.name) || m; }).filter(Boolean) : [];
        models = models.map(function(m) { return String(m); });
        models.sort();
        if (!models.length) {
          if (modelEl) {
            modelEl.innerHTML = '<option value="">未获取到模型</option>';
          }
          setFetchStatus('请求成功但模型列表为空，请检查接口是否支持 GET /models', false);
          return;
        }
        if (modelEl) {
          modelEl.innerHTML = models.map(function(m) {
            var em = escape(m);
            return '<option value="' + em + '">' + em + '</option>';
          }).join('');
          var saved = {};
          try { saved = JSON.parse(localStorage.getItem(AI_KEY)) || {}; } catch (e) { console.warn('Parsing saved AI config failed', e); }
          if (saved.model && models.indexOf(saved.model) >= 0) modelEl.value = saved.model;
        }
        saveAiConfig();
        setFetchStatus('\u2705 成功获取 ' + models.length + ' 个模型', true);
        var modalStatus = ctx.$('aiStatus');
        if (modalStatus && modalStatus !== statusEl) {
          modalStatus.textContent = '\u2705 成功获取 ' + models.length + ' 个模型！';
          modalStatus.style.color = '#10b981';
        }
      } catch (err) {
        var msg = (err && err.message) ? err.message : String(err);
        if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
          msg = '网络失败或被 CORS 拦截。请确认接口允许浏览器跨域，或改用支持 CORS 的中转地址。';
        }
        setFetchStatus('\u274c ' + msg, false);
        var modalStatusErr = ctx.$('aiStatus');
        if (modalStatusErr && modalStatusErr !== statusEl) {
          modalStatusErr.textContent = '\u274c ' + msg;
          modalStatusErr.style.color = '#ef4444';
        }
      } finally {
        ctx.setBtnBusy(btnEl, false);
      }
    },

    // ===== AI 一键生成（3-stage pipeline） =====

    runFullGeneration: async function() {
      var apiUrlEl   = ctx.$('apiUrl');
      var apiKeyEl   = ctx.$('apiKey');
      var modelEl    = ctx.$('modelSelect');
      var promptEl   = ctx.$('aiPrompt');
      var wbPromptEl = ctx.$('wbPrompt');
      var greetEl    = ctx.$('greetingPrompt');
      var statusEl   = ctx.$('aiStatus');
      var btnEl      = ctx.$('btnAiGenerate');

      var url   = (apiUrlEl ? apiUrlEl.value : '').replace(/\/$/, '') + '/chat/completions';
      var key   = apiKeyEl ? apiKeyEl.value.trim() : '';
      var model = modelEl ? modelEl.value : '';
      if (!model) { window.alert('请先拉取模型！'); return; }
      if (!promptEl || !promptEl.value.trim()) { window.alert('请填写角色设定提示词！'); return; }

      var skeletonCount = window.__getSkeletonCount__ ? window.__getSkeletonCount__() : 6;
      var searchEnabled = window.__searchConfig__ && window.__searchConfig__.isEnabled();
      var totalSteps    = (searchEnabled ? 1 : 0) + 1 + Math.ceil(skeletonCount / 5) + 1;
      var currentStep   = 0;
      var hacker        = window.__hackerAnim__;
      var charData      = null;

      if (btnEl) btnEl.disabled = true;
      cachedSearchResults = null;

      if (hacker) { hacker.start(); hacker.setPhase('\u26a1 初始化引擎...'); hacker.setProgress(0, totalSteps); hacker.setDetail(hacker.randomMsg()); }

      var aiCenter = window.__aiTaskCenter__;
      var engineTask = aiCenter ? aiCenter.create({
        type: 'engine_generate',
        title: 'AI 引擎一键生成',
        target: (promptEl.value.trim() || '').slice(0, 40),
      }) : null;
      var engineSignal = engineTask && engineTask.signal;

      try {
        var headers = { 'Content-Type': 'application/json' };
        if (key) headers['Authorization'] = 'Bearer ' + key;
        var presetsStr = ctx.panels.aiEngine.getActivePresetsStr();
        var searchInjection = '';

        // 阶段0：联网搜索
        if (searchEnabled) {
          if (engineSignal && engineSignal.aborted) throw new DOMException('已取消', 'AbortError');
          currentStep++;
          if (aiCenter && engineTask) aiCenter.setProgress(engineTask.id, currentStep / totalSteps, '联网搜索');
          if (hacker) { hacker.setPhase('\ud83c\udf10 [阶段 ' + currentStep + '/' + totalSteps + '] 联网搜索资料...'); hacker.setProgress(currentStep, totalSteps); hacker.setDetail('正在扫描互联网数据节点...'); }
          if (statusEl) { statusEl.textContent = '\ud83c\udf10 联网搜索中...'; statusEl.style.color = '#38bdf8'; }
          var searchResult = await ctx.panels.aiEngine.performSearchIfEnabled(promptEl.value.trim());
          searchInjection = searchResult.searchText || '';
          if (searchResult.mode === 'engine') { if (hacker) hacker.setDetail('\u2705 搜索完成，获取到 ' + searchResult.searchResults.length + ' 条参考资料'); }
          else if (searchResult.mode === 'ai_native') { if (hacker) hacker.setDetail('\u2139\ufe0f 使用 AI 自带联网能力'); }
          else if (searchResult.mode === 'ai_fallback') { if (hacker) hacker.setDetail('\u26a0\ufe0f 搜索引擎出错，降级为 AI 联网: ' + (searchResult.error || '')); }
          await sleep(400);
        }

        // 阶段1：生成角色
        if (engineSignal && engineSignal.aborted) throw new DOMException('已取消', 'AbortError');
        currentStep++;
        if (aiCenter && engineTask) aiCenter.setProgress(engineTask.id, currentStep / totalSteps, '构建角色');
        if (hacker) { hacker.setPhase('\ud83e\uddec [阶段 ' + currentStep + '/' + totalSteps + '] 构建角色灵魂...'); hacker.setProgress(currentStep, totalSteps); hacker.setDetail(hacker.randomMsg()); }
        if (statusEl) { statusEl.textContent = '\u23f3 [阶段 1] 构思角色设定...'; statusEl.style.color = '#38bdf8'; }

        // 主角设定：不注入 NSFW/NTL（成人配置仅服务世界书人物）
        var p1Sys = ctx.promptText('charGen')
          + (presetsStr ? '\n【文风要求】：\n' + presetsStr : '')
          + '\n【约束】主角 Description 禁止写入 NSFW_information、恶堕分期、情欲口味或 NTL 禁忌层；此类内容只属于世界书人物。'
          + searchInjection;

        var aiResp1 = await ctx.fetchAIContent({
          context: '角色生成/阶段1',
          url: url,
          headers: headers,
          model: model,
          messages: [{ role: 'system', content: p1Sys }, { role: 'user', content: promptEl.value.trim() }],
          temperature: 0.85,
          httpErrorPrefix: '角色生成失败 HTTP ',
          signal: engineSignal,
        });

        charData = ctx.extractJsonObj(aiResp1.content, '角色生成/阶段1');

        ctx.state.charName     = charData.charName     || '';
        ctx.state.wbName       = charData.wbName       || '';
        ctx.state.charDesc     = charData.charDesc     || '';
        ctx.state.creatorNotes = charData.creatorNotes || '';
        if (Array.isArray(charData.tags) || Array.isArray(charData.charTags)) {
          setCharTags(charData.tags || charData.charTags, { save: false });
        }
        ctx.state.worldbookEntries = [];
        ctx.save();
        if (hacker) hacker.setDetail('\u2705 角色「' + (charData.charName || '???') + '」锻造完成');
        await sleep(500);

        var charRef = formatCharRefForPrompt(charData);

        // 阶段2：批量生成世界书骨架
        var wbGoal    = wbPromptEl ? wbPromptEl.value.trim() : '';
        var remaining = skeletonCount;
        var batchIndex = 0;

        while (remaining > 0) {
          if (engineSignal && engineSignal.aborted) throw new DOMException('已取消', 'AbortError');
          var batchSize = Math.min(remaining, 5);
          batchIndex++; currentStep++;
          if (aiCenter && engineTask) aiCenter.setProgress(engineTask.id, currentStep / totalSteps, '骨架批次 ' + batchIndex);
          if (hacker) { hacker.setPhase('\ud83e\uddb4 [阶段 ' + currentStep + '/' + totalSteps + '] 世界书骨架 (批次 ' + batchIndex + ')'); hacker.setProgress(currentStep, totalSteps); hacker.setDetail(hacker.randomMsg()); }
          if (statusEl) statusEl.textContent = '\u23f3 生成世界书骨架... ' + ctx.state.worldbookEntries.length + '/' + skeletonCount;

          var existingTitles = ctx.state.worldbookEntries.map(function(e) { return e.comment; }).join('、');
          var existingRef    = existingTitles ? '\n【本批次已有条目(禁止重复)】：' + existingTitles : '';

          var skSys = ctx.promptText('wbSkeleton', { batchSize: batchSize })
            + charRef
            + '\n【角色】：' + ctx.state.charName + ' | ' + ctx.state.charDesc.substring(0, 300)
            + existingRef
            + (wbGoal ? '\n【方向】：' + wbGoal : '')
            + (presetsStr ? '\n【文风】：' + presetsStr.substring(0, 200) : '')
            + searchInjection
            + '\n【输出】：JSON数组 [{ "comment":"===标题===", "content":"一句话", "keys":["词"], "strategy":"selective" }, ...]'
            + '\n要求：极简、不重复、覆盖多维度（地点/人物/组织/物品/事件/规则）';

          try {
            var aiResp2 = await ctx.fetchAIContent({
              context: '世界书骨架/批次' + batchIndex,
              url: url,
              headers: headers,
              model: model,
              messages: [{ role: 'system', content: skSys }, { role: 'user', content: '生成' + batchSize + '条骨架' }],
              temperature: 0.9,
              httpErrorPrefix: 'HTTP ',
              signal: engineSignal,
            });
            var rawC = aiResp2.content;
            var skeletons;
            try {
              skeletons = ctx.extractJsonArray(rawC, '世界书骨架/批次' + batchIndex);
            } catch (pe) {
              try {
                skeletons = [ctx.extractJsonObj(rawC, '世界书骨架/批次' + batchIndex + '/fallback')];
              } catch (e2) {
                throw new Error('返回格式异常');
              }
            }
            skeletons.forEach(function(sk) {
              if (!sk || !sk.comment) return;
              ctx.state.worldbookEntries.push({
                comment: sk.comment || '未命名',
                content: sk.content || '(待展开)',
                keys: Array.isArray(sk.keys) ? sk.keys : [],
                strategy: sk.strategy || 'selective',
                position: 4,
                depth: 4,
                role: 0,
                order: 100,
                prob: 100,
              });
            });
            ctx.renderAll();
            ctx.save();
            if (hacker) hacker.setDetail('\u2705 批次 ' + batchIndex + ' 完成，已 ' + ctx.state.worldbookEntries.length + ' 条');
            await sleep(300);
          } catch (bErr) {
            if (ctx.isTrackedAbort(bErr)) throw bErr;
            if (hacker) hacker.setDetail('\u26a0\ufe0f 批次 ' + batchIndex + ': ' + bErr.message);
            await sleep(500);
          }
          remaining -= batchSize;
        }

        // 阶段3：开场白
        if (engineSignal && engineSignal.aborted) throw new DOMException('已取消', 'AbortError');
        currentStep++;
        if (aiCenter && engineTask) aiCenter.setProgress(engineTask.id, currentStep / totalSteps, '开场白');
        if (hacker) { hacker.setPhase('\ud83d\udcac [阶段 ' + currentStep + '/' + totalSteps + '] 撰写开场白...'); hacker.setProgress(currentStep, totalSteps); hacker.setDetail(hacker.randomMsg()); }
        if (statusEl) { statusEl.textContent = '\u23f3 [阶段 3] 生成开场白...'; statusEl.style.color = '#38bdf8'; }

        var greetUserDir = (greetEl && greetEl.value.trim())
          || '根据角色与世界书骨架，生成沉浸式主开场白与 2 条备选开场白';
        // 主角开场白：不注入 NSFW/NTL
        var greetSys = ctx.promptText('greetingGen')
          + charRef
          + formatWbSkeletonRef(ctx.state.worldbookEntries)
          + (presetsStr ? '\n【文风】：' + presetsStr.substring(0, 200) : '')
          + '\n【约束】开场白面向主角互动，勿写成恶堕进度或 NTL 调教说明书。'
          + searchInjection;

        var aiResp3 = await ctx.fetchAIContent({
          context: '开场白/阶段3',
          url: url,
          headers: headers,
          model: model,
          messages: [{ role: 'system', content: greetSys }, { role: 'user', content: greetUserDir }],
          temperature: 0.88,
          httpErrorPrefix: '开场白生成失败 HTTP ',
          signal: engineSignal,
        });
        var greetData = ctx.extractJsonObj(aiResp3.content, '开场白/阶段3');
        ctx.state.firstMes = greetData.firstMes || '';
        ctx.state.altGreetings = (greetData.altGreetings && Array.isArray(greetData.altGreetings)) ? greetData.altGreetings : [];
        window.__altGreetings__ = ctx.state.altGreetings;
        if (window.__renderAltGreetings__) window.__renderAltGreetings__();
        ctx.save();
        if (hacker) hacker.setDetail('\u2705 开场白已写入（主 + ' + ctx.state.altGreetings.length + ' 备选）');
        await sleep(400);

        // 完成
        if (aiCenter && engineTask) aiCenter.succeed(engineTask.id);
        if (hacker) {
          hacker.stop(); hacker.setPhase('\ud83c\udf89 生成完毕！'); hacker.setProgress(totalSteps, totalSteps);
          var doneMsg = '角色「' + ctx.state.charName + '」+ ' + ctx.state.worldbookEntries.length + ' 条骨架 + 开场白已就绪。';
          if (searchEnabled && cachedSearchResults) doneMsg += ' (参考了 ' + cachedSearchResults.length + ' 条搜索结果)';
          doneMsg += ' 请用「\u2728 AI重写」逐条展开骨架。';
          hacker.setDetail(doneMsg);
          setTimeout(function() { if (hacker) hacker.hide(); }, 5000);
        }
        if (statusEl) {
          statusEl.textContent = '\u2705 完毕！' + ctx.state.worldbookEntries.length + ' 条骨架 + 开场白' + (searchEnabled ? ' (已联网)' : '') + '。请逐条展开骨架。';
          statusEl.style.color = '#10b981';
        }

      } catch (err) {
        if (ctx.isTrackedAbort(err)) {
          if (aiCenter && engineTask && engineTask.status !== 'cancelled') aiCenter.cancel(engineTask.id);
          if (hacker) { hacker.stop(); hacker.setPhase('\u23f9 已取消'); hacker.setDetail('用户停止'); setTimeout(function() { if (hacker) hacker.hide(); }, 2000); }
          if (statusEl) { statusEl.textContent = '\u23f9 已取消'; statusEl.style.color = 'var(--color-text-muted)'; }
        } else {
          if (aiCenter && engineTask) aiCenter.fail(engineTask.id, err);
          if (hacker) { hacker.stop(); hacker.setPhase('\u274c 中止'); hacker.setDetail(err.message); setTimeout(function() { if (hacker) hacker.hide(); }, 3000); }
          if (statusEl) { statusEl.textContent = '\u274c 中止: ' + err.message; statusEl.style.color = '#ef4444'; }
        }
      } finally {
        if (btnEl) btnEl.disabled = false;
      }
    },

    // ===== AI 单条世界书 =====

    generateContextAwareWBEntry: async function(customDirection, stepInfo, signal) {
      if (!stepInfo) stepInfo = '';
      var apiUrlEl = ctx.$('apiUrl');
      var apiKeyEl = ctx.$('apiKey');
      var modelEl  = ctx.$('modelSelect');
      var url   = (apiUrlEl ? apiUrlEl.value : '').replace(/\/$/, '') + '/chat/completions';
      var key   = apiKeyEl ? apiKeyEl.value.trim() : '';
      var model = modelEl ? modelEl.value : '';
      var searchInjection = '';

      if (window.__searchConfig__ && window.__searchConfig__.isEnabled()) {
        var sq = customDirection || ctx.state.charName + ' ' + ctx.state.charDesc.substring(0, 100);
        var sr = await ctx.panels.aiEngine.performSearchIfEnabled(sq);
        searchInjection = sr.searchText || '';
      }

      var wbIncludeOtherEntries = ctx.$('wbIncludeOtherEntries');
      var includeOthers = !wbIncludeOtherEntries || wbIncludeOtherEntries.checked;

      var existingCtx = includeOthers
        ? ctx.state.worldbookEntries.map(function(e) {
            return '[标题:' + e.comment + '] (策略:' + e.strategy + '): ' + e.content;
          }).join('\n-----\n')
        : '';

      var ctxStr = includeOthers
        ? (existingCtx ? '\n【已有设定(不可重复)】：\n' + existingCtx : '\n【当前世界书为空】')
        : '\n【已跳过融合已有世界书条目】';

      var presetsStr  = ctx.panels.aiEngine.getActivePresetsStr();
      var presetBlock = presetsStr ? '\n\n【文风约束】：\n' + presetsStr : '';
      var wbIncludeCharData = ctx.$('wbIncludeCharData');
      var includeChar = wbIncludeCharData && wbIncludeCharData.checked;
      var charBlock   = includeChar ? '\n【角色】：' + ctx.state.charName + ' | ' + ctx.state.charDesc + '\n' : '';
      var adultHints = (typeof window.__buildAdultPromptHints__ === 'function')
        ? window.__buildAdultPromptHints__()
        : { nsfw: buildNsfwFlavorHint(), ntl: buildNtlHintForPrompt() };
      var sysPrompt   = (ctx.promptText('wbSingle') || '')
        + stepInfo + charBlock + '\n' + ctxStr + '\n' + presetBlock
        + (adultHints.nsfw || '') + (adultHints.ntl || '') + searchInjection
        + '\n【说明】若生成世界书人物条目，可按成人配置写情欲/禁忌；勿把恶堕分期写进主角 Description。'
        + '\n【输出】：1个JSON对象 { "comment": "标题", "content": "详细设定(至少100字)", "keys": ["触发词"], "strategy": "selective 或 constant", "position": 4 }';
      var userPrompt  = customDirection ? '【方向】：' + customDirection : '【自由发挥，拒绝重复】';
      var headers     = { 'Content-Type': 'application/json' };
      if (key) headers['Authorization'] = 'Bearer ' + key;

      var aiResp = await ctx.fetchAIContent({
        context: '世界书单条生成',
        url: url,
        headers: headers,
        model: model,
        messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: userPrompt }],
        temperature: 0.8,
        httpErrorPrefix: '请求失败 HTTP ',
        signal: signal,
      });
      var entry = ctx.extractJsonObj(aiResp.content, '世界书单条生成');
      ctx.state.worldbookEntries.push({
        comment: entry.comment || '拓展设定',
        content: entry.content || '',
        keys: Array.isArray(entry.keys) ? entry.keys : [],
        strategy: entry.strategy || 'selective',
        position: parseInt(entry.position) || 4,
        depth: 4,
        role: 0,
        order: 100,
        prob: 100,
      });
    },

    runSingleWbEntry: async function() {
      var modelEl = ctx.$('modelSelect');
      if (!modelEl || !modelEl.value) { window.alert('请先选择模型！'); return; }
      var btnEl = ctx.$('btnAiSingleWb');
      ctx.setBtnBusy(btnEl, true, '\u23f3 Roll中...');
      try {
        await ctx.runTracked({
          type: 'wb_single',
          title: '世界书单条生成',
          target: ((ctx.$('wbSinglePrompt') ? ctx.$('wbSinglePrompt').value : '') || '').slice(0, 40),
        }, async function(task) {
          await ctx.panels.aiEngine.generateContextAwareWBEntry(
            (ctx.$('wbSinglePrompt') ? ctx.$('wbSinglePrompt').value : '').trim(),
            '单条补充。',
            task.signal
          );
        });
        ctx.renderAll();
        ctx.save();
        var promptEl = ctx.$('wbSinglePrompt');
        if (promptEl) promptEl.value = '';
        closeWbModalSingle();
      } catch (err) {
        if (!ctx.isTrackedAbort(err)) window.alert('生成失败: ' + err.message);
      } finally {
        ctx.setBtnBusy(btnEl, false);
      }
    },

    // ===== AI 字符串 tag 生成 =====

    runCharTagsGen: async function() {
      var apiUrlEl = ctx.$('apiUrl');
      var modelEl  = ctx.$('modelSelect');
      var url   = (apiUrlEl ? apiUrlEl.value : '').replace(/\/$/, '');
      var model = modelEl ? modelEl.value : '';

      if (!url || !model) {
        setCharTagsAiTip('请先在「AI 配置」填写接口与模型', 'warn');
        return;
      }

      var maxChars = getTagContextChars();
      var ctxText = buildTagGenContext({
        description: ctx.state.charDesc,
        firstMes: ctx.state.firstMes,
        altGreetings: ctx.state.altGreetings || [],
        worldbookEntries: ctx.state.worldbookEntries,
      }, maxChars);

      if (!String(ctxText || '').trim()) {
        setCharTagsAiTip('请先填写角色设定或开场白等内容', 'warn');
        return;
      }

      var apiKeyEl = ctx.$('apiKey');
      var key = apiKeyEl ? apiKeyEl.value.trim() : '';
      var headers = { 'Content-Type': 'application/json' };
      if (key) headers['Authorization'] = 'Bearer ' + key;
      var sysPrompt = ctx.promptText('charTagsGen')
        || '根据角色设定与世界书，生成 5-12 个短中文分类标签。只输出 JSON 数组，例如 ["奇幻","恋爱"]。不要解释。';
      // 主角标签：不注入 NSFW 口味

      var btnEl = ctx.$('btnAiGenCharTags');
      if (btnEl) btnEl.disabled = true;
      var oldLabel = btnEl ? btnEl.textContent : '';
      ctx.setBtnBusy(btnEl, true, '生成中…');
      setCharTagsAiTip('正在生成标签…', null);

      try {
        await ctx.runTracked({
          type: 'char_tags_generate',
          title: '角色标签 AI 生成',
          target: (ctx.state.charName || '').slice(0, 40) || '标签',
        }, async function(task) {
          var aiResp = await ctx.fetchAIContent({
            context: '角色标签生成',
            url: url + '/chat/completions',
            headers: headers,
            model: model,
            messages: [
              { role: 'system', content: sysPrompt },
              { role: 'user', content: ctxText },
            ],
            temperature: 0.4,
            httpErrorPrefix: '标签生成失败 HTTP ',
            signal: task && task.signal,
          });
          var parsed = parseTagsFromAiText(aiResp.content);
          if (!parsed.length) throw new Error('未解析到有效标签');
          var merged = mergeCharTags(ctx.state.charTags, parsed);
          var before = normalizeCharTags(ctx.state.charTags).length;
          setCharTags(merged);
          var added = normalizeCharTags(merged).length - before;
          setCharTagsAiTip(
            added > 0 ? ('已合并 ' + added + ' 个新标签（共 ' + normalizeCharTags(merged).length + '）') : '无新增（已与现有标签去重）',
            'ok'
          );
        });
      } catch (err) {
        if (ctx.isTrackedAbort(err)) setCharTagsAiTip('已停止', 'warn');
        else setCharTagsAiTip(String(err.message || err), 'err');
      } finally {
        ctx.setBtnBusy(btnEl, false);
      }
    },

    // ===== 预览 =====

    updatePreview: function() {
      var fj = generateCardJSON(ctx.state);
      if (window.updatePreviewPanel) window.updatePreviewPanel(fj);
    },

    // ===== 绑定事件 =====

    bind: function() {
      var presetInput = ctx.$('presetInput');
      if (presetInput) {
        presetInput.addEventListener('change', function(e) {
          var file = e.target.files[0]; if (!file) return;
          var reader = new FileReader();
          reader.onload = function(ev) {
            try {
              var data = JSON.parse(ev.target.result);
              parsedPresetList = [];
              if (data.prompts) {
                var ao = (data.prompt_order && data.prompt_order.length > 0)
                  ? data.prompt_order[data.prompt_order.length - 1].order : [];
                var ei = ao.filter(function(i) { return i.enabled; }).map(function(i) { return i.identifier; });
                data.prompts.forEach(function(p) {
                  if (p.content && !p.marker) {
                    parsedPresetList.push({
                      id:                 p.identifier,
                      name:               p.name || '规则',
                      content:            p.content,
                      role:               p.role || 'system',
                      injection_position: p.injection_position || 0,
                      injection_depth:    p.injection_depth || 4,
                      enabled:            ao.length > 0 ? ei.indexOf(p.identifier) >= 0 : true,
                    });
                  }
                });
              }
              ctx.panels.aiEngine.renderPresetList();
              saveAiConfig();
            } catch (err) {
              var presetStatus = ctx.$('presetStatus');
              if (presetStatus) {
                presetStatus.innerHTML = '\u274c 解析失败: ' + err.message;
                presetStatus.style.color = '#ef4444';
              }
              var presetListContainer = ctx.$('presetListContainer');
              if (presetListContainer) presetListContainer.style.display = 'none';
            }
          };
          reader.readAsText(file);
        });
      }

      var btnFetchModels = ctx.$('btnFetchModels');
      if (btnFetchModels) {
        btnFetchModels.addEventListener('click', function() {
          ctx.panels.aiEngine.fetchModels();
        });
      }

      var btnAiGenerate = ctx.$('btnAiGenerate');
      if (btnAiGenerate) {
        btnAiGenerate.addEventListener('click', function() {
          ctx.panels.aiEngine.runFullGeneration();
        });
      }

      var btnAiSingleWb = ctx.$('btnAiSingleWb');
      if (btnAiSingleWb) {
        btnAiSingleWb.addEventListener('click', function() {
          ctx.panels.aiEngine.runSingleWbEntry();
        });
      }

      var btnAiGenCharTags = ctx.$('btnAiGenCharTags');
      if (btnAiGenCharTags) {
        btnAiGenCharTags.addEventListener('click', function() {
          ctx.panels.aiEngine.runCharTagsGen();
        });
      }

      // AI 配置输入持久化
      var apiUrl = ctx.$('apiUrl');
      var apiKey = ctx.$('apiKey');
      var modelSelect = ctx.$('modelSelect');
      var aiDebugEnable = ctx.$('aiDebugEnable');

      if (apiUrl) apiUrl.addEventListener('input', saveAiConfig);
      if (apiKey) apiKey.addEventListener('input', saveAiConfig);
      if (modelSelect) modelSelect.addEventListener('change', saveAiConfig);

      if (aiDebugEnable) {
        aiDebugEnable.addEventListener('change', function() {
          ctx.updateAIDebugStatus();
          saveAiConfig();
        });
      }
    },
  };
}
