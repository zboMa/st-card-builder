/**
 * 世界书审计面板 boot（从 WorldbookAuditor.astro 外提）
 */
import { entryExportComment } from '../worldbook/worldbookEntryBridge.mjs';
import { auditWorldbookAdmission } from './worldbookAdmissionAudit.mjs';
import { appFeedback } from '../ui/appMessage.mjs';

export function initWorldbookAuditor() {
  
  
  
  var btnRunAudit = document.getElementById('btnRunAudit');
  var quickCheckResult = document.getElementById('quickCheckResult');
  var auditStatus = document.getElementById('auditStatus');
  var auditReport = document.getElementById('auditReport');
  var auditScoreCard = document.getElementById('auditScoreCard');
  var scoreCircle = document.getElementById('scoreCircle');
  var scoreNumber = document.getElementById('scoreNumber');
  var scoreGrade = document.getElementById('scoreGrade');
  var scoreSummary = document.getElementById('scoreSummary');
  var auditDimensions = document.getElementById('auditDimensions');
  var auditIssues = document.getElementById('auditIssues');
  var auditSuggestions = document.getElementById('auditSuggestions');

  
  
  
  function getCharData() {
    return {
      name: (document.getElementById('charName') || {}).value || '',
      description: (document.getElementById('charDesc') || {}).value || '',
      firstMes: (document.getElementById('firstMes') || {}).value || '',
    };
  }

  function getEntries() {
    if (window.__getWorldbookEntries__) return window.__getWorldbookEntries__();
    return [];
  }

  
  
  
  // ── 快速自检逻辑（内部使用）──
  function runQuickCheck() {
    var entries = getEntries();
    var char = getCharData();
    var issues = [];

    var totalEntries = entries.length;
    var constantCount = entries.filter(function(e) { return e.strategy === 'constant'; }).length;
    var selectiveCount = entries.filter(function(e) { return e.strategy === 'selective'; }).length;
    var skeletonCount = entries.filter(function(e) { return (e.content || '').length < 60; }).length;
    var noKeysCount = entries.filter(function(e) { return e.strategy === 'selective' && (!e.keys || e.keys.length === 0); }).length;
    var emptyContentCount = entries.filter(function(e) { return !e.content || e.content.trim().length < 5; }).length;
    var totalContentLen = entries.reduce(function(s, e) { return s + (e.content || '').length; }, 0);

    if (totalEntries === 0) {
      issues.push({ level: 'critical', icon: '🚫', title: '世界书为空', desc: '还没有任何条目，请先生成或手动添加。' });
    }
    if (emptyContentCount > 0) {
      issues.push({ level: 'critical', icon: '📭', title: emptyContentCount + ' 条内容为空', desc: '这些条目几乎没有内容，注入也没有意义。' });
    }
    var scriptList = (typeof window.__getTavernHelperScripts__ === 'function')
      ? (window.__getTavernHelperScripts__() || [])
      : [];
    auditWorldbookAdmission({
      entries: entries,
      description: char.description || '',
      hasScripts: scriptList.length > 0,
    }).forEach(function(item) {
      issues.push({
        level: item.level === 'warn' ? 'warning' : (item.level === 'hint' ? 'info' : 'info'),
        icon: item.level === 'warn' ? '⚠' : '·',
        title: item.name || '准入',
        desc: item.message,
      });
    });
    var allKeys = {};
    entries.forEach(function(e, idx) {
      (e.keys || []).forEach(function(k) {
        var lk = k.toLowerCase().trim();
        if (!lk) return;
        if (!allKeys[lk]) allKeys[lk] = [];
        allKeys[lk].push(entryExportComment(e) || '条目' + idx);
      });
    });
    var dupKeys = Object.keys(allKeys).filter(function(k) { return allKeys[k].length > 1; });
    if (dupKeys.length > 0) {
      issues.push({ level: 'warning', icon: '🔄', title: dupKeys.length + ' 个触发词重复', desc: dupKeys.slice(0, 3).map(function(k) { return '「' + k + '」→ ' + allKeys[k].join(', '); }).join('；') });
    }

    
    if (issues.length === 0) {
      issues.push({ level: 'tip', icon: '✅', title: '快速自检通过', desc: '没有明显问题！可进行 AI 深度审计获取更详细建议。' });
    }

    quickCheckResult.style.display = 'block';

    var statsHtml = '<div class="qc-section-title">📊 基础统计</div>'
      + '<div class="qc-stats">'
      + statCard(totalEntries, '总条目', 'var(--color-accent-hover)')
      + statCard(constantCount, '常驻', 'var(--color-success)')
      + statCard(selectiveCount, '触发式', 'var(--color-accent-hover)')
      + statCard(skeletonCount, '骨架', '#f59e0b')
      + statCard(Math.round(totalContentLen / 1000 * 10) / 10 + 'k', '总字数', 'var(--color-text-muted)')
      + statCard(issues.length, '问题', issues[0].level === 'tip' ? 'var(--color-success)' : '#ef4444')
      + '</div>';

    var dimHtml = '';

    var quickSuggestions = [];
    if (dupKeys.length > 0) quickSuggestions.push('发现重复触发词。同一词会让多条一起进来，按作者要不要同时出现来留或改。');

    var suggestionsHtml = '';
    if (quickSuggestions.length > 0) {
      suggestionsHtml = '<div class="qc-section-title">💡 快速建议</div>'
        + '<div class="qc-suggestions-box">'
        + quickSuggestions.map(function(sugg, i) {
          return '<div class="qc-suggestion-item" style="animation-delay:' + (i * 0.05) + 's;">' + sugg + '</div>';
        }).join('')
        + '</div>';
    }

    var issuesHtml = '<div class="qc-section-title">🔎 检查结果</div>'
      + '<div class="qc-issue-list">'
      + issues.map(function(iss, i) {
        return '<div class="issue-item ' + iss.level + '" style="animation-delay:' + (i * 0.06) + 's;">'
          + '<span class="issue-icon">' + iss.icon + '</span>'
          + '<div class="issue-body"><div class="issue-title">' + iss.title + '</div><div class="issue-desc">' + iss.desc + '</div></div></div>';
      }).join('')
      + '</div>';

    quickCheckResult.innerHTML = statsHtml + dimHtml + suggestionsHtml + issuesHtml;

    // 供 AI 助手 audit_worldbook 复用同一套快速监测结果
    return {
      total: totalEntries,
      constant: constantCount,
      selective: selectiveCount,
      skeleton: skeletonCount,
      noKeys: noKeysCount,
      emptyContent: emptyContentCount,
      totalContentLen: totalContentLen,
      issues: issues,
      suggestions: quickSuggestions,
    };
  }

  window.__runWorldbookQuickCheck__ = function() {
    return runQuickCheck() || { issues: [], total: 0 };
  };

  function statCard(num, label, color) {
    return '<div class="qc-stat"><div class="qc-stat-num" style="color:' + color + ';">' + num + '</div><div class="qc-stat-label">' + label + '</div></div>';
  }

  
  
  
  btnRunAudit.addEventListener('click', async function() {
    var entries = getEntries();
    var char = getCharData();

    if (entries.length === 0) {
      auditStatus.textContent = '❌ 世界书为空，无法审计';
      auditStatus.style.color = '#ef4444';
      appFeedback(null, { message: '世界书为空，无法审计', level: 'warn', channel: 'toast' });
      return;
    }

    var apiUrlEl = document.getElementById('apiUrl');
    var apiKeyEl = document.getElementById('apiKey');
    var modelEl = document.getElementById('modelSelect');
    var url = (apiUrlEl.value || '').replace(/\/$/, '') + '/chat/completions';
    var key = (apiKeyEl.value || '').trim();
    var model = (modelEl.value || '');
    if (!model) return alert('请先在 AI 引擎中选择模型！');

    btnRunAudit.disabled = true;
    btnRunAudit.textContent = '🧠 审计中...';
    auditStatus.textContent = '⏳ AI 正在分析你的世界书...';
    auditStatus.style.color = 'var(--color-accent-hover)';
    auditReport.style.display = 'none';

    var wbSummary = entries.map(function(e, i) {
      return '[' + i + '] 标题: ' + (entryExportComment(e) || '未命名')
        + ' | 策略: ' + (e.strategy || '?')
        + ' | 触发词: ' + ((e.keys || []).join(', ') || '无')
        + ' | 内容(' + (e.content || '').length + '字): ' + (e.content || '').substring(0, 150) + (((e.content || '').length > 150) ? '...' : '');
    }).join('\n');

    var charInfo = '角色名: ' + (char.name || '未设置') + '\n角色描述: ' + (char.description || '未设置').substring(0, 300);

    var auditHead = (window.__promptStore__ && window.__promptStore__.get('wbAudit'))
      || '你是一个专业的酒馆(SillyTavern)角色卡世界书审计专家。请对以下世界书进行全面审计分析。\n\n';
    var sysPrompt = auditHead
      + '【角色信息】\n' + charInfo + '\n\n'
      + '【世界书条目 (共' + entries.length + '条)】\n' + wbSummary + '\n\n'
      + '【输出要求】必须输出一个JSON对象，格式如下：\n'
      + '{\n'
      + '  "score": 75,\n'
      + '  "grade": "B+",\n'
      + '  "summary": "一句话总评",\n'
      + '  "dimensions": [\n'
      + '    { "name": "维度名", "score": 80, "status": "good|warn|bad|none", "detail": "说明" }\n'
      + '  ],\n'
      + '  "issues": [\n'
      + '    { "level": "critical|warning|info|tip", "title": "问题标题", "desc": "详细说明", "entries": [0,1] }\n'
      + '  ],\n'
      + '  "suggestions": ["建议1", "建议2", "建议3"]\n'
      + '}\n\n'
      + '只报告准入问题：常驻却带触发词、开着的可选没有触发词也不在同组、同组开了几条、读取路径对不上、Description 为空或和常驻开头重复。\n'
      + '不要因为缺了某种类型、人物太少或太多、条数不像某张样本而扣分。不要要求每条写满固定字数。\n';

    try {
      var headers = { 'Content-Type': 'application/json' };
      if (key) headers['Authorization'] = 'Bearer ' + key;

      var center = window.__aiTaskCenter__;
      await (center && center.run ? center.run({
        type: 'auditor',
        title: '世界书内容监测',
        target: entries.length + ' 条',
      }, async function(task) {
        var res = await fetch(url, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'system', content: sysPrompt },
              { role: 'user', content: '请对这个世界书进行全面审计，给出评分和改进建议。' }
            ],
            temperature: 0.6
          }),
          signal: task.signal
        });

        if (!res.ok) throw new Error('HTTP ' + res.status);
        var raw = (await res.json()).choices[0].message.content;

        var match = raw.match(/```json\s*([\s\S]*?)\s*```/);
        var report = JSON.parse(match ? match[1] : raw);

        renderAuditReport(report);
        auditStatus.textContent = '✅ 审计完成！';
        auditStatus.style.color = '#10b981';
      }) : (async function() {
        var res = await fetch(url, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'system', content: sysPrompt },
              { role: 'user', content: '请对这个世界书进行全面审计，给出评分和改进建议。' }
            ],
            temperature: 0.6
          })
        });

        if (!res.ok) throw new Error('HTTP ' + res.status);
        var raw = (await res.json()).choices[0].message.content;

        var match = raw.match(/```json\s*([\s\S]*?)\s*```/);
        var report = JSON.parse(match ? match[1] : raw);

        renderAuditReport(report);
        auditStatus.textContent = '✅ 审计完成！';
        auditStatus.style.color = '#10b981';
      })());

    } catch(err) {
      if (window.__isAiAbortError__ && window.__isAiAbortError__(err)) {
        auditStatus.textContent = '⏹ 已取消';
        auditStatus.style.color = 'var(--color-text-muted)';
      } else {
        auditStatus.textContent = '❌ 审计失败: ' + err.message;
        auditStatus.style.color = '#ef4444';
        appFeedback(null, {
          message: '审计失败: ' + err.message,
          level: 'error',
          important: true,
          title: '世界书审计',
        });
      }
    } finally {
      btnRunAudit.disabled = false;
      btnRunAudit.textContent = '🧠 AI 深度审计';
    }
  });

  
  
  
  function renderAuditReport(report) {
    auditReport.style.display = 'block';

    var score = Math.max(0, Math.min(100, report.score || 0));
    var offset = 264 - (264 * score / 100);
    var scoreColor = score >= 80 ? 'var(--color-success)' : (score >= 60 ? 'var(--color-warning)' : (score >= 40 ? '#fb923c' : '#ef4444'));

    setTimeout(function() {
      scoreCircle.style.strokeDashoffset = offset;
      scoreCircle.style.stroke = scoreColor;
    }, 100);

    var currentNum = 0;
    var numInterval = setInterval(function() {
      currentNum += Math.ceil(score / 30);
      if (currentNum >= score) { currentNum = score; clearInterval(numInterval); }
      scoreNumber.textContent = currentNum;
      scoreNumber.style.color = scoreColor;
    }, 40);

    var gradeColors = { 'S': '#c084fc', 'A+': 'var(--color-success)', 'A': 'var(--color-success)', 'B+': 'var(--color-accent-hover)', 'B': 'var(--color-accent-hover)', 'C+': 'var(--color-warning)', 'C': 'var(--color-warning)', 'D': '#fb923c', 'F': '#ef4444' };
    scoreGrade.textContent = '🏆 ' + (report.grade || '?');
    scoreGrade.style.color = gradeColors[report.grade] || 'var(--color-text-muted)';
    scoreSummary.textContent = report.summary || '';

    
    if (report.dimensions && report.dimensions.length > 0) {
      auditDimensions.innerHTML = report.dimensions.map(function(dim) {
        var barColor = dim.status === 'good' ? 'var(--color-success)' : (dim.status === 'warn' ? 'var(--color-warning)' : (dim.status === 'bad' ? '#ef4444' : 'var(--color-text-muted)'));
        var dimScore = dim.score || 0;
        return '<div class="dim-card">'
          + '<div class="dim-header"><span class="dim-name">' + escapeHTML(dim.name) + '</span><span class="dim-status ' + (dim.status || 'none') + '">' + dimScore + '%</span></div>'
          + '<div class="dim-bar"><div class="dim-bar-fill" style="width:' + dimScore + '%;background:' + barColor + ';"></div></div>'
          + '<div class="dim-detail">' + escapeHTML(dim.detail || '') + '</div>'
          + '</div>';
      }).join('');
    }

    
    if (report.issues && report.issues.length > 0) {
      var iconMap = { critical: '🚨', warning: '⚠️', info: '💡', tip: '✅' };
      auditIssues.innerHTML = '<div class="audit-issues-title">📋 发现 ' + report.issues.length + ' 个问题</div>'
        + report.issues.map(function(iss, i) {
          return '<div class="issue-item ' + (iss.level || 'info') + '" style="animation-delay:' + (i * 0.08) + 's;">'
            + '<span class="issue-icon">' + (iconMap[iss.level] || '📌') + '</span>'
            + '<div class="issue-body"><div class="issue-title">' + escapeHTML(iss.title || '') + '</div>'
            + '<div class="issue-desc">' + escapeHTML(iss.desc || '')
            + (iss.entries && iss.entries.length > 0 ? ' <span style="color:var(--color-accent);">[条目: ' + iss.entries.join(', ') + ']</span>' : '')
            + '</div></div></div>';
        }).join('');
    } else {
      auditIssues.innerHTML = '<div class="issue-item tip"><span class="issue-icon">✅</span><div class="issue-body"><div class="issue-title">未发现严重问题</div><div class="issue-desc">世界书结构良好！</div></div></div>';
    }

    
    if (report.suggestions && report.suggestions.length > 0) {
      auditSuggestions.innerHTML = '<div class="suggestions-title">💡 改进建议</div>'
        + report.suggestions.map(function(s, i) {
          return '<div class="suggestion-item"><span class="suggestion-num">' + (i + 1) + '</span><span>' + escapeHTML(s) + '</span></div>';
        }).join('');
    }
  }

  function escapeHTML(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── 页面加载后自动运行快速自检 ──
  setTimeout(function() {
    runQuickCheck();
  }, 600);

  // ── 实时监听世界书变化，自动刷新基础统计 ──
  var _auditRefreshTimer = null;
  window.addEventListener('worldbook-changed', function() {
    // 防抖：避免短时间内大量更新
    if (_auditRefreshTimer) clearTimeout(_auditRefreshTimer);
    _auditRefreshTimer = setTimeout(function() {
      runQuickCheck();
    }, 300);
  });
}
