import { buildExtractShards, estimateExtractCalls } from '../chapters.mjs';
import { buildRecallPayload, DEFAULT_EXPAND_BUDGET } from '../recall.mjs';
import { findEntityMatch, upsertEntity, projectEntitiesToLegacy, isEntityEnriched, ingestLegacyIntoEntities } from '../entityStore.mjs';
import { applyDraftsToWorldbook } from '../sync.mjs';
import { mergeWbExtractEntry, normalizeNameList } from './worldbookExtractUtil.mjs';
import { parseJsonLoose } from '../../utils.mjs';
import {
  getAdultMode, getNtlMode, buildModeHintBlocks, buildContentModeFlags,
  buildNsfwFlavorHint, getNsfwFlavorItems, evaluateFlavorRichness,
  buildFlavorExpandSystemPrompt, buildFlavorExpandUserPrompt, NSFW_FLAVOR_PRESETS,
  getNtlTabooTypes, buildNtlTabooHint, evaluateNtlRichness,
  buildNtlExpandSystemPrompt, buildNtlExpandUserPrompt,
  buildAdultCanonDigest, ADULT_CANON_BUDGET, resolveWorldframe,
  evaluateVesselRichness, buildVesselExpandSystemPrompt, buildVesselExpandUserPrompt,
  buildVesselHintForState,
} from '../nsfwSupport.mjs';
import { PRIOR_WB_EXTRACT_PER, RAG_ENTITY_BUDGET, ENTITY_SUMMARY_STORE } from '../contextBudgets.mjs';
import { formatPriorWbExtractRef } from './worldbookExtractUtil.mjs';

/**
 * attachNovelWorldbookAi（拆自原模块）
 */
