/**
 * 世界与限定面板的纯视图构建（无 DOM、无副作用）。
 * 输入卡片状态 + 目录数据（window.__nsfwFlavorData__），输出可直接渲染的快照。
 */
import {
  listWorldviewPresetsByGroup,
  getWorldviewPreset,
  primaryWorldviewPresetId,
  MAX_WORLDVIEW_PRESET_ITEMS,
} from '../../presets/worldviews/index.mjs';
import { pickCorruptionTargets } from '../../corruptionProgress.mjs';
import { pickAffectionTargets } from '../../affectionProgress.mjs';
import { NTL_GROUPS, NTL_GROUP_IDS } from '../../adult/ntl/groups.mjs';

function asItems(list) {
  return Array.isArray(list) ? list : [];
}

function ensureNtlItems(state) {
  var raw = asItems(state.ntlTabooItems);
  if (raw.length) return raw;
  return asItems(state.ntlTabooTypes).map(function (id) {
    return { id: id, note: '' };
  });
}

export function dashedRow(kind, it, idx, total, data) {
  var title = '';
  var tag = '';
  var blurb = '';
  var notePlaceholder = '可选：补充额外要求';
  if (kind === 'worldview') {
    var p = getWorldviewPreset(it.id) || { label: it.id, summary: '', description: '' };
    title = p.label;
    tag = idx === 0 ? '主' : '叠加';
    blurb = p.summary || String(p.description || '').slice(0, 40);
    if (p.description && !p.summary && p.description.length > 40) blurb += '…';
    notePlaceholder = '可选备注（如：修仙为壳，魅魔为隐秘族群）';
  } else if (kind === 'flavor') {
    var f = (data.presets && data.presets[it.id]) || { label: it.id, summary: '' };
    title = f.label;
    tag = idx === 0 ? '主调色盘' : '';
    blurb = f.summary || '';
    notePlaceholder = '可选：补充该口味的额外提示';
  } else if (kind === 'posture' || kind === 'speech') {
    var presets = kind === 'speech' ? (data.speechPresets || {}) : (data.posturePresets || {});
    var pe = presets[it.id] || { label: it.id, summary: '' };
    title = pe.label;
    blurb = pe.summary || '';
    notePlaceholder = '可选：补充该条表达层的额外要求';
  } else {
    var info = (data.tabooTypes && data.tabooTypes[it.id]) || { label: it.id, summary: '' };
    title = info.label;
    if (it.id === 'yuri_destruction') tag = '百合破坏';
    blurb = info.summary || '';
    notePlaceholder = '可选：补充该禁忌方向的额外要求';
  }
  var canMove = kind !== 'ntl';
  return {
    id: it.id,
    title: title,
    tag: tag,
    blurb: blurb,
    note: it.note || '',
    notePlaceholder: notePlaceholder,
    canMove: canMove,
    canUp: canMove && idx > 0,
    canDown: canMove && idx < total - 1,
  };
}

function rows(kind, items, data) {
  var list = asItems(items);
  return list.map(function (it, idx) {
    return dashedRow(kind, it, idx, list.length, data);
  });
}

