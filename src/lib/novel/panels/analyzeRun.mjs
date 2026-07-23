import { buildExtractShards, estimateExtractCalls, chaptersSourceFingerprint } from '../chapters.mjs';
import { emptyKnowledgeGraph } from '../graphMerge.mjs';
import { mountOrUpdateGraph } from '../graphViz.mjs';
import {
  countEntitiesByType, isEntityEnriched, ENTITY_TYPES, projectEntitiesToLegacy,
  findEntityMatch, upsertEntity, ingestLegacyIntoEntities,
} from '../entityStore.mjs';
import {
  applySkeletonResult, applyEnrichResult, listEntitiesNeedingEnrich, buildSkeletonPriorBlock,
  buildCrossTypeRelationHint, buildAnalyzeFocusHint,
} from '../analyzePipeline.mjs';
import { buildNovelRagIndex } from '../rag/indexBuild.mjs';
import { hybridSearch } from '../rag/hybridSearch.mjs';
import { buildRagInjectBlock, pickRelatedEntities } from '../rag/inject.mjs';
import { getEmbeddingConfig, EMBEDDING_API_URL_KEY, EMBEDDING_API_KEY_KEY, EMBEDDING_MODEL_KEY } from '../rag/embeddingConfig.mjs';
import {
  getAdultMode, getNtlMode, boostAdultSearchQuery, extractStyleNsfwSection,
  buildModeHintBlocks, buildContentModeFlags, buildNsfwFlavorHint, buildNtlTabooHint,
  buildPaletteGuidanceBlock, getNsfwFlavorItems, evaluateFlavorRichness,
  buildFlavorExpandSystemPrompt, buildFlavorExpandUserPrompt, NSFW_FLAVOR_PRESETS,
  NTL_TABOO_TYPES, getNtlTabooTypes, evaluateNtlRichness, buildNtlExpandSystemPrompt,
  buildNtlExpandUserPrompt, buildAdultCanonDigest, ADULT_CANON_BUDGET,
  buildStatusBarNsfwDraftFromEntities, buildStatusBarVesselDraftFromEntities,
  resolveWorldframe, evaluateVesselRichness, buildVesselExpandSystemPrompt,
  buildVesselExpandUserPrompt, buildVesselHintForState, listVesselEntities, personMentionsVessels,
} from '../nsfwSupport.mjs';
import { RAG_ENTITY_BUDGET } from '../contextBudgets.mjs';
import { parseJsonLoose } from '../../utils.mjs';
import { novelCanonBlock, vesselOptsFromState, ENTITY_TYPE_ZH } from './analyzeShared.mjs';
import { buildRecallPayload, DEFAULT_EXPAND_BUDGET } from '../recall.mjs';
import {
  resolveProtagonistName,
  ensureProtagonistEntity,
  buildProtagonistHintBlock,
} from '../protagonist.mjs';

/**
 * attachNovelAnalyzeRun（拆自原模块）
 */
