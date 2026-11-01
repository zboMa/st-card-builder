/**
 * 世界与限定：状态层覆盖。
 * 旧 adultConfigPanel 的 DOM 渲染/读值方法在这里被替换为「直接读 cardStore + actions」，
 * 既保留既有 AI 生成逻辑，又让 Vue 成为唯一 DOM 所有者。
 */
import {
  CORRUPTION_PRESETS,
  DEFAULT_CORRUPTION_PRESET,
  resolveStageNames,
  pickCorruptionTargets,
} from '../../corruptionProgress.mjs';
import {
  AFFECTION_PRESETS,
  resolveAffectionStageNames,
  pickAffectionTargets,
} from '../../affectionProgress.mjs';
import {
  setAdultNsfwEnabled,
  setAdultNtlEnabled,
  setAdultWorldviewItems,
  setAdultFlavorItems,
  setAdultExpressionItems,
  setAdultNtlItems,
  setAdultWorldframe,
  setAdultCorruption,
  setAdultAffection,
} from '../../store/adultActions.mjs';
import { openAdultAddModal, closeAdultAddModal } from '../../store/adultStore.mjs';
import { buildCorruptionTargets, buildAffectionTargets } from './adultViewModel.mjs';

/** @param {object} ctx @param {object} s @param {object} panel */
export function attachAdultConfigState(ctx, s, panel) {
  function state() {
    return ctx.state;
  }

  function finish(opts) {
    opts = opts || {};
    if (!opts.skipSave) {
      ctx.save();
      if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
    }
    if (!opts.silentEvent) {
      window.dispatchEvent(new CustomEvent('nsfw-config-changed', {
        detail: window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {},
      }));
    }
    if (opts.worldview) {
      window.dispatchEvent(new CustomEvent('worldview-presets-changed', {
        detail: { items: (ctx.state.worldviewPresetItems || []).slice() },
      }));
    }
  }

  function readFlavorItems() {
    return s.normalizeFlavorItems(ctx.state.nsfwFlavorItems || [], '');
  }

  function readExpressionItems(kind) {
    var raw = kind === 'speech' ? ctx.state.eroticSpeechItems : ctx.state.eroticPostureItems;
    return s.normalizeExpressionItemsByKind(raw || [], kind);
  }

  function readNtlItems() {
    return s.ensureNtlItemsOnState().map(function (it) {
      return { id: it.id, note: it.note || '' };
    });
  }

  function seedSelections() {
    var changed = false;
    if (ctx.state.nsfwEnabled && ctx.state.corruptionEnabled
      && (!Array.isArray(ctx.state.corruptionSelectedNames) || !ctx.state.corruptionSelectedNames.length)) {
      var femaleOnly = ctx.state.corruptionDefaultFemaleOnly !== false;
      var picks = pickCorruptionTargets(panel.collectCorruptionCandidates(), {
        defaultFemaleOnly: femaleOnly,
        selectedNames: [],
        includeUnknown: !femaleOnly,
      });
      if (femaleOnly) {
        picks.forEach(function (p) { if (p.unknown && !p.male) p.selected = true; });
      }
      var names = picks.filter(function (p) { return p.selected; }).map(function (p) { return p.name; });
      if (names.length) {
        setAdultCorruption({ corruptionSelectedNames: names });
        changed = true;
      }
    }
    if (ctx.state.nsfwEnabled && ctx.state.affectionEnabled
      && (!Array.isArray(ctx.state.affectionSelectedNames) || !ctx.state.affectionSelectedNames.length)) {
      var aff = pickAffectionTargets(panel.collectAffectionCandidates());
      var affNames = aff.filter(function (p) { return p.selected; }).map(function (p) { return p.name; });
      if (affNames.length) {
        setAdultAffection({ affectionSelectedNames: affNames });
        changed = true;
      }
    }
    if (changed) finish({});
  }

  function refreshWorldframe() {
    if (!ctx.state.adultWorldframeForced) s.syncWorldframeFromPresets();
    var forced = ctx.state.adultWorldframeForced || '';
    var data = window.__nsfwFlavorData__;
    var info = forced && data && data.worldframes && data.worldframes[forced]
      ? { id: forced, label: data.worldframes[forced].label }
      : (ctx.state.adultWorldframe && data && data.worldframes && data.worldframes[ctx.state.adultWorldframe]
        ? { id: ctx.state.adultWorldframe, label: data.worldframes[ctx.state.adultWorldframe].label }
        : s.inferWorldframeFromCard());
    if (!forced && info && info.id && ctx.state.adultWorldframe !== info.id) {
      setAdultWorldframe({ adultWorldframe: info.id });
    }
    var novelBridge = window.__novelWorkshopBridge__;
    if (novelBridge && info && info.id) {
      if (forced && typeof novelBridge.setAdultWorldframe === 'function') {
        novelBridge.setAdultWorldframe(forced);
      } else if (!forced && typeof novelBridge.suggestAdultWorldframe === 'function') {
        novelBridge.suggestAdultWorldframe(info.id);
      } else if (typeof novelBridge.getState === 'function') {
        var ns = novelBridge.getState();
        if (ns) {
          ns.adultWorldframe = info.id;
          if (forced) ns.adultWorldframeForced = forced;
          else if (!ns.adultWorldframeForced) ns.adultWorldframeForced = '';
        }
      }
    }
    return info;
  }

  Object.assign(panel, {
    /* ---- 纯渲染方法：Vue 接管后不再写 DOM ---- */
    renderWorldframeRow: function () {
      refreshWorldframe();
    },
    renderWorldviewPresetList: function () {},
    renderFlavorList: function () {},
    renderExpressionList: function () {},
    renderNtlList: function () {},
    renderNsfwBlock: function () {},
    _renderNsfwBlockInner: function () {},
    renderCorruptionBlock: function () {},
    renderAffectionBlock: function () {},
    renderCorruptionTargets: function () {},
    renderAffectionTargets: function () {},
    renderAdultModalList: function () {},
    _refreshAdultModal: function () {},

    /* ---- 读值：直接读 state ---- */
    readFlavorItemsFromUi: function () {
      return readFlavorItems();
    },
    readExpressionItemsFromUi: function (kind) {
      return readExpressionItems(kind);
    },
    readNtlItemsFromUi: function () {
      return readNtlItems();
    },
    readSelectedCorruptionNames: function () {
      return Array.isArray(ctx.state.corruptionSelectedNames)
        ? ctx.state.corruptionSelectedNames.slice()
        : [];
    },
    readSelectedAffectionNames: function () {
      return Array.isArray(ctx.state.affectionSelectedNames)
        ? ctx.state.affectionSelectedNames.slice()
        : [];
    },

    /* ---- 同步：只做 state 规范化 ---- */
    syncNsfwBlockFromUi: function () {
      setAdultFlavorItems(readFlavorItems());
      setAdultExpressionItems('posture', readExpressionItems('posture'));
      setAdultExpressionItems('speech', readExpressionItems('speech'));
      setAdultNtlItems(readNtlItems());
      setAdultNsfwEnabled(ctx.state.nsfwEnabled);
      setAdultNtlEnabled(ctx.state.ntlEnabled);
      panel.syncCorruptionBlockFromUi({ skipRender: true, silentEvent: true, skipSave: true });
      finish({});
    },
    syncCorruptionBlockFromUi: function (opts) {
      opts = opts || {};
      var preset = CORRUPTION_PRESETS[ctx.state.corruptionPreset]
        ? ctx.state.corruptionPreset
        : DEFAULT_CORRUPTION_PRESET;
      if (ctx.state.corruptionEnabled
        && (!Array.isArray(ctx.state.corruptionSelectedNames) || !ctx.state.corruptionSelectedNames.length)) {
        var picks = buildCorruptionTargets(panel.collectCorruptionCandidates(), ctx.state);
        var names = picks.filter(function (p) { return p.selected; }).map(function (p) { return p.name; });
        if (names.length) setAdultCorruption({ corruptionSelectedNames: names });
      }
      setAdultCorruption({
        corruptionPreset: preset,
        corruptionStageNames: resolveStageNames(
          preset,
          ctx.state.corruptionStageNames,
          ctx.state.corruptionCustomBrief
        ),
      });
      finish(opts);
    },
    syncAffectionBlockFromUi: function (opts) {
      opts = opts || {};
      var preset = AFFECTION_PRESETS[ctx.state.affectionPreset]
        ? ctx.state.affectionPreset
        : '6';
      if (ctx.state.affectionEnabled
        && (!Array.isArray(ctx.state.affectionSelectedNames) || !ctx.state.affectionSelectedNames.length)) {
        var picks = buildAffectionTargets(panel.collectAffectionCandidates(), ctx.state);
        var names = picks.filter(function (p) { return p.selected; }).map(function (p) { return p.name; });
        if (names.length) setAdultAffection({ affectionSelectedNames: names });
      }
      setAdultAffection({
        affectionPreset: preset,
        affectionStageNames: resolveAffectionStageNames(
          preset,
          ctx.state.affectionStageNames,
          ctx.state.affectionCustomBrief
        ),
      });
      finish(opts);
    },

    /* ---- 提交：写 actions ---- */
    commitFlavorItems: function (items) {
      setAdultFlavorItems(s.normalizeFlavorItems(items, ''));
      finish({});
    },
    commitExpressionItems: function (kind, items) {
      setAdultExpressionItems(kind, s.normalizeExpressionItemsByKind(items, kind));
      finish({});
    },

    /* ---- 备注 ---- */
    setNoteByKind: function (kind, idx, note) {
      var text = String(note == null ? '' : note).trim();
      if (kind === 'worldview') {
        var wv = s.ensureWorldviewPresetItemsOnState().map(function (it) {
          return { id: it.id, note: it.note || '' };
        });
        if (!wv[idx]) return;
        wv[idx].note = text;
        setAdultWorldviewItems(wv);
        s.syncWorldframeFromPresets();
        finish({ worldview: true });
        return;
      }
      if (kind === 'flavor') {
        var flavor = readFlavorItems();
        if (!flavor[idx]) return;
        flavor[idx].note = text;
        panel.commitFlavorItems(flavor);
        return;
      }
      if (kind === 'posture' || kind === 'speech') {
        var expr = readExpressionItems(kind);
        if (!expr[idx]) return;
        expr[idx].note = text;
        panel.commitExpressionItems(kind, expr);
        return;
      }
      var ntl = readNtlItems();
      if (!ntl[idx]) return;
      ntl[idx].note = text;
      setAdultNtlItems(ntl);
      finish({});
    },

    /* ---- 载体框架 ---- */
    refreshWorldframe: function () {
      refreshWorldframe();
    },
    setWorldframeForced: function (value) {
      var v = String(value || '');
      var patch = { adultWorldframeForced: v };
      if (v) patch.adultWorldframe = v;
      setAdultWorldframe(patch);
      if (!v) refreshWorldframe();
      finish({});
    },

    /* ---- 生成目标勾选 ---- */
    initSelections: function () {
      seedSelections();
    },
    setCorruptionSelected: function (names) {
      setAdultCorruption({ corruptionSelectedNames: Array.isArray(names) ? names.slice() : [] });
      finish({});
    },
    setAffectionSelected: function (names) {
      setAdultAffection({ affectionSelectedNames: Array.isArray(names) ? names.slice() : [] });
      finish({});
    },

    /* ---- 添加弹窗 ---- */
    openAddModal: function (kind) {
      if (!kind) return;
      openAdultAddModal(kind);
    },
    closeAddModal: function () {
      closeAdultAddModal();
    },
  });
}