export function buildWorldframeView(state, data) {
  var forced = state.adultWorldframeForced || '';
  var effectiveId = forced || state.adultWorldframe || '';
  var info = forced && data.worldframes && data.worldframes[forced]
    ? { id: forced, label: data.worldframes[forced].label, confidence: 1, source: 'forced' }
    : (effectiveId && data.worldframes && data.worldframes[effectiveId]
      ? { id: effectiveId, label: data.worldframes[effectiveId].label, confidence: 0.7, source: 'cached' }
      : { id: '', label: '未推断', confidence: null, source: '' });
  var conf = info.confidence != null ? (' · ' + Math.round(info.confidence * 100) + '%') : '';
  var src = info.source === 'forced' ? '手动' : (info.source === 'infer' ? '自动' : (info.source || ''));
  var options = [{ value: '', label: '自动（跟主预设）' }];
  asItems(data.worldframeIds).forEach(function (id) {
    if (id === 'generic') return;
    var wf = data.worldframes && data.worldframes[id];
    var sum = (wf && wf.summary) ? (' · ' + wf.summary) : '';
    options.push({ value: id, label: ((wf && wf.label) || id) + sum });
  });
  options.push({ value: 'generic', label: '通用' });

  var items = asItems(state.worldviewPresetItems);
  var primaryId = primaryWorldviewPresetId(items);
  var p = getWorldviewPreset(primaryId);
  var mapHint = forced
    ? '已手动强制；与主预设脱钩'
    : (p
      ? '由预设「' + (p.label || primaryId) + '」→ 框架「' + (info.label || info.id) + '」'
      : '未选预设时按卡面推断；口味/NTL 物化为该世界的载体');

  return {
    forced: forced,
    effectiveId: info.id,
    label: (info.label || info.id || '未推断') + conf + (src ? '（' + src + '）' : ''),
    mapHint: mapHint,
    options: options,
  };
}

export function buildCorruptionTargets(candidates, state) {
  var selectedNames = asItems(state.corruptionSelectedNames).slice();
  var picks = pickCorruptionTargets(asItems(candidates), {
    defaultFemaleOnly: state.corruptionDefaultFemaleOnly !== false,
    selectedNames: selectedNames,
    includeUnknown: state.corruptionDefaultFemaleOnly === false,
  });
  return picks.map(function (p, i) {
    return {
      index: i,
      name: p.name,
      selected: selectedNames.indexOf(p.name) >= 0,
      meta: p.female ? '女' : (p.male ? '男' : '未知'),
      female: !!p.female,
      male: !!p.male,
      unknown: !!p.unknown,
    };
  });
}

export function buildAffectionTargets(candidates, state) {
  var selectedNames = asItems(state.affectionSelectedNames).slice();
  var picks = pickAffectionTargets(asItems(candidates));
  return picks.map(function (p, i) {
    return {
      index: i,
      name: p.name,
      selected: selectedNames.indexOf(p.name) >= 0,
      meta: p.female ? '女' : (p.male ? '男' : '未知'),
      female: !!p.female,
      male: !!p.male,
      unknown: !!p.unknown,
    };
  });
}

export function buildAdultLists(state, data) {
  var worldview = asItems(state.worldviewPresetItems);
  var flavor = asItems(state.nsfwFlavorItems);
  var posture = asItems(state.eroticPostureItems);
  var speech = asItems(state.eroticSpeechItems);
  var ntl = ensureNtlItems(state);
  return {
    worldview: rows('worldview', worldview, data),
    flavor: rows('flavor', flavor, data),
    posture: rows('posture', posture, data),
    speech: rows('speech', speech, data),
    ntl: rows('ntl', ntl, data),
    caps: {
      worldview: worldview.length
        ? ('已选 ' + worldview.length + ' / ' + MAX_WORLDVIEW_PRESET_ITEMS)
        : ('最多 ' + MAX_WORLDVIEW_PRESET_ITEMS + ' 项'),
      flavor: flavor.length
        ? ('已选 ' + flavor.length + ' / ' + ((data && data.maxItems) || 5))
        : ('最多 ' + ((data && data.maxItems) || 5) + ' 个'),
    },
  };
}

function itemPreview(full) {
  function pv(value) {
    return Array.isArray(value) ? value.join(' / ') : (value == null ? '' : String(value));
  }
  if (!full) return [];
  var blocks = [
    ['说明', pv(full.description)],
    ['写法', pv(full.writingGuide)],
    ['要求', pv(full.mustCover)],
    ['避免', pv(full.avoid)],
    ['反模式', pv(full.antiPatterns)],
    ['焦点', pv(full.focus)],
    ['色盘', pv(full.palette)],
    ['密度提示', pv(full.densityHint)],
    ['信号', pv(full.signals)],
    ['框架映射', pv(full.mapsToWorldframe)],
    ['词库', pv(full.lexicon)],
    ['场景骨架', pv(full.skeletonHints)],
  ];
  return blocks.filter(function (b) { return b[1]; });
}

