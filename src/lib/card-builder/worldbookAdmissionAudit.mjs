/**
 * 世界书准入：只报告这条能不能进上下文、同组开了几条、职责字段有没有对上。
 * 不按类型凑数，不要求人物、势力、物品各有一条。
 */

function entryName(entry, index) {
  var name = String((entry && (entry.displayName || entry.comment)) || '').trim();
  return name || ('条目' + index);
}

function pushIssue(issues, issue) {
  issues.push(issue);
}

/**
 * @param {{ entries?: object[], description?: string, hasScripts?: boolean, variablePaths?: string[] }} input
 * @returns {Array<{ code: string, level: string, name?: string, message: string }>}
 */
export function auditWorldbookAdmission(input) {
  input = input || {};
  var entries = Array.isArray(input.entries) ? input.entries : [];
  var description = String(input.description || '');
  var hasScripts = !!input.hasScripts;
  var variablePaths = Array.isArray(input.variablePaths) ? input.variablePaths : [];
  var varlistText = entries.filter(function(e) {
    return e && (e.kind === 'mvu_varlist' || e.ownerSlot === 'varlist' || e.ownerSlot === 'mvu_varlist');
  }).map(function(e) { return String(e.content || ''); }).join('\n');
  var issues = [];

  if (!description.trim()) {
    pushIssue(issues, {
      code: 'empty-description',
      level: 'warn',
      message: 'Description 是空的。常驻规则没有一份总在场的契约。',
    });
  }

  var groups = {};
  entries.forEach(function(entry, index) {
    if (!entry) return;
    var name = entryName(entry, index);
    var strategy = entry.strategy || 'selective';
    var keys = Array.isArray(entry.keys) ? entry.keys.filter(function(k) { return String(k || '').trim(); }) : [];
    var enabled = entry.enabled !== false;
    var group = String(entry.group || '').trim();
    var reads = String(entry.reads || '').trim();
    var content = String(entry.content || '').trim();

    if (strategy === 'constant' && keys.length) {
      pushIssue(issues, {
        code: 'constant-keys',
        level: 'warn',
        name: name,
        message: '常驻条目带了触发词。它进不进上下文不靠这些词。',
      });
    }
    if (strategy === 'selective' && enabled && !keys.length && !group) {
      pushIssue(issues, {
        code: hasScripts ? 'maybe-script' : 'dead-selective',
        level: hasScripts ? 'hint' : 'warn',
        name: name,
        message: hasScripts
          ? '这条开着，但没有触发词，也不在同组里。若由脚本注入，可以忽略。'
          : '这条开着，没有触发词，也不在同组里。对话时进不了上下文。',
      });
    }
    if (group) {
      if (!groups[group]) groups[group] = { on: 0, total: 0 };
      groups[group].total += 1;
      if (enabled) groups[group].on += 1;
    }
    if (reads) {
      var known = variablePaths.indexOf(reads) >= 0 || (varlistText && varlistText.indexOf(reads) >= 0);
      var hasCatalog = variablePaths.length > 0 || !!varlistText;
      if (hasCatalog && !known) {
        pushIssue(issues, {
          code: 'reads-missing',
          level: 'warn',
          name: name,
          message: '读取路径「' + reads + '」不在状态栏变量里。',
        });
      }
    }
    if (strategy === 'constant' && enabled && content.length >= 40 && description.indexOf(content.slice(0, 80)) >= 0) {
      pushIssue(issues, {
        code: 'description-duplicates-constant',
        level: 'info',
        name: name,
        message: 'Description 和这条常驻的开头重复。契约留在描述里，长规则留在这一条。',
      });
    }
  });

  Object.keys(groups).forEach(function(name) {
    var g = groups[name];
    pushIssue(issues, {
      code: 'group-count',
      level: 'info',
      name: name,
      message: '同组「' + name + '」开着 ' + g.on + ' 条，共 ' + g.total + ' 条。互斥与否由作者决定。',
    });
  });

  return issues;
}

/**
 * Description 为空时，指出一段可以抬进描述的契约。不写卡，作者确认后才复制。
 * 只收较短的系统提示或常驻条目，避免把整库正文抬进描述。
 * @param {{ description?: string, systemPrompt?: string, entries?: object[] }} input
 * @returns {{ source: string, name: string, text: string } | null}
 */
export function suggestContractLift(input) {
  input = input || {};
  if (String(input.description || '').trim()) return null;
  var system = String(input.systemPrompt || '').trim();
  if (system.length >= 12 && system.length <= 800) {
    return { source: 'system_prompt', name: '系统提示', text: system };
  }
  var entries = Array.isArray(input.entries) ? input.entries : [];
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    if (!entry || entry.enabled === false) continue;
    var constant = entry.strategy === 'constant' || entry.constant === true;
    if (!constant) continue;
    var text = String(entry.content || '').trim();
    if (text.length < 12 || text.length > 800) continue;
    return {
      source: 'constant',
      name: String(entry.displayName || entry.comment || '常驻条目'),
      text: text,
    };
  }
  return null;
}
