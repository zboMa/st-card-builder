/**
 * 设定面板：角色设定生成 + 开场白生成
 */
import { buildSetupCorpus } from '../chapters.mjs';
import { findEntityMatch } from '../entityStore.mjs';
import { DEFAULT_EXPAND_BUDGET } from '../recall.mjs';
import { hybridSearch } from '../rag/hybridSearch.mjs';
import { pickRelatedEntities, buildRagInjectBlock } from '../rag/inject.mjs';
import { getEmbeddingConfig, EMBEDDING_API_URL_KEY, EMBEDDING_API_KEY_KEY, EMBEDDING_MODEL_KEY } from '../rag/embeddingConfig.mjs';
import { applyTemplate } from '../../promptStore.mjs';
import { escapeHtml, parseJsonLoose } from '../../utils.mjs';
import {
  buildModeHintBlocks,
  buildPaletteGuidanceBlock,
} from '../nsfwSupport.mjs';
import { SETUP_ENTITY_SUMMARY } from '../contextBudgets.mjs';
import { truncateToTokens } from '../../assistant/contextManager.mjs';

export function registerSetup(ctx) {
  var panel = {};

  // ========== 本地工具 ==========

  function $(id) {
    return ctx.$(id);
  }

  function getApiConfig() {
    var apiUrlEl = $('apiUrl');
    var apiKeyEl = $('apiKey');
    var embedUrlEl = $('embeddingApiUrl');
    var embedKeyEl = $('embeddingApiKey');
    var embedEl = $('embeddingModel');
    var embeddingApiUrl = embedUrlEl ? String(embedUrlEl.value || '').trim() : '';
    var embeddingApiKey = embedKeyEl ? String(embedKeyEl.value || '').trim() : '';
    var embeddingModel = embedEl ? String(embedEl.value || '').trim() : '';
    try {
      if (!embeddingApiUrl) embeddingApiUrl = localStorage.getItem(EMBEDDING_API_URL_KEY) || '';
      if (!embeddingApiKey) embeddingApiKey = localStorage.getItem(EMBEDDING_API_KEY_KEY) || '';
      if (!embeddingModel) embeddingModel = localStorage.getItem(EMBEDDING_MODEL_KEY) || '';
    } catch (e) { /* ignore */ }
    var resolved = getEmbeddingConfig({
      embeddingApiUrl: embeddingApiUrl,
      embeddingApiKey: embeddingApiKey,
      embeddingModel: embeddingModel,
      apiUrl: apiUrlEl ? String(apiUrlEl.value || '') : '',
      apiKey: apiKeyEl ? String(apiKeyEl.value || '').trim() : '',
    });
    return {
      apiUrl: resolved.apiUrl,
      apiKey: resolved.apiKey,
      embedModel: resolved.embeddingModel,
    };
  }

  function isAiConfigured() {
    var modelEl = $('modelSelect');
    return !!(modelEl && modelEl.value);
  }

  function setAiTip(id, msg) {
    var el = $(id);
    if (el) el.textContent = msg || '';
  }

  /** 填充实体人物下拉 */
  function fillPersonEntityPick(selectId, currentName) {
    var sel = $(selectId);
    if (!sel) return;
    var state = ctx.state;
    var persons = (state.entities || []).filter(function(e) { return e && e.type === 'person'; });
    var cur = String(currentName || '').trim();
    var html = '<option value="">— 手填角色名 —</option>';
    persons.forEach(function(e) {
      var selected = cur && (e.name === cur || (e.aliases || []).indexOf(cur) >= 0) ? ' selected' : '';
      html += '<option value="' + escapeHtml(e.id) + '"' + selected + '>'
        + escapeHtml(e.name) + '</option>';
    });
    sel.innerHTML = html;
  }

  /** 切换字数 / 前 N 章控件显隐 */
  function syncRangeModeUi(prefix, mode) {
    var charsWrap = $(prefix + 'CharLimitWrap');
    var chWrap = $(prefix + 'ChapterCountWrap');
    var isCh = mode === 'chapters';
    if (charsWrap) charsWrap.style.display = isCh ? 'none' : '';
    if (chWrap) chWrap.style.display = isCh ? '' : 'none';
  }

  function renderSetupCorpusPreview(kind) {
    var state = ctx.state;
    var isGreet = kind === 'greet';
    var corpus = buildSetupCorpus(state.chapters, isGreet
      ? { mode: state.greetRangeMode, charLimit: state.greetCharLimit, chapterCount: state.greetChapterCount }
      : { mode: state.setupRangeMode, charLimit: state.setupCharLimit, chapterCount: state.setupChapterCount });
    var meta = $(isGreet ? 'novelGreetPreviewMeta' : 'novelSetupPreviewMeta');
    var prev = $(isGreet ? 'novelGreetPreview' : 'novelSetupPreview');
    var name = String(isGreet ? state.greetCharName : state.setupCharName || '').trim();
    var ent = name ? findEntityMatch(state.entities, name, []) : null;
    var hint = ent && ent.type === 'person' ? ' · 已匹配实体，生成时优先 RAG' : ' · 生成时无命中则用此范围';
    if (meta) {
      meta.textContent = '范围预览 ' + corpus.charCount + ' 字 · ' + corpus.chapterCount + ' 章' + hint;
    }
    if (prev) prev.textContent = corpus.text || '（暂无启用章节文本）';
    return corpus;
  }

  /**
   * 设定/开场白语料：优先实体匹配 + RAG；无命中回退范围截取
   * @returns {Promise<{ text, charCount, chapterCount, mode, source, entity }>}
   */
  async function resolveSetupCorpus(kind, charName, signal) {
    var state = ctx.state;
    var isGreet = kind === 'greet';
    var budget = isGreet
      ? (state.greetCharLimit || state.expandBudget || DEFAULT_EXPAND_BUDGET)
      : (state.setupCharLimit || state.expandBudget || DEFAULT_EXPAND_BUDGET);
    var name = String(charName || '').trim();
    var ent = name ? findEntityMatch(state.entities, name, []) : null;
    if (ent && ent.type !== 'person') ent = null;
    if (!ent && name) {
      ent = (state.entities || []).find(function(e) {
        return e && e.type === 'person' && String(e.name || '') === name;
      }) || null;
    }

    var fallback = buildSetupCorpus(state.chapters, isGreet
      ? { mode: state.greetRangeMode, charLimit: state.greetCharLimit, chapterCount: state.greetChapterCount }
      : { mode: state.setupRangeMode, charLimit: state.setupCharLimit, chapterCount: state.setupChapterCount });

    if (!name) {
      return Object.assign({}, fallback, { source: 'range', entity: null });
    }

    try {
      var api = getApiConfig();
      var cardId = ctx.sm.getBoundCardId();
      var query = ent
        ? [ent.name].concat(ent.aliases || []).join(' ')
        : name;
      var search = await hybridSearch({
        chapters: state.chapters,
        query: query,
        cardId: cardId,
        budget: budget,
        apiUrl: api.apiUrl,
        apiKey: api.apiKey,
        embedModel: api.embedModel,
        signal: signal,
      });
      var body = search && search.body ? String(search.body).trim() : '';
      if (body.length >= 120) {
        var related = ent ? [ent] : pickRelatedEntities(state.entities, query, 4);
        var inject = buildRagInjectBlock(search, related, { entityBudget: 2000 });
        return {
          text: inject,
          charCount: body.length,
          chapterCount: (search.snippets && search.snippets.length) || 0,
          mode: 'rag',
          source: 'rag',
          entity: ent,
        };
      }
    } catch (e) {
      if (ctx.isTrackedAbort(e)) throw e;
      // RAG 失败则回退
    }
    return Object.assign({}, fallback, { source: 'range', entity: ent });
  }

  // ========== 渲染 ==========

  panel.renderSetup = function() {
    var state = ctx.state;
    var name = $('novelSetupCharName');
    var mode = $('novelSetupRangeMode');
    var limit = $('novelSetupCharLimit');
    var chN = $('novelSetupChapterCount');
    if (name && document.activeElement !== name) name.value = state.setupCharName || '';
    if (mode) mode.value = state.setupRangeMode || 'chars';
    if (limit) limit.value = String(state.setupCharLimit || 16000);
    if (chN && document.activeElement !== chN) chN.value = String(state.setupChapterCount || 3);
    fillPersonEntityPick('novelSetupEntityPick', state.setupCharName);
    syncRangeModeUi('novelSetup', state.setupRangeMode || 'chars');
    renderSetupCorpusPreview('setup');
  };

  panel.renderGreetings = function() {
    var state = ctx.state;
    var name = $('novelGreetCharName');
    var mode = $('novelGreetRangeMode');
    var limit = $('novelGreetCharLimit');
    var chN = $('novelGreetChapterCount');
    var count = $('novelGreetCount');
    if (name && document.activeElement !== name) name.value = state.greetCharName || '';
    if (mode) mode.value = state.greetRangeMode || 'chars';
    if (limit) limit.value = String(state.greetCharLimit || 16000);
    if (chN && document.activeElement !== chN) chN.value = String(state.greetChapterCount || 3);
    if (count && document.activeElement !== count) count.value = String(state.greetCount || 3);
    fillPersonEntityPick('novelGreetEntityPick', state.greetCharName || state.setupCharName);
    syncRangeModeUi('novelGreet', state.greetRangeMode || 'chars');
    renderSetupCorpusPreview('greet');
  };

  // ========== 绑定 ==========

  panel.bindSetup = function() {
    var state = ctx.state;
    var pick = $('novelSetupEntityPick');
    if (pick) pick.addEventListener('change', function() {
      var id = pick.value;
      var ent = (state.entities || []).find(function(e) { return e.id === id; });
      if (ent) {
        state.setupCharName = ent.name;
        var nameEl = $('novelSetupCharName');
        if (nameEl) nameEl.value = ent.name;
        ctx.save();
        renderSetupCorpusPreview('setup');
      }
    });
    var name = $('novelSetupCharName');
    if (name) name.addEventListener('input', function() {
      state.setupCharName = name.value;
      ctx.save();
      renderSetupCorpusPreview('setup');
    });
    var mode = $('novelSetupRangeMode');
    if (mode) mode.addEventListener('change', function() {
      state.setupRangeMode = mode.value === 'chapters' ? 'chapters' : 'chars';
      ctx.save();
      panel.renderSetup();
    });
    var limit = $('novelSetupCharLimit');
    if (limit) limit.addEventListener('change', function() {
      state.setupCharLimit = parseInt(limit.value, 10) || 16000;
      ctx.save();
      renderSetupCorpusPreview('setup');
    });
    var chN = $('novelSetupChapterCount');
    if (chN) chN.addEventListener('input', function() {
      state.setupChapterCount = Math.max(1, parseInt(chN.value, 10) || 1);
      ctx.save();
      renderSetupCorpusPreview('setup');
    });
    var gen = $('btnNovelGenCharSetup');
    if (gen) gen.addEventListener('click', async function() {
      try {
        await panel.runGenCharSetup();
      } catch (e) {
        if (!ctx.isTrackedAbort(e)) alert('生成失败: ' + (e.message || e));
      }
    });
  };

  panel.bindGreetings = function() {
    var state = ctx.state;
    var pick = $('novelGreetEntityPick');
    if (pick) pick.addEventListener('change', function() {
      var id = pick.value;
      var ent = (state.entities || []).find(function(e) { return e.id === id; });
      if (ent) {
        state.greetCharName = ent.name;
        var nameEl = $('novelGreetCharName');
        if (nameEl) nameEl.value = ent.name;
        ctx.save();
        renderSetupCorpusPreview('greet');
      }
    });
    var name = $('novelGreetCharName');
    if (name) name.addEventListener('input', function() {
      state.greetCharName = name.value;
      ctx.save();
      renderSetupCorpusPreview('greet');
    });
    var mode = $('novelGreetRangeMode');
    if (mode) mode.addEventListener('change', function() {
      state.greetRangeMode = mode.value === 'chapters' ? 'chapters' : 'chars';
      ctx.save();
      panel.renderGreetings();
    });
    var limit = $('novelGreetCharLimit');
    if (limit) limit.addEventListener('change', function() {
      state.greetCharLimit = parseInt(limit.value, 10) || 16000;
      ctx.save();
      renderSetupCorpusPreview('greet');
    });
    var chN = $('novelGreetChapterCount');
    if (chN) chN.addEventListener('input', function() {
      state.greetChapterCount = Math.max(1, parseInt(chN.value, 10) || 1);
      ctx.save();
      renderSetupCorpusPreview('greet');
    });
    var count = $('novelGreetCount');
    if (count) count.addEventListener('input', function() {
      state.greetCount = Math.max(1, Math.min(12, parseInt(count.value, 10) || 3));
      ctx.save();
    });
    var gen = $('btnNovelGenGreetings');
    if (gen) gen.addEventListener('click', async function() {
      try {
        await panel.runGenGreetings();
      } catch (e) {
        if (!ctx.isTrackedAbort(e)) alert('生成失败: ' + (e.message || e));
      }
    });
  };

  // ========== 执行 ==========

  panel.runGenCharSetup = async function() {
    var state = ctx.state;
    var g = ctx.gates();
    if (!g.canExtract) throw new Error((g.reasons || []).join('\n') || '前置未完成');
    if (!isAiConfigured()) {
      setAiTip('novelSetupAiTip', '未配置 AI，请先到「AI 配置」选择模型');
      throw new Error('未配置 AI 模型（请先到「AI 配置」）');
    }
    var charName = String(state.setupCharName || '').trim();
    if (!charName) throw new Error('请先填写角色名称');

    ctx.setStatus('novelSetupStatus', '准备原文…');
    var btn = $('btnNovelGenCharSetup');
    ctx.busyFlags.charSetup = true;
    if (ctx.engineBegin) ctx.engineBegin('novel.setup.generate');
    ctx.setBtnBusy(btn, true, '生成中…');
    try {
      return await ctx.runTracked({
        type: 'novel_char_setup',
        title: '小说角色设定 · ' + charName,
        target: charName,
      }, async function(task) {
        if (task.signal && task.signal.aborted) throw new DOMException('已取消', 'AbortError');
        var corpus = await resolveSetupCorpus('setup', charName, task.signal);
        if (!corpus.text || !String(corpus.text).trim()) throw new Error('无可用原文（RAG 与范围截取均空）');
        var meta = $('novelSetupPreviewMeta');
        var prev = $('novelSetupPreview');
        if (meta) {
          meta.textContent = (corpus.source === 'rag' ? 'RAG 召回 ' : '范围截取 ')
            + corpus.charCount + ' 字 · ' + (corpus.chapterCount || 0)
            + (corpus.entity ? ' 章 · 实体 ' + corpus.entity.name : ' 章');
        }
        if (prev) prev.textContent = corpus.text;
        var head = ctx.promptText(
          'novelCharSetup',
          '你是 SillyTavern 角色卡写手。仅根据提供的小说原文，为指定角色生成角色设定。只输出 JSON：{ charName, wbName, charDesc, creatorNotes }'
        );
        // 写入主卡角色设定 = 主角：禁止注入 NSFW/NTL/恶堕
        var user = head
          + '\n角色名称: ' + charName
          + (corpus.entity ? '\n实体摘要: ' + truncateToTokens(String(corpus.entity.summary || ''), SETUP_ENTITY_SUMMARY) : '')
          + '\nContext: ' + (state.contextText || '无')
          + '\n【硬约束】输出的 charDesc/creatorNotes 是主角卡面设定：禁止 NSFW_information、情欲口味、NTL、恶堕分期；成人层只属于世界书人物条目。'
          + buildModeHintBlocks(state, 'expand')
          + buildPaletteGuidanceBlock(state, { includeAdult: false })
          + '\n\n【原文】\n' + corpus.text;
        var text = await ctx.callAI(user, null, task.signal);
        var data = parseJsonLoose(text);
        var fields = {
          charName: String(data.charName || charName).trim() || charName,
          wbName: String(data.wbName || '').trim(),
          charDesc: String(data.charDesc || '').trim(),
          creatorNotes: String(data.creatorNotes || '').trim(),
        };
        if (!fields.charDesc) throw new Error('模型未返回角色描述');
        ctx.setCharacterFields(fields);
        ctx.setStatus('novelSetupStatus', '已写入当前卡：' + fields.charName
          + '（描述 ' + fields.charDesc.length + ' 字 · 语料 ' + corpus.source + '）');
        return {
          charName: fields.charName,
          descLen: fields.charDesc.length,
          corpusChars: corpus.charCount,
          corpusSource: corpus.source,
        };
      });
    } catch (e) {
      if (ctx.isTrackedAbort(e)) ctx.setStatus('novelSetupStatus', '⏹ 已取消生成');
      throw e;
    } finally {
      ctx.busyFlags.charSetup = false;
      if (ctx.engineEnd) ctx.engineEnd('novel.setup.generate');
      ctx.setBtnBusy(btn, false);
      if (ctx.renderGatesFn) ctx.renderGatesFn();
    }
  };

  panel.runGenGreetings = async function() {
    var state = ctx.state;
    var g = ctx.gates();
    if (!g.canExtract) throw new Error((g.reasons || []).join('\n') || '前置未完成');
    if (!isAiConfigured()) {
      setAiTip('novelGreetAiTip', '未配置 AI，请先到「AI 配置」选择模型');
      throw new Error('未配置 AI 模型（请先到「AI 配置」）');
    }
    var charName = String(state.greetCharName || state.setupCharName || '').trim();
    if (!charName) throw new Error('请先填写角色名称');
    var total = Math.max(1, Math.min(12, Number(state.greetCount) || 3));
    var altCount = Math.max(0, total - 1);

    ctx.setStatus('novelGreetStatus', '准备原文…');
    var btn = $('btnNovelGenGreetings');
    ctx.busyFlags.greetings = true;
    if (ctx.engineBegin) ctx.engineBegin('novel.greetings.generate');
    ctx.setBtnBusy(btn, true, '生成中…');
    try {
      return await ctx.runTracked({
        type: 'novel_greetings',
        title: '小说开场白 · ' + charName + ' ×' + total,
        target: charName,
      }, async function(task) {
        if (task.signal && task.signal.aborted) throw new DOMException('已取消', 'AbortError');
        var corpus = await resolveSetupCorpus('greet', charName, task.signal);
        if (!corpus.text || !String(corpus.text).trim()) throw new Error('无可用原文（RAG 与范围截取均空）');
        var meta = $('novelGreetPreviewMeta');
        var prev = $('novelGreetPreview');
        if (meta) {
          meta.textContent = (corpus.source === 'rag' ? 'RAG 召回 ' : '范围截取 ')
            + corpus.charCount + ' 字 · ' + (corpus.chapterCount || 0)
            + (corpus.entity ? ' 章 · 实体 ' + corpus.entity.name : ' 章');
        }
        if (prev) prev.textContent = corpus.text;
        var headTpl = ctx.promptText(
          'novelGreetingsGen',
          '你是 SillyTavern 开场白写手。只输出 JSON：{ "firstMes":"...", "altGreetings":[...] }，altGreetings 长度必须刚好为 {{altCount}}。'
        );
        var head = applyTemplate(headTpl, { altCount: altCount });
        // 主卡开场白面向主角互动：不注入 NSFW/NTL 调色盘
        var user = head
          + '\n角色名称: ' + charName
          + (corpus.entity ? '\n实体摘要: ' + truncateToTokens(String(corpus.entity.summary || ''), SETUP_ENTITY_SUMMARY) : '')
          + '\n开场白总数: ' + total + '（主开场 1 + 备选 ' + altCount + '）'
          + '\nContext: ' + (state.contextText || '无')
          + '\n【硬约束】开场白勿写成恶堕进度说明或 NTL 调教手册；禁止未成年内容。'
          + buildModeHintBlocks(state, 'expand')
          + '\n\n【原文】\n' + corpus.text;
        var text = await ctx.callAI(user, null, task.signal);
        var data = parseJsonLoose(text);
        var firstMes = String(data.firstMes || data.first_mes || '').trim();
        var alts = Array.isArray(data.altGreetings)
          ? data.altGreetings
          : (Array.isArray(data.alternate_greetings) ? data.alternate_greetings : []);
        alts = alts.map(function(s) { return String(s || '').trim(); }).filter(Boolean);
        while (alts.length < altCount) alts.push('');
        if (alts.length > altCount) alts = alts.slice(0, altCount);
        if (!firstMes) throw new Error('模型未返回主开场白');
        ctx.setGreetingFields({ firstMes: firstMes, alternateGreetings: alts });
        ctx.setStatus('novelGreetStatus', '已写入当前卡：主开场 + 备选 ' + alts.length
          + ' 条 · 语料 ' + corpus.source);
        return {
          firstMesLen: firstMes.length,
          altCount: alts.length,
          corpusChars: corpus.charCount,
          corpusSource: corpus.source,
        };
      });
    } catch (e) {
      if (ctx.isTrackedAbort(e)) ctx.setStatus('novelGreetStatus', '⏹ 已取消生成');
      throw e;
    } finally {
      ctx.busyFlags.greetings = false;
      if (ctx.engineEnd) ctx.engineEnd('novel.greetings.generate');
      ctx.setBtnBusy(btn, false);
      if (ctx.renderGatesFn) ctx.renderGatesFn();
    }
  };

  // 挂载到 ctx
  ctx.panels.setup = panel;
  return panel;
}
