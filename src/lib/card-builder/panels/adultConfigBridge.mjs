/**
 * 世界与限定：Vue ⇄ 旧世界桥。
 * - adultApi：Vue 组件唯一调用入口（写入走 actions / panel 内部逻辑）。
 * - window.__*__：保留给助手工具 / 世界书 / 导出等旧调用方。
 */
import {
  CORRUPTION_PRESETS,
  DEFAULT_CORRUPTION_PRESET,
  resolveStageNames,
  buildCorruptionExportIssues,
} from '../../corruptionProgress.mjs';
import {
  AFFECTION_PRESETS,
  DEFAULT_AFFECTION_PRESET,
  resolveAffectionStageNames,
  buildAffectionExportIssues,
} from '../../affectionProgress.mjs';
import { normalizeWorldviewPresetItems, primaryWorldviewPresetId } from '../../presets/worldviews/index.mjs';
import { formatAdultModeLine } from '../../assistant/generationContext.mjs';
import { buildAdultCanonDigest } from '../../adult/canon.mjs';
import { setCardKeys } from '../../store/cardStore.mjs';
import { adultUiStore, setAdultBusy } from '../../store/adultStore.mjs';
import { buildAdultView, buildAddModal, buildAddItemPreview } from './adultViewModel.mjs';

/** @param {object} ctx @param {object} s @param {object} panel */
export function installAdultConfigBridge(ctx, s, panel) {
  function data() {
    return window.__nsfwFlavorData__ || null;
  }

  function buildView() {
    return buildAdultView(ctx.state, data(), {
      corruption: panel.collectCorruptionCandidates(),
      affection: panel.collectAffectionCandidates(),
    });
  }

  function addView() {
    var modal = adultUiStore.get().addModal || {};
    if (!modal.open || !modal.kind) return null;
    return buildAddModal(modal.kind, ctx.state, data());
  }

  function previewAddItem(id) {
    var modal = adultUiStore.get().addModal || {};
    var view = buildAddModal(modal.kind, ctx.state, data());
    if (!view) return null;
    return buildAddItemPreview(modal.kind, view.catalog, id);
  }

  function commitUi() {
    setCardKeys({});
  }

  var adultApi = {
    buildView: buildView,
    addView: addView,
    previewAddItem: previewAddItem,
    initSelections: function () {
      if (panel.initSelections) panel.initSelections();
    },

    toggle: async function (kind, on) {
      if (kind === 'nsfw') {
        var onNsfw = !!on;
        if (!(await s.confirmAdultOp(onNsfw
          ? '启用 NSFW？将显示口味 / 姿势语言 / 情趣话风配置。'
          : '关闭 NSFW？口味与表达层将隐藏（已选项仍保留在卡内）。'))) return false;
        ctx.state.nsfwEnabled = onNsfw;
        panel.syncNsfwBlockFromUi();
        return true;
      }
      if (kind === 'ntl') {
        var onNtl = !!on;
        if (!(await s.confirmAdultOp(onNtl ? '启用 NTL 禁忌层？' : '关闭 NTL 禁忌层？已选项仍保留在卡内。'))) return false;
        ctx.state.ntlEnabled = onNtl;
        panel.syncNsfwBlockFromUi();
        return true;
      }
      if (kind === 'corruption') {
        var onCorr = !!on;
        if (!(await s.confirmAdultOp(onCorr
          ? '启用恶堕进度线？将显示阶段与档案生成配置。'
          : '关闭恶堕进度线？已生成内容仍保留在世界书中。'))) return false;
        ctx.state.corruptionEnabled = onCorr;
        if (onCorr && !ctx.state.nsfwEnabled) ctx.state.nsfwEnabled = true;
        panel.syncCorruptionBlockFromUi();
        return true;
      }
      if (kind === 'affection') {
        var onAff = !!on;
        if (!(await s.confirmAdultOp(onAff
          ? '启用纯爱线（亲密度）？将显示档位与档案生成配置。'
          : '关闭纯爱线？已生成内容仍保留在世界书中。'))) return false;
        ctx.state.affectionEnabled = onAff;
        panel.syncAffectionBlockFromUi();
        return true;
      }
      return false;
    },

    setCorruptionPreset: function (value) {
      ctx.state.corruptionPreset = String(value || '');
      panel.syncCorruptionBlockFromUi();
    },
    setCorruptionBrief: function (value) {
      ctx.state.corruptionCustomBrief = String(value || '');
      panel.syncCorruptionBlockFromUi({ skipRender: true });
    },
    setCorruptionExtra: function (value) {
      ctx.state.corruptionExtraNotes = String(value || '');
      panel.syncCorruptionBlockFromUi({ skipRender: true });
    },
    setCorruptionFemaleOnly: function (on) {
      ctx.state.corruptionDefaultFemaleOnly = !!on;
      ctx.state.corruptionSelectedNames = [];
      panel.syncCorruptionBlockFromUi();
    },
    setCorruptionSync: function (on) {
      ctx.state.corruptionSyncStatusBar = !!on;
      panel.syncCorruptionBlockFromUi({ skipRender: true });
    },
    setCorruptionSelected: function (names) {
      panel.setCorruptionSelected(names);
    },

    setAffectionPreset: function (value) {
      ctx.state.affectionPreset = String(value || '');
      panel.syncAffectionBlockFromUi();
    },
    setAffectionBrief: function (value) {
      ctx.state.affectionCustomBrief = String(value || '');
      panel.syncAffectionBlockFromUi({ skipRender: true });
    },
    setAffectionExtra: function (value) {
      ctx.state.affectionExtraNotes = String(value || '');
      panel.syncAffectionBlockFromUi({ skipRender: true });
    },
    setAffectionSync: function (on) {
      ctx.state.affectionSyncStatusBar = !!on;
      panel.syncAffectionBlockFromUi({ skipRender: true });
    },
    setAffectionSelected: function (names) {
      panel.setAffectionSelected(names);
    },

    refreshTargets: function (kind) {
      if (kind === 'affection') {
        panel.setAffectionSelected(ctx.state.affectionSelectedNames || []);
        panel.setAffectionTip('已刷新角色列表', 'ok');
      } else {
        panel.setCorruptionSelected(ctx.state.corruptionSelectedNames || []);
        panel.setCorruptionTip('已刷新角色列表', 'ok');
      }
    },

    setWorldframe: async function (value) {
      var v = String(value || '');
      var lab = v && data() && data().worldframes && data().worldframes[v]
        ? data().worldframes[v].label
        : (v || '自动（跟主预设）');
      if (!(await s.confirmAdultOp(v
        ? { title: '手动锁定载体框架？', message: '将锁定为「' + lab + '」。' }
        : { title: '取消手动覆盖？', message: '改回自动跟随主预设。' }))) return false;
      panel.setWorldframeForced(v);
      return true;
    },
    refreshWorldframe: async function () {
      if (!(await s.confirmAdultOp({
        title: '重新推断载体框架？',
        message: '将清除手动覆盖，按主预设映射重算。',
      }))) return false;
      panel.setWorldframeForced('');
      return true;
    },

    addItem: function (kind, id, note) {
      if (kind === 'worldview') panel.addWorldviewPresetItem(id, note);
      else if (kind === 'flavor') panel.addFlavorItem(id, note);
      else if (kind === 'posture' || kind === 'speech') panel.addExpressionItem(kind, id, note);
      else panel.addNtlItem(id, note);
    },
    removeItem: function (kind, idx) {
      if (kind === 'worldview') return panel.removeWorldviewPresetItem(idx);
      if (kind === 'flavor') return panel.removeFlavorItem(idx);
      if (kind === 'posture' || kind === 'speech') return panel.removeExpressionItem(kind, idx);
      return panel.removeNtlItem(idx);
    },
    moveItem: function (kind, idx, delta) {
      if (kind === 'worldview') return panel.moveWorldviewPresetItem(idx, delta);
      if (kind === 'flavor') return panel.moveFlavorItem(idx, delta);
      if (kind === 'posture' || kind === 'speech') return panel.moveExpressionItem(kind, idx, delta);
    },
    setNote: function (kind, idx, note) {
      panel.setNoteByKind(kind, idx, note);
    },
    openAddModal: function (kind) {
      panel.openAddModal(kind);
    },
    closeAddModal: function () {
      panel.closeAddModal();
    },

    generateCorruption: async function () {
      setAdultBusy('corruption');
      try {
        return await panel.runGenerateCorruptionLore();
      } finally {
        setAdultBusy('');
      }
    },
    generateAffection: async function () {
      setAdultBusy('affection');
      try {
        return await panel.runGenerateAffectionLore();
      } finally {
        setAdultBusy('');
      }
    },
    generateDigest: async function () {
      setAdultBusy('digest');
      try {
        return await panel.generateSystemDigest();
      } finally {
        setAdultBusy('');
      }
    },
    removeDigest: function () {
      return panel.removeSystemDigest();
    },
  };

  window.__adultConfigApi__ = adultApi;

  /* ---------------- 旧 window 桥（兼容） ---------------- */
  window.__getNsfwConfig__ = function () {
    var corr = panel.getCorruptionConfig();
    var items = s.ensureFlavorItemsOnState();
    var postureItems = s.ensurePostureItemsOnState();
    var speechItems = s.ensureSpeechItemsOnState();
    var wvItems = s.ensureWorldviewPresetItemsOnState();
    return {
      enabled: ctx.state.nsfwEnabled,
      flavor: ctx.state.nsfwFlavor || (items[0] && items[0].id) || '',
      flavorItems: items.map(function (it) { return { id: it.id, note: it.note || '' }; }),
      postureItems: postureItems.map(function (it) { return { id: it.id, note: it.note || '' }; }),
      speechItems: speechItems.map(function (it) { return { id: it.id, note: it.note || '' }; }),
      eroticPostureItems: postureItems.map(function (it) { return { id: it.id, note: it.note || '' }; }),
      eroticSpeechItems: speechItems.map(function (it) { return { id: it.id, note: it.note || '' }; }),
      ntlEnabled: ctx.state.ntlEnabled,
      ntlTabooTypes: (ctx.state.ntlTabooTypes || []).slice(),
      ntlTabooItems: s.ensureNtlItemsOnState().map(function (it) { return { id: it.id, note: it.note || '' }; }),
      worldviewPresetItems: wvItems.map(function (it) { return { id: it.id, note: it.note || '' }; }),
      worldviewPresetId: primaryWorldviewPresetId(wvItems) || '',
      adultWorldframe: ctx.state.adultWorldframe || '',
      adultWorldframeForced: ctx.state.adultWorldframeForced || '',
      corruptionEnabled: corr.enabled,
      corruptionPreset: corr.preset,
      corruptionCustomBrief: corr.customBrief,
      corruptionExtraNotes: corr.extraNotes,
      corruptionStageNames: corr.stageNames.slice(),
      corruptionSelectedNames: corr.selectedNames.slice(),
      corruptionDefaultFemaleOnly: corr.defaultFemaleOnly,
      corruptionSyncStatusBar: corr.syncStatusBar,
      affectionEnabled: ctx.state.affectionEnabled,
      affectionPreset: ctx.state.affectionPreset || '6',
      affectionCustomBrief: ctx.state.affectionCustomBrief || '',
      affectionExtraNotes: ctx.state.affectionExtraNotes || '',
      affectionStageNames: Array.isArray(ctx.state.affectionStageNames) ? ctx.state.affectionStageNames.slice() : [],
      affectionSelectedNames: Array.isArray(ctx.state.affectionSelectedNames) ? ctx.state.affectionSelectedNames.slice() : [],
      affectionSyncStatusBar: ctx.state.affectionSyncStatusBar !== false,
    };
  };

  window.__setNsfwConfig__ = function (cfg) {
    cfg = cfg || {};
    if (typeof cfg.enabled === 'boolean') ctx.state.nsfwEnabled = cfg.enabled;
    if (Array.isArray(cfg.flavorItems)) {
      ctx.state.nsfwFlavorItems = s.normalizeFlavorItems(cfg.flavorItems, cfg.flavor || '');
      ctx.state.nsfwFlavor = ctx.state.nsfwFlavorItems.length ? ctx.state.nsfwFlavorItems[0].id : '';
    } else if (typeof cfg.flavor === 'string') {
      ctx.state.nsfwFlavor = cfg.flavor;
      ctx.state.nsfwFlavorItems = cfg.flavor
        ? s.normalizeFlavorItems([{ id: cfg.flavor, note: '' }], '')
        : [];
    }
    if (Array.isArray(cfg.postureItems) || Array.isArray(cfg.eroticPostureItems)) {
      ctx.state.eroticPostureItems = s.normalizeExpressionItemsByKind(
        cfg.postureItems || cfg.eroticPostureItems,
        'posture'
      );
    }
    if (Array.isArray(cfg.speechItems) || Array.isArray(cfg.eroticSpeechItems)) {
      ctx.state.eroticSpeechItems = s.normalizeExpressionItemsByKind(
        cfg.speechItems || cfg.eroticSpeechItems,
        'speech'
      );
    }
    if (typeof cfg.ntlEnabled === 'boolean') ctx.state.ntlEnabled = cfg.ntlEnabled;
    if (Array.isArray(cfg.ntlTabooItems)) {
      ctx.state.ntlTabooItems = cfg.ntlTabooItems.map(function (it) {
        return { id: String((it && it.id) || ''), note: String((it && it.note) || '') };
      }).filter(function (it) { return it.id; });
      ctx.state.ntlTabooTypes = ctx.state.ntlTabooItems.map(function (it) { return it.id; });
      s.ensureNtlItemsOnState();
    } else if (Array.isArray(cfg.ntlTabooTypes)) {
      ctx.state.ntlTabooTypes = cfg.ntlTabooTypes.slice();
      ctx.state.ntlTabooItems = ctx.state.ntlTabooTypes.map(function (id) { return { id: id, note: '' }; });
      s.ensureNtlItemsOnState();
    }
    if (Array.isArray(cfg.worldviewPresetItems) || typeof cfg.worldviewPresetId === 'string') {
      ctx.state.worldviewPresetItems = normalizeWorldviewPresetItems(
        cfg.worldviewPresetItems,
        cfg.worldviewPresetId || ''
      );
      s.syncWorldframeFromPresets();
    }
    if (typeof cfg.adultWorldframe === 'string') ctx.state.adultWorldframe = cfg.adultWorldframe;
    if (typeof cfg.adultWorldframeForced === 'string') ctx.state.adultWorldframeForced = cfg.adultWorldframeForced;
    if (typeof cfg.corruptionEnabled === 'boolean') ctx.state.corruptionEnabled = cfg.corruptionEnabled;
    if (typeof cfg.corruptionExtraNotes === 'string') ctx.state.corruptionExtraNotes = cfg.corruptionExtraNotes;
    if (Array.isArray(cfg.corruptionSelectedNames)) ctx.state.corruptionSelectedNames = cfg.corruptionSelectedNames.slice();
    if (typeof cfg.corruptionPreset === 'string' || typeof cfg.corruptionCustomBrief === 'string' || Array.isArray(cfg.corruptionStageNames)) {
      if (typeof cfg.corruptionPreset === 'string') {
        ctx.state.corruptionPreset = cfg.corruptionPreset;
        if (!CORRUPTION_PRESETS[ctx.state.corruptionPreset]) ctx.state.corruptionPreset = DEFAULT_CORRUPTION_PRESET;
      }
      if (typeof cfg.corruptionCustomBrief === 'string') ctx.state.corruptionCustomBrief = cfg.corruptionCustomBrief;
      if (Array.isArray(cfg.corruptionStageNames)) ctx.state.corruptionStageNames = cfg.corruptionStageNames.slice();
      ctx.state.corruptionStageNames = resolveStageNames(
        ctx.state.corruptionPreset,
        ctx.state.corruptionStageNames,
        ctx.state.corruptionCustomBrief
      );
    }
    if (typeof cfg.corruptionDefaultFemaleOnly === 'boolean') ctx.state.corruptionDefaultFemaleOnly = cfg.corruptionDefaultFemaleOnly;
    if (typeof cfg.corruptionSyncStatusBar === 'boolean') ctx.state.corruptionSyncStatusBar = cfg.corruptionSyncStatusBar;
    if (typeof cfg.affectionEnabled === 'boolean') ctx.state.affectionEnabled = cfg.affectionEnabled;
    if (typeof cfg.affectionExtraNotes === 'string') ctx.state.affectionExtraNotes = cfg.affectionExtraNotes;
    if (Array.isArray(cfg.affectionSelectedNames)) ctx.state.affectionSelectedNames = cfg.affectionSelectedNames.slice();
    if (typeof cfg.affectionPreset === 'string' || typeof cfg.affectionCustomBrief === 'string' || Array.isArray(cfg.affectionStageNames)) {
      if (typeof cfg.affectionPreset === 'string') {
        ctx.state.affectionPreset = cfg.affectionPreset;
        if (!AFFECTION_PRESETS[ctx.state.affectionPreset]) ctx.state.affectionPreset = DEFAULT_AFFECTION_PRESET;
      }
      if (typeof cfg.affectionCustomBrief === 'string') ctx.state.affectionCustomBrief = cfg.affectionCustomBrief;
      if (Array.isArray(cfg.affectionStageNames)) ctx.state.affectionStageNames = cfg.affectionStageNames.slice();
      ctx.state.affectionStageNames = resolveAffectionStageNames(
        ctx.state.affectionPreset,
        ctx.state.affectionStageNames,
        ctx.state.affectionCustomBrief
      );
    }
    if (typeof cfg.affectionSyncStatusBar === 'boolean') ctx.state.affectionSyncStatusBar = cfg.affectionSyncStatusBar;
    if (ctx.state.corruptionEnabled && !ctx.state.nsfwEnabled) ctx.state.nsfwEnabled = true;
    ctx.save();
    commitUi();
    if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
    window.dispatchEvent(new CustomEvent('nsfw-config-changed', { detail: window.__getNsfwConfig__() }));
    window.dispatchEvent(new CustomEvent('worldview-presets-changed', {
      detail: { items: s.ensureWorldviewPresetItemsOnState().slice() },
    }));
  };

  window.__getCorruptionExportIssues__ = function () {
    return buildCorruptionExportIssues({
      enabled: !!(ctx.state.nsfwEnabled && ctx.state.corruptionEnabled),
      worldbookEntries: ctx.state.worldbookEntries,
      selectedNames: ctx.state.corruptionSelectedNames,
    });
  };
  window.__getAffectionExportIssues__ = function () {
    return buildAffectionExportIssues({
      enabled: !!ctx.state.affectionEnabled,
      worldbookEntries: ctx.state.worldbookEntries,
      selectedNames: ctx.state.affectionSelectedNames,
    });
  };
  window.__generateCorruptionLore__ = function (o) {
    return panel.runGenerateCorruptionLore(o || {});
  };
  window.__generateAffectionLore__ = function (o) {
    return panel.runGenerateAffectionLore(o || {});
  };
  window.__buildAdultPromptHints__ = function () {
    var novelBridge = window.__novelWorkshopBridge__;
    var novelEntities = (novelBridge && typeof novelBridge.listEntities === 'function')
      ? (novelBridge.listEntities({}) || [])
      : [];
    var styleText = (novelBridge && typeof novelBridge.getState === 'function')
      ? ((novelBridge.getState() || {}).styleText || '')
      : '';
    var canon = '';
    var wfLabel = '';
    var vessel = '';
    var flavor = s.buildNsfwFlavorHint();
    var posture = s.buildPostureHintForPrompt();
    var speech = s.buildSpeechHintForPrompt();
    if (ctx.state.nsfwEnabled || ctx.state.ntlEnabled) {
      var wfInfo = s.inferWorldframeFromCard();
      wfLabel = wfInfo.label || '';
      ctx.state.adultWorldframe = wfInfo.id;
      canon = buildAdultCanonDigest({
        entities: novelEntities,
        worldbookEntries: ctx.state.worldbookEntries || [],
        styleText: styleText,
        includeCorruption: true,
        includeStyle: true,
        includeVessels: true,
        worldframeLabel: wfLabel,
      });
      var d = data();
      if (d && typeof d.buildVesselHint === 'function') {
        vessel = d.buildVesselHint({
          worldframe: wfInfo.id,
          flavorItems: s.ensureFlavorItemsOnState(),
          ntlItems: s.ensureNtlItemsOnState(),
          intro: '（仅世界书管道：物化口味/NTL 为世界观载体）',
        });
      }
    }
    return {
      gate: formatAdultModeLine(!!ctx.state.nsfwEnabled, !!ctx.state.ntlEnabled),
      nsfw: flavor + posture + speech,
      posture: posture,
      speech: speech,
      ntl: s.buildNtlHintForPrompt(),
      canon: canon,
      vessel: vessel,
    };
  };

  if (panel.initSelections) panel.initSelections();

  return adultApi;
}
