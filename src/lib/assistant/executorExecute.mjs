/**
 * 助手工具 executeConfirmed / invoke（拆自 executor）
 */
import { getToolByName, VALID_VIEWS } from './tools.mjs';
import { classifyToolRisk, buildChangePreview } from './risk.mjs';
import {
  CHARACTER_CANONICAL_KEYS,
  normalizeCharacterFieldKey,
  normalizeCharacterPatch,
} from './characterFields.mjs';
import { resolveWorldbookIndex, normalizeTarget } from './executorResolve.mjs';

export function createExecutorExecute(bridge, snaps, helpers) {
  var ok = helpers.ok;
  var fail = helpers.fail;
  var findWbIndex = helpers.findWbIndex;
  var searchCard = helpers.searchCard;
  var analyzeChatLocal = helpers.analyzeChatLocal;
  var buildLintFixOps = helpers.buildLintFixOps;
  async function executeConfirmed(toolName, args, execOpts) {
    var a = args || {};
    var skipSnap = !!(execOpts && execOpts.skipSnapshot);
    function maybeSnap() {
      if (!skipSnap && snaps.pushSnapshot) snaps.pushSnapshot(bridge.captureSnapshot());
    }
    switch (toolName) {
      case 'get_character_fields':
        return ok(bridge.getCharacter());
      case 'get_character_summary': {
        var c = bridge.getCharacter() || {};
        var maxLen = a.maxLen || 280;
        var summary = {};
        Object.keys(c).forEach(function(k) {
          var t = String(c[k] == null ? '' : c[k]);
          summary[k] = t.length > maxLen ? t.slice(0, maxLen) + '…' : t;
        });
        return ok(summary);
      }
      case 'get_worldbook_list': {
        var list = bridge.getWorldbook() || [];
        var q = String(a.query || '').trim().toLowerCase();
        var mapped = list.map(function(e, i) {
          return {
            index: i,
            id: e.uid || e.id || null,
            comment: e.comment || '',
            keys: e.keys || [],
            strategy: e.strategy || 'selective',
            enabled: e.enabled !== false,
            contentLen: String(e.content || '').length,
          };
        });
        if (q) {
          mapped = mapped.filter(function(e) {
            return (e.comment + ' ' + (e.keys || []).join(' ')).toLowerCase().indexOf(q) >= 0;
          });
        }
        return ok({ count: mapped.length, entries: mapped });
      }
      case 'get_worldbook_entry': {
        var entries = bridge.getWorldbook() || [];
        var idx = findWbIndex(entries, a);
        if (idx < 0 || idx >= entries.length) return fail('条目未找到（请用 index / titleMatch / comment / id 定位）');
        return ok({ index: idx, entry: entries[idx] });
      }
      case 'get_mvu_state':
        return ok(bridge.getMvu());
      case 'infer_mvu_variables': {
        if (bridge.inferMvuVariables) return ok(bridge.inferMvuVariables(a));
        return fail('MVU 推定桥接未就绪');
      }
      case 'get_novel_workspace':
        return ok(bridge.getNovel());
      case 'novel_list_outputs':
        if (bridge.listNovelOutputs) return ok(bridge.listNovelOutputs(a));
        return ok(bridge.getNovel());
      case 'get_export_preview':
        return ok(bridge.getExportPreview(a));
      case 'export_card_check':
        if (bridge.exportCardCheck) return ok(bridge.exportCardCheck(a));
        return ok(bridge.getExportPreview(a));
      case 'search_card_content':
        return ok({ hits: searchCard(a.query, a.limit) });
      case 'search_novel_passages': {
        if (!bridge.searchNovelPassages) return fail('小说检索桥接未就绪');
        return ok(await bridge.searchNovelPassages(a.query, a));
      }
      case 'list_novel_entities': {
        if (!bridge.listNovelEntities) return fail('知识库桥接未就绪');
        return ok({ entities: bridge.listNovelEntities(a) });
      }
      case 'get_novel_entity': {
        if (!bridge.getNovelEntity) return fail('知识库桥接未就绪');
        var t = a.target != null ? a.target : a;
        var key = (typeof t === 'string') ? t : (t.id || t.name || t.titleMatch || '');
        var ent = bridge.getNovelEntity(key);
        if (!ent) return fail('实体未找到');
        return ok({ entity: ent });
      }
      case 'audit_worldbook':
        return ok(bridge.auditWorldbook());
      case 'lint_for_sillytavern':
        return ok(bridge.lintCard());
      case 'get_chat_feedback':
        return ok(bridge.getChatFeedback(a));
      case 'analyze_chat_feedback': {
        // 优先 LLM 结构化；失败回退本地启发式
        if (bridge.analyzeChatFeedback) {
          try {
            var llm = await bridge.analyzeChatFeedback(a);
            return ok(llm);
          } catch (e) {
            var local = analyzeChatLocal(a.feedback);
            local.llmError = e.message || String(e);
            return ok(local);
          }
        }
        return ok(analyzeChatLocal(a.feedback));
      }
      case 'suggest_fixes': {
        var packed = buildLintFixOps(a.maxOps);
        return ok({
          lint: packed.lint,
          audit: packed.audit,
          suggestedOps: packed.ops,
          chatIssues: analyzeChatLocal().issues,
        });
      }
      case 'fix_from_lint': {
        var plan = buildLintFixOps(a.maxOps);
        if (!plan.ops.length) return ok({ applied: false, ops: [], note: '未发现可自动修复项' });
        if (a.apply === false) return ok({ applied: false, preview: true, ops: plan.ops, lint: plan.lint });
        maybeSnap();
        var fixResults = [];
        for (var fi = 0; fi < plan.ops.length; fi++) {
          var op = plan.ops[fi];
          var rr = await executeConfirmed(op.op, op.args || {}, { skipSnapshot: true });
          fixResults.push({ op: op.op, result: rr });
          if (!rr.ok) break;
        }
        return ok({ applied: true, ops: plan.ops, results: fixResults });
      }
      case 'open_module': {
        var view = String(a.view || '');
        if (VALID_VIEWS.indexOf(view) < 0) return fail('未知模块: ' + view + '，可选: ' + VALID_VIEWS.join(', '));
        bridge.openModule(view);
        return ok({ view: view });
      }
      case 'list_cards':
        if (!bridge.listCards) return fail('多卡桥接未就绪');
        return ok(bridge.listCards());
      case 'get_engine_options':
        if (!bridge.getEngineOptions) return fail('引擎选项桥接未就绪');
        return ok(bridge.getEngineOptions());
      case 'get_prompt_ids':
        if (!bridge.getPromptIds) return fail('提示词桥接未就绪');
        return ok(bridge.getPromptIds());
      case 'get_adult_config':
        if (!bridge.getAdultConfig && !bridge.getNsfwConfig) return fail('成人配置桥接未就绪');
        return ok((bridge.getAdultConfig || bridge.getNsfwConfig)());
      case 'set_adult_config': {
        if (!bridge.setAdultConfig && !bridge.setNsfwConfig) return fail('成人配置桥接未就绪');
        maybeSnap();
        return ok((bridge.setAdultConfig || bridge.setNsfwConfig)(a));
      }
      case 'set_engine_options': {
        if (!bridge.setEngineOptions) return fail('引擎选项桥接未就绪');
        maybeSnap();
        return ok(bridge.setEngineOptions(a));
      }
      case 'update_character_fields': {
        var norm = normalizeCharacterPatch(a.fields || {});
        if (!Object.keys(norm.fields).length) {
          return fail(
            '未写入任何角色字段'
            + (norm.ignored.length ? '（未识别: ' + norm.ignored.join(', ') + '）' : '')
            + '。可用: ' + CHARACTER_CANONICAL_KEYS.join(', ')
          );
        }
        maybeSnap();
        bridge.setCharacter(norm.fields);
        return ok({
          applied: Object.keys(norm.fields),
          ignored: norm.ignored,
          mapped: norm.mapped,
        });
      }
      case 'replace_character_section': {
        if (!a.field) return fail('缺少 field');
        var repField = normalizeCharacterFieldKey(a.field);
        if (!repField) {
          return fail('未识别的角色字段: ' + a.field + '。可用: ' + CHARACTER_CANONICAL_KEYS.join(', '));
        }
        maybeSnap();
        var patch = {};
        patch[repField] = a.content;
        bridge.setCharacter(patch);
        return ok({ field: repField, mappedFrom: repField !== a.field ? a.field : undefined });
      }
      case 'expand_character_field': {
        if (!a.field) return fail('缺少 field');
        var expField = normalizeCharacterFieldKey(a.field);
        if (!expField) {
          return fail('未识别的角色字段: ' + a.field + '。可用: ' + CHARACTER_CANONICAL_KEYS.join(', '));
        }
        if (!bridge.expandCharacterField) return fail('角色字段扩写桥接未就绪');
        maybeSnap();
        return ok(await bridge.expandCharacterField({
          field: expField,
          mode: a.mode || 'expand',
          instruction: a.instruction || a.direction || '',
        }));
      }
      case 'create_worldbook_entry': {
        var wb = (bridge.getWorldbook() || []).slice();
        var toAdd = Array.isArray(a.entries) ? a.entries.slice()
          : (a.entry && typeof a.entry === 'object' ? [a.entry]
            : (a.comment || a.content ? [a] : []));
        if (!toAdd.length) return fail('缺少 entry 或 entries');
        maybeSnap();
        toAdd.forEach(function(entry) {
          if (!entry || typeof entry !== 'object') return;
          wb.push({
            comment: entry.comment || '未命名',
            content: entry.content || '',
            keys: Array.isArray(entry.keys) ? entry.keys : [],
            strategy: entry.strategy || 'selective',
            position: entry.position != null ? entry.position : 4,
            depth: entry.depth != null ? entry.depth : 4,
            role: entry.role != null ? entry.role : 0,
            order: entry.order != null ? entry.order : 100,
            prob: entry.prob != null ? entry.prob : 100,
            enabled: entry.enabled !== false,
          });
        });
        bridge.setWorldbook(wb);
        return ok({ count: wb.length, added: toAdd.length });
      }
      case 'update_worldbook_entry': {
        var wb2 = (bridge.getWorldbook() || []).slice();
        var i2 = findWbIndex(wb2, a);
        if (i2 < 0 || i2 >= wb2.length) return fail('条目未找到');
        maybeSnap();
        var p = a.patch || {};
        wb2[i2] = Object.assign({}, wb2[i2], p);
        if (p.keys && !Array.isArray(p.keys)) wb2[i2].keys = String(p.keys).split(/[,，]/).map(function(s) { return s.trim(); }).filter(Boolean);
        bridge.setWorldbook(wb2);
        return ok({ index: i2, entry: wb2[i2] });
      }
      case 'delete_worldbook_entry': {
        var wb3 = (bridge.getWorldbook() || []).slice();
        var clearAll = a.all === true || a.indices === 'all' || a.indices === '*';
        if (clearAll) {
          var total = wb3.length;
          if (!total) return ok({ deleted: 0, remaining: 0, clearedAll: true });
          maybeSnap();
          bridge.setWorldbook([]);
          return ok({ deleted: total, remaining: 0, clearedAll: true });
        }
        var indices = Array.isArray(a.indices) ? a.indices.slice() : [];
        if (typeof a.index === 'number') indices.push(a.index);
        var resolved = findWbIndex(wb3, a);
        if (resolved >= 0) indices.push(resolved);
        indices = indices.filter(function(n, pos, arr) { return arr.indexOf(n) === pos && n >= 0 && n < wb3.length; }).sort(function(x, y) { return y - x; });
        if (!indices.length) return fail('未指定可删除条目');
        maybeSnap();
        indices.forEach(function(di) { wb3.splice(di, 1); });
        bridge.setWorldbook(wb3);
        return ok({ deleted: indices.length, remaining: wb3.length });
      }
      case 'rewrite_greeting':
      case 'expand_greeting': {
        if (!bridge.mutateGreeting) return fail('开场白桥接未就绪');
        maybeSnap();
        return ok(await bridge.mutateGreeting({
          target: a.target != null ? a.target : (a.index != null ? { alternate: a.index } : 'main'),
          mode: a.mode || (toolName === 'expand_greeting' ? 'expand' : 'rewrite'),
          instruction: a.instruction || a.direction || '',
        }));
      }
      case 'update_alternate_greeting': {
        if (typeof a.index !== 'number') return fail('缺少备选 index');
        maybeSnap();
        var ch = bridge.getCharacter() || {};
        var alts = Array.isArray(ch.altGreetings) ? ch.altGreetings.slice() : [];
        if (a.index < 0 || a.index >= alts.length) return fail('备选开场白序号越界');
        alts[a.index] = a.content != null ? String(a.content) : alts[a.index];
        bridge.setCharacter({ altGreetings: alts });
        return ok({ index: a.index, length: alts[a.index].length });
      }
      case 'generate_character_draft':
        maybeSnap();
        return ok(await bridge.generateCharacter(a));
      case 'generate_worldbook_skeleton':
        maybeSnap();
        return ok(await bridge.generateSkeleton(a));
      case 'generate_worldbook_entry': {
        if (!bridge.generateWorldbookEntry) return fail('单条世界书生成桥接未就绪');
        maybeSnap();
        return ok(await bridge.generateWorldbookEntry({
          direction: a.direction || a.instruction || '',
        }));
      }
      case 'organize_worldbook': {
        if (!bridge.organizeWorldbook) return fail('世界书整理桥接未就绪');
        maybeSnap();
        return ok(await bridge.organizeWorldbook({ apply: a.apply !== false }));
      }
      case 'batch_fill_worldbook_keys': {
        if (!bridge.batchFillWorldbookKeys) return fail('触发词补全桥接未就绪');
        maybeSnap();
        return ok(await bridge.batchFillWorldbookKeys(a));
      }
      case 'rewrite_worldbook_entry':
      case 'expand_worldbook_entry': {
        var mode = a.mode || (toolName === 'rewrite_worldbook_entry' ? 'rewrite' : 'expand');
        maybeSnap();
        if (bridge.mutateWorldbookEntry) {
          return ok(await bridge.mutateWorldbookEntry({
            target: a.target != null ? a.target : { index: a.index, comment: a.comment, id: a.id, titleMatch: a.titleMatch },
            mode: mode,
            instruction: a.instruction || a.direction || '',
          }));
        }
        // 回退旧 expandEntry
        return ok(await bridge.expandEntry(Object.assign({}, a, { mode: mode })));
      }
      case 'apply_patch_bundle': {
        var ops = Array.isArray(a.ops) ? a.ops : [];
        maybeSnap();
        var results = [];
        for (var oi = 0; oi < ops.length; oi++) {
          var opb = ops[oi];
          var name = opb.op || opb.tool;
          var opArgs = opb.args || {};
          var r = await executeConfirmed(name, opArgs, { skipSnapshot: true });
          results.push({ op: name, result: r });
          if (!r.ok) break;
        }
        return ok({ results: results, summary: a.summary || '' });
      }
      case 'undo_last_bundle': {
        if (!snaps.popSnapshot) return fail('快照栈不可用');
        var last = snaps.popSnapshot();
        if (!last) return fail('没有可撤销的快照');
        bridge.restoreSnapshot(last);
        return ok({ restoredAt: last.at || null });
      }
      case 'switch_card':
      case 'create_card':
      case 'duplicate_card':
      case 'rename_card':
      case 'delete_card':
      case 'import_card': {
        if (!bridge.manageCard) return fail('多卡管理桥接未就绪');
        if (toolName === 'import_card' && a.cardJson == null && a.json == null) {
          return fail('缺少 cardJson');
        }
        maybeSnap();
        return ok(await Promise.resolve(bridge.manageCard(toolName, a)));
      }
      case 'set_novel_source':
        maybeSnap();
        return ok(bridge.setNovelSource(a));
      case 'run_novel_extract_step':
      case 'novel_split_chapters':
      case 'novel_extract_characters':
      case 'novel_extract_worldbook':
      case 'novel_distill_style': {
        if (toolName === 'run_novel_extract_step' && !a.mode) {
          return fail('缺少 mode（split|characters|worldbook|style 等）');
        }
        maybeSnap();
        var modeMap = {
          novel_split_chapters: 'split',
          novel_extract_characters: 'characters',
          novel_extract_worldbook: 'worldbook',
          novel_distill_style: 'style',
        };
        var extractMode = a.mode || modeMap[toolName] || 'characters';
        return ok(await bridge.runNovelExtract(Object.assign({}, a, { mode: extractMode })));
      }
      case 'run_novel_rag_index': {
        if (!bridge.runNovelRagIndex) return fail('RAG 索引桥接未就绪');
        maybeSnap();
        return ok(await bridge.runNovelRagIndex(a));
      }
      case 'run_novel_analyze': {
        if (!bridge.runNovelAnalyze) return fail('小说分析桥接未就绪');
        maybeSnap();
        return ok(await bridge.runNovelAnalyze(a.phase || a.mode || 'all'));
      }
      case 'enrich_novel_entity': {
        if (!bridge.enrichNovelEntity) return fail('实体丰满桥接未就绪');
        maybeSnap();
        return ok(await bridge.enrichNovelEntity({
          target: a.target != null ? a.target : { id: a.id, name: a.name },
          id: a.id,
          name: a.name,
          ids: a.ids,
        }));
      }
      case 'patch_novel_entity': {
        if (!bridge.patchNovelEntity) return fail('知识库桥接未就绪');
        maybeSnap();
        return ok(bridge.patchNovelEntity({
          target: a.target != null ? a.target : { id: a.id, name: a.name },
          patch: a.patch || a.fields || {},
        }));
      }
      case 'merge_novel_entities': {
        if (!bridge.mergeNovelEntities) return fail('知识库桥接未就绪');
        var keep = a.keep != null ? a.keep : a.primary;
        var drop = a.drop != null ? a.drop : a.secondary;
        if (keep == null && a.primaryId == null) return fail('缺少 keep 实体定位');
        if (drop == null && a.secondaryId == null) return fail('缺少 drop 实体定位');
        maybeSnap();
        return ok(bridge.mergeNovelEntities({
          keep: keep,
          drop: drop,
          primaryId: a.primaryId,
          secondaryId: a.secondaryId,
        }));
      }
      case 'sync_novel_entities': {
        maybeSnap();
        if (bridge.syncNovelEntities) return ok(bridge.syncNovelEntities(a));
        if (bridge.syncNovelOutputs) return ok(bridge.syncNovelOutputs(Object.assign({ target: 'entities' }, a)));
        return fail('同步桥接未就绪');
      }
      case 'set_novel_adult_mode': {
        if (!bridge.setNovelAdultMode) return fail('成人模式桥接未就绪');
        maybeSnap();
        return ok({ adultMode: bridge.setNovelAdultMode(!!(a.enabled != null ? a.enabled : a.on)) });
      }
      case 'set_novel_ntl_mode': {
        if (!bridge.setNovelNtlMode) return fail('NTL 模式桥接未就绪');
        maybeSnap();
        return ok({ ntlMode: bridge.setNovelNtlMode(!!(a.enabled != null ? a.enabled : a.on)) });
      }
      case 'draft_nsfw_statusbar': {
        if (!bridge.draftNsfwStatusBar) return fail('NSFW 状态栏草案桥接未就绪');
        return ok(bridge.draftNsfwStatusBar({ name: a.name || a.charName || '' }));
      }
      case 'generate_corruption_lore': {
        var genCorr = bridge.generateCorruptionLore
          || (typeof window !== 'undefined' ? window.__generateCorruptionLore__ : null);
        if (typeof genCorr !== 'function') return fail('恶堕进度生成桥接未就绪');
        maybeSnap();
        if (a.preset || a.customBrief != null || a.extraNotes != null || a.enabled != null) {
          if (typeof bridge.setNsfwConfig === 'function') {
            var curB = typeof bridge.getNsfwConfig === 'function' ? bridge.getNsfwConfig() : {};
            bridge.setNsfwConfig({
              enabled: true,
              corruptionEnabled: a.enabled !== false,
              corruptionPreset: a.preset || curB.corruptionPreset || '5',
              corruptionCustomBrief: a.customBrief != null ? String(a.customBrief) : (curB.corruptionCustomBrief || ''),
              corruptionExtraNotes: a.extraNotes != null ? String(a.extraNotes) : (curB.corruptionExtraNotes || ''),
              corruptionSelectedNames: Array.isArray(a.selectedNames)
                ? a.selectedNames
                : (curB.corruptionSelectedNames || []),
            });
          } else if (typeof window !== 'undefined' && typeof window.__setNsfwConfig__ === 'function') {
            var curCfg = typeof window.__getNsfwConfig__ === 'function' ? window.__getNsfwConfig__() : {};
            window.__setNsfwConfig__({
              enabled: true,
              corruptionEnabled: a.enabled !== false,
              corruptionPreset: a.preset || curCfg.corruptionPreset || '5',
              corruptionCustomBrief: a.customBrief != null ? String(a.customBrief) : (curCfg.corruptionCustomBrief || ''),
              corruptionExtraNotes: a.extraNotes != null ? String(a.extraNotes) : (curCfg.corruptionExtraNotes || ''),
              corruptionSelectedNames: Array.isArray(a.selectedNames)
                ? a.selectedNames
                : (curCfg.corruptionSelectedNames || []),
            });
          }
        }
        var lore = await genCorr({
          selectedNames: Array.isArray(a.selectedNames) ? a.selectedNames : undefined,
          templateOnly: !!a.templateOnly,
        });
        if (!lore || lore.ok === false) return fail((lore && lore.error) || '恶堕世界书生成失败');
        return ok(lore);
      }
      case 'novel_patch_chapters': {
        if (!bridge.patchNovelChapters) return fail('章节补丁桥接未就绪');
        if (!a.action) return fail('缺少 action');
        maybeSnap();
        return ok(bridge.patchNovelChapters(a));
      }
      case 'novel_expand_character':
      case 'novel_rewrite_character': {
        if (!bridge.mutateNovelCharacter) return fail('小说人物桥接未就绪');
        maybeSnap();
        return ok(await bridge.mutateNovelCharacter({
          target: a.target != null ? a.target : { id: a.id, name: a.name },
          mode: a.mode || (toolName === 'novel_rewrite_character' ? 'rewrite' : 'expand'),
          instruction: a.instruction || '',
        }));
      }
      case 'novel_expand_worldbook': {
        if (!bridge.expandNovelWorldbook) return fail('小说世界书扩展桥接未就绪');
        maybeSnap();
        return ok(await bridge.expandNovelWorldbook({
          target: a.target != null ? a.target : { index: a.index, name: a.name },
          mode: a.mode || 'expand',
          instruction: a.instruction || '',
        }));
      }
      case 'novel_sync_outputs':
      case 'apply_novel_result_to_card': {
        maybeSnap();
        if (bridge.syncNovelOutputs) {
          return ok(bridge.syncNovelOutputs(a));
        }
        return ok(bridge.applyNovel(a));
      }
      case 'upsert_mvu_design': {
        maybeSnap();
        if (bridge.upsertMvuDesign) {
          return ok(bridge.upsertMvuDesign(Object.assign({}, a, { inject: a.inject === true })));
        }
        return ok(bridge.upsertMvu(Object.assign({}, a.design || a, { __inject: a.inject === true })));
      }
      case 'upsert_mvu_variables': {
        maybeSnap();
        if (bridge.upsertMvuVariables) {
          return ok(bridge.upsertMvuVariables(Object.assign({}, a, { inject: a.inject !== false })));
        }
        return ok(bridge.upsertMvu(a.design || a));
      }
      case 'clear_mvu': {
        if (!bridge.clearMvu) return fail('MVU 清空桥接未就绪');
        maybeSnap();
        return ok(bridge.clearMvu(a));
      }
      case 'patch_mvu_node': {
        if (!bridge.patchMvuNode) return fail('MVU 节点补丁桥接未就绪');
        if (!a.path) return fail('缺少 path');
        maybeSnap();
        return ok(bridge.patchMvuNode(a));
      }
      case 'apply_chat_feedback_fixes': {
        var fixes = Array.isArray(a.fixes) ? a.fixes : [];
        maybeSnap();
        var applied = [];
        for (var fi2 = 0; fi2 < fixes.length; fi2++) {
          var fx = fixes[fi2];
          var rn = await executeConfirmed(fx.tool || fx.op, fx.args || {}, { skipSnapshot: true });
          applied.push(rn);
          if (!rn.ok) break;
        }
        return ok({ applied: applied });
      }
      default:
        return fail('未知工具: ' + toolName);
    }
  }

  /**
   * 入口：分级后返回 applied / pending_confirm / result
   */
  async function invoke(toolName, args, options) {
    var opts = options || {};
    var meta = getToolByName(toolName);
    if (!meta) return fail('未注册工具: ' + toolName);

    var risk = classifyToolRisk(toolName, args);
    var preview = buildChangePreview(toolName, args);

    if (risk === 'none' || risk === 'auto' || opts.forceApply) {
      var result = await executeConfirmed(toolName, args);
      return Object.assign({}, result, {
        risk: risk,
        applied: !!result.ok && risk !== 'none',
        preview: preview,
      });
    }

    return {
      ok: true,
      risk: 'confirm',
      pendingConfirm: true,
      tool: toolName,
      args: args || {},
      preview: preview,
      message: '此操作为大改，需用户确认后再应用。',
    };
  }
  return {
    invoke: invoke,
    executeConfirmed: executeConfirmed,
    classify: classifyToolRisk,
    resolveWorldbookIndex: resolveWorldbookIndex,
    normalizeTarget: normalizeTarget,
  };

}