export function buildAddCatalog(kind, state, data) {
  var selected = Object.create(null);
  var out = [];
  if (kind === 'worldview') {
    asItems(state.worldviewPresetItems).forEach(function (it) { selected[it.id] = true; });
    listWorldviewPresetsByGroup().forEach(function (g) {
      var items = asItems(g.items).filter(function (it) { return !selected[it.id]; });
      if (!items.length) return;
      out.push({
        id: g.id,
        label: g.label,
        items: items.map(function (it) {
          var p = getWorldviewPreset(it.id);
          return { id: it.id, label: it.label, summary: it.summary || '', description: it.description || '', full: p || null };
        }),
      });
    });
    return out;
  }
  if (kind === 'flavor') {
    asItems(state.nsfwFlavorItems).forEach(function (it) { selected[it.id] = true; });
    var groups = {};
    var groupOrder = [];
    asItems(data.groups).forEach(function (g) {
      var gid = typeof g === 'string' ? g : (g.id || g.label);
      if (gid) { groups[gid] = []; groupOrder.push(gid); }
    });
    if (!groupOrder.length) {
      groupOrder = ['基础属性', '关系形态', '场景氛围', '感官焦点', '特殊癖好'];
    }
    asItems(data.ids).forEach(function (id) {
      if (selected[id]) return;
      var f = data.presets && data.presets[id];
      var g = (f && f.group) || '场景氛围';
      if (!groups[g]) { groups[g] = []; if (groupOrder.indexOf(g) < 0) groupOrder.push(g); }
      groups[g].push(id);
    });
    groupOrder.forEach(function (g) {
      if (!groups[g] || !groups[g].length) return;
      out.push({
        id: g,
        label: g,
        items: groups[g].map(function (id) {
          var f = data.presets[id];
          return { id: id, label: f.label, summary: f.summary || '', description: f.description || '', full: f || null };
        }),
      });
    });
    return out;
  }
  if (kind === 'posture' || kind === 'speech') {
    var isSpeech = kind === 'speech';
    var cur = isSpeech ? state.eroticSpeechItems : state.eroticPostureItems;
    asItems(cur).forEach(function (it) { selected[it.id] = true; });
    var presets = isSpeech ? (data.speechPresets || {}) : (data.posturePresets || {});
    var groupList = isSpeech ? (data.speechGroups || []) : (data.postureGroups || []);
    var ids = isSpeech ? (data.speechIds || []) : (data.postureIds || []);
    groupList.forEach(function (g) {
      var gid = typeof g === 'string' ? g : (g && (g.id || g.label));
      if (!gid) return;
      var groupIds = ids.filter(function (id) {
        var p = presets[id];
        return !selected[id] && p && (p.group || '') === gid;
      });
      if (!groupIds.length) return;
      out.push({
        id: gid,
        label: gid,
        items: groupIds.map(function (id) {
          var p = presets[id];
          return { id: id, label: p.label, summary: p.summary || '', description: p.description || '', full: p || null };
        }),
      });
    });
    var leftovers = ids.filter(function (id) {
      var p = presets[id];
      return !selected[id] && (!p || !p.group || !groupList.some(function (g) {
        return (typeof g === 'string' ? g : (g && (g.id || g.label))) === p.group;
      }));
    });
    if (leftovers.length) {
      out.push({
        id: 'other',
        label: '其他',
        items: leftovers.map(function (id) {
          var p = presets[id];
          return { id: id, label: p.label, summary: p.summary || '', description: p.description || '', full: p || null };
        }),
      });
    }
    return out;
  }
  ensureNtlItems(state).forEach(function (it) { selected[it.id] = true; });
  NTL_GROUP_IDS.forEach(function (gid) {
    var meta = NTL_GROUPS[gid] || { id: gid, label: gid };
    var items = (data.tabooIds || []).filter(function (id) {
      if (selected[id]) return false;
      var t = data.tabooTypes && data.tabooTypes[id];
      return t && (t.group || '') === gid;
    }).map(function (id) {
      var t = data.tabooTypes[id];
      return { id: id, label: t.label, summary: t.summary || '', description: t.description || '', full: t || null };
    });
    if (!items.length) return;
    out.push({ id: gid, label: meta.label, items: items });
  });
  var ntlLeft = (data.tabooIds || []).filter(function (id) {
    if (selected[id]) return false;
    var t = data.tabooTypes && data.tabooTypes[id];
    return t && NTL_GROUP_IDS.indexOf(t.group) < 0;
  }).map(function (id) {
    var t = data.tabooTypes[id];
    return { id: id, label: t.label, summary: t.summary || '', description: t.description || '', full: t || null };
  });
  if (ntlLeft.length) out.push({ id: 'other', label: '其他', items: ntlLeft });
  return out;
}

