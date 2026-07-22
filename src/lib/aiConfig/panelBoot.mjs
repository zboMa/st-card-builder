/**
 * AI 配置面板 boot（从 AIPanel.astro 外提）
 */

export function initAiConfigPanel() {
  var apiUrl           = document.getElementById('apiUrl');
  var apiUrlHint       = document.getElementById('apiUrlHint');
  var wbSkeletonCount  = document.getElementById('wbSkeletonCount');
  var tagContextChars  = document.getElementById('tagContextChars');
  var embeddingApiUrlEl = document.getElementById('embeddingApiUrl');
  var embeddingApiKeyEl = document.getElementById('embeddingApiKey');
  var embeddingModelEl = document.getElementById('embeddingModel');
  var novelRagEnableEl = document.getElementById('assistantNovelRagEnable');
  var novelRagBudgetEl = document.getElementById('assistantNovelRagBudget');
  var EMBED_URL_LS_KEY = 'st_v3_builder_embedding_api_url';
  var EMBED_KEY_LS_KEY = 'st_v3_builder_embedding_api_key';
  var EMBED_LS_KEY = 'st_v3_builder_embedding_model';
  var NOVEL_RAG_CFG_KEY = 'st_v3_builder_novel_rag';
  var countBtns        = document.querySelectorAll('.wb-count-btn');
  var hackerOverlay    = document.getElementById('hackerOverlay');
  var hackerCanvas     = document.getElementById('hackerCanvas');
  var hackerPhase      = document.getElementById('hackerPhase');
  var hackerProgress   = document.getElementById('hackerProgress');
  var hackerDetail     = document.getElementById('hackerDetail');

  // 搜索相关 DOM
  var searchEnable       = document.getElementById('searchEnable');
  var searchConfigBlock  = document.getElementById('searchConfigBlock');
  var searchConfigDetail = document.getElementById('searchConfigDetail');
  var searchModeBadge    = document.getElementById('searchModeBadge');
  var searchEngine       = document.getElementById('searchEngine');
  var searchKeyGroup     = document.getElementById('searchKeyGroup');
  var searchKeyLabel     = document.getElementById('searchKeyLabel');
  var searchApiKey       = document.getElementById('searchApiKey');
  var searchRegisterHint = document.getElementById('searchRegisterHint');
  var searchResultCount  = document.getElementById('searchResultCount');
  var searchLang         = document.getElementById('searchLang');
  var searchCustomQuery  = document.getElementById('searchCustomQuery');
  var btnTestSearch      = document.getElementById('btnTestSearch');
  var searchTestStatus   = document.getElementById('searchTestStatus');
  var searchPreview      = document.getElementById('searchPreview');

  var SEARCH_CONFIG_KEY = 'st_v3_builder_search_config';
  var DEFAULT_TAG_CTX = 12000;

  // ============================================================
  //  AI 配置横向 Tab（默认 API）
  // ============================================================
  function switchAiConfigTab(name) {
    var tabName = name || 'api';
    document.querySelectorAll('.ai-config-tab').forEach(function(btn) {
      var on = btn.getAttribute('data-ai-config-tab') === tabName;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.ai-config-pane').forEach(function(pane) {
      var on = pane.getAttribute('data-ai-config-pane') === tabName;
      pane.classList.toggle('is-active', on);
      if (on) pane.removeAttribute('hidden');
      else pane.setAttribute('hidden', '');
    });
  }
  document.querySelectorAll('.ai-config-tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      switchAiConfigTab(btn.getAttribute('data-ai-config-tab'));
    });
  });
  switchAiConfigTab('api');

  // ============================================================
  //  协议提示条
  // ============================================================
  function checkApiUrlProtocol() {
    var val     = apiUrl.value.trim();
    var isHttps = location.protocol === 'https:';
    var isHttp  = val.startsWith('http://');

    if (!val) { apiUrlHint.style.display = 'none'; return; }
    apiUrlHint.style.display = 'block';

    if (isHttps && isHttp) {
      apiUrlHint.innerHTML =
        '<div class="hint-bar" style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);color:var(--color-warning);">' +
          '⚠️ <span>HTTP 地址在 HTTPS 页面下会被浏览器拦截</span>' +
          '<span style="margin-left:auto;font-size:0.65rem;opacity:0.6;">悬停查看解决方法 ▾</span>' +
        '</div>' +
        '<div class="hint-detail" style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);border-top:none;color:var(--color-warning);">' +
          '解决方法（任选一种）：<br/>' +
          '① 🔗 改用本工具的 HTTP 版本访问：' +
          '<a href="http://zmer.xyz:11450" target="_blank" style="color:var(--color-accent-hover);text-decoration:underline;">http://zmer.xyz:11450</a><br/>' +
          '② 给你的 API 套上 HTTPS<br/>' +
          '③ 使用 OpenAI / 中转站等 HTTPS 接口' +
        '</div>';
    } else if (!isHttps && isHttp) {
      apiUrlHint.innerHTML =
        '<div class="hint-bar" style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);color:var(--color-success);">' +
          '✅ <span>HTTP 地址，当前页面也是 HTTP，可以正常请求。</span>' +
        '</div>';
    } else {
      apiUrlHint.innerHTML =
        '<div class="hint-bar" style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);color:var(--color-success);">' +
          '✅ <span>HTTPS 地址，可以正常请求。</span>' +
        '</div>';
    }
  }

  apiUrl.addEventListener('input', checkApiUrlProtocol);
  checkApiUrlProtocol();

  // ============================================================
  //  快捷条数按钮
  // ============================================================
  function updateCountBtnActive() {
    var val = parseInt(wbSkeletonCount.value);
    countBtns.forEach(function(btn) {
      btn.classList.toggle('active', parseInt(btn.getAttribute('data-count')) === val);
    });
  }
  countBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      wbSkeletonCount.value = btn.getAttribute('data-count');
      updateCountBtnActive();
    });
  });
  wbSkeletonCount.addEventListener('input', updateCountBtnActive);
  updateCountBtnActive();

  // ============================================================
  //  联网搜索 UI 逻辑
  // ============================================================
  var _searchInitDone = false;  // 初次 load 不动画
  var _searchAnimating = false;

  function updateSearchBadge() {
    var enabled = searchEnable.checked;
    if (!enabled) { searchModeBadge.style.display = 'none'; return; }

    var engine = searchEngine.value;
    searchModeBadge.style.display = 'inline';

    if (engine === 'none') {
      searchModeBadge.textContent      = 'AI 自带联网';
      searchModeBadge.style.background = 'rgba(56,189,248,0.12)';
      searchModeBadge.style.color      = 'var(--color-accent-hover)';
      searchModeBadge.style.border     = '1px solid rgba(56,189,248,0.25)';
      searchKeyGroup.style.display     = 'none';
    } else if (engine === 'serper') {
      searchModeBadge.textContent      = 'Serper · Google';
      searchModeBadge.style.background = 'rgba(16,185,129,0.12)';
      searchModeBadge.style.color      = 'var(--color-success)';
      searchModeBadge.style.border     = '1px solid rgba(16,185,129,0.25)';
      searchKeyGroup.style.display     = 'block';
      searchKeyLabel.textContent       = 'Serper API Key';
      searchRegisterHint.innerHTML     = '📎 免费注册：<a href="https://serper.dev" target="_blank" style="color:var(--color-accent-hover);text-decoration:underline;">serper.dev</a> → 注册后在 Dashboard 复制 API Key（免费 2,500 次/月）';
    } else if (engine === 'tavily') {
      searchModeBadge.textContent      = 'Tavily · AI 专用';
      searchModeBadge.style.background = 'rgba(245,158,11,0.12)';
      searchModeBadge.style.color      = 'var(--color-warning)';
      searchModeBadge.style.border     = '1px solid rgba(245,158,11,0.25)';
      searchKeyGroup.style.display     = 'block';
      searchKeyLabel.textContent       = 'Tavily API Key';
      searchRegisterHint.innerHTML     = '📎 免费注册：<a href="https://tavily.com" target="_blank" style="color:var(--color-accent-hover);text-decoration:underline;">tavily.com</a> → 注册后在 API Keys 页复制（免费 1,000 次/月）';
    }
  }

  /* ── 放大镜扫描文档动画 ── */
  function playSearchScanAnimation(cb) {
    if (!window.gsap) { cb(); return; }
    var overlay = document.createElement('div');
    overlay.className = 'search-scan-overlay';

    // 文档图标群
    var docIcons = ['📄', '📋', '📑'];
    var docs = [];
    docIcons.forEach(function (icon, i) {
      var d = document.createElement('span');
      d.className = 'search-scan-doc';
      d.textContent = icon;
      d.style.left = (20 + i * 30) + '%';
      d.style.top = '35%';
      overlay.appendChild(d);
      docs.push(d);
    });

    // 放大镜
    var glass = document.createElement('span');
    glass.className = 'search-scan-glass';
    glass.textContent = '🔍';
    overlay.appendChild(glass);

    // 扫描线
    var scanLine = document.createElement('div');
    scanLine.className = 'search-scan-line';
    overlay.appendChild(scanLine);

    searchConfigBlock.appendChild(overlay);
    searchConfigBlock.style.overflow = 'hidden';

    var tl = gsap.timeline({
      onComplete: function () {
        overlay.remove();
        searchConfigBlock.style.overflow = '';
        cb();
      }
    });

    // Phase 1: 文档图标淡入浮起
    docs.forEach(function (d, i) {
      tl.fromTo(d,
        { opacity: 0, y: 20, scale: 0.5 },
        { opacity: 0.7, y: 0, scale: 1, duration: 0.25, ease: 'back.out(1.5)' },
        i * 0.08
      );
    });

    // Phase 2: 放大镜从左侧飞入并从左到右扫描
    tl.fromTo(glass,
      { opacity: 0, left: '-10%', top: '20%', scale: 0.3, rotation: -20 },
      { opacity: 1, left: '10%', top: '25%', scale: 1, rotation: 0, duration: 0.3, ease: 'power2.out' },
      0.15
    );
    tl.to(glass, {
      left: '75%', top: '30%', duration: 0.6, ease: 'power1.inOut',
    });

    // 扫描线跟随
    tl.fromTo(scanLine,
      { opacity: 0, top: '0%' },
      { opacity: 1, top: '100%', duration: 0.6, ease: 'power1.inOut' },
      0.35
    );

    // Phase 3: 文档被"发现"时闪光
    docs.forEach(function (d, i) {
      tl.to(d, {
        scale: 1.3, opacity: 1,
        filter: 'drop-shadow(0 0 14px rgba(56,189,248,0.9))',
        duration: 0.15, yoyo: true, repeat: 1,
      }, 0.45 + i * 0.06);
    });

    // Phase 4: 全部飞散消失，放大镜缩小消失
    tl.to(glass, { opacity: 0, scale: 0.5, y: -15, duration: 0.2, ease: 'power2.in' });
    docs.forEach(function (d) {
      tl.to(d, { opacity: 0, scale: 0.3, y: -10, duration: 0.2, ease: 'power2.in' }, '-=0.15');
    });
    tl.to(scanLine, { opacity: 0, duration: 0.15 }, '-=0.2');
  }

  /* ── 展开/收起搜索配置详情（带动画） ── */
  function expandSearchDetail(animate) {
    if (animate && window.gsap) {
      searchConfigDetail.style.display = 'block';
      searchConfigDetail.style.overflow = 'hidden';
      var children = searchConfigDetail.children;
      // 先让每个子元素隐藏
      for (var i = 0; i < children.length; i++) {
        gsap.set(children[i], { opacity: 0, y: 12 });
      }
      var _childCount = children.length;
      var _childDone = 0;
      gsap.fromTo(searchConfigDetail,
        { height: 0, opacity: 0 },
        {
          height: 'auto', opacity: 1, duration: 0.45, ease: 'power2.out',
          onComplete: function () {
            searchConfigDetail.style.overflow = '';
            searchConfigDetail.style.height = '';
          }
        }
      );
      // 子元素依次淡入，完成后清除 transform 防止产生层叠上下文
      for (var j = 0; j < children.length; j++) {
        (function(idx) {
          gsap.to(children[idx], {
            opacity: 1, y: 0, duration: 0.35, ease: 'power2.out',
            delay: 0.1 + idx * 0.06,
            onComplete: function() {
              children[idx].style.transform = '';
              _childDone++;
              if (_childDone >= _childCount) {
                searchConfigDetail.style.transform = '';
                searchConfigDetail.style.opacity = '';
              }
            }
          });
        })(j);
      }
    } else {
      searchConfigDetail.style.display = 'block';
    }
  }

  function collapseSearchDetail(animate) {
    if (animate && window.gsap) {
      searchConfigDetail.style.overflow = 'hidden';
      gsap.to(searchConfigDetail, {
        height: 0, opacity: 0, duration: 0.3, ease: 'power2.inOut',
        onComplete: function () {
          searchConfigDetail.style.display = 'none';
          searchConfigDetail.style.overflow = '';
          searchConfigDetail.style.height = '';
          searchConfigDetail.style.opacity = '';
          searchConfigDetail.style.transform = '';
          // 清除子元素残留的 GSAP transform
          var ch = searchConfigDetail.children;
          for (var k = 0; k < ch.length; k++) {
            ch[k].style.transform = '';
            ch[k].style.opacity = '';
          }
        }
      });
    } else {
      searchConfigDetail.style.display = 'none';
    }
  }

  function updateSearchUI(isUserAction) {
    var enabled = searchEnable.checked;
    var shouldAnimate = _searchInitDone && isUserAction === true;
    searchConfigBlock.classList.toggle('active', enabled);
    updateSearchBadge();

    if (enabled) {
      if (shouldAnimate && !_searchAnimating) {
        _searchAnimating = true;
        playSearchScanAnimation(function () {
          expandSearchDetail(true);
          _searchAnimating = false;
        });
      } else {
        searchConfigDetail.style.display = 'block';
      }
    } else {
      if (shouldAnimate) {
        collapseSearchDetail(true);
      } else {
        searchConfigDetail.style.display = 'none';
      }
      searchModeBadge.style.display = 'none';
    }

    saveSearchConfig();
  }

  searchEnable.addEventListener('change', function () { updateSearchUI(true); });
  searchEngine.addEventListener('change', function () { updateSearchBadge(); saveSearchConfig(); });
  searchApiKey.addEventListener('input', saveSearchConfig);
  searchResultCount.addEventListener('change', saveSearchConfig);
  searchLang.addEventListener('change', saveSearchConfig);

  // ============================================================
  //  搜索配置持久化
  // ============================================================
  function saveSearchConfig() {
    localStorage.setItem(SEARCH_CONFIG_KEY, JSON.stringify({
      enabled:     searchEnable.checked,
      engine:      searchEngine.value,
      apiKey:      searchApiKey.value.trim(),
      resultCount: parseInt(searchResultCount.value),
      lang:        searchLang.value,
    }));
  }

  function loadSearchConfig() {
    try {
      var c = JSON.parse(localStorage.getItem(SEARCH_CONFIG_KEY));
      if (!c) { searchEnable.checked = false; updateSearchUI(false); _searchInitDone = true; return; }
      searchEnable.checked = c.enabled === true;
      if (c.engine)      searchEngine.value      = c.engine;
      if (c.apiKey)      searchApiKey.value       = c.apiKey;
      if (c.resultCount) searchResultCount.value  = c.resultCount;
      if (c.lang)        searchLang.value         = c.lang;
      updateSearchUI(false);
      _searchInitDone = true;
    } catch(e) {
      searchEnable.checked = false;
      updateSearchUI(false);
      _searchInitDone = true;
    }
  }

  loadSearchConfig();

  // ============================================================
  //  搜索执行函数
  // ============================================================
  async function executeSearch(query, count, lang) {
    var engine = searchEngine.value;
    var key    = searchApiKey.value.trim();
    if (engine === 'serper' && key) {
      return await searchWithSerper(query, count, lang, key);
    } else if (engine === 'tavily' && key) {
      return await searchWithTavily(query, count, key);
    } else {
      return null;
    }
  }

  async function searchWithSerper(query, count, lang, key) {
    var res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q:   query,
        num: count,
        gl:  lang === 'zh-CN' ? 'cn' : (lang === 'ja' ? 'jp' : 'us'),
        hl:  lang === 'auto' ? 'zh-CN' : lang
      })
    });
    if (!res.ok) throw new Error('Serper 搜索失败 HTTP ' + res.status);
    var data = await res.json();
    var results = [];
    if (data.organic) {
      data.organic.forEach(function(item) {
        results.push({ title: item.title || '', snippet: item.snippet || '', url: item.link || '' });
      });
    }
    if (data.knowledgeGraph) {
      var kg = data.knowledgeGraph;
      results.unshift({ title: '[知识面板] ' + (kg.title || ''), snippet: kg.description || '', url: kg.descriptionLink || '' });
    }
    return results.slice(0, count);
  }

  async function searchWithTavily(query, count, key) {
    var res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key, query: query, max_results: count, search_depth: 'basic', include_answer: true })
    });
    if (!res.ok) throw new Error('Tavily 搜索失败 HTTP ' + res.status);
    var data = await res.json();
    var results = [];
    if (data.answer) {
      results.push({ title: '[AI 总结]', snippet: data.answer, url: '' });
    }
    if (data.results) {
      data.results.forEach(function(item) {
        results.push({ title: item.title || '', snippet: item.content || '', url: item.url || '' });
      });
    }
    return results.slice(0, count + 1);
  }

  function formatSearchResultsForPrompt(results) {
    if (!results || results.length === 0) return '';
    var text = '\n\n【🌐 联网搜索参考资料】：\n';
    text += '以下是从互联网搜索到的相关资料，请参考这些真实信息来丰富你的创作，但不要照搬：\n';
    text += '─────────────────\n';
    results.forEach(function(r, i) {
      text += '📄 [' + (i + 1) + '] ' + r.title + '\n';
      text += '   ' + r.snippet + '\n';
      if (r.url) text += '   🔗 ' + r.url + '\n';
      text += '\n';
    });
    text += '─────────────────\n';
    text += '请基于以上参考资料，结合用户的创意要求进行创作。可以借鉴但不要照搬原文。\n';
    return text;
  }

  function renderSearchPreview(results) {
    if (!results || results.length === 0) { searchPreview.style.display = 'none'; return; }
    var html = '';
    results.forEach(function(r) {
      html += '<div class="search-result-item">';
      html += '<div class="search-result-title">'   + escapeHTMLSimple(r.title)                     + '</div>';
      html += '<div class="search-result-snippet">' + escapeHTMLSimple(r.snippet).substring(0, 200) + '</div>';
      if (r.url) html += '<div class="search-result-url">' + escapeHTMLSimple(r.url) + '</div>';
      html += '</div>';
    });
    searchPreview.innerHTML = html;
    searchPreview.style.display = 'block';
  }

  function escapeHTMLSimple(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ============================================================
  //  搜索测试按钮
  // ============================================================
  btnTestSearch.addEventListener('click', async function() {
    var engine = searchEngine.value;
    var query  = searchCustomQuery.value.trim() || document.getElementById('aiPrompt').value.trim();
    if (!query) {
      searchTestStatus.textContent = '❌ 请先填写提示词或搜索词';
      searchTestStatus.style.color = 'var(--color-danger)';
      return;
    }
    if (engine === 'none') {
      searchTestStatus.textContent = 'ℹ️ 当前为 AI 自带联网模式，无需测试';
      searchTestStatus.style.color = 'var(--color-accent-hover)';
      searchPreview.style.display  = 'none';
      return;
    }
    if (!searchApiKey.value.trim()) {
      searchTestStatus.textContent = '❌ 请先填写搜索 API Key';
      searchTestStatus.style.color = 'var(--color-danger)';
      return;
    }
    btnTestSearch.disabled       = true;
    searchTestStatus.textContent = '🔍 搜索中...';
    searchTestStatus.style.color = 'var(--color-accent-hover)';
    try {
      var count   = parseInt(searchResultCount.value) || 5;
      var lang    = searchLang.value;
      var results = await executeSearch(query, count, lang);
      if (results && results.length > 0) {
        searchTestStatus.textContent = '✅ 找到 ' + results.length + ' 条结果';
        searchTestStatus.style.color = 'var(--color-success)';
        renderSearchPreview(results);
      } else {
        searchTestStatus.textContent = '⚠️ 未找到结果';
        searchTestStatus.style.color = 'var(--color-warning)';
        searchPreview.style.display  = 'none';
      }
    } catch(err) {
      searchTestStatus.textContent = '❌ ' + err.message;
      searchTestStatus.style.color = 'var(--color-danger)';
      searchPreview.style.display  = 'none';
    } finally {
      btnTestSearch.disabled = false;
    }
  });

  // ============================================================
  //  黑客风信息流动画
  // ============================================================
  var hackerChars      = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン{}[]<>/\\|=+-*&^%$#@!~;:,.?ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var hackerAnimId     = null;
  var hackerStreamText = '';

  function startHackerAnim() {
    hackerOverlay.style.display = 'block';
    hackerStreamText = '';
    hackerCanvas.textContent = '';
    for (var i = 0; i < 800; i++) {
      hackerStreamText += hackerChars[Math.floor(Math.random() * hackerChars.length)];
      if (Math.random() < 0.08) hackerStreamText += '\n';
    }
    hackerCanvas.textContent = hackerStreamText;
    var frameCount = 0;
    function tick() {
      frameCount++;
      if (frameCount % 2 === 0) {
        var arr     = hackerStreamText.split('');
        var changes = 15 + Math.floor(Math.random() * 25);
        for (var c = 0; c < changes; c++) {
          var pos = Math.floor(Math.random() * arr.length);
          if (arr[pos] !== '\n') arr[pos] = hackerChars[Math.floor(Math.random() * hackerChars.length)];
        }
        var newLine = '';
        for (var n = 0; n < 20; n++) newLine += hackerChars[Math.floor(Math.random() * hackerChars.length)];
        arr.push('\n');
        for (var nn = 0; nn < newLine.length; nn++) arr.push(newLine[nn]);
        if (arr.length > 1200) arr.splice(0, arr.length - 1200);
        hackerStreamText         = arr.join('');
        hackerCanvas.textContent = hackerStreamText;
        hackerCanvas.scrollTop   = hackerCanvas.scrollHeight;
      }
      hackerAnimId = requestAnimationFrame(tick);
    }
    hackerAnimId = requestAnimationFrame(tick);
  }

  function stopHackerAnim()    { if (hackerAnimId) { cancelAnimationFrame(hackerAnimId); hackerAnimId = null; } }
  function hideHackerOverlay() { hackerOverlay.style.display = 'none'; }
  function setHackerPhase(text)  { hackerPhase.textContent = text; }
  function setHackerProgress(current, total) {
    var pct = total > 0 ? Math.round((current / total) * 100) : 0;
    hackerProgress.style.setProperty('--progress', pct + '%');
  }
  function setHackerDetail(text) { hackerDetail.textContent = text; }

  var hackerMessages = [
    '正在肘击gemini...',
    '正在肘击deepseek...',
    '正在申请退款Claude...',
    '正在给谷歌写申述邮件...',
    '正在删除无用的屎山代码...',
    '正在申请GPT大兵认证...',
    '正在假装看懂了报错信息...',
    '正在说服模型不要幻觉...',
    '正在等模型生成，已等待三个世纪...',
    '正在让 GPT 假装自己是 Claude...',
    '正在让 Claude 假装自己是 GPT...',
    '正在把幻觉结果当参考文献...',
    '正在把五行代码注释写成两百字...',
    '正在把 bug 重新命名为 feature...',
    '正在偷偷绕过内容审核...',
    '正在控诉 token 不够用...',
    '正在等待 Cloudflare 转圈圈...',
    '正在给 token 省钱，删掉了标点...',
    '正在测试 AI 有没有感情...',
    '正在把 prompt 改了又改...',
  ];
  function getRandomHackerMsg() { return hackerMessages[Math.floor(Math.random() * hackerMessages.length)]; }

  // ============================================================
  //  暴露给 index.astro
  // ============================================================
  window.__hackerAnim__ = {
    start:       startHackerAnim,
    stop:        stopHackerAnim,
    hide:        hideHackerOverlay,
    setPhase:    setHackerPhase,
    setProgress: setHackerProgress,
    setDetail:   setHackerDetail,
    randomMsg:   getRandomHackerMsg,
  };

  window.__getSkeletonCount__ = function() {
    var v = parseInt(wbSkeletonCount.value);
    if (isNaN(v) || v < 1) return 6;
    if (v > 30) return 30;
    return v;
  };

  /** 助手：设置骨架条数（非密钥） */
  window.__setSkeletonCount__ = function(n) {
    var v = parseInt(n, 10);
    if (isNaN(v) || v < 1) v = 6;
    if (v > 30) v = 30;
    wbSkeletonCount.value = String(v);
    updateCountBtnActive();
    return { skeletonCount: v };
  };

  /** 标签 AI 上下文字数（默认 12k） */
  function readTagContextChars() {
    if (!tagContextChars) return DEFAULT_TAG_CTX;
    var v = parseInt(tagContextChars.value, 10);
    if (isNaN(v) || v < 1000) return DEFAULT_TAG_CTX;
    if (v > 200000) return 200000;
    return v;
  }
  window.__getTagContextChars__ = readTagContextChars;
  window.__setTagContextChars__ = function(n) {
    var v = parseInt(n, 10);
    if (isNaN(v) || v < 1000) v = DEFAULT_TAG_CTX;
    if (v > 200000) v = 200000;
    if (tagContextChars) tagContextChars.value = String(v);
    return { tagContextChars: v };
  };
  // 变更时通知 index 持久化（若已挂载）
  if (tagContextChars) {
    tagContextChars.addEventListener('change', function() {
      tagContextChars.value = String(readTagContextChars());
      if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
    });
    tagContextChars.addEventListener('input', function() {
      if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
    });
  }

  /** 小说 RAG / Embedding 配置 */
  function loadNovelRagUi() {
    try {
      if (embeddingApiUrlEl) embeddingApiUrlEl.value = localStorage.getItem(EMBED_URL_LS_KEY) || '';
      if (embeddingApiKeyEl) embeddingApiKeyEl.value = localStorage.getItem(EMBED_KEY_LS_KEY) || '';
      if (embeddingModelEl) embeddingModelEl.value = localStorage.getItem(EMBED_LS_KEY) || '';
      var cfg = JSON.parse(localStorage.getItem(NOVEL_RAG_CFG_KEY) || '{}');
      if (novelRagEnableEl) novelRagEnableEl.checked = cfg.enabled !== false;
      if (novelRagBudgetEl && cfg.budget) novelRagBudgetEl.value = String(cfg.budget);
    } catch (e) { /* ignore */ }
  }
  function persistNovelRagUi() {
    var enabled = !(novelRagEnableEl && !novelRagEnableEl.checked);
    var budget = Math.max(2000, parseInt(novelRagBudgetEl && novelRagBudgetEl.value, 10) || 12000);
    try {
      if (embeddingApiUrlEl) localStorage.setItem(EMBED_URL_LS_KEY, String(embeddingApiUrlEl.value || '').trim());
      if (embeddingApiKeyEl) localStorage.setItem(EMBED_KEY_LS_KEY, String(embeddingApiKeyEl.value || '').trim());
      if (embeddingModelEl) localStorage.setItem(EMBED_LS_KEY, String(embeddingModelEl.value || '').trim());
      localStorage.setItem(NOVEL_RAG_CFG_KEY, JSON.stringify({ enabled: enabled, budget: budget }));
    } catch (e) { /* ignore */ }
    // 与小说桶 state.rag 对齐（单一开关源）
    if (window.__novelWorkshopBridge__ && typeof window.__novelWorkshopBridge__.setRagOptions === 'function') {
      window.__novelWorkshopBridge__.setRagOptions({ enabled: enabled, budget: budget });
    }
    if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
  }
  loadNovelRagUi();
  // 若小说工坊已加载，用 state.rag 覆盖 UI
  if (window.__novelWorkshopBridge__ && typeof window.__novelWorkshopBridge__.getRagOptions === 'function') {
    try {
      var fromNovel = window.__novelWorkshopBridge__.getRagOptions();
      if (novelRagEnableEl) novelRagEnableEl.checked = fromNovel.enabled !== false;
      if (novelRagBudgetEl && fromNovel.budget) novelRagBudgetEl.value = String(fromNovel.budget);
    } catch (e) { /* ignore */ }
  }
  [embeddingApiUrlEl, embeddingApiKeyEl, embeddingModelEl, novelRagEnableEl, novelRagBudgetEl].forEach(function(el) {
    if (!el) return;
    el.addEventListener('change', persistNovelRagUi);
    if (el === embeddingApiUrlEl || el === embeddingApiKeyEl || el === embeddingModelEl || el === novelRagBudgetEl) {
      el.addEventListener('input', persistNovelRagUi);
    }
  });
  window.__getNovelRagOptions__ = function() {
    // 优先小说 state.rag
    if (window.__novelWorkshopBridge__ && typeof window.__novelWorkshopBridge__.getRagOptions === 'function') {
      var o = window.__novelWorkshopBridge__.getRagOptions();
      return {
        enabled: o.enabled !== false,
        budget: Math.max(2000, Number(o.budget) || 12000),
        embedModel: embeddingModelEl ? String(embeddingModelEl.value || '').trim() : (o.embedModel || ''),
        embeddingApiUrl: embeddingApiUrlEl ? String(embeddingApiUrlEl.value || '').trim() : '',
        embeddingApiKey: embeddingApiKeyEl ? String(embeddingApiKeyEl.value || '').trim() : '',
      };
    }
    var budget = Math.max(2000, parseInt(novelRagBudgetEl && novelRagBudgetEl.value, 10) || 12000);
    return {
      enabled: !(novelRagEnableEl && !novelRagEnableEl.checked),
      budget: budget,
      embedModel: embeddingModelEl ? String(embeddingModelEl.value || '').trim() : '',
      embeddingApiUrl: embeddingApiUrlEl ? String(embeddingApiUrlEl.value || '').trim() : '',
      embeddingApiKey: embeddingApiKeyEl ? String(embeddingApiKeyEl.value || '').trim() : '',
    };
  };

  window.__searchConfig__ = {
    isEnabled:       function() { return searchEnable.checked; },
    getEngine:       function() { return searchEngine.value; },
    getCustomQuery:  function() { return searchCustomQuery.value.trim(); },
    getResultCount:  function() { return parseInt(searchResultCount.value) || 5; },
    getLang:         function() { return searchLang.value; },
    executeSearch:   executeSearch,
    formatForPrompt: formatSearchResultsForPrompt,
  };
}
