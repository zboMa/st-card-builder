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
  buildAdultContextDigests,
  extractStyleNsfwSection,
  buildModeHintBlocks,
  buildContentModeFlags,
  buildNsfwFlavorHint,
  buildNtlTabooHint,
  buildPaletteGuidanceBlock,
  ADULT_RAG_BOOST_TERMS,
  NTL_RAG_BOOST_TERMS,
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
export function registerCharacters(ctx) {
  var panel = {};

  panel.syncBadge = function(status) {
    var s = status || 'unsynced';
    var label = s === 'synced' ? '已同步' : (s === 'dirty' ? '有本地修改' : '未同步');
    return '<span class="novel-sync-badge ' + s + '">' + label + '</span>';
  };

  /** 按人物 id/名找实体 */
  panel.findPersonEntityForChar = function(ch) {
    if (!ch) return null;
    var state = ctx.state;
    var byId = (state.entities || []).find(function(e) { return e.id === ch.id && e.type === 'person'; });
    if (byId) return byId;
    return findEntityMatch(state.entities, ch.name, ch.aliases || []);
  };

  /** 按 id/名定位人物 */
  panel.findCharacter = function(target) {
    var state = ctx.state;
    var t = target || {};
    if (typeof t === 'string') t = { id: t, name: t };
    var id = t.id != null ? String(t.id) : '';
    var name = t.name != null ? String(t.name) : (t.titleMatch != null ? String(t.titleMatch) : '');
    if (id) {
      var byId = state.characters.find(function(c) { return c.id === id; });
      if (byId) return byId;
    }
    if (name) {
      var exact = state.characters.find(function(c) { return c.name === name; });
      if (exact) return exact;
      var q = name.toLowerCase();
      return state.characters.find(function(c) {
        return String(c.name || '').toLowerCase().indexOf(q) >= 0;
      }) || null;
    }
    return null;
  };

  panel.addCharactersByNames = function(names, note) {
    var state = ctx.state;
    if (!state.entities) state.entities = [];
    (names || []).forEach(function(raw) {
      var name = String(raw || '').trim();
      if (!name) return;
      if (state.characters.some(function(c) { return c.name === name; })) return;
      upsertEntity(state.entities, {
        type: 'person',
        name: name,
        aliases: [],
        summary: note || '',
      }, { source: 'manual' });
    });
    projectEntitiesToLegacy(state);
  };

  panel.render = function() {
    var state = ctx.state;
    var grid = ctx.$('novelCharGrid');
    var idCheck = ctx.$('novelScanIdentity');
    var stage = ctx.$('novelSplitStage');
    var modeEl = ctx.$('novelCharShardMode');
    var chunk = ctx.$('novelCharChunkSize');
    var perCh = ctx.$('novelCharChaptersPerShard');
    var policy = ctx.$('novelCharConflictPolicy');
    if (idCheck) idCheck.checked = !!state.scanWithIdentity;
    if (stage) stage.checked = !!state.splitByStage;
    if (modeEl) modeEl.value = state.charShardMode === 'chapters' ? 'chapters' : 'chars';
    if (chunk) chunk.value = String(state.charChunkSize || 8000);
    if (perCh) perCh.value = String(state.charChaptersPerShard || 1);
    if (ctx.syncShardModeUi) ctx.syncShardModeUi('novelChar', state.charShardMode);
    if (policy) policy.value = state.conflictPolicy || 'merge';
    if (!grid) return;
    if (!(state.characters || []).length) {
      grid.innerHTML = '<div class="novel-status-text">暂无人物。请先「小说分析」，或手动添加 / 扫描全书。</div>';
      return;
    }
    grid.innerHTML = state.characters.map(function(c) {
      var ent = panel.findPersonEntityForChar(c);
      var enriched = ent ? isEntityEnriched(ent, !!state.strictQuality, getAdultMode(state)) : !!c.profile;
      var note = c.note || (c.profile ? '已扩展' : '待扩展');
      var canSync = !!(c.profile || (ent && String(ent.content || ent.summary || '').trim()));
      var needExpand = !c.profile;
      return '<div class="novel-list-row" data-char-id="' + c.id + '">'
        + '<input type="checkbox" data-char-sel="' + c.id + '"' + (c.selected ? ' checked' : '') + ' />'
        + '<div class="novel-list-main">'
        + '<button type="button" class="novel-list-title" data-char-edit="' + c.id + '" title="查看/编辑档案">'
        + escapeHtml(c.name) + '</button>'
        + '<div>' + panel.syncBadge(c.syncStatus)
        + (enriched ? '' : ' <span class="novel-sync-badge unsynced">待丰满</span>')
        + '</div>'
        + '<div class="novel-list-meta">' + escapeHtml(note).slice(0, 80)
        + ' · 出现约 ' + (c.hits || 0) + ' 段'
        + (c.aliases && c.aliases.length ? ' · 别名 ' + escapeHtml(c.aliases.join('、')) : '')
        + '</div></div>'
        + '<div class="novel-list-actions">'
        + (canSync
          ? ctx.iconBtn('data-char-sync-wb="' + c.id + '"', '📖', '同步到世界书人物条')
          : '')
        + (ent
          ? ctx.iconBtn(
            'data-char-enrich="' + escapeHtml(ent.id) + '"',
            '✦',
            enriched ? '重新丰满' : 'AI 丰满',
            enriched ? '' : 'btn-ai-expand'
          )
          : ctx.iconBtn(
            'data-char-expand="' + c.id + '"',
            '✦',
            needExpand ? 'AI 扩展（未扩展）' : 'AI 重写',
            needExpand ? 'btn-ai-expand' : ''
          ))
        + ctx.iconBtn('data-char-edit="' + c.id + '"', '✎', '编辑档案')
        + ctx.iconBtn('data-char-del="' + c.id + '"', '×', '删除', 'is-danger')
        + '</div></div>';
    }).join('');

    grid.querySelectorAll('[data-char-sel]').forEach(function(cb) {
      cb.addEventListener('change', function() {
        var id = cb.getAttribute('data-char-sel');
        state.characters = state.characters.map(function(c) {
          return c.id === id ? Object.assign({}, c, { selected: cb.checked }) : c;
        });
        var ent = (state.entities || []).find(function(e) { return e.id === id; })
          || panel.findPersonEntityForChar(state.characters.find(function(c) { return c.id === id; }));
        if (ent) ent.selected = cb.checked;
        ctx.save();
      });
    });
    grid.querySelectorAll('[data-char-del]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (!confirm('确认删除该人物？')) return;
        var id = btn.getAttribute('data-char-del');
        var ch = state.characters.find(function(c) { return c.id === id; });
        var ent = panel.findPersonEntityForChar(ch);
        state.characters = state.characters.filter(function(c) { return c.id !== id; });
        if (ent) {
          state.entities = (state.entities || []).filter(function(e) { return e.id !== ent.id; });
          state.relations = (state.relations || []).filter(function(r) {
            return r.fromId !== ent.id && r.toId !== ent.id;
          });
        }
        ctx.save();
        ctx.renderAll();
      });
    });
    grid.querySelectorAll('[data-char-enrich]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        ctx.runAnalyzeEnrich({ ids: [btn.getAttribute('data-char-enrich')] }).catch(function(e) {
          if (!ctx.isTrackedAbort(e)) alert('丰满失败: ' + (e.message || e));
        });
      });
    });
    grid.querySelectorAll('[data-char-expand]').forEach(function(btn) {
      btn.addEventListener('click', function() { panel.expand(btn.getAttribute('data-char-expand')); });
    });
    grid.querySelectorAll('[data-char-edit]').forEach(function(btn) {
      btn.addEventListener('click', function() { panel.openProfileEditor(btn.getAttribute('data-char-edit')); });
    });
    grid.querySelectorAll('[data-char-sync-wb]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        ctx.syncOutputs({ target: 'character_worldbook', ids: [btn.getAttribute('data-char-sync-wb')], selected: false });
        ctx.setStatus('novelCharStatus', '已同步到世界书人物条（不写入主角设定）');
      });
    });
  };

  panel.openProfileEditor = function(id) {
    var state = ctx.state;
    var ch = state.characters.find(function(c) { return c.id === id; });
    if (!ch) return;
    ctx.editState.editingCharId = id;
    var title = ctx.$('novelModalProfileTitle');
    var aliases = ctx.$('novelCharAliases');
    var jsonEl = ctx.$('novelCharProfileJson');
    if (title) title.textContent = '人物档案 · ' + ch.name;
    if (aliases) aliases.value = (ch.aliases || []).join(', ');
    if (jsonEl) jsonEl.value = JSON.stringify(ch.profile || emptyCharacterProfile(ch.name), null, 2);
    ctx.openNovelModal('novelModalProfile');
  };

  panel.openEntityEditor = function(id) {
    var state = ctx.state;
    var ent = (state.entities || []).find(function(e) { return e.id === id; });
    if (!ent) return;
    ctx.editState.editingEntityId = id;
    var title = ctx.$('novelModalEntityTitle');
    var nameEl = ctx.$('novelEntityName');
    var typeEl = ctx.$('novelEntityType');
    var aliasesEl = ctx.$('novelEntityAliases');
    var sumEl = ctx.$('novelEntitySummary');
    var keysEl = ctx.$('novelEntityKeys');
    var contentEl = ctx.$('novelEntityContent');
    if (title) title.textContent = '编辑实体 · ' + ent.name;
    if (nameEl) nameEl.value = ent.name || '';
    if (typeEl) typeEl.value = ent.type || 'lore';
    if (aliasesEl) aliasesEl.value = (ent.aliases || []).join(', ');
    if (sumEl) sumEl.value = ent.summary || '';
    if (keysEl) keysEl.value = (ent.keys || []).join(', ');
    if (contentEl) contentEl.value = ent.content || '';
    ctx.openNovelModal('novelModalEntity');
  };

  /**
   * await 人物 AI 扩展/重写（附录1）；供 UI 与助手共用
   * @param {string|object} targetIdOrOpts
   * @param {{ mode?: string, instruction?: string, openEditor?: boolean, silent?: boolean, skipConfirm?: boolean }} [opts]
   */
  panel.expand = async function(targetIdOrOpts, opts) {
    var state = ctx.state;
    var options = opts || {};
    var target = targetIdOrOpts;
    if (typeof targetIdOrOpts === 'string') target = { id: targetIdOrOpts };
    else if (targetIdOrOpts && (targetIdOrOpts.mode || targetIdOrOpts.instruction) && !targetIdOrOpts.id && !targetIdOrOpts.name) {
      options = targetIdOrOpts;
      target = { id: options.id, name: options.name };
    }
    var g = ctx.gates();
    if (!g.canExtract) {
      var reason = (g.reasons || []).join('\n') || '前置未完成';
      if (!options.silent) alert(reason);
      throw new Error(reason);
    }
    var ch = panel.findCharacter(target);
    if (!ch) throw new Error('人物未找到（请用 id 或 name）');
    var mode = options.mode || 'expand';
    ctx.setStatus('novelCharStatus', '正在为「' + ch.name + '」匹配原文…');
    var adultOnExpand = getAdultMode(state);
    var ntlOnExpand = getNtlMode(state);
    var expandAliases = (ch.aliases || []).slice();
    if (adultOnExpand) {
      ADULT_RAG_BOOST_TERMS.forEach(function(t) {
        if (expandAliases.indexOf(t) < 0) expandAliases.push(t);
      });
    }
    if (ntlOnExpand) {
      NTL_RAG_BOOST_TERMS.forEach(function(t) {
        if (expandAliases.indexOf(t) < 0) expandAliases.push(t);
      });
    }
    var recall = buildRecallPayload(
      state.chapters,
      ch.name,
      expandAliases,
      state.expandBudget || DEFAULT_EXPAND_BUDGET,
      180
    );
    if (!recall.snippetCount) {
      var miss = '未在启用章节中匹配到「' + ch.name + '」及其别名';
      ctx.setStatus('novelCharStatus', '未命中原文');
      if (!options.silent) alert(miss);
      throw new Error(miss);
    }
    var ok = await ctx.confirmExpandRecall({
      title: '人物 AI 扩展 · ' + ch.name,
      body: recall.body,
      totalChars: recall.totalChars,
      snippetCount: recall.snippetCount,
      truncated: recall.truncated,
      terms: recall.terms,
      silent: options.silent,
      skipConfirm: options.skipConfirm,
    });
    if (!ok) {
      ctx.setStatus('novelCharStatus', '已取消「' + ch.name + '」扩展');
      throw new DOMException('已取消', 'AbortError');
    }
    var expandBtn = document.querySelector('[data-char-expand="' + ch.id + '"]');
    var expandOld = expandBtn ? expandBtn.innerHTML : '';
    if (expandBtn) {
      expandBtn.disabled = true;
      expandBtn.innerHTML = '…';
    }
    try {
      return await ctx.runTracked({
        type: 'novel_char_expand',
        title: mode === 'rewrite' ? '人物 AI 重写' : '人物 AI 扩展',
        target: ch.name,
      }, async function(task) {
        ctx.setStatus('novelCharStatus', '正在为「' + ch.name + '」' + (mode === 'rewrite' ? '重写' : '扩展') + '...');
        var head = ctx.promptText(
          'novelCharExpand',
          '你是小说人物档案专家。优先依据原文；原文未写明的字段须根据已有性格/外貌/关系等合理虚构补全，禁止留空或写「（原文未提及）」。只输出 JSON 对象。'
        );
        var modeHint = mode === 'rewrite'
          ? '\n【模式】重写：在原文与合理虚构上重建完整档案，可覆盖旧档案。'
          : (mode === 'patch'
            ? '\n【模式】定向修改：保留未提及字段，仅按要求改动。'
            : '\n【模式】扩写：在已有档案基础上补全空白与细节；空白处合理虚构。');
        var adultOn = getAdultMode(state);
        var user = head
          + modeHint
          + (options.instruction ? '\n【用户要求】' + options.instruction : '')
          + (ch.profile && mode !== 'rewrite' ? '\n【现有档案】\n' + JSON.stringify(ch.profile) : '')
          + (adultOn ? extractStyleNsfwSection(state.styleText) : '')
          + buildModeHintBlocks(state, 'expand')
          + buildPaletteGuidanceBlock(state)
          + buildNtlTabooHint(state)
          + buildAdultContextDigests(state.entities, 2000, getNtlMode(state))
          + '\n\n角色名: ' + ch.name
          + '\n别名: ' + (ch.aliases || []).join('、')
          + buildContentModeFlags(state)
          + '\nContext: ' + (state.contextText || '')
          + '\n召回字数: ' + recall.totalChars + (recall.truncated ? '（已抽样截断）' : '')
          + '\n匹配词: ' + recall.terms.join('、')
          + '\n\n【原文片段】\n' + recall.body
          + '\n\n请输出附录1完整 JSON，字段须含: Chinese name, Nickname, age, gender, identity, key_events, relationships, turning_points, appearance{hair,eyes,build,识别特征}, personality{core_traits}, persona_layers{surface,social,intimate,under_stress,secret_self}, tension_pairs[{trait_a,trait_b,resolution}], core_desire, values_and_drives, hidden_motives, goals, weakness, likes, dislikes, skills, speech_style, NSFW_information（含 body/erogenous_zones/sexual_personality/contrast/xp_kinks/sensitive_triggers/inner_erotic_thoughts/Sex_related_traits/Kinks/Limits/desire_palette/sexual_psychology/situational_modulation/aftercare）。'
          + (adultOn ? '\nAdultMode=true：NSFW_information 禁止整块「原文未提及」，须填 Limits 与 Kinks/xp_kinks；无原文则据已有档案推断。' : '');
        var text = await ctx.callAI(user, null, task.signal);
        var json = parseJsonLoose(text);
        var profile = normalizeCharacterProfile(json.profile || json, ch.name);
        if (mode === 'patch' && ch.profile) {
          profile = Object.assign({}, ch.profile, profile);
        }
        ch.profile = profile;
        ch.hits = recall.hitCount;
        ch.note = String(profile.identity && profile.identity[0] ? profile.identity[0] : '已 AI 扩展');
        ch.syncStatus = 'unsynced';
        if (typeof profile.Nickname === 'string') {
          ch.aliases = profile.Nickname.split(/[,，、]/).map(function(s) { return s.trim(); }).filter(Boolean);
        }
        if (!state.entities) state.entities = [];
        upsertEntity(state.entities, {
          type: 'person',
          name: ch.name,
          aliases: ch.aliases,
          summary: ch.note,
          attrs: { profile: profile },
          content: profileContentDigest(profile, ch.name),
        }, { source: 'expand' });
        projectEntitiesToLegacy(state);
        ctx.save();
        ctx.renderAll();
        if (options.openEditor !== false && !options.silent) panel.openProfileEditor(ch.id);
        ctx.setStatus('novelCharStatus', '「' + ch.name + '」扩展完成（召回 ' + recall.totalChars + ' 字 / ' + recall.snippetCount + ' 片段）');
        return { id: ch.id, name: ch.name, mode: mode, recallChars: recall.totalChars };
      });
    } catch (e) {
      if (!ctx.isTrackedAbort(e)) {
        ctx.setStatus('novelCharStatus', '扩展失败: ' + e.message);
        if (!options.silent) alert('AI 扩展失败: ' + e.message);
      } else {
        ctx.setStatus('novelCharStatus', '已取消「' + ch.name + '」扩展');
      }
      throw e;
    } finally {
      if (expandBtn) {
        expandBtn.disabled = false;
        expandBtn.innerHTML = expandOld || '✦';
      }
    }
  };

  /** 先前的扫描参考信息（内部函数） */
  function formatPriorCharScanRef(chars) {
    if (!chars || !chars.length) return '';
    var lines = chars.map(function(c) {
      var alias = (c.aliases || []).length ? ' aliases=' + c.aliases.join('/') : '';
      return '- ' + c.name + alias + (c.note ? ' · ' + String(c.note).substring(0, 80) : '');
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
    if (scanBtn) scanBtn.addEventListener('click', async function() {
      if (ctx.busyFlags.charScan) return;
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
        await ctx.runAnalyzeEnrich({ ids: ids });
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
  ctx.panels.characters = panel;
  return panel;
}
