/**
 * 人物面板：渲染、绑定、扫描、扩展、档案编辑
 */
import { buildExtractShards } from '../chapters.mjs';
import { buildRecallPayload, DEFAULT_EXPAND_BUDGET } from '../recall.mjs';
import {
  normalizeCharacterProfile,
  emptyCharacterProfile,
  profileContentDigest,
} from '../schema.mjs';
import {
  profileToCharacterFields,
  entityPersonToCharacterFields,
  profileToWorldbookDraft,
  entityPersonToWorldbookDraft,
} from '../sync.mjs';
import {
  getAdultMode,
  getNtlMode,
  boostAdultSearchQuery,
  extractStyleNsfwSection,
  buildModeHintBlocks,
  buildContentModeFlags,
  buildNsfwFlavorHint,
  buildNtlTabooHint,
  buildPaletteGuidanceBlock,
  getNsfwFlavorItems,
  evaluateFlavorRichness,
  buildFlavorExpandSystemPrompt,
  buildFlavorExpandUserPrompt,
  NSFW_FLAVOR_PRESETS,
  NTL_TABOO_TYPES,
  getNtlTabooTypes,
  evaluateNtlRichness,
  buildNtlExpandSystemPrompt,
  buildNtlExpandUserPrompt,
  buildAdultCanonDigest,
  ADULT_CANON_BUDGET,
  ADULT_RAG_BOOST_TERMS,
  NTL_RAG_BOOST_TERMS,
  resolveWorldframe,
  listVesselEntities,
  personMentionsVessels,
} from '../nsfwSupport.mjs';
import {
  upsertEntity,
  findEntityMatch,
  projectEntitiesToLegacy,
  ingestLegacyIntoEntities,
  isEntityEnriched,
} from '../entityStore.mjs';
import { uid, escapeHtml, parseJsonLoose, normalizeNameList } from '../../utils.mjs';

/**
 * @param {object} ctx — 小说工坊上下文（由 shared/context.mjs 创建，含 $、save、busyFlags 等）
 */

/**
 * attachNovelCharactersScanBind（拆自原模块）
 */
