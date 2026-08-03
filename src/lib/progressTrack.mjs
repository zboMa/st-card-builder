/**
 * 数值进度线共享基础：0-100 档位映射 + 总则/推进规则/事件锚点模板
 *
 * 供恶堕进度、亲密度（纯爱线）两条平行线复用：
 * - 变量统一为 0-100 数值；当前档位 = 数值映射到阶段表
 * - 推进绑定「事件锚点」，禁止凭空增减，防止速通
 * - 恶堕单向只升，亲密度可双向波动（direction 参数区分）
 */

function asList(v) {
  if (!Array.isArray(v)) return [];
  var out = [];
  var seen = Object.create(null);
  v.forEach(function(x) {
    var s = String(x == null ? '' : x).trim();
    if (!s || seen[s]) return;
    seen[s] = true;
    out.push(s);
  });
  return out;
}

/** 0-100 数值 → 档位索引（按阶段数等分；100 归末档） */
export function valueToStageIndex(value, stageCount) {
  var v = Number(value);
  if (!isFinite(v)) v = 0;
  v = Math.max(0, Math.min(100, v));
  var count = Math.max(2, Math.floor(stageCount) || 5);
  var idx = Math.floor((v / 100) * count);
  return Math.max(0, Math.min(count - 1, idx));
}

/** 0-100 数值 → 当前阶段名 */
export function valueToStageName(value, stageNames) {
  var names = asList(stageNames);
  if (!names.length) return '';
  return names[valueToStageIndex(value, names.length)];
}

/** 档位边界表（供展示）：[{ name, from, to }]，整数闭区间 */
export function stageBoundaries(stageNames) {
  var names = asList(stageNames);
  var count = names.length;
  if (!count) return [];
  return names.map(function(n, i) {
    return {
      name: n,
      from: Math.floor((i / count) * 100),
      to: Math.floor(((i + 1) / count) * 100) - (i === count - 1 ? 0 : 1),
    };
  });
}

/** 档位映射表文本 */
export function formatStageMap(stageNames) {
  return stageBoundaries(stageNames).map(function(b) {
    return b.from + '-' + b.to + ' ' + b.name;
  }).join('\n');
}

/**
 * 数值进度总则（世界书正文）
 * @param {{
 *   title: string,            // 总则标题，如「恶堕进度总则」
 *   statusLabel: string,      // 变量标签，如「恶堕进度」
 *   archivePrefix: string,    // 档案条目前缀，如「恶堕档案·」
 *   stageNames: string[],
 *   direction?: 'ascend'|'fluctuate',
 *   singleStepMax?: number,
 *   anchorNote?: string,      // 额外说明（通用档案等）
 *   anchorLines?: string,     // 事件锚点表（升档/降档触发事件）
 * }} opts
 */
export function buildTrackRulesContent(opts) {
  var o = opts || {};
  var stages = asList(o.stageNames);
  var label = o.statusLabel || '进度';
  var archivePrefix = o.archivePrefix || '';
  var singleStepMax = o.singleStepMax || 15;
  var lines = [];
  lines.push('【' + (o.title || '进度总则') + '】');
  lines.push('本卡使用状态栏/MVU 变量「' + label + '」标记每位适用角色的当前进度（0-100 数值）。');
  lines.push('档位映射表（变量值 → 当前阶段）：');
  lines.push(formatStageMap(stages));
  lines.push('扮演时：只采用该角色「' + archivePrefix + '」条目中与当前档位对应的阶段内容，禁止混用其他阶段。');
  lines.push('同档内数值高低表示程度深浅（高者更深入该阶段），行为基调仍以档位档案为准。');
  lines.push('推进规则：');
  if (o.direction === 'fluctuate') {
    lines.push('- 双向可波动：关系推进可升、冲突/伤害/长期冷落可降，但每次增减同样必须对应剧情事件。');
  } else {
    lines.push('- 单向递增：只升不降；禁止无铺垫回退，通常按档位渐进。');
  }
  lines.push('- 禁止凭空增减：每次变化必须对应剧情中可指认的事件，无事件不得涨落。');
  lines.push('- 单次单一事件变动上限 ±' + singleStepMax + ' 点；即使重大事件也不得一次跨满一档以上。');
  lines.push('- 跨档需「里程碑/重大事件」：按下方锚点表执行，禁止无锚点跳档。');
  lines.push('- 每次变化须在叙事中给出明确诱因与心理/关系代价，并留下可回看的痕迹。');
  if (o.anchorNote) lines.push(o.anchorNote);
  if (o.anchorLines) lines.push(o.anchorLines);
  return lines.join('\n');
}

/** 档案正文模板（按阶段分节，每节占位） */
export function buildTrackArchiveContentTemplate(opts) {
  var o = opts || {};
  var name = String(o.charName || '').trim() || '角色';
  var stages = asList(o.stageNames);
  var statusLabel = o.statusLabel || '进度';
  var lines = [];
  lines.push('【' + name + ' · ' + (o.archiveTitle || '进度档案') + '】');
  lines.push('【读取状态栏/MVU「' + statusLabel + '」数值（0-100）；仅采用与当前档位对应的阶段，禁止混用其他阶段】');
  lines.push('');
  stages.forEach(function(stage) {
    lines.push('## ' + stage);
    (o.sectionHints || []).forEach(function(h) {
      lines.push('- ' + h + '：（按「' + stage + '」档位、结合该角色初始设定展开）');
    });
    if (o.breakthroughHint) lines.push('- 突破条件：（' + o.breakthroughHint + '）');
    lines.push('');
  });
  return lines.join('\n').trim() + '\n';
}
