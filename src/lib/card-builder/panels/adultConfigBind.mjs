/**
 * 成人配置：Bind + window 桥（拆自 adultConfig）
 */
import {
  buildCorruptionExportIssues,
  CORRUPTION_ARC_BRIEFS,
  CORRUPTION_PRESETS,
  DEFAULT_CORRUPTION_PRESET,
  resolveStageNames,
} from '../../corruptionProgress.mjs';
import {
  buildAffectionExportIssues,
  AFFECTION_PRESETS,
  DEFAULT_AFFECTION_PRESET,
  resolveAffectionStageNames,
} from '../../affectionProgress.mjs';
import { buildAdultCanonDigest } from '../../adult/canon.mjs';
import { formatAdultModeLine } from '../../assistant/generationContext.mjs';
import { enhanceSelectMini, syncEnhancedSelectLabel } from '../../ui/enhanceSelectMini.mjs';
import {
  normalizeWorldviewPresetItems,
  primaryWorldviewPresetId,
} from '../../presets/worldviews/index.mjs';

/** @param {object} ctx @param {object} s @param {object} panel */
export function attachAdultConfigBind(ctx, s, panel) {
  panel.bind = function() {
      window.__getNsfwConfig__ = function() {
        var corr = ctx.panels.adultConfig.getCorruptionConfig();
        var items = s.ensureFlavorItemsOnState();
        var postureItems = s.ensurePostureItemsOnState();
        var speechItems = s.ensureSpeechItemsOnState();
        var wvItems = s.ensureWorldviewPresetItemsOnState();
        return {
          enabled: ctx.state.nsfwEnabled,
          flavor: ctx.state.nsfwFlavor || (items[0] && items[0].id) || '',
          flavorItems: items.map(function(it) {
            return { id: it.id, note: it.note || '' };
          }),
          postureItems: postureItems.map(function(it) {
            return { id: it.id, note: it.note || '' };
          }),
          speechItems: speechItems.map(function(it) {
            return { id: it.id, note: it.note || '' };
          }),
          eroticPostureItems: postureItems.map(function(it) {
            return { id: it.id, note: it.note || '' };
          }),
          eroticSpeechItems: speechItems.map(function(it) {
            return { id: it.id, note: it.note || '' };
          }),
          ntlEnabled: ctx.state.ntlEnabled,
          ntlTabooTypes: ctx.state.ntlTabooTypes.slice(),
          ntlTabooItems: s.ensureNtlItemsOnState().map(function(it) {
            return { id: it.id, note: it.note || '' };
          }),
          worldviewPresetItems: wvItems.map(function(it) {
            return { id: it.id, note: it.note || '' };
          }),
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
      window.__setNsfwConfig__ = function(cfg) {
        if (cfg && typeof cfg.enabled === 'boolean') ctx.state.nsfwEnabled = cfg.enabled;
        if (cfg && Array.isArray(cfg.flavorItems)) {
          ctx.state.nsfwFlavorItems = s.normalizeFlavorItems(cfg.flavorItems, cfg.flavor || '');
          ctx.state.nsfwFlavor = ctx.state.nsfwFlavorItems.length ? ctx.state.nsfwFlavorItems[0].id : '';
        } else if (cfg && typeof cfg.flavor === 'string') {
          ctx.state.nsfwFlavor = cfg.flavor;
          ctx.state.nsfwFlavorItems = cfg.flavor
            ? s.normalizeFlavorItems([{ id: cfg.flavor, note: '' }], '')
            : [];
        }
        if (cfg && (Array.isArray(cfg.postureItems) || Array.isArray(cfg.eroticPostureItems))) {
          ctx.state.eroticPostureItems = s.normalizeExpressionItemsByKind(
            cfg.postureItems || cfg.eroticPostureItems,
            'posture'
          );
        }
        if (cfg && (Array.isArray(cfg.speechItems) || Array.isArray(cfg.eroticSpeechItems))) {
          ctx.state.eroticSpeechItems = s.normalizeExpressionItemsByKind(
            cfg.speechItems || cfg.eroticSpeechItems,
            'speech'
          );
        }
        if (cfg && typeof cfg.ntlEnabled === 'boolean') ctx.state.ntlEnabled = cfg.ntlEnabled;
        if (cfg && Array.isArray(cfg.ntlTabooItems)) {
          ctx.state.ntlTabooItems = cfg.ntlTabooItems.map(function(it) {
            return { id: String((it && it.id) || ''), note: String((it && it.note) || '') };
          }).filter(function(it) { return it.id; });
          ctx.state.ntlTabooTypes = ctx.state.ntlTabooItems.map(function(it) { return it.id; });
          s.ensureNtlItemsOnState();
        } else if (cfg && Array.isArray(cfg.ntlTabooTypes)) {
          ctx.state.ntlTabooTypes = cfg.ntlTabooTypes.slice();
          ctx.state.ntlTabooItems = ctx.state.ntlTabooTypes.map(function(id) { return { id: id, note: '' }; });
          s.ensureNtlItemsOnState();
        }
        if (cfg && (Array.isArray(cfg.worldviewPresetItems) || typeof cfg.worldviewPresetId === 'string')) {
          ctx.state.worldviewPresetItems = normalizeWorldviewPresetItems(
            cfg.worldviewPresetItems,
            cfg.worldviewPresetId || ''
          );
          s.syncWorldframeFromPresets();
        }
        if (cfg && typeof cfg.adultWorldframe === 'string') ctx.state.adultWorldframe = cfg.adultWorldframe;
        if (cfg && typeof cfg.adultWorldframeForced === 'string') {
          ctx.state.adultWorldframeForced = cfg.adultWorldframeForced;
        }
        if (cfg && typeof cfg.corruptionEnabled === 'boolean') ctx.state.corruptionEnabled = cfg.corruptionEnabled;
        if (cfg && typeof cfg.corruptionExtraNotes === 'string') ctx.state.corruptionExtraNotes = cfg.corruptionExtraNotes;
        if (cfg && Array.isArray(cfg.corruptionSelectedNames)) ctx.state.corruptionSelectedNames = cfg.corruptionSelectedNames.slice();
        if (cfg && (typeof cfg.corruptionPreset === 'string'
          || typeof cfg.corruptionCustomBrief === 'string'
          || Array.isArray(cfg.corruptionStageNames))) {
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
        if (cfg && typeof cfg.corruptionDefaultFemaleOnly === 'boolean') {
          ctx.state.corruptionDefaultFemaleOnly = cfg.corruptionDefaultFemaleOnly;
        }
        if (cfg && typeof cfg.corruptionSyncStatusBar === 'boolean') {
          ctx.state.corruptionSyncStatusBar = cfg.corruptionSyncStatusBar;
        }
        if (cfg && typeof cfg.affectionEnabled === 'boolean') ctx.state.affectionEnabled = cfg.affectionEnabled;
        if (cfg && typeof cfg.affectionExtraNotes === 'string') ctx.state.affectionExtraNotes = cfg.affectionExtraNotes;
        if (cfg && Array.isArray(cfg.affectionSelectedNames)) ctx.state.affectionSelectedNames = cfg.affectionSelectedNames.slice();
        if (cfg && (typeof cfg.affectionPreset === 'string'
          || typeof cfg.affectionCustomBrief === 'string'
          || Array.isArray(cfg.affectionStageNames))) {
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
        if (cfg && typeof cfg.affectionSyncStatusBar === 'boolean') {
          ctx.state.affectionSyncStatusBar = cfg.affectionSyncStatusBar;
        }
        // 恶堕是 NSFW 子功能：开启恶堕而 NSFW 关闭时自动补齐，避免不一致状态
        if (ctx.state.corruptionEnabled && !ctx.state.nsfwEnabled) {
          ctx.state.nsfwEnabled = true;
        }
        ctx.save();
        ctx.panels.adultConfig.renderNsfwBlock();
        if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
        window.dispatchEvent(new CustomEvent('nsfw-config-changed', {
          detail: window.__getNsfwConfig__(),
        }));
        window.dispatchEvent(new CustomEvent('worldview-presets-changed', {
          detail: { items: s.ensureWorldviewPresetItemsOnState().slice() },
        }));
      };
      window.__generateCorruptionLore__ = function(o) {
        return ctx.panels.adultConfig.runGenerateCorruptionLore(o || {});
      };
      window.__generateAffectionLore__ = function(o) {
        return ctx.panels.adultConfig.runGenerateAffectionLore(o || {});
      };
      window.__getCorruptionExportIssues__ = function() {
        return buildCorruptionExportIssues({
          enabled: !!(ctx.state.nsfwEnabled && ctx.state.corruptionEnabled),
          worldbookEntries: ctx.state.worldbookEntries,
          selectedNames: ctx.state.corruptionSelectedNames,
        });
      };
      window.__getAffectionExportIssues__ = function() {
        return buildAffectionExportIssues({
          enabled: !!ctx.state.affectionEnabled,
          worldbookEntries: ctx.state.worldbookEntries,
          selectedNames: ctx.state.affectionSelectedNames,
        });
      };
      // 兼容旧桥：世界书生成仍可读（含成人 Canon 联动）
      window.__buildAdultPromptHints__ = function() {
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
          var data = window.__nsfwFlavorData__;
          if (data && typeof data.buildVesselHint === 'function') {
            vessel = data.buildVesselHint({
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

      var adultEl = document.getElementById('adultNsfwEnabled');
      var ntlEl = document.getElementById('adultNtlEnabled');
      var flavorList = document.getElementById('adultNsfwFlavorList');
      var postureList = document.getElementById('adultPostureList');
      var speechList = document.getElementById('adultSpeechList');
      if (adultEl) adultEl.addEventListener('change', async function() {
        var on = !!adultEl.checked;
        if (!(await s.confirmAdultOp(on
          ? '启用 NSFW？将显示口味 / 姿势语言 / 情趣话风配置。'
          : '关闭 NSFW？口味与表达层将隐藏（已选项仍保留在卡内）。'))) {
          adultEl.checked = !on;
          return;
        }
        ctx.panels.adultConfig.syncNsfwBlockFromUi();
      });
      if (ntlEl) ntlEl.addEventListener('change', async function() {
        var on = !!ntlEl.checked;
        if (!(await s.confirmAdultOp(on ? '启用 NTL 禁忌层？' : '关闭 NTL 禁忌层？已选项仍保留在卡内。'))) {
          ntlEl.checked = !on;
          return;
        }
        ctx.panels.adultConfig.syncNsfwBlockFromUi();
      });
      if (flavorList) {
        flavorList.addEventListener('click', async function(e) {
          var t = e.target && e.target.closest ? e.target.closest('[data-flavor-remove], [data-flavor-up], [data-flavor-down]') : null;
          if (!t) return;
          if (t.hasAttribute('data-flavor-remove')) {
            var ri = parseInt(t.getAttribute('data-flavor-remove'), 10);
            if (!isNaN(ri)) await ctx.panels.adultConfig.removeFlavorItem(ri);
            return;
          }
          if (t.hasAttribute('data-flavor-up')) {
            var ui = parseInt(t.getAttribute('data-flavor-up'), 10);
            if (!isNaN(ui)) ctx.panels.adultConfig.moveFlavorItem(ui, -1);
            return;
          }
          if (t.hasAttribute('data-flavor-down')) {
            var di = parseInt(t.getAttribute('data-flavor-down'), 10);
            if (!isNaN(di)) ctx.panels.adultConfig.moveFlavorItem(di, 1);
          }
        });
        flavorList.addEventListener('change', function(e) {
          if (!e.target || !e.target.matches('[data-flavor-note]')) return;
          ctx.panels.adultConfig.syncNsfwBlockFromUi();
        });
      }
      function bindExpressionList(listEl, kind) {
        if (!listEl) return;
        listEl.addEventListener('click', async function(e) {
          var t = e.target && e.target.closest
            ? e.target.closest('[data-expression-remove], [data-expression-up], [data-expression-down]')
            : null;
          if (!t) return;
          function parseExpressionToken(attr) {
            var token = String(t.getAttribute(attr) || '');
            var parts = token.split(':');
            if (parts[0] !== kind) return null;
            var idx = parseInt(parts[1], 10);
            return isNaN(idx) ? null : idx;
          }
          if (t.hasAttribute('data-expression-remove')) {
            var ri = parseExpressionToken('data-expression-remove');
            if (ri != null) await ctx.panels.adultConfig.removeExpressionItem(kind, ri);
            return;
          }
          if (t.hasAttribute('data-expression-up')) {
            var ui = parseExpressionToken('data-expression-up');
            if (ui != null) ctx.panels.adultConfig.moveExpressionItem(kind, ui, -1);
            return;
          }
          if (t.hasAttribute('data-expression-down')) {
            var di = parseExpressionToken('data-expression-down');
            if (di != null) ctx.panels.adultConfig.moveExpressionItem(kind, di, 1);
          }
        });
        listEl.addEventListener('change', function(e) {
          if (!e.target || !e.target.matches('[data-expression-note]')) return;
          var token = String(e.target.getAttribute('data-expression-note') || '');
          if (token.indexOf(kind + ':') !== 0) return;
          ctx.panels.adultConfig.syncNsfwBlockFromUi();
        });
      }
      bindExpressionList(postureList, 'posture');
      bindExpressionList(speechList, 'speech');

      var wvList = document.getElementById('adultWorldviewPresetList');
      if (wvList) {
        wvList.addEventListener('click', async function(e) {
          var t = e.target;
          if (!t || !t.getAttribute) return;
          if (t.hasAttribute('data-wv-remove')) {
            var ri = parseInt(t.getAttribute('data-wv-remove'), 10);
            if (!isNaN(ri)) await ctx.panels.adultConfig.removeWorldviewPresetItem(ri);
            return;
          }
          if (t.hasAttribute('data-wv-up')) {
            var ui = parseInt(t.getAttribute('data-wv-up'), 10);
            if (!isNaN(ui)) ctx.panels.adultConfig.moveWorldviewPresetItem(ui, -1);
            return;
          }
          if (t.hasAttribute('data-wv-down')) {
            var di = parseInt(t.getAttribute('data-wv-down'), 10);
            if (!isNaN(di)) ctx.panels.adultConfig.moveWorldviewPresetItem(di, 1);
          }
        });
        wvList.addEventListener('change', function(e) {
          if (!e.target || !e.target.matches('[data-wv-note]')) return;
          var idx = parseInt(e.target.getAttribute('data-wv-note'), 10);
          var items = s.ensureWorldviewPresetItemsOnState();
          if (isNaN(idx) || !items[idx]) return;
          items[idx].note = String(e.target.value || '').trim();
          ctx.state.worldviewPresetItems = items;
          ctx.save();
          if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
        });
      }

      var wfRefresh = document.getElementById('btnAdultWorldframeRefresh');
      var wfSelect = document.getElementById('adultWorldframeSelect');
      enhanceSelectMini(wfSelect);
      if (wfRefresh) {
        wfRefresh.addEventListener('click', async function() {
          if (!(await s.confirmAdultOp({
            title: '重新推断载体框架？',
            message: '将清除手动覆盖，按主预设映射重算。',
          }))) return;
          ctx.state.adultWorldframeForced = '';
          s.syncWorldframeFromPresets();
          var info = s.inferWorldframeFromCard();
          if (!ctx.state.adultWorldframe) ctx.state.adultWorldframe = info.id;
          s.withAppScrollPreserved(function() {
            ctx.panels.adultConfig.renderWorldframeRow();
          });
          ctx.save();
          if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
          window.dispatchEvent(new CustomEvent('nsfw-config-changed', {
            detail: window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {},
          }));
        });
      }
      if (wfSelect) {
        wfSelect.addEventListener('change', async function() {
          var v = wfSelect.value || '';
          var data = window.__nsfwFlavorData__;
          var lab = v && data && data.worldframes && data.worldframes[v]
            ? data.worldframes[v].label
            : (v || '自动（跟主预设）');
          if (!(await s.confirmAdultOp(v
            ? {
              title: '手动锁定载体框架？',
              message: '将锁定为「' + lab + '」。',
            }
            : {
              title: '取消手动覆盖？',
              message: '改回自动跟随主预设。',
            }))) {
            wfSelect.value = ctx.state.adultWorldframeForced || '';
            return;
          }
          ctx.state.adultWorldframeForced = v;
          if (v) ctx.state.adultWorldframe = v;
          else {
            s.syncWorldframeFromPresets();
            var info = s.inferWorldframeFromCard();
            if (!ctx.state.adultWorldframe) ctx.state.adultWorldframe = info.id;
          }
          s.withAppScrollPreserved(function() {
            ctx.panels.adultConfig.renderWorldframeRow();
          });
          ctx.save();
          if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
          window.dispatchEvent(new CustomEvent('nsfw-config-changed', {
            detail: window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {},
          }));
        });
      }

      var ntlList = document.getElementById('adultNtlTabooList');
      if (ntlList) {
        ntlList.addEventListener('click', async function(e) {
          var btn = e.target && e.target.closest ? e.target.closest('[data-ntl-remove]') : null;
          if (!btn) return;
          var idx = parseInt(btn.getAttribute('data-ntl-remove'), 10);
          if (isNaN(idx)) return;
          await ctx.panels.adultConfig.removeNtlItem(idx);
        });
        ntlList.addEventListener('change', function(e) {
          if (!e.target || !e.target.matches('[data-ntl-note]')) return;
          ctx.panels.adultConfig.syncNsfwBlockFromUi();
        });
      }

      if (!ctx.panels.adultConfig._addBtnDocumentBound) {
        ctx.panels.adultConfig._addBtnDocumentBound = true;
        document.addEventListener('click', function(e) {
          var btn = e.target && e.target.closest
            ? e.target.closest('[data-adult-add]')
            : null;
          if (!btn) return;
          ctx.panels.adultConfig.openAddModal(btn.getAttribute('data-adult-add') || '');
        });
      }

      var corrEnabled = document.getElementById('adultCorruptionEnabled');
      var corrPreset = document.getElementById('adultCorruptionPreset');
      enhanceSelectMini(corrPreset);
      var corrBrief = document.getElementById('adultCorruptionCustomBrief');
      var corrExtra = document.getElementById('adultCorruptionExtraNotes');
      var corrFemale = document.getElementById('adultCorruptionFemaleOnly');
      var corrSync = document.getElementById('adultCorruptionSyncSb');
      var corrRefresh = document.getElementById('btnRefreshCorruptionTargets');
      if (corrEnabled) corrEnabled.addEventListener('change', async function() {
        var on = !!corrEnabled.checked;
        if (!(await s.confirmAdultOp(on
          ? '启用恶堕进度线？将显示阶段与档案生成配置。'
          : '关闭恶堕进度线？已生成内容仍保留在世界书中。'))) {
          corrEnabled.checked = !on;
          return;
        }
        s.withAppScrollPreserved(function() {
          ctx.panels.adultConfig.syncCorruptionBlockFromUi();
        });
      });
      if (corrPreset) corrPreset.addEventListener('change', function() {
        s.withAppScrollPreserved(function() {
          ctx.panels.adultConfig.syncCorruptionBlockFromUi();
        });
      });
      if (corrBrief) corrBrief.addEventListener('change', function() {
        ctx.panels.adultConfig.syncCorruptionBlockFromUi({ skipRender: true });
      });
      if (corrExtra) corrExtra.addEventListener('change', function() {
        ctx.panels.adultConfig.syncCorruptionBlockFromUi({ skipRender: true });
      });
      var corrArc = document.getElementById('adultCorruptionArcBrief');
      enhanceSelectMini(corrArc);
      if (corrArc) {
        corrArc.addEventListener('change', function() {
          var id = corrArc.value || '';
          var pack = id && CORRUPTION_ARC_BRIEFS[id];
          if (pack && corrBrief) {
            corrBrief.value = pack.brief || '';
            ctx.state.corruptionPreset = 'custom';
            var presetEl = document.getElementById('adultCorruptionPreset');
            if (presetEl) {
              presetEl.value = 'custom';
              syncEnhancedSelectLabel(presetEl);
            }
          }
          s.withAppScrollPreserved(function() {
            ctx.panels.adultConfig.syncCorruptionBlockFromUi();
          });
        });
      }
      if (corrFemale) corrFemale.addEventListener('change', function() {
        ctx.state.corruptionSelectedNames = [];
        s.withAppScrollPreserved(function() {
          ctx.panels.adultConfig.syncCorruptionBlockFromUi();
        });
      });
      if (corrSync) corrSync.addEventListener('change', function() {
        ctx.panels.adultConfig.syncCorruptionBlockFromUi({ skipRender: true });
      });
      if (corrRefresh) corrRefresh.addEventListener('click', function() {
        s.withAppScrollPreserved(function() {
          ctx.panels.adultConfig.renderCorruptionTargets();
        });
        ctx.panels.adultConfig.setCorruptionTip('已刷新角色列表', 'ok');
      });
      var corrTargets = document.getElementById('adultCorruptionTargets');
      if (corrTargets) {
        corrTargets.addEventListener('change', function(e) {
          if (!e.target || !e.target.matches('[data-corruption-target]')) return;
          ctx.state.corruptionSelectedNames = ctx.panels.adultConfig.readSelectedCorruptionNames();
          ctx.save();
        });
      }

      // ---- 纯爱线（亲密度） ----
      var affEnabled = document.getElementById('adultAffectionEnabled');
      var affPreset = document.getElementById('adultAffectionPreset');
      enhanceSelectMini(affPreset);
      var affBrief = document.getElementById('adultAffectionCustomBrief');
      var affExtra = document.getElementById('adultAffectionExtraNotes');
      var affSync = document.getElementById('adultAffectionSyncSb');
      var affRefresh = document.getElementById('btnRefreshAffectionTargets');
      if (affEnabled) affEnabled.addEventListener('change', async function() {
        var on = !!affEnabled.checked;
        if (!(await s.confirmAdultOp(on
          ? '启用纯爱线（亲密度）？将显示档位与档案生成配置。'
          : '关闭纯爱线？已生成内容仍保留在世界书中。'))) {
          affEnabled.checked = !on;
          return;
        }
        s.withAppScrollPreserved(function() {
          ctx.panels.adultConfig.syncAffectionBlockFromUi();
        });
      });
      if (affPreset) affPreset.addEventListener('change', function() {
        s.withAppScrollPreserved(function() {
          ctx.panels.adultConfig.syncAffectionBlockFromUi();
        });
      });
      if (affBrief) affBrief.addEventListener('change', function() {
        ctx.panels.adultConfig.syncAffectionBlockFromUi({ skipRender: true });
      });
      if (affExtra) affExtra.addEventListener('change', function() {
        ctx.panels.adultConfig.syncAffectionBlockFromUi({ skipRender: true });
      });
      if (affSync) affSync.addEventListener('change', function() {
        ctx.panels.adultConfig.syncAffectionBlockFromUi({ skipRender: true });
      });
      if (affRefresh) affRefresh.addEventListener('click', function() {
        s.withAppScrollPreserved(function() {
          ctx.panels.adultConfig.renderAffectionTargets();
        });
        ctx.panels.adultConfig.setAffectionTip('已刷新角色列表', 'ok');
      });
      var affTargets = document.getElementById('adultAffectionTargets');
      if (affTargets) {
        affTargets.addEventListener('change', function(e) {
          if (!e.target || !e.target.matches('[data-affection-target]')) return;
          ctx.state.affectionSelectedNames = ctx.panels.adultConfig.readSelectedAffectionNames();
          ctx.save();
        });
      }

      // ---- 成人体系总纲（固化进卡） ----
      var genDigest = document.getElementById('btnGenSystemDigest');
      if (genDigest) {
        genDigest.addEventListener('click', async function() {
          if (!(await s.confirmAdultOp({
            title: '生成/更新体系总纲？',
            message: '将先写恶堕世界书（总则 + 勾选角色档案，需 AI；未启用/无目标/无 AI 时跳过），再写入/覆盖「[成人体系]」世界书条目（constant 常驻）。',
          }))) return;
          ctx.panels.adultConfig.generateSystemDigest();
        });
      }
      var clearDigest = document.getElementById('btnClearSystemDigest');
      if (clearDigest) {
        clearDigest.addEventListener('click', async function() {
          if (!(await s.confirmAdultOp({
            title: '移除体系总纲？',
            message: '将删除所有「[成人体系]」世界书条目。',
            okText: '移除',
          }))) return;
          ctx.panels.adultConfig.removeSystemDigest();
        });
      }

      ctx.panels.adultConfig.renderNsfwBlock();
  };
}