export function attachNovelCharactersScanBind(ctx, panel) {
  function formatPriorCharScanRef(chars) {
    if (!chars || !chars.length) return '';
    var lines = chars.map(function(c) {
      var alias = (c.aliases || []).length ? ' aliases=' + c.aliases.join('/') : '';
      return '- ' + c.name + alias + (c.note ? ' · ' + String(c.note).substring(0, 300) : '');
    }).join('\n');
    return '\n【已扫描人物（勿重复同名；可补 aliases/identity，可完善说明）】\n' + lines;
  }

  /** await 人物扫描（逐步分片，每步注入已扫描参考并刷新列表预览）；侧栏任务中心可停 */
  panel.runScan = async function() {
    var state = ctx.state;
    var shards = buildExtractShards(state.chapters, ctx.charShardOpts ? ctx.charShardOpts() : {
      mode: state.charShardMode === 'chapters' ? 'chapters' : 'chars',
      chunkSize: state.charChunkSize || state.chunkSize || 8000,
      chaptersPerShard: state.charChaptersPerShard || 1,
    });
    if (!shards.length) throw new Error('无启用章节文本可扫描');
    ctx.setStatus('novelCharStatus', '逐步扫描人物中（约 ' + shards.length + ' 次）...');
    var scanBtn = ctx.$('btnCharScan');
    ctx.busyFlags.charScan = true;
    if (ctx.engineBegin) ctx.engineBegin('novel.char.scan');
    ctx.setBtnBusy(scanBtn, true, '扫描中…');
    try {
      return await ctx.runTracked({
        type: 'novel_char_scan',
        title: '人物扫描',
        target: shards.length + ' 次',
      }, async function(task) {
        var head = ctx.promptText(
          'novelCharScan',
          '从文本中抽取出场人物与别名。只输出 JSON：{ "characters": [ { "name": "准确称呼", "aliases": ["别名"], "identity": "一句话身份", "stage": "" } ] }。不要虚构路人。'
        );
        var scanAccum = (state.characters || []).map(function(c) {
          return { name: c.name, aliases: (c.aliases || []).slice(), note: c.note || '', hits: c.hits || 0 };
        });

        function upsertScanHit(item) {
          if (!item || !item.name) return;
          var name = String(item.name || item.Chinese_name || '').trim();
          if (!name) return;
          var note = item.identity || '';
          if (state.splitByStage && item.stage) {
            name = name + '（' + item.stage + '）';
            note = (item.stage + ' · ') + note;
          }
          var aliases = normalizeNameList(name, item.aliases);
          var existing = scanAccum.find(function(c) { return c.name === name; });
          if (existing) {
            existing.hits = (existing.hits || 0) + 1;
            if (note && (!existing.note || String(note).length > String(existing.note).length)) {
              existing.note = note;
            }
            existing.aliases = Array.from(new Set((existing.aliases || []).concat(aliases)));
          } else {
            scanAccum.push({
              name: name,
              aliases: aliases,
              note: note,
              hits: 1,
            });
          }
        }

        function flushScanPreview() {
          scanAccum.forEach(function(hit) {
            var existing = state.characters.find(function(c) { return c.name === hit.name; });
            if (existing) {
              existing.hits = Math.max(existing.hits || 0, hit.hits || 0);
              if (hit.note && (!existing.note || String(hit.note).length > String(existing.note || '').length)) {
                existing.note = hit.note;
              }
              existing.aliases = Array.from(new Set((existing.aliases || []).concat(hit.aliases || [])));
            } else {
              state.characters.push({
                id: uid('char'),
                name: hit.name,
                aliases: hit.aliases || [],
                note: hit.note || '',
                hits: hit.hits || 1,
                selected: false,
                profile: null,
                syncStatus: 'unsynced',
              });
            }
          });
          ingestLegacyIntoEntities(state, 'legacy_scan');
          projectEntitiesToLegacy(state);
          ctx.save();
          ctx.renderAll();
        }

        for (var idx = 0; idx < shards.length; idx++) {
          if (task.signal && task.signal.aborted) throw new DOMException('已取消', 'AbortError');
          var shard = shards[idx];
          var priorRef = formatPriorCharScanRef(scanAccum);
          var user = head
            + priorRef
            + '\nMode: ' + state.narrativeMode
            + '\n需要身份说明: ' + (!!state.scanWithIdentity)
            + '\n按阶段拆分: ' + (!!state.splitByStage)
            + '\nContext: ' + (state.contextText || '')
            + '\n【章节 ' + shard.chapterTitle + (shard.part > 1 ? ' · 片' + shard.part : '') + '】\n' + shard.text;
          try {
            var text = await ctx.callAI(user, null, task.signal);
            var parsed = parseJsonLoose(text);
            (parsed.characters || []).forEach(upsertScanHit);
          } catch (e) {
            if (ctx.isTrackedAbort(e)) throw e;
          }
          flushScanPreview();
          if (window.__aiTaskCenter__ && task.id) {
            window.__aiTaskCenter__.setProgress(task.id, (idx + 1) / shards.length, (idx + 1) + '/' + shards.length);
          }
          ctx.setStatus('novelCharStatus', '扫描中 ' + (idx + 1) + '/' + shards.length + ' · 已发现 ' + state.characters.length + ' 人');
        }

        ctx.setStatus('novelCharStatus', '扫描完成，当前 ' + state.characters.length + ' 人（' + shards.length + ' 步）');
        return { characterCount: state.characters.length, shardsScanned: shards.length };
      });
    } catch (e) {
      if (ctx.isTrackedAbort(e)) ctx.setStatus('novelCharStatus', '⏹ 已取消扫描');
      throw e;
    } finally {
      ctx.busyFlags.charScan = false;
      if (ctx.engineEnd) ctx.engineEnd('novel.char.scan');
      ctx.setBtnBusy(scanBtn, false);
      if (ctx.updateExtractCallEstimates) ctx.updateExtractCallEstimates();
      if (ctx.renderGatesFn) ctx.renderGatesFn();
    }
  };

  panel.bind = function() {
    var state = ctx.state;
    var addBtn = ctx.$('btnCharAdd');
    if (addBtn) addBtn.addEventListener('click', function() {
      var input = ctx.$('novelCharManual');
      var raw = input ? input.value : '';
      var names = String(raw).split(/[,，、\s]+/).map(function(s) { return s.trim(); }).filter(Boolean);
      panel.addCharactersByNames(names, '手动添加');
      if (input) input.value = '';
      ctx.save();
      ctx.renderAll();
    });

    var scanBtn = ctx.$('btnCharScan');
    if (scanBtn) scanBtn.addEventListener('click', function() {
      var state = ctx.state;
      var modeEl = ctx.$('novelCharShardMode');
      var chunk = ctx.$('novelCharChunkSize');
      var perCh = ctx.$('novelCharChaptersPerShard');
      var policy = ctx.$('novelCharConflictPolicy');
      var idCheck = ctx.$('novelScanIdentity');
      var stage = ctx.$('novelSplitStage');
      if (modeEl) modeEl.value = state.charShardMode === 'chapters' ? 'chapters' : 'chars';
      if (chunk) chunk.value = String(state.charChunkSize || 8000);
      if (perCh) perCh.value = String(state.charChaptersPerShard || 1);
      if (policy) policy.value = state.conflictPolicy || 'merge';
      if (idCheck) idCheck.checked = !!state.scanWithIdentity;
      if (stage) stage.checked = !!state.splitByStage;
      if (ctx.syncShardModeUi) ctx.syncShardModeUi('novelChar', state.charShardMode);
      if (ctx.updateExtractCallEstimates) ctx.updateExtractCallEstimates();
      ctx.openNovelModal('novelModalCharScan');
    });
    var scanConfirm = ctx.$('btnCharScanConfirm');
    if (scanConfirm) scanConfirm.addEventListener('click', async function() {
      if (ctx.busyFlags.charScan) return;
      ctx.closeNovelModal('novelModalCharScan');
      try {
        await panel.runScan();
      } catch (e) {
        if (!ctx.isTrackedAbort(e)) {
          alert('扫描失败: ' + e.message);
          ctx.setStatus('novelCharStatus', '扫描失败');
        }
      }
    });

    var mergeBtn = ctx.$('btnCharMerge');
    if (mergeBtn) mergeBtn.addEventListener('click', function() {
      var sel = state.characters.filter(function(c) { return c.selected; });
      if (sel.length < 2) return alert('请选择至少两个角色合并');
      var primary = sel[0];
      var aliases = (primary.aliases || []).slice();
      var dropEntIds = {};
      sel.slice(1).forEach(function(c) {
        aliases.push(c.name);
        (c.aliases || []).forEach(function(a) { if (aliases.indexOf(a) < 0) aliases.push(a); });
        primary.hits = (primary.hits || 0) + (c.hits || 0);
        var de = panel.findPersonEntityForChar(c);
        if (de) dropEntIds[de.id] = true;
      });
      primary.aliases = aliases;
      var drop = {};
      sel.slice(1).forEach(function(c) { drop[c.id] = true; });
      state.characters = state.characters.filter(function(c) { return !drop[c.id]; });
      primary.selected = false;
      if (!state.entities) state.entities = [];
      upsertEntity(state.entities, {
        type: 'person',
        name: primary.name,
        aliases: primary.aliases,
        summary: primary.note || '',
        attrs: primary.profile ? { profile: primary.profile } : {},
      }, { source: 'manual' });
      if (Object.keys(dropEntIds).length) {
        var keep = panel.findPersonEntityForChar(primary);
        state.entities = (state.entities || []).filter(function(e) {
          return !dropEntIds[e.id] || (keep && e.id === keep.id);
        });
        state.relations = (state.relations || []).map(function(r) {
          var from = dropEntIds[r.fromId] && keep ? keep.id : r.fromId;
          var to = dropEntIds[r.toId] && keep ? keep.id : r.toId;
          return Object.assign({}, r, { fromId: from, toId: to });
        });
      }
      projectEntitiesToLegacy(state);
      ctx.save();
      ctx.renderAll();
    });

    var clearBtn = ctx.$('btnCharClear');
    if (clearBtn) clearBtn.addEventListener('click', function() {
      if (!confirm('清空人物列表？')) return;
      state.characters = [];
      state.entities = (state.entities || []).filter(function(e) { return e.type !== 'person'; });
      state.relations = (state.relations || []).filter(function(r) {
        var ids = {};
        (state.entities || []).forEach(function(e) { ids[e.id] = true; });
        return ids[r.fromId] && ids[r.toId];
      });
      ctx.save();
      ctx.renderAll();
    });

    var enrichSel = ctx.$('btnCharEnrichSelected');
    if (enrichSel) enrichSel.addEventListener('click', async function() {
      var ids = state.characters.filter(function(c) { return c.selected; }).map(function(c) {
        var ent = panel.findPersonEntityForChar(c);
        return ent ? ent.id : '';
      }).filter(Boolean);
      if (!ids.length) return alert('请先勾选已有实体的人物（建议先跑小说分析）');
      try {
        await ctx.panels.analyze.runAnalyzeEnrich({ ids: ids, skipConfirm: true, sourceBtn: enrichSel });
      } catch (e) {
        if (!ctx.isTrackedAbort(e)) alert('丰满失败: ' + (e.message || e));
      }
    });

    var idCheck = ctx.$('novelScanIdentity');
    if (idCheck) idCheck.addEventListener('change', function() {
      state.scanWithIdentity = idCheck.checked;
      ctx.save();
    });
    var stage = ctx.$('novelSplitStage');
    if (stage) stage.addEventListener('change', function() {
      state.splitByStage = stage.checked;
      ctx.save();
    });
    var charMode = ctx.$('novelCharShardMode');
    if (charMode) charMode.addEventListener('change', function() {
      state.charShardMode = charMode.value === 'chapters' ? 'chapters' : 'chars';
      if (ctx.syncShardModeUi) ctx.syncShardModeUi('novelChar', state.charShardMode);
      ctx.save();
      if (ctx.updateExtractCallEstimates) ctx.updateExtractCallEstimates();
    });
    var charChunk = ctx.$('novelCharChunkSize');
    if (charChunk) charChunk.addEventListener('change', function() {
      state.charChunkSize = parseInt(charChunk.value, 10) || 8000;
      ctx.save();
      if (ctx.updateExtractCallEstimates) ctx.updateExtractCallEstimates();
    });
    var charPer = ctx.$('novelCharChaptersPerShard');
    if (charPer) {
      charPer.addEventListener('change', function() {
        state.charChaptersPerShard = Math.max(1, Math.floor(parseInt(charPer.value, 10) || 1));
        charPer.value = String(state.charChaptersPerShard);
        ctx.save();
        if (ctx.updateExtractCallEstimates) ctx.updateExtractCallEstimates();
      });
      charPer.addEventListener('input', function() {
        state.charChaptersPerShard = Math.max(1, Math.floor(parseInt(charPer.value, 10) || 1));
        if (ctx.updateExtractCallEstimates) ctx.updateExtractCallEstimates();
      });
    }
    var charPolicy = ctx.$('novelCharConflictPolicy');
    if (charPolicy) charPolicy.addEventListener('change', function() {
      state.conflictPolicy = charPolicy.value;
      ctx.save();
      if (ctx.panels.style) ctx.panels.style.render();
      if (ctx.panels.worldbook) ctx.panels.worldbook.render();
    });

    var charSearchInput = ctx.$('novelCharSearchInput');
    var charSearchClear = ctx.$('novelCharSearchClear');
    if (charSearchInput) {
      charSearchInput.addEventListener('input', function() {
        ctx.editState.novelCharSearchQuery = charSearchInput.value || '';
        panel.render();
      });
    }
    if (charSearchClear) charSearchClear.addEventListener('click', function() {
      ctx.editState.novelCharSearchQuery = '';
      if (charSearchInput) charSearchInput.value = '';
      panel.render();
    });

    var syncChars = ctx.$('btnSyncCharsSelected');
    if (syncChars) syncChars.addEventListener('click', function() {
      try {
        // 与世界书管道合一：人物只进世界书，不进主角
        var r = ctx.syncOutputs({ target: 'character_worldbook', selected: true });
        ctx.setStatus(
          'novelCharStatus',
          '人物→世界书：新增 ' + (r.added || 0) + ' / 更新 ' + (r.updated || 0) + ' / 跳过 ' + (r.skipped || 0)
        );
      } catch (e) {
        alert(e.message || '同步失败');
      }
    });
    var syncCharsWb = ctx.$('btnSyncCharsWb');
    if (syncCharsWb) syncCharsWb.addEventListener('click', function() {
      try {
        var r = ctx.syncOutputs({ target: 'character_worldbook', selected: true });
        ctx.setStatus('novelCharStatus', '人物→世界书：新增 ' + r.added + ' / 更新 ' + r.updated + ' / 跳过 ' + r.skipped);
      } catch (e) {
        alert(e.message || '同步失败');
      }
    });

    var saveProfile = ctx.$('btnNovelProfileSave');
    if (saveProfile) saveProfile.addEventListener('click', function() {
      if (!ctx.editState.editingCharId) return;
      var ch = state.characters.find(function(c) { return c.id === ctx.editState.editingCharId; });
      if (!ch) return;
      try {
        var aliasesEl = ctx.$('novelCharAliases');
        var jsonEl = ctx.$('novelCharProfileJson');
        ch.aliases = String(aliasesEl && aliasesEl.value || '')
          .split(/[,，、]/).map(function(s) { return s.trim(); }).filter(Boolean);
        ch.profile = normalizeCharacterProfile(JSON.parse(jsonEl.value), ch.name);
        ch.syncStatus = ch.syncStatus === 'synced' ? 'dirty' : 'unsynced';
        ch.note = '档案已编辑';
        if (!state.entities) state.entities = [];
        upsertEntity(state.entities, {
          type: 'person',
          name: ch.name,
          aliases: ch.aliases,
          summary: ch.note,
          attrs: { profile: ch.profile },
          content: profileContentDigest(ch.profile, ch.name),
        }, { source: 'manual' });
        var savedEnt = panel.findPersonEntityForChar(ch);
        if (savedEnt) savedEnt.syncStatus = ch.syncStatus;
        projectEntitiesToLegacy(state);
        ctx.save();
        ctx.renderAll();
        ctx.closeNovelModal('novelModalProfile');
        ctx.setStatus('novelCharStatus', '已保存「' + ch.name + '」档案');
      } catch (e) {
        alert('JSON 无效: ' + e.message);
      }
    });
  };

  // 挂载到 ctx

}
