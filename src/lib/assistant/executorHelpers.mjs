/**
 * 助手工具执行器 helpers（拆自 executor）
 */
import { VALID_VIEWS } from './tools.mjs';
import { resolveWorldbookIndex } from './executorResolve.mjs';

export function createExecutorHelpers(bridge, snaps) {
  function ok(data, extra) {
    return Object.assign({ ok: true, data: data }, extra || {});
  }
  function fail(message, extra) {
    return Object.assign({ ok: false, error: message }, extra || {});
  }

  function findWbIndex(entries, args) {
    return resolveWorldbookIndex(entries, args);
  }

  function searchCard(query, limit) {
    var q = String(query || '').trim().toLowerCase();
    var lim = Math.min(Math.max(limit || 20, 1), 50);
    if (!q) return [];
    var hits = [];
    var char = bridge.getCharacter() || {};
    Object.keys(char).forEach(function(k) {
      var text = String(char[k] == null ? '' : char[k]);
      if (text.toLowerCase().indexOf(q) >= 0) {
        hits.push({ source: 'character', field: k, snippet: text.slice(0, 160) });
      }
    });
    var wb = bridge.getWorldbook() || [];
    wb.forEach(function(e, idx) {
      var blob = ((e.comment || '') + '\n' + (e.content || '') + '\n' + (Array.isArray(e.keys) ? e.keys.join(',') : '')).toLowerCase();
      if (blob.indexOf(q) >= 0) {
        hits.push({
          source: 'worldbook',
          index: idx,
          comment: e.comment || '',
          snippet: String(e.content || '').slice(0, 160),
        });
      }
    });
    return hits.slice(0, lim);
  }

  /** 本地启发式（LLM 不可用时的回退） */
  function analyzeChatLocal(feedback) {
    var fb = feedback || bridge.getChatFeedback() || {};
    var messages = Array.isArray(fb.messages) ? fb.messages : [];
    var issues = [];
    var fixes = [];
    var joined = messages.map(function(m) { return m.content || ''; }).join('\n');
    if (!messages.length) {
      issues.push({ type: 'empty_chat', message: '试聊尚无历史，请先进行几轮对话。' });
    }
    if (joined.length < 80 && messages.length) {
      issues.push({ type: 'short_replies', message: '回复偏短，可加强人设主动性或 RP 指令。' });
      fixes.push({
        tool: 'expand_character_field',
        args: { field: 'charDesc', mode: 'expand', instruction: '加强主动性与 RP 指引，避免短回复' },
      });
    }
    var char = bridge.getCharacter() || {};
    var desc = String(char.charDesc || '');
    if (desc.length < 120) {
      issues.push({ type: 'thin_desc', message: '角色描述偏短，试聊易跑偏。' });
      fixes.push({
        tool: 'expand_character_field',
        args: { field: 'charDesc', mode: 'expand', instruction: '补全性格、说话方式与互动边界' },
      });
    }
    var wb = bridge.getWorldbook() || [];
    var noKeys = wb.filter(function(e) { return !e.keys || !e.keys.length; }).length;
    if (noKeys > 0) {
      issues.push({ type: 'missing_keys', message: noKeys + ' 条世界书缺少 keys，试聊难触发。' });
      fixes.push({ tool: 'batch_fill_worldbook_keys', args: { onlyMissing: true } });
    }
    var skeleton = wb.filter(function(e) { return String(e.content || '').length < 40; }).length;
    if (skeleton > 0) {
      issues.push({ type: 'skeleton', message: skeleton + ' 条世界书仍是短骨架，建议展开。' });
    }
    return { messageCount: messages.length, issues: issues, fixes: fixes, sample: messages.slice(-6), source: 'local' };
  }

  /** 根据 lint/审计构造可执行 ops */
  function buildLintFixOps(maxOps) {
    var lim = Math.min(Math.max(maxOps || 12, 1), 30);
    var lint = bridge.lintCard() || { issues: [] };
    var audit = bridge.auditWorldbook() || {};
    var ops = [];
    var wb = bridge.getWorldbook() || [];
    var char = bridge.getCharacter() || {};

    (lint.issues || []).forEach(function(issue) {
      if (ops.length >= lim) return;
      var code = issue.code || '';
      if (code === 'no_name' || /缺少角色名/.test(issue.message || '')) {
        // 无法自动命名，跳过
      } else if (code === 'short_desc' || /角色描述偏短/.test(issue.message || '')) {
        ops.push({
          op: 'expand_character_field',
          args: { field: 'charDesc', mode: 'expand', instruction: '补足至可支撑试聊的完整人设' },
        });
      } else if (code === 'no_first_mes' || /缺少开场白/.test(issue.message || '')) {
        if (!char.firstMes) {
          ops.push({
            op: 'expand_greeting',
            args: { target: 'main', instruction: '写一段贴合人设的开场白' },
          });
        }
      } else if (/缺少触发词|noKeys|wb_/.test(code + (issue.message || '')) && /触发词/.test(issue.message || issue.title || '')) {
        ops.push({ op: 'batch_fill_worldbook_keys', args: { onlyMissing: true } });
      } else if (/骨架/.test(issue.message || issue.title || '')) {
        // 展开前几条短骨架
        var shortIdx = [];
        wb.forEach(function(e, i) {
          if (String(e.content || '').length < 60) shortIdx.push(i);
        });
        shortIdx.slice(0, 3).forEach(function(idx) {
          if (ops.length < lim) {
            ops.push({
              op: 'expand_worldbook_entry',
              args: { target: { index: idx }, mode: 'expand', instruction: '展开为完整设定' },
            });
          }
        });
      }
    });

    if ((audit.noKeys || 0) > 0 && !ops.some(function(o) { return o.op === 'batch_fill_worldbook_keys'; })) {
      ops.push({ op: 'batch_fill_worldbook_keys', args: { onlyMissing: true } });
    }
    if ((audit.skeleton || 0) > 0) {
      var addedExpand = ops.filter(function(o) { return o.op === 'expand_worldbook_entry'; }).length;
      if (!addedExpand) {
        wb.forEach(function(e, i) {
          if (ops.length >= lim) return;
          if (String(e.content || '').length < 60) {
            ops.push({
              op: 'expand_worldbook_entry',
              args: { target: { index: i }, instruction: '展开骨架' },
            });
          }
        });
      }
    }

    // 去重同名工具（batch 类只留一次）
    var seen = {};
    ops = ops.filter(function(o) {
      if (o.op === 'batch_fill_worldbook_keys') {
        if (seen.batch_keys) return false;
        seen.batch_keys = true;
      }
      return true;
    }).slice(0, lim);

    return { lint: lint, audit: audit, ops: ops };
  }

  return { ok: ok, fail: fail, findWbIndex: findWbIndex, searchCard: searchCard, analyzeChatLocal: analyzeChatLocal, buildLintFixOps: buildLintFixOps };
}