export function attachNovelWorldbookAi(ctx, panel) {
  // ---- AI 扩展 ----

  function wbShardOpts() {
    var state = ctx.state;
    return {
      mode: state.wbShardMode === 'chapters' ? 'chapters' : 'chars',
      chunkSize: state.wbChunkSize || state.chunkSize || 8000,
      chaptersPerShard: state.wbChaptersPerShard || 1,
    };
  }

  panel.expandWbEntry = async function(indexOrOpts, opts) {
    var state = ctx.state;
    var options = opts || {};
    var index = typeof indexOrOpts === 'number' ? indexOrOpts : Number(indexOrOpts && indexOrOpts.index);
    if (indexOrOpts && typeof indexOrOpts === 'object' && indexOrOpts.index == null && indexOrOpts.name) {
      options = Object.assign({}, options, indexOrOpts);
      index = (state.wbEntries || []).findIndex(function(e) {
        return e.name === indexOrOpts.name || e.comment === indexOrOpts.name;
      });
    }
    var g = ctx.gates ? ctx.gates() : { canExtract: false, reasons: ['未就绪'] };
    if (!g.canExtract) {
      var reason = (g.reasons || []).join('\n') || '前置未完成';
      if (!options.silent) alert(reason);
      throw new Error(reason);
    }
    var entry = state.wbEntries && state.wbEntries[index];
    if (!entry) throw new Error('世界书条目未找到');
    var mode = options.mode || 'expand';
    var matchName = entry.name || entry.comment || '';
    var matchKeys = Array.isArray(entry.keys) ? entry.keys.slice() : [];
    var adultWbExp = getAdultMode(state);
    var ntlWbExp = getNtlMode(state);
    if (adultWbExp) {
      ADULT_RAG_BOOST_TERMS.forEach(function(t) {
        if (matchKeys.indexOf(t) < 0) matchKeys.push(t);
      });
    }
    if (ntlWbExp) {
      NTL_RAG_BOOST_TERMS.forEach(function(t) {
        if (matchKeys.indexOf(t) < 0) matchKeys.push(t);
      });
    }
    if (ctx.setStatus) ctx.setStatus('novelWbStatus', '正在为「' + matchName + '」匹配原文…');
    var recall = buildRecallPayload(
      state.chapters,
      matchName,
      matchKeys,
      state.expandBudget || DEFAULT_EXPAND_BUDGET,
      180
    );
    if (!recall.snippetCount) {
      var miss = '未在启用章节中匹配到「' + matchName + '」及其触发词';
      if (ctx.setStatus) ctx.setStatus('novelWbStatus', '未命中原文');
      if (!options.silent) alert(miss);
      throw new Error(miss);
    }
    var ok = await ctx.confirmExpandRecall({
      title: '世界书 AI 扩展 · ' + matchName,
      body: recall.body,
      totalChars: recall.totalChars,
      snippetCount: recall.snippetCount,
      truncated: recall.truncated,
      terms: recall.terms,
      silent: options.silent,
      skipConfirm: options.skipConfirm,
    });
    if (!ok) {
      if (ctx.setStatus) ctx.setStatus('novelWbStatus', '已取消「' + matchName + '」扩展');
      throw new DOMException('已取消', 'AbortError');
    }
    var expandBtn = document.querySelector('[data-wb-expand="' + index + '"]');
    var expandOld = expandBtn ? expandBtn.innerHTML : '';
    if (expandBtn) {
      expandBtn.disabled = true;
      expandBtn.innerHTML = '…';
    }
    try {
      return await ctx.runTracked({
        type: 'novel_wb_expand',
        title: mode === 'rewrite' ? '世界书条目 AI 重写' : '世界书条目 AI 扩展',
        target: matchName,
      }, async function(task) {
        if (ctx.setStatus) ctx.setStatus('novelWbStatus', '正在扩写「' + matchName + '」…');
        var head = ctx.promptText(
          'novelWbExpand',
          '你是小说世界书扩写专家。仅根据原文片段扩写条目描述，禁止臆造。只输出 JSON：{ "name", "content", "keys" }'
        );
        var modeHint = mode === 'rewrite'
          ? '\n【模式】重写：依据原文重建内容，可大幅改写。'
          : '\n【模式】扩写：在已有内容上补全细节，保留可靠事实。';
        var adultOn = getAdultMode(state);
        var flavorItems = adultOn ? getNsfwFlavorItems(state) : [];
        var ntlTypes = getNtlMode(state) ? getNtlTabooTypes(state) : [];
        var user = head
          + modeHint
          + (options.instruction ? '\n【用户要求】' + options.instruction : '')
          + buildModeHintBlocks(state, 'expand')
          + (flavorItems.length ? buildNsfwFlavorHint(state) : '')
          + (ntlTypes.length ? buildNtlTabooHint(state) : '')
          + buildAdultCanonDigest({
            entities: state.entities,
            worldbookEntries: (state.wbEntries || []).map(function(e) {
              return {
                comment: e.comment || ('[小说' + (e.category || 'setting') + '] ' + e.name),
                content: e.content || '',
              };
            }),
            styleText: state.styleText,
            focusName: matchName,
            budget: ADULT_CANON_BUDGET,
            worldframeLabel: resolveWorldframe(state).label,
          })
          + '\n条目标题: ' + matchName
          + '\n类别: ' + (entry.category || 'setting')
          + '\n现有触发词: ' + matchKeys.join('、')
          + (entry.content && mode !== 'rewrite' ? '\n【现有内容】\n' + entry.content : '')
          + (entry.attrs ? '\n【现有 attrs】\n' + JSON.stringify(entry.attrs) : '')
          + buildContentModeFlags(state)
          + '\nContext: ' + (state.contextText || '')
          + '\n召回 tokens: ' + recall.totalChars + (recall.truncated ? '（已抽样截断）' : '')
          + '\n匹配词: ' + recall.terms.join('、')
          + '\n\n【原文片段】\n' + recall.body
          + '\n\n请输出 JSON（AdultMode 时含 attrs.adult；NtlMode 时可含 attrs.ntl；已选口味/禁忌时 content/attrs 须写透必写维度）。';
        var text = await ctx.callAI(user, null, task.signal);
        var json = parseJsonLoose(text);
        if (flavorItems.length) {
          var probe = {
            content: json.content || entry.content || '',
            attrs: json.attrs || entry.attrs || {},
          };
          var richness = evaluateFlavorRichness(probe, flavorItems, { presets: NSFW_FLAVOR_PRESETS });
          if (!richness.ok) {
            var expandPrompt = buildFlavorExpandSystemPrompt(flavorItems, { presets: NSFW_FLAVOR_PRESETS })
              + '\n\n' + buildFlavorExpandUserPrompt({
                weakDimensions: richness.weakDimensions,
                minChars: richness.minChars,
                flavorHint: buildNsfwFlavorHint(state),
                context: matchName + ' · ' + (entry.category || 'setting'),
                text: JSON.stringify(json),
              })
              + '\n请输出 JSON：{ "name", "content", "keys", "attrs"? }';
            var expandText = await ctx.callAI(expandPrompt, null, task.signal);
            var expanded = parseJsonLoose(expandText);
            var richness2 = evaluateFlavorRichness({
              content: expanded.content || '',
              attrs: expanded.attrs || {},
            }, flavorItems, { presets: NSFW_FLAVOR_PRESETS });
            if (richness2.total >= richness.total) json = Object.assign({}, json, expanded);
          }
        }
        if (ntlTypes.length) {
          var ntlProbe = {
            content: json.content || entry.content || '',
            attrs: json.attrs || entry.attrs || {},
          };
          var ntlRich = evaluateNtlRichness(ntlProbe, ntlTypes, { tabooTypes: NTL_TABOO_TYPES });
          if (!ntlRich.ok) {
            var ntlExpandPrompt = buildNtlExpandSystemPrompt(ntlTypes, { tabooTypes: NTL_TABOO_TYPES })
              + '\n\n' + buildNtlExpandUserPrompt({
                weakDimensions: ntlRich.weakDimensions,
                minChars: ntlRich.minChars,
                ntlHint: buildNtlTabooHint(state),
                context: matchName + ' · ' + (entry.category || 'setting'),
                text: JSON.stringify(json),
              })
              + '\n请输出 JSON：{ "name", "content", "keys", "attrs"? }（含加厚 attrs.ntl）';
            var ntlExpandText = await ctx.callAI(ntlExpandPrompt, null, task.signal);
            var ntlExpanded = parseJsonLoose(ntlExpandText);
            var ntlRich2 = evaluateNtlRichness({
              content: ntlExpanded.content || '',
              attrs: ntlExpanded.attrs || {},
            }, ntlTypes, { tabooTypes: NTL_TABOO_TYPES });
            if (ntlRich2.total >= ntlRich.total) json = Object.assign({}, json, ntlExpanded);
          }
        }
        if (adultOn || getNtlMode(state)) {
          var cat = String(entry.category || 'setting');
          if (cat === 'item' || cat === 'location' || cat === 'nsfw' || cat === 'faction'
            || cat === 'setting' || cat === 'worldview' || cat === 'history') {
            var vOpts = {
              worldframe: resolveWorldframe(state).id,
              flavorItems: flavorItems,
              ntlItems: ntlTypes.map(function(id) { return { id: id }; }),
            };
            var vProbe = {
              type: cat === 'nsfw' ? 'nsfw' : (cat === 'item' ? 'item' : 'lore'),
              name: matchName,
              content: json.content || entry.content || '',
              attrs: json.attrs || entry.attrs || {},
            };
            var vRich = evaluateVesselRichness(vProbe, vOpts);
            if (!vRich.ok) {
              var vExpandPrompt = buildVesselExpandSystemPrompt(vOpts)
                + '\n\n' + buildVesselExpandUserPrompt({
                  weakDimensions: vRich.weakDimensions,
                  minChars: vRich.minChars,
                  vesselHint: buildVesselHintForState(state),
                  context: matchName + ' · ' + cat,
                  text: JSON.stringify(json),
                })
                + '\n请输出 JSON：{ "name", "content", "keys", "attrs"? }（attrs.adult 须含 vesselKind/powerLogic/costOrRisk/relatedPersons）';
              var vExpandText = await ctx.callAI(vExpandPrompt, null, task.signal);
              var vExpanded = parseJsonLoose(vExpandText);
              var vRich2 = evaluateVesselRichness({
                content: vExpanded.content || '',
                attrs: vExpanded.attrs || {},
              }, vOpts);
              if (vRich2.total >= vRich.total) json = Object.assign({}, json, vExpanded);
            }
          }
        }
        if (json.name) entry.name = String(json.name).trim() || entry.name;
        if (json.content) entry.content = String(json.content);
        if (Array.isArray(json.keys) && json.keys.length) {
          entry.keys = json.keys.map(function(k) { return String(k).trim(); }).filter(Boolean);
        }
        if (json.attrs && typeof json.attrs === 'object') {
          entry.attrs = Object.assign({}, entry.attrs || {}, json.attrs);
          if (json.attrs.adult) {
            entry.attrs.adult = mergeAdultAttrs(entry.attrs.adult, json.attrs.adult);
          }
        }
        entry.comment = '[小说' + (entry.category || 'setting') + '] ' + entry.name;
        entry.syncStatus = entry.syncStatus === 'synced' ? 'dirty' : (entry.syncStatus || 'unsynced');
        if (!state.entities) state.entities = [];
        var wbType = wbCategoryToEntityType(entry.category);
        upsertEntity(state.entities, {
          type: wbType === 'nsfw' ? 'nsfw' : wbType,
          name: entry.name,
          content: entry.content,
          keys: entry.keys,
          summary: String(entry.content || '').slice(0, ENTITY_SUMMARY_STORE),
          attrs: entry.attrs || {},
          layer: entry.layer,
        }, { source: 'expand' });
        projectEntitiesToLegacy(state);
        ctx.save();
        ctx.renderAll();
        if (ctx.setStatus) ctx.setStatus('novelWbStatus', '「' + entry.name + '」扩展完成（召回 ' + recall.totalChars + ' tok）');
        return { index: index, name: entry.name, mode: mode, recallChars: recall.totalChars };
      });
    } catch (e) {
      if (!ctx.isTrackedAbort(e)) {
        if (ctx.setStatus) ctx.setStatus('novelWbStatus', '扩展失败: ' + e.message);
        if (!options.silent) alert('AI 扩展失败: ' + e.message);
      } else {
        if (ctx.setStatus) ctx.setStatus('novelWbStatus', '已取消「' + matchName + '」扩展');
      }
      throw e;
    } finally {
      if (expandBtn) {
        expandBtn.disabled = false;
        expandBtn.innerHTML = expandOld || '✦';
      }
    }
  };

  // ---- AI 抽取 ----

  panel.runExtractWorldbook = async function() {
    var state = ctx.state;
    var $ = ctx.$;
    var g = ctx.gates ? ctx.gates() : { canExtract: false, reasons: ['未就绪'] };
    if (!g.canExtract) throw new Error((g.reasons || []).join('\n') || '前置未完成');
    if (!(state.wbFocus || []).length) throw new Error('请至少勾选一类内容');
    var shards = buildExtractShards(state.chapters, wbShardOpts());
    if (!shards.length) throw new Error('无启用章节文本可抽取');
    if (ctx.setStatus) ctx.setStatus('novelWbStatus', '逐步抽取世界书中（约 ' + shards.length + ' 次）...');
    var queue = $('novelWbQueue');
    if (queue) queue.style.display = 'block';
    var extractBtn = $('btnWbExtract');
    ctx.busyFlags.wbExtract = true;
    if (ctx.engineBegin) ctx.engineBegin('novel.wb.extract');
    ctx.setBtnBusy(extractBtn, true, '抽取中…');
    try {
      return await ctx.runTracked({
        type: 'novel_wb_extract',
        title: '世界书条目抽取',
        target: shards.length + ' 次 · ' + ((state.wbFocus || []).join(',') || ''),
      }, async function(task) {
        var head = ctx.promptText(
          'novelWbExtract',
          '从小说片段抽取非人物世界书事实。禁止输出人物角色卡。keys 尽量挖全。只输出 JSON：{ "entries": [ { "category": "worldview|faction|location|setting|history|item|nsfw", "name": "...", "content": "...", "keys": ["..."], "layer": "green|blue" } ] }'
        );
        var all = (state.wbEntries || []).map(function(e) {
          return {
            category: e.category,
            name: e.name,
            content: e.content,
            keys: e.keys,
            layer: e.layer,
          };
        });

        function flushWbPreview() {
          var prevByKey = {};
          (state.wbEntries || []).forEach(function(e) {
            prevByKey[(e.category || 'setting') + '::' + e.name] = e;
          });
          state.wbEntries = all.map(function(e) {
            var k = (e.category || 'setting') + '::' + e.name;
            return toWbDraftEntry(e, prevByKey[k]);
          });
          ingestLegacyIntoEntities(state, 'legacy_wb');
          projectEntitiesToLegacy(state);
          ctx.save();
          ctx.renderAll();
        }

        for (var idx = 0; idx < shards.length; idx++) {
          if (task.signal && task.signal.aborted) throw new DOMException('已取消', 'AbortError');
          var shard = shards[idx];
          if (queue) queue.textContent = '进度 ' + (idx + 1) + '/' + shards.length + ' · 已 ' + all.length + ' 条';
          var priorRef = formatPriorWbExtractRef(all);
          var adultOn = getAdultMode(state);
          var extractFlavorItems = adultOn ? getNsfwFlavorItems(state) : [];
          var extractNtlTypes = getNtlMode(state) ? getNtlTabooTypes(state) : [];
          var user = head
            + priorRef
            + buildModeHintBlocks(state, 'extract')
            + (extractFlavorItems.length ? buildNsfwFlavorHint(state) : '')
            + (extractNtlTypes.length ? buildNtlTabooHint(state) : '')
            + buildAdultCanonDigest({
              entities: state.entities,
              worldbookEntries: (state.wbEntries || []).map(function(e) {
                return {
                  comment: e.comment || ('[小说' + (e.category || 'setting') + '] ' + e.name),
                  content: e.content || '',
                };
              }).concat(all.map(function(e) {
                return {
                  comment: '[小说' + (e.category || 'setting') + '] ' + e.name,
                  content: e.content || '',
                };
              })),
              styleText: state.styleText,
              budget: ADULT_CANON_BUDGET,
            })
            + '\nFocus: ' + (state.wbFocus || []).join(',')
            + buildContentModeFlags(state)
            + '\nMode: ' + state.narrativeMode
            + '\nContext: ' + (state.contextText || '')
            + '\n【章节 ' + shard.chapterTitle + (shard.part > 1 ? ' · 片' + shard.part : '') + '】\n' + shard.text;
          try {
            var text = await ctx.callAI(user, null, task.signal);
            var json = parseJsonLoose(text);
            (json.entries || []).forEach(function(e) { mergeWbExtractEntry(all, e); });
          } catch (e) {
            if (ctx.isTrackedAbort(e)) throw e;
          }
          flushWbPreview();
          if (window.__aiTaskCenter__ && task.id) {
            window.__aiTaskCenter__.setProgress(task.id, (idx + 1) / shards.length, (idx + 1) + '/' + shards.length);
          }
          if (ctx.setStatus) ctx.setStatus('novelWbStatus', '抽取中 ' + (idx + 1) + '/' + shards.length + ' · 已 ' + state.wbEntries.length + ' 条');
        }
        if (ctx.setStatus) ctx.setStatus('novelWbStatus', '已生成 ' + state.wbEntries.length + ' 条草稿（' + shards.length + ' 步）');
        return { draftCount: state.wbEntries.length, shardsScanned: shards.length };
      });
    } catch (e) {
      if (ctx.isTrackedAbort(e) && ctx.setStatus) ctx.setStatus('novelWbStatus', '⏹ 已取消抽取');
      throw e;
    } finally {
      ctx.busyFlags.wbExtract = false;
      if (ctx.engineEnd) ctx.engineEnd('novel.wb.extract');
      ctx.setBtnBusy(extractBtn, false);
      if (queue) queue.style.display = 'none';
      if (ctx.updateExtractCallEstimates) ctx.updateExtractCallEstimates();
      if (ctx.renderGatesFn) ctx.renderGatesFn();
    }
  };


}