export function buildAddModal(kind, state, data) {
  if (!kind || !data) return null;
  var meta = kind === 'worldview'
    ? { label: '世界观预设', hint: '最多 ' + MAX_WORLDVIEW_PRESET_ITEMS + ' 项；首项为主底盘，其余为叠加层' }
    : kind === 'flavor'
      ? { label: '口味', hint: '最多 ' + ((data.maxItems) || 5) + ' 个；首项为主调色盘' }
      : kind === 'posture'
        ? { label: '姿势语言', hint: '不占口味槽；可多选；禁止儿童性化' }
        : kind === 'speech'
          ? { label: '情趣话风', hint: '不占口味槽；可多选；禁止儿童性化' }
          : { label: 'NTL 禁忌', hint: '权力/背德/越界/百破等；多选' };
  var current = kind === 'worldview' ? state.worldviewPresetItems
    : kind === 'flavor' ? state.nsfwFlavorItems
      : kind === 'speech' ? state.eroticSpeechItems
        : kind === 'posture' ? state.eroticPostureItems
          : ensureNtlItems(state);
  var cap = kind === 'worldview'
    ? (' / ' + MAX_WORLDVIEW_PRESET_ITEMS)
    : (kind === 'flavor' ? (' / ' + ((data.maxItems) || 5)) : '');
  var max = kind === 'worldview' ? MAX_WORLDVIEW_PRESET_ITEMS
    : kind === 'flavor' ? ((data.maxItems) || 5)
      : 0;
  return {
    kind: kind,
    label: meta.label,
    hint: meta.hint,
    max: max,
    catalog: buildAddCatalog(kind, state, data),
    selected: rows(kind, current, data),
    selectedHead: '已选： ' + asItems(current).length + cap,
  };
}

export function buildAdultView(state, data, candidates) {
  if (!data) {
    return {
      lists: { worldview: [], flavor: [], posture: [], speech: [], ntl: [], caps: { worldview: '', flavor: '' } },
      worldframe: { forced: '', effectiveId: '', label: '未推断', mapHint: '', options: [] },
      corruptionTargets: [],
      affectionTargets: [],
    };
  }
  return {
    lists: buildAdultLists(state, data),
    worldframe: buildWorldframeView(state, data),
    corruptionTargets: buildCorruptionTargets(candidates && candidates.corruption, state),
    affectionTargets: buildAffectionTargets(candidates && candidates.affection, state),
  };
}

export function buildAddItemPreview(kind, catalog, id) {
  var info = null;
  asItems(catalog).forEach(function (g) {
    asItems(g.items).forEach(function (it) { if (it.id === id) info = it; });
  });
  if (!info) return null;
  return {
    title: info.label,
    summary: info.full && info.full.summary ? info.full.summary : '',
    blocks: itemPreview(info.full),
    description: info.description || info.summary || '',
  };
}