export function attachNovelAnalyzeRun(ctx, panel) {
  function gates() {
    return ctx.gates ? ctx.gates() : { canExtract: false, reasons: ['未就绪'] };
  }
  function getApiConfig() {
    if (typeof panel.getApiConfig === 'function') return panel.getApiConfig();
    if (typeof ctx.getApiConfig === 'function') return ctx.getApiConfig();
    throw new Error('API 配置未就绪');
  }
  function analyzeShardOpts() {
    return panel.analyzeShardOpts();
  }
  function clearFailedShards(phase) {
    return panel.clearFailedShards(phase);
  }
  function pushFailedShard(rec) {
    return panel.pushFailedShard(rec);
  }
  function isRagIndexStale() {
    return panel.isRagIndexStale();
  }

  function setActionBtnBusy(btn, busy, loadingText) {
    if (!btn) return;
    if (btn.classList && btn.classList.contains('novel-icon-btn')) {
      if (busy) {
        if (btn.dataset.idleHtml == null) btn.dataset.idleHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '…';
      } else {
        btn.disabled = false;
        if (btn.dataset.idleHtml != null) {
          btn.innerHTML = btn.dataset.idleHtml;
          delete btn.dataset.idleHtml;
        }
      }
      return;
    }
    ctx.setBtnBusy(btn, busy, loadingText);
  }

  function prepareProtagonistForAnalyze(state) {
    var p = resolveProtagonistName(state);
    if (p.name) {
      ensureProtagonistEntity(state, p.name);
      return p;
    }
    // 软提示已放在开始分析弹窗；此处仅短状态，不阻断
    return p;
  }

  panel.runBuildRagIndex = async function(opts) {
    opts = opts || {};
    var state = ctx.state;
    var cardId = ctx.sm.getBoundCardId();
    if (!cardId) throw new Error('未绑定角色卡');
    var g = gates();
    if (!g.canExtract) throw new Error((g.reasons || []).join('\n') || '前置未完成');
    var api = getApiConfig();
    var $ = ctx.$;
    var btn = $('btnNovelRagIndex');
    ctx.busyFlags.ragIndex = true;
    ctx.setBtnBusy(btn, true, '建索引…');
    if (!state.rag) state.rag = {};
    state.rag.indexStatus = 'building';
    ctx.save();
    panel.render();
    try {
      return await ctx.runTracked({
        type: 'novel_rag_index',
        title: '小说 RAG 索引',
        target: cardId,
      }, async function(task) {
        var result = await buildNovelRagIndex({
          cardId: cardId,
          chapters: state.chapters,
          apiUrl: api.apiUrl,
          apiKey: api.apiKey,
          embedModel: api.embedModel,
          signal: task.signal,
          keywordOnly: !!opts.keywordOnly,
          onProgress: function(ratio, label) {
            if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', label || '建索引…');
            if (window.__aiTaskCenter__ && task.id) {
              window.__aiTaskCenter__.setProgress(task.id, ratio, label || '');
            }
          },
        });
        state.rag.indexStatus = 'ready';
        state.rag.indexUpdatedAt = new Date().toISOString();
        state.rag.chunkCount = result.chunkCount || 0;
        state.rag.embedModel = (result.index && result.index.embedModel) || api.embedModel;
        state.rag.sourceFingerprint = chaptersSourceFingerprint(state.chapters);
        ctx.save();
        panel.render();
        if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '索引就绪 | ' + (result.mode || 'keyword') + ' | ' + (result.chunkCount || 0) + ' 块');
        return result;
      });
    } catch (e) {
      if (state.rag) state.rag.indexStatus = 'error';
      ctx.save();
      panel.render();
      throw e;
    } finally {
      ctx.busyFlags.ragIndex = false;
      ctx.setBtnBusy(btn, false);
      if (ctx.renderGatesFn) ctx.renderGatesFn();
    }
  };

  panel.runAnalyzeSkeleton = async function(opts) {
    opts = opts || {};
    var state = ctx.state;
    var $ = ctx.$;
    var g = gates();
    if (!g.canExtract) throw new Error((g.reasons || []).join('\n') || '前置未完成');
    var shards = buildExtractShards(state.chapters, analyzeShardOpts());
    if (!shards.length) throw new Error('无启用章节文本可分析');
    var indexes = null;
    if (opts.shardIndexes && opts.shardIndexes.length) {
      indexes = opts.shardIndexes.filter(function(i) { return i >= 0 && i < shards.length; });
      if (!indexes.length) throw new Error('无有效失败片可重跑');
    }
    if (opts.clearFailed !== false && !indexes) clearFailedShards('skeleton');
    var protag = prepareProtagonistForAnalyze(state);
    var queue = $('novelAnalyzeQueue');
    if (queue) queue.style.display = 'block';
    var btn = opts.sourceBtn || $('btnNovelAnalyzeAll') || $('btnNovelAnalyzeSkeleton');
    ctx.busyFlags.analyzeSkeleton = true;
    setActionBtnBusy(btn, true, '骨架扫描…');
    if (ctx.refreshAnalyzeBusyUi) ctx.refreshAnalyzeBusyUi();
    else if (ctx.renderGatesFn) ctx.renderGatesFn();
    var totalRuns = indexes ? indexes.length : shards.length;
    if (ctx.setStatus) {
      ctx.setStatus(
        'novelAnalyzeStatus',
        (protag.name
          ? '骨架扫描中（约 ' + totalRuns + ' 次）… · 主角「' + protag.name + '」'
          : '骨架扫描中（约 ' + totalRuns + ' 次）… · 未设主角锚点')
      );
    }
    try {
      return await ctx.runTracked({
        type: 'novel_analyze_skeleton',
        title: indexes ? '骨架重跑失败片' : '小说骨架扫描',
        target: totalRuns + ' 次',
      }, async function(task) {
        var head = ctx.promptText('novelAnalyzeSkeleton', '输出 entities + relations 骨架 JSON');
        var totals = { add: 0, merge: 0, relAdd: 0, failed: 0, relSkipped: 0, relProjected: 0 };
        var runList = indexes || shards.map(function(_, i) { return i; });
        for (var ri = 0; ri < runList.length; ri++) {
          var idx = runList[ri];
          if (task.signal && task.signal.aborted) throw new DOMException('已取消', 'AbortError');
          var shard = shards[idx];
          if (queue) {
            queue.textContent = '骨架 ' + (ri + 1) + '/' + runList.length
              + ' | 实体 ' + (state.entities || []).length;
          }
          var prior = buildSkeletonPriorBlock(state);
          var user = head
            + prior
            + buildProtagonistHintBlock(protag.name)
            + buildAnalyzeFocusHint(state)
            + buildCrossTypeRelationHint()
            + buildModeHintBlocks(state, 'skeleton')
            + (getAdultMode(state) ? buildNsfwFlavorHint(state) : '')
            + (getNtlMode(state) ? buildNtlTabooHint(state) : '')
            + novelCanonBlock(state, '')
            + buildContentModeFlags(state)
            + '\nMode: ' + state.narrativeMode
            + '\nContext: ' + (state.contextText || '')
            + '\n【章节 ' + shard.chapterTitle + (shard.part > 1 ? ' · 片' + shard.part : '') + '】\n' + shard.text;
          try {
            var text = await ctx.callAI(user, null, task.signal);
            var parsed = parseJsonLoose(text);
            var st = applySkeletonResult(state, parsed);
            totals.add += st.add;
            totals.merge += st.merge;
            totals.relAdd += st.relAdd;
            totals.relSkipped = (totals.relSkipped || 0) + (st.relSkipped || 0);
            totals.relProjected = (totals.relProjected || 0) + (st.relProjected || 0);
            state.failedShards = (state.failedShards || []).filter(function(f) {
              return !(f.phase === 'skeleton' && f.shardIndex === idx);
            });
          } catch (e) {
            if (ctx.isTrackedAbort(e)) throw e;
            totals.failed++;
            pushFailedShard({
              phase: 'skeleton',
              shardIndex: idx,
              label: (shard.chapterTitle || '章') + (shard.part > 1 ? '#' + shard.part : ''),
              error: String(e.message || e),
            });
          }
          panel.flushAnalyzePreview();
          if (window.__aiTaskCenter__ && task.id) {
            window.__aiTaskCenter__.setProgress(task.id, (ri + 1) / runList.length, (ri + 1) + '/' + runList.length);
          }
          if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '骨架 ' + (ri + 1) + '/' + runList.length
            + ' | 实体 ' + (state.entities || []).length
            + (totals.failed ? ' | 失败 ' + totals.failed : ''));
        }
        if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '骨架完成 | 实体 ' + (state.entities || []).length
          + '（+' + totals.add + '/合' + totals.merge + '）· 关系 +' + totals.relAdd
          + (totals.relProjected ? ' · 结构边 +' + totals.relProjected : '')
          + (totals.relSkipped ? ' · 未解析 ' + totals.relSkipped : '')
          + (totals.failed ? ' | 失败 ' + totals.failed : ''));
        panel.render();
        return totals;
      });
    } catch (e) {
      if (ctx.isTrackedAbort(e) && ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '⏹ 已取消骨架扫描');
      throw e;
    } finally {
      ctx.busyFlags.analyzeSkeleton = false;
      setActionBtnBusy(btn, false);
      if (queue) queue.style.display = 'none';
      if (ctx.updateExtractCallEstimates) ctx.updateExtractCallEstimates();
      if (ctx.refreshAnalyzeBusyUi) ctx.refreshAnalyzeBusyUi();
      else if (ctx.renderGatesFn) ctx.renderGatesFn();
      panel.render();
    }
  };

  panel.runAnalyzeEnrich = async function(opts) {
    opts = opts || {};
    var state = ctx.state;
    var $ = ctx.$;
    var g = gates();
    if (!g.canExtract) throw new Error((g.reasons || []).join('\n') || '前置未完成');
    var api = getApiConfig();
    var cardId = ctx.sm.getBoundCardId();
    var queue = (state.entities || []).slice();
    if (opts.ids && opts.ids.length) {
      var want = {};
      opts.ids.forEach(function(id) { want[id] = true; });
      queue = queue.filter(function(e) { return want[e.id]; });
    } else {
      queue = listEntitiesNeedingEnrich(
        state.entities,
        state.strictQuality,
        getAdultMode(state),
        getNtlMode(state),
        state.analyzeFocus
      );
    }
    if (!queue.length) {
      if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '无待丰满实体');
      return { enriched: 0 };
    }
    var needConfirm = opts.confirm === true
      && !opts.silent
      && !opts.skipConfirm
      && queue.length === 1;
    if (needConfirm) {
      var previewEnt = queue[0];
      var recall = buildRecallPayload(
        state.chapters,
        previewEnt.name,
        previewEnt.aliases || [],
        state.expandBudget || DEFAULT_EXPAND_BUDGET,
        180
      );
      var ok = await ctx.confirmExpandRecall({
        title: '实体丰满 · ' + previewEnt.name,
        body: recall.body || '（无摘录；仍将用 RAG/关键词检索丰满）',
        totalChars: recall.totalChars || 0,
        snippetCount: recall.snippetCount || 0,
        truncated: recall.truncated,
        terms: recall.terms,
      });
      if (!ok) {
        if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '已取消丰满「' + previewEnt.name + '」');
        throw new DOMException('已取消', 'AbortError');
      }
    }
    if (opts.clearFailed !== false && !(opts.ids && opts.ids.length)) clearFailedShards('enrich');
    var btn = opts.sourceBtn || $('btnNovelAnalyzeEnrich') || $('btnNovelAnalyzeAll');
    ctx.busyFlags.analyzeEnrich = true;
    setActionBtnBusy(btn, true, '丰满中…');
    if (ctx.refreshAnalyzeBusyUi) ctx.refreshAnalyzeBusyUi();
    else if (ctx.renderGatesFn) ctx.renderGatesFn();
    if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '实体丰满 ' + queue.length + ' 项…');
    var head = ctx.promptText('novelEnrichEntity', '单实体丰满 JSON');
    var done = 0;
    var failed = 0;
    try {
      return await ctx.runTracked({
        type: 'novel_analyze_enrich',
        title: '实体丰满化',
        target: queue.length + ' 项',
      }, async function(task) {
        for (var i = 0; i < queue.length; i++) {
          if (task.signal && task.signal.aborted) throw new DOMException('已取消', 'AbortError');
          var ent = queue[i];
          var live = (state.entities || []).find(function(e) { return e.id === ent.id; }) || ent;
          var adultOn = getAdultMode(state);
          var ntlOn = getNtlMode(state);
          var query = boostAdultSearchQuery(
            [live.name].concat(live.aliases || []).join(' '),
            adultOn,
            ntlOn
          );
          try {
            var search = await hybridSearch({
              chapters: state.chapters,
              query: query,
              cardId: cardId,
              budget: state.expandBudget || 12000,
              apiUrl: api.apiUrl,
              apiKey: api.apiKey,
              embedModel: api.embedModel,
              signal: task.signal,
            });
            var related = pickRelatedEntities(state.entities, query, 8);
            var inject = buildRagInjectBlock(search, related, { entityBudget: RAG_ENTITY_BUDGET });
            var styleNsfw = adultOn ? extractStyleNsfwSection(state.styleText) : '';
            var flavorItems = adultOn ? getNsfwFlavorItems(state) : [];
            var ntlTypes = ntlOn ? getNtlTabooTypes(state) : [];
            var needFlavor = flavorItems.length > 0 && (live.type === 'person' || live.type === 'nsfw');
            var needNtl = ntlTypes.length > 0 && live.type === 'person';
            var needVessel = (adultOn || ntlOn) && (
              live.type === 'nsfw'
              || live.type === 'item'
              || live.type === 'location'
              || live.type === 'lore'
              || live.type === 'faction'
            );
            var vOpts = vesselOptsFromState(state);
            var user = head
              + '\n\n' + inject
              + styleNsfw
              + buildModeHintBlocks(state, 'enrich')
              + (needFlavor || needNtl ? buildPaletteGuidanceBlock(state) : '')
              + (needFlavor ? buildNsfwFlavorHint(state) : '')
              + (needNtl ? buildNtlTabooHint(state) : '')
              + novelCanonBlock(state, live.name)
              + '\n\n【待丰满实体】\n'
              + JSON.stringify({
                type: live.type,
                name: live.name,
                aliases: live.aliases,
                summary: live.summary,
                attrs: live.attrs || {},
              }, null, 2)
              + buildContentModeFlags(state)
              + '\nStrictQuality: ' + (!!state.strictQuality)
              + '\nContext: ' + (state.contextText || '');
            if (live.type === 'person') {
              var vessels = listVesselEntities(state.entities);
              if (vessels.length) {
                user += '\n【软约束】正文须点名互动至少一件已有载体：'
                  + vessels.slice(0, 8).map(function(v) { return v.name; }).join('、');
              }
            }
            var text = await ctx.callAI(user, null, task.signal);
            var parsed = parseJsonLoose(text);
            if (needFlavor) {
              var richness = evaluateFlavorRichness(parsed, flavorItems, { presets: NSFW_FLAVOR_PRESETS });
              if (!richness.ok) {
                var expandPrompt = buildFlavorExpandSystemPrompt(flavorItems, { presets: NSFW_FLAVOR_PRESETS })
                  + '\n\n' + buildFlavorExpandUserPrompt({
                    weakDimensions: richness.weakDimensions,
                    minChars: richness.minChars,
                    flavorHint: buildNsfwFlavorHint(state),
                    context: live.type + ' | ' + live.name,
                    text: JSON.stringify(parsed),
                  })
                  + '\n请输出加厚后的完整 JSON 实体（保持 type/name）。';
                var expandText = await ctx.callAI(expandPrompt, null, task.signal);
                var expanded = parseJsonLoose(expandText);
                var richness2 = evaluateFlavorRichness(expanded, flavorItems, { presets: NSFW_FLAVOR_PRESETS });
                if (richness2.total >= richness.total) parsed = expanded;
              }
            }
            if (needNtl) {
              var ntlRich = evaluateNtlRichness(parsed, ntlTypes, { tabooTypes: NTL_TABOO_TYPES });
              if (!ntlRich.ok) {
                var ntlExpandPrompt = buildNtlExpandSystemPrompt(ntlTypes, { tabooTypes: NTL_TABOO_TYPES })
                  + '\n\n' + buildNtlExpandUserPrompt({
                    weakDimensions: ntlRich.weakDimensions,
                    minChars: ntlRich.minChars,
                    ntlHint: buildNtlTabooHint(state),
                    context: live.type + ' | ' + live.name,
                    text: JSON.stringify(parsed),
                  })
                  + '\n请输出加厚后的完整 JSON 实体，写满 attrs.ntl。';
                var ntlExpandText = await ctx.callAI(ntlExpandPrompt, null, task.signal);
                var ntlExpanded = parseJsonLoose(ntlExpandText);
                var ntlRich2 = evaluateNtlRichness(ntlExpanded, ntlTypes, { tabooTypes: NTL_TABOO_TYPES });
                if (ntlRich2.total >= ntlRich.total) parsed = ntlExpanded;
              }
            }
            if (needVessel) {
              var vRich = evaluateVesselRichness(parsed, vOpts);
              if (!vRich.ok) {
                var vExpandPrompt = buildVesselExpandSystemPrompt(vOpts)
                  + '\n\n' + buildVesselExpandUserPrompt({
                    weakDimensions: vRich.weakDimensions,
                    minChars: vRich.minChars,
                    vesselHint: buildVesselHintForState(state),
                    context: live.type + ' | ' + live.name,
                    text: JSON.stringify(parsed),
                  })
                  + '\n请输出加厚后的完整 JSON 实体，写满 attrs.adult（含 powerLogic/vesselKind/costOrRisk/relatedPersons）。';
                var vExpandText = await ctx.callAI(vExpandPrompt, null, task.signal);
                var vExpanded = parseJsonLoose(vExpandText);
                var vRich2 = evaluateVesselRichness(vExpanded, vOpts);
                if (vRich2.total >= vRich.total) parsed = vExpanded;
              }
            }
            if (live.type === 'person') {
              var vesselList = listVesselEntities(state.entities);
              var mention = personMentionsVessels(JSON.stringify(parsed), vesselList);
              if (mention.missing) {
                var avail = vesselList.map(function(v) { return v.name; }).filter(Boolean).slice(0, 10).join('、');
                var hookPrompt = '你是角色卡编辑。下文未点名已有世界观成人载体，请改写使人物与至少一件载体产生互动（持有/被施加/惧怕/渴望），保持 JSON 结构。\n'
                  + '可用载体：' + avail
                  + '\n\n' + JSON.stringify(parsed);
                try {
                  var hookText = await ctx.callAI(hookPrompt, null, task.signal);
                  var hooked = parseJsonLoose(hookText);
                  if (hooked && (hooked.name || hooked.type || hooked.attrs || hooked.NSFW_information)) {
                    parsed = hooked;
                  }
                } catch (hookErr) {
                  if (ctx.isTrackedAbort(hookErr)) throw hookErr;
                }
              }
            }
            applyEnrichResult(state, live.id, parsed);
            done++;
            state.failedShards = (state.failedShards || []).filter(function(f) {
              return !(f.phase === 'enrich' && f.entityId === live.id);
            });
          } catch (e) {
            if (ctx.isTrackedAbort(e)) throw e;
            failed++;
            pushFailedShard({
              phase: 'enrich',
              entityId: live.id,
              label: live.name,
              error: String(e.message || e),
            });
          }
          panel.flushAnalyzePreview();
          if (window.__aiTaskCenter__ && task.id) {
            window.__aiTaskCenter__.setProgress(task.id, (i + 1) / queue.length, (i + 1) + '/' + queue.length);
          }
          if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '丰满 ' + (i + 1) + '/' + queue.length + ' | ' + live.name
            + (failed ? ' | 失败 ' + failed : ''));
        }
        if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '丰满完成 | ' + done + '/' + queue.length
          + (failed ? ' | 失败 ' + failed : ''));
        if (ctx.panels.characters && ctx.panels.characters.render) ctx.panels.characters.render();
        if (ctx.panels.worldbook && ctx.panels.worldbook.render) ctx.panels.worldbook.render();
        panel.render();
        return { enriched: done, total: queue.length, failed: failed };
      });
    } catch (e) {
      if (ctx.isTrackedAbort(e) && ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '⏹ 已取消丰满');
      throw e;
    } finally {
      ctx.busyFlags.analyzeEnrich = false;
      setActionBtnBusy(btn, false);
      if (ctx.updateExtractCallEstimates) ctx.updateExtractCallEstimates();
      if (ctx.refreshAnalyzeBusyUi) ctx.refreshAnalyzeBusyUi();
      else if (ctx.renderGatesFn) ctx.renderGatesFn();
      panel.render();
    }
  };

  panel.runRetryFailedShards = async function() {
    var state = ctx.state;
    var failed = (state.failedShards || []).slice();
    if (!failed.length) {
      if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '无失败项');
      return { retried: 0 };
    }
    var skIdx = failed.filter(function(f) { return f.phase === 'skeleton'; })
      .map(function(f) { return f.shardIndex; })
      .filter(function(i) { return typeof i === 'number'; });
    var enIds = failed.filter(function(f) { return f.phase === 'enrich' && f.entityId; })
      .map(function(f) { return f.entityId; });
    var out = { skeleton: null, enrich: null };
    if (skIdx.length) {
      out.skeleton = await panel.runAnalyzeSkeleton({ shardIndexes: skIdx, clearFailed: false });
    }
    if (enIds.length) {
      out.enrich = await panel.runAnalyzeEnrich({ ids: enIds, clearFailed: false });
    }
    if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '失败项重跑完成'
      + (skIdx.length ? ' | 骨架 ' + skIdx.length : '')
      + (enIds.length ? ' | 丰满 ' + enIds.length : ''));
    panel.render();
    return out;
  };

  panel.runAnalyzeRelations = async function() {
    var state = ctx.state;
    var g = gates();
    if (!g.canExtract) throw new Error((g.reasons || []).join('\n') || '前置未完成');
    if (!(state.entities || []).length) throw new Error('请先运行骨架扫描');
    var api = getApiConfig();
    var cardId = ctx.sm.getBoundCardId();
    ctx.busyFlags.analyzeRelations = true;
    if (ctx.refreshAnalyzeBusyUi) ctx.refreshAnalyzeBusyUi();
    else if (ctx.renderGatesFn) ctx.renderGatesFn();
    if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '关系补全中…');
    try {
      return await ctx.runTracked({
        type: 'novel_analyze_relations',
        title: '关系补全',
        target: '1 次',
      }, async function(task) {
        var adultOn = getAdultMode(state);
        var ntlOn = getNtlMode(state);
        // 按类型抽样实体名，避免检索全堆人名
        var byType = {};
        (state.entities || []).forEach(function(e) {
          if (!e || !e.name) return;
          var t = e.type || 'lore';
          if (!byType[t]) byType[t] = [];
          if (byType[t].length < 6) byType[t].push(e.name);
        });
        var sampleNames = Object.keys(byType).map(function(t) {
          return byType[t].join(' ');
        }).join(' ').trim();
        var search = await hybridSearch({
          chapters: state.chapters,
          query: boostAdultSearchQuery(sampleNames || '关系 事件 地点', adultOn, ntlOn),
          cardId: cardId,
          budget: state.expandBudget || 12000,
          apiUrl: api.apiUrl,
          apiKey: api.apiKey,
          embedModel: api.embedModel,
          signal: task.signal,
        });
        var prior = buildSkeletonPriorBlock(state);
        var inject = buildRagInjectBlock(search, state.entities.slice(0, 40), { entityBudget: RAG_ENTITY_BUDGET });
        var head = ctx.promptText('novelAnalyzeRelations', '补全 relations JSON');
        var user = head
          + prior
          + buildCrossTypeRelationHint()
          + buildAnalyzeFocusHint(state)
          + buildModeHintBlocks(state, 'relations')
          + (adultOn ? buildNsfwFlavorHint(state) : '')
          + (ntlOn ? buildNtlTabooHint(state) : '')
          + novelCanonBlock(state, '')
          + '\n\n' + inject
          + buildContentModeFlags(state)
          + '\nContext: ' + (state.contextText || '');
        var text = await ctx.callAI(user, null, task.signal);
        var parsed = parseJsonLoose(text);
        var st = applySkeletonResult(state, { relations: parsed.relations || parsed.edges || [] });
        panel.flushAnalyzePreview();
        if (ctx.setStatus) {
          ctx.setStatus(
            'novelAnalyzeStatus',
            '关系补全完成 | +' + st.relAdd
              + (st.relProjected ? ' · 结构边 +' + st.relProjected : '')
              + (st.relSkipped ? ' · 未解析 ' + st.relSkipped : '')
          );
        }
        return st;
      });
    } catch (e) {
      if (ctx.isTrackedAbort(e) && ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '⏹ 已取消关系补全');
      throw e;
    } finally {
      ctx.busyFlags.analyzeRelations = false;
      if (ctx.renderGatesFn) ctx.renderGatesFn();
    }
  };

  panel.runAnalyzeAll = async function() {
    var state = ctx.state;
    var $ = ctx.$;
    var g = gates();
    if (!g.canExtract) throw new Error((g.reasons || []).join('\n') || '前置未完成');
    var btn = $('btnNovelAnalyzeAll');
    ctx.busyFlags.analyzeAll = true;
    setActionBtnBusy(btn, true, '完整分析…');
    if (ctx.refreshAnalyzeBusyUi) ctx.refreshAnalyzeBusyUi();
    else if (ctx.renderGatesFn) ctx.renderGatesFn();
    try {
      clearFailedShards();
      if (isRagIndexStale()) {
        if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', 'Step0 | 建索引…');
        try {
          await panel.runBuildRagIndex({});
        } catch (e) {
          if (ctx.isTrackedAbort(e)) throw e;
          if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '向量索引失败，降级关键词…');
          await panel.runBuildRagIndex({ keywordOnly: true });
        }
      } else {
        if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', 'Step0 | 索引仍有效，跳过重建');
      }
      if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', 'Step1 | 骨架扫描…');
      await panel.runAnalyzeSkeleton();
      if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', 'Step2 | 实体丰满…');
      await panel.runAnalyzeEnrich({});
      if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', 'Step3 | 关系补全…');
      await panel.runAnalyzeRelations();
      if (ctx.setStatus) ctx.setStatus('novelAnalyzeStatus', '完整分析完成'
        + ((state.failedShards || []).length ? '（有 ' + state.failedShards.length + ' 项失败可重跑）' : ''));
      return {
        entityCount: (state.entities || []).length,
        relationCount: (state.relations || []).length,
        failed: (state.failedShards || []).length,
      };
    } finally {
      ctx.busyFlags.analyzeAll = false;
      setActionBtnBusy(btn, false);
      if (ctx.updateExtractCallEstimates) ctx.updateExtractCallEstimates();
      if (ctx.refreshAnalyzeBusyUi) ctx.refreshAnalyzeBusyUi();
      else if (ctx.renderGatesFn) ctx.renderGatesFn();
    }
  };


}
