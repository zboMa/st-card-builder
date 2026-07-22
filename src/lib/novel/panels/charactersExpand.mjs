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
 * attachNovelCharactersExpand（拆自原模块）
 */
export function attachNovelCharactersExpand(ctx, panel) {
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
          + buildNsfwFlavorHint(state)
          + buildNtlTabooHint(state)
          + buildAdultCanonDigest({
            entities: state.entities,
            worldbookEntries: (state.wbEntries || []).map(function(e) {
              return {
                comment: e.comment || ('[小说' + (e.category || 'setting') + '] ' + e.name),
                content: e.content || '',
              };
            }),
            styleText: state.styleText,
            focusName: ch.name,
            budget: ADULT_CANON_BUDGET,
            worldframeLabel: resolveWorldframe(state).label,
          })
          + '\n\n角色名: ' + ch.name
          + '\n别名: ' + (ch.aliases || []).join('、')
          + buildContentModeFlags(state)
          + '\nContext: ' + (state.contextText || '')
          + '\n召回字数: ' + recall.totalChars + (recall.truncated ? '（已抽样截断）' : '')
          + '\n匹配词: ' + recall.terms.join('、')
          + '\n\n【原文片段】\n' + recall.body
          + '\n\n请输出附录1完整 JSON，字段须含: Chinese name, Nickname, age, gender, identity, key_events, relationships, turning_points, appearance{hair,eyes,build,识别特征}, personality{core_traits}, persona_layers{surface,social,intimate,under_stress,secret_self}, tension_pairs[{trait_a,trait_b,resolution}], core_desire, values_and_drives, hidden_motives, goals, weakness, likes, dislikes, skills, speech_style, NSFW_information（含 body/erogenous_zones/sexual_personality/contrast/xp_kinks/sensitive_triggers/inner_erotic_thoughts/Sex_related_traits/Kinks/Limits/desire_palette/sexual_psychology/situational_modulation/aftercare）。'
          + (adultOn ? '\nAdultMode=true：NSFW_information 禁止整块「原文未提及」，须填 Limits 与 Kinks/xp_kinks；无原文则据已有档案推断。须按口味丰满规范写透必写维度。' : '');
        var vesselNames = listVesselEntities(state.entities).map(function(v) { return v.name; }).filter(Boolean);
        if ((adultOn || getNtlMode(state)) && vesselNames.length) {
          user += '\n【软约束】须点名与已有世界观成人载体的互动：' + vesselNames.slice(0, 8).join('、');
        }
        var text = await ctx.callAI(user, null, task.signal);
        var json = parseJsonLoose(text);
        var profile = normalizeCharacterProfile(json.profile || json, ch.name);
        if (mode === 'patch' && ch.profile) {
          profile = Object.assign({}, ch.profile, profile);
        }
        var flavorItems = adultOn ? getNsfwFlavorItems(state) : [];
        var flavorThinTip = '';
        if (flavorItems.length) {
          var richness = evaluateFlavorRichness(profile, flavorItems, { presets: NSFW_FLAVOR_PRESETS });
          if (!richness.ok) {
            var expandPrompt = buildFlavorExpandSystemPrompt(flavorItems, { presets: NSFW_FLAVOR_PRESETS })
              + '\n\n' + buildFlavorExpandUserPrompt({
                weakDimensions: richness.weakDimensions,
                minChars: richness.minChars,
                flavorHint: buildNsfwFlavorHint(state),
                context: ch.name + (ch.note ? (' · ' + ch.note) : ''),
                text: JSON.stringify(profile),
              })
              + '\n请输出完整人物 JSON（含加厚后的 NSFW_information）。';
            var expandText = await ctx.callAI(expandPrompt, null, task.signal);
            var expandJson = parseJsonLoose(expandText);
            var expandedProfile = normalizeCharacterProfile(expandJson.profile || expandJson, ch.name);
            var richness2 = evaluateFlavorRichness(expandedProfile, flavorItems, { presets: NSFW_FLAVOR_PRESETS });
            if (richness2.total >= richness.total) profile = expandedProfile;
            if (!richness2.ok) {
              flavorThinTip = '；口味层仍偏薄：' + richness2.weakDimensions.slice(0, 3).join('；');
            }
          }
        }
        var ntlTypes = getNtlMode(state) ? getNtlTabooTypes(state) : [];
        if (ntlTypes.length) {
          var ntlProbe = {
            attrs: { ntl: (profile && profile.ntl) || (profile && profile.NSFW_information && profile.NSFW_information.ntl) || profile },
            content: JSON.stringify(profile),
          };
          var ntlRich = evaluateNtlRichness(ntlProbe, ntlTypes, { tabooTypes: NTL_TABOO_TYPES });
          if (!ntlRich.ok) {
            var ntlExpandPrompt = buildNtlExpandSystemPrompt(ntlTypes, { tabooTypes: NTL_TABOO_TYPES })
              + '\n\n' + buildNtlExpandUserPrompt({
                weakDimensions: ntlRich.weakDimensions,
                minChars: ntlRich.minChars,
                ntlHint: buildNtlTabooHint(state),
                context: ch.name + (ch.note ? (' · ' + ch.note) : ''),
                text: JSON.stringify(profile),
              })
              + '\n请输出完整人物 JSON，并写满 attrs.ntl / 禁忌相关字段。';
            var ntlExpandText = await ctx.callAI(ntlExpandPrompt, null, task.signal);
            var ntlExpandJson = parseJsonLoose(ntlExpandText);
            var ntlExpandedProfile = normalizeCharacterProfile(ntlExpandJson.profile || ntlExpandJson, ch.name);
            var ntlRich2 = evaluateNtlRichness({
              attrs: { ntl: ntlExpandedProfile },
              content: JSON.stringify(ntlExpandedProfile),
            }, ntlTypes, { tabooTypes: NTL_TABOO_TYPES });
            if (ntlRich2.total >= ntlRich.total) profile = ntlExpandedProfile;
            if (!ntlRich2.ok) {
              flavorThinTip += '；NTL 仍偏薄：' + ntlRich2.weakDimensions.slice(0, 2).join('；');
            }
          }
        }
        if ((adultOn || getNtlMode(state)) && vesselNames.length) {
          var mention = personMentionsVessels(JSON.stringify(profile), listVesselEntities(state.entities));
          if (mention.missing) {
            try {
              var hookPrompt = '你是角色卡编辑。下文未点名已有世界观成人载体，请改写 NSFW/关系相关字段，使人物与至少一件载体互动（持有/被施加/惧怕/渴望）。保持完整人物 JSON。\n'
                + '可用载体：' + vesselNames.slice(0, 10).join('、')
                + '\n\n' + JSON.stringify(profile);
              var hookText = await ctx.callAI(hookPrompt, null, task.signal);
              var hookJson = parseJsonLoose(hookText);
              var hooked = normalizeCharacterProfile(hookJson.profile || hookJson, ch.name);
              if (hooked && (hooked.NSFW_information || hooked.identity)) profile = hooked;
              var mention2 = personMentionsVessels(JSON.stringify(profile), listVesselEntities(state.entities));
              if (mention2.missing) flavorThinTip += '；未挂钩世界观载体';
            } catch (hookErr) {
              if (ctx.isTrackedAbort(hookErr)) throw hookErr;
            }
          }
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
        ctx.setStatus(
          'novelCharStatus',
          '「' + ch.name + '」扩展完成（召回 ' + recall.totalChars + ' 字 / ' + recall.snippetCount + ' 片段）' + flavorThinTip
        );
        return { id: ch.id, name: ch.name, mode: mode, recallChars: recall.totalChars, flavorThin: !!flavorThinTip };
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

}
