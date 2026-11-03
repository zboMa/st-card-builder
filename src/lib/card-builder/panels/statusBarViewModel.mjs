import {
  STATUS_BAR_MODULES,
  STATUS_BAR_MODULE_GROUPS,
  STATUS_BAR_PRESETS,
  excludeCardNameFromCharacters,
  getPresetById,
  resolveModuleFlags,
} from '../../statusBar.mjs';

export function buildPresetView(design) {
  var d = design || {};
  return STATUS_BAR_PRESETS.map(function(preset) {
    return {
      id: preset.id,
      label: preset.label,
      nsfw: !!preset.nsfw,
      active: preset.id === d.presetId,
    };
  });
}

export function buildModuleGroupsView(design) {
  var d = design || {};
  var flags = resolveModuleFlags(d.presetId, d.moduleFlags, d.nsfw);
  var groups = [];
  STATUS_BAR_MODULE_GROUPS.forEach(function(group) {
    var items = STATUS_BAR_MODULES.filter(function(mod) {
      if (mod.group !== group.id) return false;
      if (mod.nsfw && !d.nsfw) return false;
      return true;
    }).map(function(mod) {
      return {
        id: mod.id,
        label: mod.label,
        hint: mod.hint || '',
        checked: !!flags[mod.id],
      };
    });
    if (!items.length) return;
    groups.push({ id: group.id, label: group.label, items: items });
  });
  return groups;
}

export function buildCharacterView(design, charName) {
  var list = excludeCardNameFromCharacters((design || {}).characters, charName);
  return list.map(function(c) {
    return {
      name: String(c.name || ''),
      identity: String(c.identity || ''),
      selected: c.selected === true,
    };
  });
}

export function buildStatusBarStepMarks(design, paths, charName) {
  var d = design || {};
  var flags = d.moduleFlags || {};
  var anyModule = Object.keys(flags).some(function(k) { return !!flags[k]; });
  var picked = buildCharacterView(d, charName).filter(function(c) { return c.selected; }).length;
  return {
    1: !!(d.includeProtagonist || picked),
    2: anyModule,
    3: Array.isArray(paths) && paths.length > 0,
    4: !!String(d.layoutPrompt || '').trim(),
  };
}

/**
 * 状态栏 UI 快照。设计仍在 cardBuilderExtensions，这里只做可渲染投影。
 * @param {object} design
 * @param {{ charName?: string, paths?: any[], tree?: object, view?: string, busy?: object, previewHtml?: string, snippetCode?: string, hintText?: string, floorLabel?: string, canPrev?: boolean, canNext?: boolean }} [opts]
 */
export function buildStatusBarView(design, opts) {
  var d = design || {};
  var o = opts || {};
  var paths = Array.isArray(o.paths) ? o.paths : [];
  var tree = o.tree && typeof o.tree === 'object' ? o.tree : {};
  var preset = getPresetById(d.presetId);
  return {
    includeProtagonist: !!d.includeProtagonist,
    nsfw: !!d.nsfw,
    extra: String(d.extra || ''),
    layoutPrompt: String(d.layoutPrompt || ''),
    charName: String(o.charName || ''),
    presetId: d.presetId || preset.id,
    presetLabel: preset.label,
    presets: buildPresetView(d),
    moduleGroups: buildModuleGroupsView(d),
    characters: buildCharacterView(d, o.charName),
    paths: paths,
    tree: tree,
    hasTree: Object.keys(tree).length > 0,
    previewHtml: String(o.previewHtml || ''),
    snippetCode: String(o.snippetCode || ''),
    hintText: String(o.hintText || ''),
    floorLabel: String(o.floorLabel || '尚无样例'),
    canPrev: !!o.canPrev,
    canNext: !!o.canNext,
    view: o.view || 'preview',
    generateLabel: paths.length ? '重新生成' : '生成',
    stepDone: buildStatusBarStepMarks(d, paths, o.charName),
    busy: o.busy || { vars: false, layout: false, sample: false },
    hasLayout: !!String(d.customBodyHtml || '').trim(),
    hasPaths: paths.length > 0,
  };
}
