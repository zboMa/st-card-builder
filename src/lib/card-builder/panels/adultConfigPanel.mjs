/**
 * 成人配置：面板 API（拆自 adultConfig）
 */
import {
  normalizeCorruptionConfig,
  resolveStageNames,
  parseStageNamesFromAiText,
  pickCorruptionTargets,
  buildRulesWorldbookEntry,
  buildArchiveWorldbookEntry,
  buildCustomStagesSystemPrompt,
  buildCustomStagesUserPrompt,
  buildArchiveSystemPrompt,
  buildArchiveExpandSystemPrompt,
  buildArchiveUserPrompt,
  upsertWorldbookByComment,
  buildGeneralArchiveEntry,
  ensureCorruptionModuleInDesign,
  findWorldbookPersonContext,
  evaluateArchiveRichness,
  CORRUPTION_MIN_CHARS_PER_STAGE,
  CORRUPTION_PRESETS,
  DEFAULT_CORRUPTION_PRESET,
} from '../../corruptionProgress.mjs';
import {
  resolveAffectionStageNames,
  parseAffectionStageNamesFromAiText,
  pickAffectionTargets,
  buildRulesWorldbookEntry as buildAffectionRulesWorldbookEntry,
  buildArchiveWorldbookEntry as buildAffectionArchiveWorldbookEntry,
  buildArchiveSystemPrompt as buildAffectionArchiveSystemPrompt,
  buildArchiveExpandSystemPrompt as buildAffectionArchiveExpandSystemPrompt,
  buildArchiveUserPrompt as buildAffectionArchiveUserPrompt,
  buildGeneralArchiveEntry as buildAffectionGeneralArchiveEntry,
  ensureAffectionModuleInDesign,
  AFFECTION_MIN_CHARS_PER_STAGE,
  AFFECTION_PRESETS,
  DEFAULT_AFFECTION_PRESET,
  AFFECTION_STATUS_LABEL,
  upsertWorldbookByComment as upsertWorldbookByComment2,
} from '../../affectionProgress.mjs';
import { CORRUPTION_EXPAND_WB } from '../../novel/contextBudgets.mjs';
import { truncateToTokens } from '../../assistant/contextManager.mjs';
import {
  isPersonWorldbookEntry,
  personNameFromWorldbookComment,
  personNameFromWorldbookEntry,
} from '../../novel/sync.mjs';
import { isAdultDigestEntry, entryExportComment } from '../../worldbook/worldbookEntryBridge.mjs';
import { buildPlaceholderPaths, normalizeDesign } from '../../statusBar.mjs';
import { enhanceSelectMini, syncEnhancedSelectLabel } from '../../ui/enhanceSelectMini.mjs';
import { buildAdultCanonDigest, formatCorruptionArchiveDigests } from '../../adult/canon.mjs';
import { NTL_GROUPS, NTL_GROUP_IDS } from '../../adult/ntl/groups.mjs';
import {
  buildAdultSystemDigest,
  hasMeaningfulSystemDigest,
  upsertSystemDigestEntries,
  mergeCorruptionConfigNote,
  stripCorruptionConfigNote,
  mergeAffectionConfigNote,
  stripAffectionConfigNote,
} from '../../adult/systemDigest.mjs';
import {
  listWorldviewPresetsByGroup,
  getWorldviewPreset,
  primaryWorldviewPresetId,
  MAX_WORLDVIEW_PRESET_ITEMS,
} from '../../presets/worldviews/index.mjs';

/** @param {object} ctx @param {object} s @param {object} panel */
export function attachAdultConfigPanel(ctx, s, panel) {
  Object.assign(panel, {
    buildNsfwFlavorHint: s.buildNsfwFlavorHint,
    buildPostureHintForPrompt: s.buildPostureHintForPrompt,
    buildSpeechHintForPrompt: s.buildSpeechHintForPrompt,
    buildNtlHintForPrompt: s.buildNtlHintForPrompt,

    renderWorldframeRow: function() {
      var row = document.getElementById('adultWorldframeRow');
      var labelEl = document.getElementById('adultWorldframeLabel');
      var select = document.getElementById('adultWorldframeSelect');
      var mapHint = document.getElementById('adultWorldframeMapHint');
      var data = window.__nsfwFlavorData__;
      if (!row) return;
      row.style.display = 'flex';
      if (select && data && data.worldframeIds && !select.dataset.filled) {
        var opts = '<option value="">自动（跟主预设）</option>';
        data.worldframeIds.forEach(function(id) {
          if (id === 'generic') return;
          var wf = data.worldframes[id];
          var sum = (wf && wf.summary) ? (' — ' + wf.summary) : '';
          opts += '<option value="' + id + '">' + s.escapeHtml((wf && wf.label) || id) + s.escapeHtml(sum) + '</option>';
        });
        opts += '<option value="generic">通用</option>';
        select.innerHTML = opts;
        select.dataset.filled = '1';
      }
      if (!ctx.state.adultWorldframeForced) s.syncWorldframeFromPresets();
      var forced = ctx.state.adultWorldframeForced || '';
      if (select) {
        select.value = forced;
        syncEnhancedSelectLabel(select);
      }
      var info = forced && data && data.worldframes[forced]
        ? { id: forced, label: data.worldframes[forced].label, confidence: 1, source: 'forced' }
        : (ctx.state.adultWorldframe && data && data.worldframes[ctx.state.adultWorldframe]
          ? {
            id: ctx.state.adultWorldframe,
            label: data.worldframes[ctx.state.adultWorldframe].label,
            confidence: 0.7,
            source: 'cached',
          }
          : s.inferWorldframeFromCard());
      if (!forced && info.id && ctx.state.adultWorldframe !== info.id) {
        ctx.state.adultWorldframe = info.id;
        ctx.save();
      }
      if (labelEl) {
        var conf = info.confidence != null ? (' · ' + Math.round(info.confidence * 100) + '%') : '';
        var src = info.source === 'forced' ? '手动' : (info.source === 'infer' ? '自动' : (info.source || ''));
        labelEl.textContent = (info.label || info.id || '未推断') + conf + (src ? '（' + src + '）' : '');
      }
      if (mapHint) {
        var items = s.ensureWorldviewPresetItemsOnState();
        var primaryId = primaryWorldviewPresetId(items);
        var p = getWorldviewPreset(primaryId);
        if (forced) {
          mapHint.textContent = '已手动强制；与主预设脱钩';
        } else if (p) {
          mapHint.textContent = '由预设「' + (p.label || primaryId) + '」→ 框架「' + (info.label || info.id) + '」';
        } else {
          mapHint.textContent = '未选预设时按卡面推断；口味/NTL 物化为该世界的载体';
        }
      }
      var novelBridge = window.__novelWorkshopBridge__;
      if (novelBridge) {
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
    },

    renderWorldviewPresetList: function() {
      var listEl = document.getElementById('adultWorldviewPresetList');
      var capEl = document.getElementById('adultWvCap');
      var items = s.ensureWorldviewPresetItemsOnState();
      if (listEl) {
        if (!items.length) {
          listEl.innerHTML = '<span class="adult-wv-empty">尚未添加——点「＋ 新增」多选组合（如魅魔+修仙）。不选则 AI 引擎须填写阶段提示词。</span>';
        } else {
          listEl.innerHTML = items.map(function(it, idx) {
            return ctx.panels.adultConfig._dashedItemHtml('worldview', it, idx, items.length, false);
          }).join('');
        }
      }
      if (capEl) {
        capEl.textContent = items.length
          ? ('已选 ' + items.length + ' / ' + MAX_WORLDVIEW_PRESET_ITEMS)
          : ('最多 ' + MAX_WORLDVIEW_PRESET_ITEMS + ' 项');
      }
    },

    addWorldviewPresetItem: function(id, note) {
      id = String(id || '').trim();
      if (!id || !getWorldviewPreset(id)) return;
      var items = s.ensureWorldviewPresetItemsOnState();
      if (items.length >= MAX_WORLDVIEW_PRESET_ITEMS) return;
      if (items.some(function(it) { return it.id === id; })) return;
      items.push({ id: id, note: String(note || '') });
      ctx.state.worldviewPresetItems = items;
      s.syncWorldframeFromPresets();
      s.withAppScrollPreserved(function() {
        ctx.panels.adultConfig.renderWorldviewPresetList();
        ctx.panels.adultConfig.renderWorldframeRow();
      });
      ctx.panels.adultConfig._refreshAdultModal();
      ctx.save();
      if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
      window.dispatchEvent(new CustomEvent('nsfw-config-changed', {
        detail: window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {},
      }));
      window.dispatchEvent(new CustomEvent('worldview-presets-changed', {
        detail: { items: items.slice() },
      }));
    },

    getCorruptionConfig: function() {
      return normalizeCorruptionConfig({
        enabled: ctx.state.corruptionEnabled,
        preset: ctx.state.corruptionPreset,
        customBrief: ctx.state.corruptionCustomBrief,
        extraNotes: ctx.state.corruptionExtraNotes,
        stageNames: ctx.state.corruptionStageNames,
        selectedNames: ctx.state.corruptionSelectedNames,
        defaultFemaleOnly: ctx.state.corruptionDefaultFemaleOnly,
        syncStatusBar: ctx.state.corruptionSyncStatusBar,
      });
    },

    setCorruptionTip: function(text, kind) {
      var tip = document.getElementById('adultCorruptionTip');
      if (!tip) return;
      tip.textContent = text || '';
      tip.classList.remove('is-warn', 'is-ok', 'is-err');
      if (kind) tip.classList.add('is-' + kind);
    },

    collectCorruptionCandidates: function() {
      var out = [];
      var seen = Object.create(null);
      var protagonist = String(ctx.state.charName || '').trim();

      function pushCand(c) {
        if (!c || !c.name) return;
        var name = String(c.name).trim();
        if (!name || seen[name]) return;
        // 主角永不进入恶堕生成列表
        if (protagonist && name === protagonist) return;
        seen[name] = true;
        out.push({
          name: name,
          aliases: Array.isArray(c.aliases) ? c.aliases.slice() : [],
          gender: c.gender == null ? '' : String(c.gender),
          identity: c.identity || '',
          worldbookContent: c.worldbookContent || '',
          selected: c.selected !== false,
        });
      }

      var wb = Array.isArray(ctx.state.worldbookEntries) ? ctx.state.worldbookEntries : [];
      // 只认世界书人物条（[小说人物]/[人物]），与主角管道隔离
      wb.forEach(function(e) {
        if (!e || !isPersonWorldbookEntry(e)) return;
        var name = personNameFromWorldbookEntry(e);
        if (!name) return;
        var ctxHit = findWorldbookPersonContext(wb, name);
        pushCand({
          name: name,
          aliases: Array.isArray(e.keys) ? e.keys : [],
          gender: '',
          identity: '',
          worldbookContent: (ctxHit && ctxHit.content) || e.content || '',
          selected: true,
        });
      });

      var bridge = window.__novelWorkshopBridge__;
      if (bridge && typeof bridge.listEntities === 'function') {
        var list = bridge.listEntities({ type: 'person' }) || [];
        list.forEach(function(e) {
          var gender = e.gender || '';
          var identity = e.identity || e.summary || '';
          var aliases = e.aliases || [];
          if ((!gender || !identity) && typeof bridge.getEntity === 'function') {
            var full = bridge.getEntity(e.id || e.name);
            if (full) {
              var profile = (full.attrs && full.attrs.profile) || full.profile || {};
              if (!gender) gender = profile.gender || '';
              if (!identity) identity = profile.identity || full.summary || '';
              if (Array.isArray(full.aliases) && full.aliases.length) aliases = full.aliases;
            }
          }
          var wbCtx = findWorldbookPersonContext(wb, e.name);
          pushCand({
            name: e.name,
            aliases: aliases,
            gender: gender,
            identity: identity,
            worldbookContent: (wbCtx && wbCtx.content) || '',
            selected: e.selected !== false,
          });
        });
      }

      return out;
    },

    renderCorruptionTargets: function() {
      var box = document.getElementById('adultCorruptionTargets');
      if (!box) return;
      var femaleOnly = ctx.state.corruptionDefaultFemaleOnly !== false;
      var selectedNames = Array.isArray(ctx.state.corruptionSelectedNames)
        ? ctx.state.corruptionSelectedNames.slice()
        : [];
      var candidates = ctx.panels.adultConfig.collectCorruptionCandidates();
      var picks = pickCorruptionTargets(candidates, {
        defaultFemaleOnly: femaleOnly,
        selectedNames: selectedNames,
        includeUnknown: !femaleOnly,
      });
      // 未知性别且来自世界书人物标题时：女向默认下仍可选，预勾选未知
      if (femaleOnly && !selectedNames.length) {
        picks.forEach(function(p) {
          if (p.unknown && !p.male) p.selected = true;
        });
      }
      s.corruptionTargetsCache = picks;
      if (!picks.length) {
        box.innerHTML = '<span class="char-nsfw-subtitle">暂无世界书人物条——请先同步/创建「[小说人物] 名字」类条目（主角设定不在此列）</span>';
        return;
      }
      box.innerHTML = picks.map(function(p, i) {
        var meta = p.female ? '女' : (p.male ? '男' : '未知');
        return '<label><input type="checkbox" data-corruption-target="' + i + '"'
          + (p.selected ? ' checked' : '') + ' />'
          + '<span>' + s.escapeHtml(p.name) + '</span>'
          + '<span class="char-nsfw-subtitle">(' + meta + ')</span></label>';
      }).join('');
    },

    readSelectedCorruptionNames: function() {
      var names = [];
      document.querySelectorAll('#adultCorruptionTargets [data-corruption-target]').forEach(function(el) {
        if (!el.checked) return;
        var idx = parseInt(el.getAttribute('data-corruption-target'), 10);
        if (isNaN(idx) || !s.corruptionTargetsCache[idx]) return;
        names.push(s.corruptionTargetsCache[idx].name);
      });
      return names;
    },

    renderFlavorList: function() {
      var data = window.__nsfwFlavorData__;
      var listEl = document.getElementById('adultNsfwFlavorList');
      var capEl = document.getElementById('adultNsfwFlavorCap');
      if (!listEl || !data) return;

      var items = s.ensureFlavorItemsOnState();
      var max = s.maxFlavorItems();
      if (!items.length) {
        listEl.innerHTML = '<span class="adult-wv-empty">尚未添加口味——点「＋ 新增」添加（可不选，用通用写法）</span>';
      } else {
        listEl.innerHTML = items.map(function(it, idx) {
          return ctx.panels.adultConfig._dashedItemHtml('flavor', it, idx, items.length, false);
        }).join('');
      }
      if (capEl) {
        capEl.textContent = items.length
          ? ('已选 ' + items.length + ' / ' + max)
          : ('最多 ' + max + ' 个');
      }
    },

    renderExpressionList: function(kind) {
      var data = window.__nsfwFlavorData__;
      if (!data) return;
      var isSpeech = kind === 'speech';
      var listEl = document.getElementById(isSpeech ? 'adultSpeechList' : 'adultPostureList');
      if (!listEl) return;

      var items = isSpeech ? s.ensureSpeechItemsOnState() : s.ensurePostureItemsOnState();
      var label = isSpeech ? '情趣话风' : '姿势语言';

      if (!items.length) {
        listEl.innerHTML = '<span class="adult-wv-empty">尚未添加' + label + '——点「＋ 新增」添加；不占口味槽，可按需要叠加。</span>';
      } else {
        listEl.innerHTML = items.map(function(it, idx) {
          return ctx.panels.adultConfig._dashedItemHtml(kind, it, idx, items.length, false);
        }).join('');
      }
    },

    renderNsfwBlock: function() {
      s.withAppScrollPreserved(function() {
        ctx.panels.adultConfig._renderNsfwBlockInner();
      });
    },

    _renderNsfwBlockInner: function() {
      var adultEl = document.getElementById('adultNsfwEnabled');
      var ntlEl = document.getElementById('adultNtlEnabled');
      var flavorSection = document.getElementById('adultFlavorSection');
      var postureSection = document.getElementById('adultPostureSection');
      var speechSection = document.getElementById('adultSpeechSection');
      var ntlRow = document.getElementById('adultNtlTabooRow');

      ctx.panels.adultConfig.renderWorldviewPresetList();
      s.ensureFlavorItemsOnState();
      if (adultEl && adultEl.checked !== ctx.state.nsfwEnabled) adultEl.checked = ctx.state.nsfwEnabled;
      if (ntlEl && ntlEl.checked !== ctx.state.ntlEnabled) ntlEl.checked = ctx.state.ntlEnabled;

      if (flavorSection) flavorSection.style.display = ctx.state.nsfwEnabled ? 'block' : 'none';
      if (ctx.state.nsfwEnabled) ctx.panels.adultConfig.renderFlavorList();
      if (postureSection) postureSection.style.display = ctx.state.nsfwEnabled ? 'block' : 'none';
      if (speechSection) speechSection.style.display = ctx.state.nsfwEnabled ? 'block' : 'none';
      if (ctx.state.nsfwEnabled) {
        ctx.panels.adultConfig.renderExpressionList('posture');
        ctx.panels.adultConfig.renderExpressionList('speech');
      }

      if (ntlRow) ntlRow.style.display = ctx.state.ntlEnabled ? 'block' : 'none';
      ctx.panels.adultConfig.renderWorldframeRow();
      s.ensureNtlItemsOnState();
      if (ctx.state.ntlEnabled) ctx.panels.adultConfig.renderNtlList();
      ctx.panels.adultConfig.renderCorruptionBlock();
      ctx.panels.adultConfig.renderAffectionBlock();
    },

    renderNtlList: function() {
      var data = window.__nsfwFlavorData__;
      var listEl = document.getElementById('adultNtlTabooList');
      if (!listEl || !data) return;
      var items = s.ensureNtlItemsOnState();
      if (!items.length) {
        listEl.innerHTML = '<span class="char-nsfw-subtitle">点右上「＋ 新增」添加禁忌方向</span>';
        return;
      }
      listEl.innerHTML = items.map(function(it, idx) {
        return ctx.panels.adultConfig._dashedItemHtml('ntl', it, idx, items.length, false);
      }).join('');
    },

    renderCorruptionBlock: function() {
      var wrap = document.getElementById('adultCorruptionBlock');
      var enabledEl = document.getElementById('adultCorruptionEnabled');
      var body = document.getElementById('adultCorruptionBody');
      var presetEl = document.getElementById('adultCorruptionPreset');
      var customRow = document.getElementById('adultCorruptionCustomRow');
      var briefEl = document.getElementById('adultCorruptionCustomBrief');
      var extraEl = document.getElementById('adultCorruptionExtraNotes');
      var femaleEl = document.getElementById('adultCorruptionFemaleOnly');
      var syncEl = document.getElementById('adultCorruptionSyncSb');

      if (wrap) wrap.style.display = ctx.state.nsfwEnabled ? 'block' : 'none';
      if (!ctx.state.nsfwEnabled) return;

      if (enabledEl) enabledEl.checked = !!ctx.state.corruptionEnabled;
      if (body) body.style.display = ctx.state.corruptionEnabled ? 'block' : 'none';
      if (presetEl) {
        presetEl.value = ctx.state.corruptionPreset || DEFAULT_CORRUPTION_PRESET;
        syncEnhancedSelectLabel(presetEl);
      }
      if (customRow) customRow.style.display = (ctx.state.corruptionPreset === 'custom') ? 'block' : 'none';
      if (briefEl && briefEl.value !== (ctx.state.corruptionCustomBrief || '')) {
        briefEl.value = ctx.state.corruptionCustomBrief || '';
      }
      if (extraEl && extraEl.value !== (ctx.state.corruptionExtraNotes || '')) {
        extraEl.value = ctx.state.corruptionExtraNotes || '';
      }
      if (femaleEl) femaleEl.checked = ctx.state.corruptionDefaultFemaleOnly !== false;
      if (syncEl) syncEl.checked = ctx.state.corruptionSyncStatusBar !== false;
      if (ctx.state.corruptionEnabled) ctx.panels.adultConfig.renderCorruptionTargets();
    },

    readFlavorItemsFromUi: function() {
      var items = s.ensureFlavorItemsOnState().map(function(it) {
        return { id: it.id, note: it.note || '' };
      });
      ctx.panels.adultConfig._applyNotesFromLists('data-flavor-note', items, null);
      return s.normalizeFlavorItems(items, '');
    },

    readExpressionItemsFromUi: function(kind) {
      var isSpeech = kind === 'speech';
      var items = (isSpeech ? s.ensureSpeechItemsOnState() : s.ensurePostureItemsOnState()).map(function(it) {
        return { id: it.id, note: it.note || '' };
      });
      ctx.panels.adultConfig._applyNotesFromLists('data-expression-note', items, kind);
      return s.normalizeExpressionItemsByKind(items, kind);
    },

    readNtlItemsFromUi: function() {
      var items = s.ensureNtlItemsOnState().map(function(it) {
        return { id: it.id, note: it.note || '' };
      });
      ctx.panels.adultConfig._applyNotesFromLists('data-ntl-note', items, null);
      return items;
    },

    syncNsfwBlockFromUi: function() {
      var adultEl = document.getElementById('adultNsfwEnabled');
      var ntlEl = document.getElementById('adultNtlEnabled');

      ctx.state.nsfwEnabled = adultEl ? !!adultEl.checked : false;
      var items = ctx.panels.adultConfig.readFlavorItemsFromUi();
      ctx.state.nsfwFlavorItems = items;
      ctx.state.nsfwFlavor = items.length ? items[0].id : '';
      ctx.state.eroticPostureItems = ctx.panels.adultConfig.readExpressionItemsFromUi('posture');
      ctx.state.eroticSpeechItems = ctx.panels.adultConfig.readExpressionItemsFromUi('speech');
      ctx.state.ntlEnabled = ntlEl ? !!ntlEl.checked : false;
      var ntlItems = ctx.panels.adultConfig.readNtlItemsFromUi();
      ctx.state.ntlTabooItems = ntlItems;
      ctx.state.ntlTabooTypes = ntlItems.map(function(it) { return it.id; });

      ctx.panels.adultConfig.syncCorruptionBlockFromUi({ skipRender: true, silentEvent: true });
      ctx.panels.adultConfig.renderNsfwBlock();
      ctx.save();
      if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
      window.dispatchEvent(new CustomEvent('nsfw-config-changed', {
        detail: window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {},
      }));
    },

    commitFlavorItems: function(items) {
      ctx.state.nsfwFlavorItems = s.normalizeFlavorItems(items, '');
      ctx.state.nsfwFlavor = ctx.state.nsfwFlavorItems.length ? ctx.state.nsfwFlavorItems[0].id : '';
      var adultEl = document.getElementById('adultNsfwEnabled');
      var ntlEl = document.getElementById('adultNtlEnabled');
      var ntlItems = ctx.panels.adultConfig.readNtlItemsFromUi();
      ctx.state.nsfwEnabled = adultEl ? !!adultEl.checked : ctx.state.nsfwEnabled;
      ctx.state.ntlEnabled = ntlEl ? !!ntlEl.checked : ctx.state.ntlEnabled;
      ctx.state.ntlTabooItems = ntlItems;
      ctx.state.ntlTabooTypes = ntlItems.map(function(it) { return it.id; });
      ctx.panels.adultConfig.syncCorruptionBlockFromUi({ skipRender: true, silentEvent: true });
      ctx.panels.adultConfig.renderNsfwBlock();
      ctx.panels.adultConfig._refreshAdultModal();
      ctx.save();
      if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
      window.dispatchEvent(new CustomEvent('nsfw-config-changed', {
        detail: window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {},
      }));
    },

    commitExpressionItems: function(kind, items) {
      var next = s.normalizeExpressionItemsByKind(items, kind);
      if (kind === 'speech') ctx.state.eroticSpeechItems = next;
      else ctx.state.eroticPostureItems = next;
      var adultEl = document.getElementById('adultNsfwEnabled');
      var ntlEl = document.getElementById('adultNtlEnabled');
      var ntlItems = ctx.panels.adultConfig.readNtlItemsFromUi();
      ctx.state.nsfwEnabled = adultEl ? !!adultEl.checked : ctx.state.nsfwEnabled;
      ctx.state.ntlEnabled = ntlEl ? !!ntlEl.checked : ctx.state.ntlEnabled;
      ctx.state.ntlTabooItems = ntlItems;
      ctx.state.ntlTabooTypes = ntlItems.map(function(it) { return it.id; });
      ctx.panels.adultConfig.syncCorruptionBlockFromUi({ skipRender: true, silentEvent: true });
      ctx.panels.adultConfig.renderNsfwBlock();
      ctx.panels.adultConfig._refreshAdultModal();
      ctx.save();
      if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
      window.dispatchEvent(new CustomEvent('nsfw-config-changed', {
        detail: window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {},
      }));
    },

    addFlavorItem: function(flavorId, note) {
      var id = String(flavorId || '').trim();
      if (!id) return;
      var items = ctx.panels.adultConfig.readFlavorItemsFromUi();
      if (items.length >= s.maxFlavorItems()) return;
      if (items.some(function(it) { return it.id === id; })) return;
      items.push({ id: id, note: String(note || '') });
      ctx.panels.adultConfig.commitFlavorItems(items);
    },

    removeFlavorItem: async function(idx) {
      var items = ctx.panels.adultConfig.readFlavorItemsFromUi();
      if (idx < 0 || idx >= items.length) return;
      var lab = s.labelFlavor(items[idx].id);
      if (!(await s.confirmAdultRemove({ kind: '口味', label: lab }))) return;
      items.splice(idx, 1);
      ctx.panels.adultConfig.commitFlavorItems(items);
    },

    moveFlavorItem: function(idx, delta) {
      var items = ctx.panels.adultConfig.readFlavorItemsFromUi();
      var from = parseInt(idx, 10);
      var to = from + (delta || 0);
      if (isNaN(from) || to < 0 || to >= items.length) return;
      var tmp = items[from];
      items[from] = items[to];
      items[to] = tmp;
      ctx.panels.adultConfig.commitFlavorItems(items);
    },

    addExpressionItem: function(kind, itemId, note) {
      var id = String(itemId || '').trim();
      if (!id) return;
      var items = ctx.panels.adultConfig.readExpressionItemsFromUi(kind);
      if (items.some(function(it) { return it.id === id; })) return;
      items.push({ id: id, note: String(note || '') });
      ctx.panels.adultConfig.commitExpressionItems(kind, items);
    },

    removeExpressionItem: async function(kind, idx) {
      var items = ctx.panels.adultConfig.readExpressionItemsFromUi(kind);
      if (idx < 0 || idx >= items.length) return;
      var kindLabel = kind === 'speech' ? '情趣话风' : '姿势语言';
      var lab = s.labelExpression(kind, items[idx].id);
      if (!(await s.confirmAdultRemove({ kind: kindLabel, label: lab }))) return;
      items.splice(idx, 1);
      ctx.panels.adultConfig.commitExpressionItems(kind, items);
    },

    moveExpressionItem: function(kind, idx, delta) {
      var items = ctx.panels.adultConfig.readExpressionItemsFromUi(kind);
      var from = parseInt(idx, 10);
      var to = from + (delta || 0);
      if (isNaN(from) || to < 0 || to >= items.length) return;
      var tmp = items[from];
      items[from] = items[to];
      items[to] = tmp;
      ctx.panels.adultConfig.commitExpressionItems(kind, items);
    },

    syncCorruptionBlockFromUi: function(opts) {
      opts = opts || {};
      var enabledEl = document.getElementById('adultCorruptionEnabled');
      var presetEl = document.getElementById('adultCorruptionPreset');
      var briefEl = document.getElementById('adultCorruptionCustomBrief');
      var extraEl = document.getElementById('adultCorruptionExtraNotes');
      var femaleEl = document.getElementById('adultCorruptionFemaleOnly');
      var syncEl = document.getElementById('adultCorruptionSyncSb');

      ctx.state.corruptionEnabled = enabledEl ? !!enabledEl.checked : !!ctx.state.corruptionEnabled;
      ctx.state.corruptionPreset = presetEl ? presetEl.value : (ctx.state.corruptionPreset || '5');
      if (!CORRUPTION_PRESETS[ctx.state.corruptionPreset]) ctx.state.corruptionPreset = '5';
      ctx.state.corruptionCustomBrief = briefEl ? briefEl.value : (ctx.state.corruptionCustomBrief || '');
      ctx.state.corruptionExtraNotes = extraEl ? extraEl.value : (ctx.state.corruptionExtraNotes || '');
      ctx.state.corruptionDefaultFemaleOnly = femaleEl ? !!femaleEl.checked : true;
      ctx.state.corruptionSyncStatusBar = syncEl ? !!syncEl.checked : true;
      if (document.getElementById('adultCorruptionTargets')) {
        ctx.state.corruptionSelectedNames = ctx.panels.adultConfig.readSelectedCorruptionNames();
      }
      ctx.state.corruptionStageNames = resolveStageNames(
        ctx.state.corruptionPreset,
        ctx.state.corruptionStageNames,
        ctx.state.corruptionCustomBrief
      );

      if (!opts.skipRender) ctx.panels.adultConfig.renderCorruptionBlock();
      if (!opts.skipSave) ctx.save();
      if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
      if (!opts.silentEvent) {
        window.dispatchEvent(new CustomEvent('nsfw-config-changed', {
          detail: window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {},
        }));
      }
    },

    syncCorruptionStatusBar: function(stageNames, selectedNames, generalMode) {
      if (!window.__statusBarApi__ || typeof window.__statusBarApi__.getDesign !== 'function') {
        return { ok: false, reason: 'status_bar_api_missing' };
      }
      var cur = window.__statusBarApi__.getDesign() || {};
      var names = Array.isArray(selectedNames) ? selectedNames.filter(Boolean) : [];
      if (!names.length && !generalMode) {
        return { ok: false, reason: 'no_worldbook_targets' };
      }
      var next = ensureCorruptionModuleInDesign(Object.assign({}, cur, { nsfw: true }), stageNames);
      if (names.length) {
        next.castMode = 'multi';
        next.femaleOnly = true;
        next.characters = names.map(function(n) {
          return { name: n, selected: true, aliases: [] };
        });
        next.mainName = names[0];
        next = normalizeDesign(next);
        next.paths = buildPlaceholderPaths(next);
      } else {
        next = normalizeDesign(next);
      }
      if (typeof window.__statusBarApi__.setDesign === 'function') {
        window.__statusBarApi__.setDesign(next);
      }
      return { ok: true, castMode: names.length ? 'multi' : 'general', names: names.slice(), general: generalMode || !names.length };
    },

    setAffectionTip: function(text, kind) {
      var tip = document.getElementById('adultAffectionTip');
      if (!tip) return;
      tip.textContent = text || '';
      tip.className = 'ui-status-tip' + (kind === 'warn' ? ' is-warn' : (kind === 'ok' ? ' is-ok' : ''));
    },

    collectAffectionCandidates: function() {
      var out = [];
      var seen = Object.create(null);
      var protagonist = String(ctx.state.charName || '').trim();

      function pushCand(c) {
        if (!c || !c.name) return;
        var name = String(c.name).trim();
        if (!name || seen[name]) return;
        if (protagonist && name === protagonist) return;
        seen[name] = true;
        out.push({
          name: name,
          aliases: Array.isArray(c.aliases) ? c.aliases.slice() : [],
          identity: c.identity || '',
          worldbookContent: c.worldbookContent || '',
          selected: c.selected !== false,
        });
      }

      var wb = Array.isArray(ctx.state.worldbookEntries) ? ctx.state.worldbookEntries : [];
      wb.forEach(function(e) {
        if (!e || !isPersonWorldbookEntry(e)) return;
        var name = personNameFromWorldbookEntry(e);
        if (!name) return;
        var ctxHit = findWorldbookPersonContext(wb, name);
        pushCand({
          name: name,
          aliases: Array.isArray(e.keys) ? e.keys : [],
          identity: '',
          worldbookContent: (ctxHit && ctxHit.content) || e.content || '',
          selected: true,
        });
      });

      var bridge = window.__novelWorkshopBridge__;
      if (bridge && typeof bridge.listEntities === 'function') {
        var list = bridge.listEntities({ type: 'person' }) || [];
        list.forEach(function(e) {
          var identity = e.identity || e.summary || '';
          var aliases = e.aliases || [];
          if ((!identity) && typeof bridge.getEntity === 'function') {
            var full = bridge.getEntity(e.id || e.name);
            if (full) {
              var profile = (full.attrs && full.attrs.profile) || full.profile || {};
              if (!identity) identity = profile.identity || full.summary || '';
              if (Array.isArray(full.aliases) && full.aliases.length) aliases = full.aliases;
            }
          }
          var wbCtx = findWorldbookPersonContext(wb, e.name);
          pushCand({
            name: e.name,
            aliases: aliases,
            identity: identity,
            worldbookContent: (wbCtx && wbCtx.content) || '',
            selected: e.selected !== false,
          });
        });
      }

      return out;
    },

    renderAffectionTargets: function() {
      var box = document.getElementById('adultAffectionTargets');
      if (!box) return;
      var selectedNames = Array.isArray(ctx.state.affectionSelectedNames)
        ? ctx.state.affectionSelectedNames.slice()
        : [];
      var candidates = ctx.panels.adultConfig.collectAffectionCandidates();
      var picks = pickAffectionTargets(candidates);
      s.affectionTargetsCache = picks;
      var selSet = Object.create(null);
      selectedNames.forEach(function(n) { selSet[n] = true; });
      var html = picks.map(function(c, i) {
        return '<label><input type="checkbox" data-affection-target="' + i + '"'
          + (c.selected || selSet[c.name] ? ' checked' : '') + ' /> '
          + '<span>' + ctx.escapeHtml(c.name) + '</span></label>';
      }).join('');
      box.innerHTML = html || '<span class="char-nsfw-subtitle">暂无可用角色（来自世界书/小说人物）</span>';
    },

    readSelectedAffectionNames: function() {
      var names = [];
      document.querySelectorAll('#adultAffectionTargets [data-affection-target]').forEach(function(el) {
        if (!el.checked) return;
        var idx = parseInt(el.getAttribute('data-affection-target'), 10);
        if (isNaN(idx) || !s.affectionTargetsCache[idx]) return;
        names.push(s.affectionTargetsCache[idx].name);
      });
      return names;
    },

    renderAffectionBlock: function() {
      var wrap = document.getElementById('adultAffectionBlock');
      var enabledEl = document.getElementById('adultAffectionEnabled');
      var body = document.getElementById('adultAffectionBody');
      var presetEl = document.getElementById('adultAffectionPreset');
      var customRow = document.getElementById('adultAffectionCustomRow');
      var briefEl = document.getElementById('adultAffectionCustomBrief');
      var extraEl = document.getElementById('adultAffectionExtraNotes');
      var syncEl = document.getElementById('adultAffectionSyncSb');

      if (wrap) wrap.style.display = ctx.state.nsfwEnabled ? 'block' : 'none';
      if (!ctx.state.nsfwEnabled) return;

      if (enabledEl) enabledEl.checked = !!ctx.state.affectionEnabled;
      if (body) body.style.display = ctx.state.affectionEnabled ? 'block' : 'none';
      if (presetEl) {
        presetEl.value = ctx.state.affectionPreset || DEFAULT_AFFECTION_PRESET;
        syncEnhancedSelectLabel(presetEl);
      }
      if (customRow) customRow.style.display = (ctx.state.affectionPreset === 'custom') ? 'block' : 'none';
      if (briefEl && briefEl.value !== (ctx.state.affectionCustomBrief || '')) {
        briefEl.value = ctx.state.affectionCustomBrief || '';
      }
      if (extraEl && extraEl.value !== (ctx.state.affectionExtraNotes || '')) {
        extraEl.value = ctx.state.affectionExtraNotes || '';
      }
      if (syncEl) syncEl.checked = ctx.state.affectionSyncStatusBar !== false;
      if (ctx.state.affectionEnabled) ctx.panels.adultConfig.renderAffectionTargets();
    },

    syncAffectionBlockFromUi: function(opts) {
      opts = opts || {};
      var enabledEl = document.getElementById('adultAffectionEnabled');
      var presetEl = document.getElementById('adultAffectionPreset');
      var briefEl = document.getElementById('adultAffectionCustomBrief');
      var extraEl = document.getElementById('adultAffectionExtraNotes');
      var syncEl = document.getElementById('adultAffectionSyncSb');

      ctx.state.affectionEnabled = enabledEl ? !!enabledEl.checked : !!ctx.state.affectionEnabled;
      ctx.state.affectionPreset = presetEl ? presetEl.value : (ctx.state.affectionPreset || '6');
      if (!AFFECTION_PRESETS[ctx.state.affectionPreset]) ctx.state.affectionPreset = '6';
      ctx.state.affectionCustomBrief = briefEl ? briefEl.value : (ctx.state.affectionCustomBrief || '');
      ctx.state.affectionExtraNotes = extraEl ? extraEl.value : (ctx.state.affectionExtraNotes || '');
      ctx.state.affectionSyncStatusBar = syncEl ? !!syncEl.checked : true;
      if (document.getElementById('adultAffectionTargets')) {
        ctx.state.affectionSelectedNames = ctx.panels.adultConfig.readSelectedAffectionNames();
      }
      ctx.state.affectionStageNames = resolveAffectionStageNames(
        ctx.state.affectionPreset,
        ctx.state.affectionStageNames,
        ctx.state.affectionCustomBrief
      );

      if (!opts.skipRender) ctx.panels.adultConfig.renderAffectionBlock();
      if (!opts.skipSave) ctx.save();
      if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
      if (!opts.silentEvent) {
        window.dispatchEvent(new CustomEvent('nsfw-config-changed', {
          detail: window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {},
        }));
      }
    },

    syncAffectionStatusBar: function(stageNames, selectedNames, generalMode) {
      if (!window.__statusBarApi__ || typeof window.__statusBarApi__.getDesign !== 'function') {
        return { ok: false, reason: 'status_bar_api_missing' };
      }
      var cur = window.__statusBarApi__.getDesign() || {};
      var names = Array.isArray(selectedNames) ? selectedNames.filter(Boolean) : [];
      var next = ensureAffectionModuleInDesign(Object.assign({}, cur), stageNames);
      if (names.length) {
        next.castMode = 'multi';
        next.characters = names.map(function(n) {
          return { name: n, selected: true, aliases: [] };
        });
        next.mainName = names[0];
        next = normalizeDesign(next);
        next.paths = buildPlaceholderPaths(next);
      } else {
        next = normalizeDesign(next);
      }
      if (typeof window.__statusBarApi__.setDesign === 'function') {
        window.__statusBarApi__.setDesign(next);
      }
      return { ok: true, castMode: names.length ? 'multi' : 'general', names: names.slice(), general: generalMode || !names.length };
    },

    runGenerateAffectionLore: async function(opts) {
      opts = opts || {};
      ctx.panels.adultConfig.syncAffectionBlockFromUi({ skipRender: true });
      if (!ctx.state.affectionEnabled) {
        ctx.panels.adultConfig.setAffectionTip('请先启用纯爱线', 'warn');
        return { ok: false, error: 'affection_disabled' };
      }
      var selected = ctx.panels.adultConfig.readSelectedAffectionNames();
      if (!selected.length && Array.isArray(opts.selectedNames)) selected = opts.selectedNames.slice();
      var protagonist = String(ctx.state.charName || '').trim();
      selected = selected.filter(function(n) { return n && n !== protagonist; });
      var generalMode = !selected.length;
      if (generalMode) {
        ctx.panels.adultConfig.setAffectionTip('未勾选角色：将生成「亲密档案·通用」（适用于所有/随机角色）', null);
      }
      ctx.state.affectionSelectedNames = selected.slice();

      var apiUrlEl = ctx.$('apiUrl');
      var modelEl = ctx.$('modelSelect');
      var apiKeyEl = ctx.$('apiKey');
      var url = (apiUrlEl ? apiUrlEl.value : '').replace(/\/$/, '');
      var model = modelEl ? modelEl.value : '';
      var useAi = !!(url && model) && opts.templateOnly !== true;
      if (!generalMode && !useAi) {
        ctx.panels.adultConfig.setAffectionTip('逐人亲密档案需配置 AI 后方可生成（通用档案无需 AI）', 'warn');
        return { ok: false, error: 'ai_required' };
      }

      var btn = document.getElementById('btnGenAffectionLore');
      if (btn) btn.disabled = true;
      ctx.panels.adultConfig.setAffectionTip('正在生成纯爱线世界书…', null);

      try {
        var result = await ctx.runTracked({
          type: 'affection_lore_generate',
          title: '纯爱线世界书',
          target: selected.join('、').slice(0, 40),
        }, async function(task) {
          var stageNames = resolveAffectionStageNames(
            ctx.state.affectionPreset,
            ctx.state.affectionStageNames,
            ctx.state.affectionCustomBrief
          );
          var headers = { 'Content-Type': 'application/json' };
          var key = apiKeyEl ? apiKeyEl.value.trim() : '';
          if (key) headers['Authorization'] = 'Bearer ' + key;

          if (useAi && ctx.state.affectionPreset === 'custom') {
            var stageResp = await ctx.fetchAIContent({
              context: '亲密度档位表',
              url: url + '/chat/completions',
              headers: headers,
              model: model,
              messages: [
                { role: 'system', content: '你是角色卡亲密关系档位设计师。根据用户对关系基调的描述，产出 3-8 个档位名。要求：档位名短（≤8字）、可递增、可写入状态栏枚举；不要解释。只输出 JSON：{ "stages": ["档位1", "档位2", ...] }' },
                { role: 'user', content: '关系基调描述：\n' + (ctx.state.affectionCustomBrief || '') },
              ],
              temperature: 0.4,
              httpErrorPrefix: '亲密度档位生成失败 HTTP ',
              signal: task && task.signal,
            });
            var parsedStages = parseAffectionStageNamesFromAiText(stageResp.content);
            if (parsedStages.length >= AFFECTION_STAGE_MIN) stageNames = parsedStages;
          }

          ctx.state.affectionStageNames = stageNames.slice();
          var entries = Array.isArray(ctx.state.worldbookEntries) ? ctx.state.worldbookEntries.slice() : [];
          entries = upsertWorldbookByComment2(entries, buildAffectionRulesWorldbookEntry(stageNames));
          if (generalMode) {
            entries = upsertWorldbookByComment2(entries, buildAffectionGeneralArchiveEntry(stageNames));
          }

          if (generalMode) {
            ctx.state.worldbookEntries = entries;
            ctx.save();
            window.dispatchEvent(new CustomEvent('worldbook-changed'));
            window.dispatchEvent(new CustomEvent('card-builder-data-changed'));
            if (ctx.panels.worldbook && ctx.panels.worldbook.renderEntriesList) {
              ctx.panels.worldbook.renderEntriesList();
            }
            var sbGen = { ok: false };
            if (ctx.state.affectionSyncStatusBar !== false) {
              sbGen = ctx.panels.adultConfig.syncAffectionStatusBar(stageNames, [], true);
            }
            if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
            return {
              ok: true,
              stageNames: stageNames,
              rulesComment: '亲密关系总则',
              archiveCount: 0,
              generalArchive: true,
              selectedNames: [],
              usedAi: false,
              statusBar: sbGen,
              minCharsPerStage: AFFECTION_MIN_CHARS_PER_STAGE,
            };
          }

          var candMap = Object.create(null);
          s.affectionTargetsCache.forEach(function(c) { candMap[c.name] = c; });
          ctx.panels.adultConfig.collectAffectionCandidates().forEach(function(c) {
            if (!candMap[c.name]) candMap[c.name] = c;
          });
          var minTotal = stageNames.length * AFFECTION_MIN_CHARS_PER_STAGE;

          for (var i = 0; i < selected.length; i++) {
            var name = selected[i];
            var meta = candMap[name] || { name: name, aliases: [] };
            var wbCtx = findWorldbookPersonContext(entries, name);
            var worldbookContent = (meta.worldbookContent || (wbCtx && wbCtx.content) || '').trim();
            if (!worldbookContent) {
              throw new Error('「' + name + '」缺少世界书人物正文，请先完善该人物条目再生成亲密档案');
            }
            var userPrompt = buildAffectionArchiveUserPrompt({
              charName: name,
              stageNames: stageNames,
              worldbookContent: worldbookContent,
              identity: meta.identity || '',
              customBrief: ctx.state.affectionCustomBrief,
              extraNotes: ctx.state.affectionExtraNotes,
            });
            var aiResp = await ctx.fetchAIContent({
              context: '亲密档案·' + name,
              url: url + '/chat/completions',
              headers: headers,
              model: model,
              messages: [
                { role: 'system', content: ctx.promptText('affectionArchive', buildAffectionArchiveSystemPrompt()) },
                { role: 'user', content: userPrompt },
              ],
              temperature: 0.75,
              httpErrorPrefix: '亲密档案生成失败 HTTP ',
              signal: task && task.signal,
            });
            var content = String(aiResp.content || '').trim();
            var richness = evaluateArchiveRichness(content, stageNames);
            if (!richness.ok) {
              var expandResp = await ctx.fetchAIContent({
                context: '亲密档案扩写·' + name,
                url: url + '/chat/completions',
                headers: headers,
                model: model,
                messages: [
                  { role: 'system', content: ctx.promptText('affectionArchiveExpand', buildAffectionArchiveExpandSystemPrompt()) },
                  {
                    role: 'user',
                    content: '薄弱阶段：' + richness.weakStages.join('、')
                      + '\n目标每阶段≥' + AFFECTION_MIN_CHARS_PER_STAGE + '字，全文≥' + minTotal + '字。\n\n'
                      + '【该角色世界书】\n' + truncateToTokens(worldbookContent, CORRUPTION_EXPAND_WB)
                      + '\n\n【待加厚正文】\n' + content,
                  },
                ],
                temperature: 0.7,
                httpErrorPrefix: '亲密档案扩写失败 HTTP ',
                signal: task && task.signal,
              });
              var expanded = String(expandResp.content || '').trim();
              if (expanded.length > content.length) content = expanded;
              richness = evaluateArchiveRichness(content, stageNames);
            }
            if (!richness.ok) {
              throw new Error('「' + name + '」亲密档案仍偏薄（弱阶段：'
                + richness.weakStages.join('、') + '），请重试或补充该人物世界书细节');
            }
            entries = upsertWorldbookByComment2(
              entries,
              buildAffectionArchiveWorldbookEntry(name, content, meta.aliases)
            );
          }

          ctx.state.worldbookEntries = entries;
          ctx.save();
          window.dispatchEvent(new CustomEvent('worldbook-changed'));
          window.dispatchEvent(new CustomEvent('card-builder-data-changed'));
          if (ctx.panels.worldbook && ctx.panels.worldbook.renderEntriesList) {
            ctx.panels.worldbook.renderEntriesList();
          }
          var sb = { ok: false };
          if (ctx.state.affectionSyncStatusBar !== false) {
            sb = ctx.panels.adultConfig.syncAffectionStatusBar(stageNames, selected);
          }
          if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
          return {
            ok: true,
            stageNames: stageNames,
            rulesComment: '亲密关系总则',
            archiveCount: selected.length,
            generalArchive: false,
            selectedNames: selected.slice(),
            usedAi: true,
            statusBar: sb,
            minCharsPerStage: AFFECTION_MIN_CHARS_PER_STAGE,
          };
        });
        ctx.panels.adultConfig.setAffectionTip('纯爱线世界书生成完成', 'ok');
        return result;
      } catch (err) {
        ctx.panels.adultConfig.setAffectionTip(err && err.message ? err.message : String(err), 'warn');
        return { ok: false, error: err && err.message ? err.message : String(err) };
      } finally {
        if (btn) btn.disabled = false;
      }
    },

    runGenerateCorruptionLore: async function(opts) {
      opts = opts || {};
      ctx.panels.adultConfig.syncCorruptionBlockFromUi({ skipRender: true });
      if (!ctx.state.nsfwEnabled) {
        ctx.panels.adultConfig.setCorruptionTip('请先启用 NSFW', 'warn');
        return { ok: false, error: 'nsfw_disabled' };
      }
      if (!ctx.state.corruptionEnabled) {
        ctx.panels.adultConfig.setCorruptionTip('请先启用恶堕进度', 'warn');
        return { ok: false, error: 'corruption_disabled' };
      }
      var selected = ctx.panels.adultConfig.readSelectedCorruptionNames();
      if (!selected.length && Array.isArray(opts.selectedNames)) selected = opts.selectedNames.slice();
      var protagonist = String(ctx.state.charName || '').trim();
      selected = selected.filter(function(n) { return n && n !== protagonist; });
      var generalMode = !selected.length;
      if (generalMode) {
        ctx.panels.adultConfig.setCorruptionTip('未勾选角色：将生成「恶堕档案·通用」（适用于所有/随机女角色）', null);
      }
      ctx.state.corruptionSelectedNames = selected.slice();

      var apiUrlEl = ctx.$('apiUrl');
      var modelEl = ctx.$('modelSelect');
      var apiKeyEl = ctx.$('apiKey');
      var url = (apiUrlEl ? apiUrlEl.value : '').replace(/\/$/, '');
      var model = modelEl ? modelEl.value : '';
      var useAi = !!(url && model) && opts.templateOnly !== true;
      if (!generalMode && !useAi) {
        ctx.panels.adultConfig.setCorruptionTip('逐人恶堕档案需配置 AI 后方可生成（通用档案无需 AI）', 'warn');
        return { ok: false, error: 'ai_required' };
      }

      var btn = document.getElementById('btnGenCorruptionLore');
      if (btn) btn.disabled = true;
      ctx.panels.adultConfig.setCorruptionTip('正在生成丰满恶堕世界书…', null);

      try {
        var result = await ctx.runTracked({
          type: 'corruption_lore_generate',
          title: '恶堕进度世界书',
          target: selected.join('、').slice(0, 40),
        }, async function(task) {
          var stageNames = resolveStageNames(
            ctx.state.corruptionPreset,
            ctx.state.corruptionStageNames,
            ctx.state.corruptionCustomBrief
          );

          var headers = { 'Content-Type': 'application/json' };
          var key = apiKeyEl ? apiKeyEl.value.trim() : '';
          if (key) headers['Authorization'] = 'Bearer ' + key;

          if (useAi && ctx.state.corruptionPreset === 'custom') {
            var stageResp = await ctx.fetchAIContent({
              context: '恶堕阶段表',
              url: url + '/chat/completions',
              headers: headers,
              model: model,
              messages: [
                { role: 'system', content: ctx.promptText('corruptionStages', buildCustomStagesSystemPrompt()) },
                { role: 'user', content: buildCustomStagesUserPrompt(ctx.state.corruptionCustomBrief) },
              ],
              temperature: 0.4,
              httpErrorPrefix: '恶堕阶段生成失败 HTTP ',
              signal: task && task.signal,
            });
            var parsedStages = parseStageNamesFromAiText(stageResp.content);
            if (parsedStages.length >= 2) stageNames = parsedStages;
          }

          ctx.state.corruptionStageNames = stageNames.slice();
          var entries = Array.isArray(ctx.state.worldbookEntries) ? ctx.state.worldbookEntries.slice() : [];
          entries = upsertWorldbookByComment(entries, buildRulesWorldbookEntry(stageNames));
          if (generalMode) {
            entries = upsertWorldbookByComment(entries, buildGeneralArchiveEntry(stageNames));
          }

          if (generalMode) {
            ctx.state.worldbookEntries = entries;
            ctx.save();
            window.dispatchEvent(new CustomEvent('worldbook-changed'));
            window.dispatchEvent(new CustomEvent('card-builder-data-changed'));
            if (ctx.panels.worldbook && ctx.panels.worldbook.renderEntriesList) {
              ctx.panels.worldbook.renderEntriesList();
            }

            var sbGen = { ok: false };
            if (ctx.state.corruptionSyncStatusBar !== false) {
              sbGen = ctx.panels.adultConfig.syncCorruptionStatusBar(stageNames, [], true);
            }
            if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
            return {
              ok: true,
              stageNames: stageNames,
              rulesComment: '恶堕进度总则',
              archiveCount: 0,
              generalArchive: true,
              selectedNames: [],
              usedAi: false,
              statusBar: sbGen,
              minCharsPerStage: CORRUPTION_MIN_CHARS_PER_STAGE,
            };
          }

          var candMap = Object.create(null);
          s.corruptionTargetsCache.forEach(function(c) { candMap[c.name] = c; });
          ctx.panels.adultConfig.collectCorruptionCandidates().forEach(function(c) {
            if (!candMap[c.name]) candMap[c.name] = c;
          });

          var flavorHint = s.buildNsfwFlavorHint();
          var postureHint = s.buildPostureHintForPrompt();
          var speechHint = s.buildSpeechHintForPrompt();
          var ntlHint = s.buildNtlHintForPrompt();
          var minTotal = stageNames.length * CORRUPTION_MIN_CHARS_PER_STAGE;
          var novelBridge = window.__novelWorkshopBridge__;
          var novelEntities = (novelBridge && typeof novelBridge.listEntities === 'function')
            ? (novelBridge.listEntities({}) || [])
            : [];

          for (var i = 0; i < selected.length; i++) {
            var name = selected[i];
            var meta = candMap[name] || { name: name, aliases: [] };
            var wbCtx = findWorldbookPersonContext(entries, name);
            var worldbookContent = (meta.worldbookContent || (wbCtx && wbCtx.content) || '').trim();
            if (!worldbookContent) {
              throw new Error('「' + name + '」缺少世界书人物正文，请先完善该人物条目再生成恶堕档案');
            }

            var siblingHint = formatCorruptionArchiveDigests(entries, { excludeName: name });
            var canonDigest = buildAdultCanonDigest({
              entities: novelEntities,
              worldbookEntries: entries,
              focusName: name,
              excludeNames: [],
              includeCorruption: true,
              includeStyle: true,
              styleText: (novelBridge && novelBridge.getState)
                ? ((novelBridge.getState() || {}).styleText || '')
                : '',
            });

            var userPrompt = buildArchiveUserPrompt({
              charName: name,
              stageNames: stageNames,
              worldbookContent: worldbookContent,
              identity: meta.identity || '',
              customBrief: ctx.state.corruptionCustomBrief,
              extraNotes: ctx.state.corruptionExtraNotes,
              nsfwFlavorHint: flavorHint + postureHint + speechHint,
              ntlHint: ntlHint,
              canonDigest: canonDigest,
              siblingArchivesHint: siblingHint,
            });

            var aiResp = await ctx.fetchAIContent({
              context: '恶堕档案·' + name,
              url: url + '/chat/completions',
              headers: headers,
              model: model,
              messages: [
                { role: 'system', content: ctx.promptText('corruptionArchive', buildArchiveSystemPrompt()) },
                { role: 'user', content: userPrompt },
              ],
              temperature: 0.75,
              httpErrorPrefix: '恶堕档案生成失败 HTTP ',
              signal: task && task.signal,
            });
            var content = String(aiResp.content || '').trim();
            var richness = evaluateArchiveRichness(content, stageNames);

            if (!richness.ok) {
              var expandResp = await ctx.fetchAIContent({
                context: '恶堕档案扩写·' + name,
                url: url + '/chat/completions',
                headers: headers,
                model: model,
                messages: [
                  { role: 'system', content: ctx.promptText('corruptionArchiveExpand', buildArchiveExpandSystemPrompt()) },
                  {
                    role: 'user',
                    content: '薄弱阶段：' + richness.weakStages.join('、')
                      + '\n目标每阶段≥' + CORRUPTION_MIN_CHARS_PER_STAGE + '字，全文≥' + minTotal + '字。\n\n'
                      + '【该角色世界书】\n' + truncateToTokens(worldbookContent, CORRUPTION_EXPAND_WB)
                      + (siblingHint ? '\n' + siblingHint : '')
                      + '\n\n【待加厚正文】\n' + content,
                  },
                ],
                temperature: 0.7,
                httpErrorPrefix: '恶堕档案扩写失败 HTTP ',
                signal: task && task.signal,
              });
              var expanded = String(expandResp.content || '').trim();
              if (expanded.length > content.length) content = expanded;
              richness = evaluateArchiveRichness(content, stageNames);
            }

            if (!richness.ok) {
              throw new Error('「' + name + '」恶堕档案仍偏薄（弱阶段：'
                + richness.weakStages.join('、') + '），请重试或补充该人物世界书细节');
            }

            entries = upsertWorldbookByComment(
              entries,
              buildArchiveWorldbookEntry(name, content, meta.aliases)
            );
          }

          ctx.state.worldbookEntries = entries;
          ctx.save();
          window.dispatchEvent(new CustomEvent('worldbook-changed'));
          window.dispatchEvent(new CustomEvent('card-builder-data-changed'));
          if (ctx.panels.worldbook && ctx.panels.worldbook.renderEntriesList) {
            ctx.panels.worldbook.renderEntriesList();
          }

          var sb = { ok: false };
          if (ctx.state.corruptionSyncStatusBar !== false) {
            sb = ctx.panels.adultConfig.syncCorruptionStatusBar(stageNames, selected);
          }
          if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();

          return {
            ok: true,
            stageNames: stageNames,
            rulesComment: '恶堕进度总则',
            archiveCount: selected.length,
            selectedNames: selected.slice(),
            usedAi: true,
            statusBar: sb,
            minCharsPerStage: CORRUPTION_MIN_CHARS_PER_STAGE,
          };
        });

        ctx.panels.adultConfig.setCorruptionTip(
          result.generalArchive
            ? '已写入总则 + 「恶堕档案·通用」（适用于所有/随机女角色）'
            : '已更新总则 + ' + result.archiveCount + ' 条丰满档案（每阶≥'
              + CORRUPTION_MIN_CHARS_PER_STAGE + '字 · ' + result.stageNames.length + ' 阶）',
          'ok'
        );
        return result;
      } catch (err) {
        if (ctx.isTrackedAbort(err)) {
          ctx.panels.adultConfig.setCorruptionTip('已停止', 'warn');
          return { ok: false, error: 'aborted' };
        }
        ctx.panels.adultConfig.setCorruptionTip(String(err.message || err), 'err');
        return { ok: false, error: String(err.message || err) };
      } finally {
        if (btn) btn.disabled = false;
      }
    },

    /* ---------- 成人体系总纲（固化进卡，constant 常驻） ---------- */

    setSystemDigestTip: function(text, kind) {
      var tip = document.getElementById('adultSystemDigestTip');
      if (!tip) return;
      tip.textContent = text || '';
      tip.classList.remove('is-warn', 'is-ok', 'is-err');
      if (kind) tip.classList.add('is-' + kind);
    },

    generateSystemDigest: async function() {
      ctx.panels.adultConfig.syncNsfwBlockFromUi();
      // 先写恶堕世界书（总则 + 角色档案，需 AI；未启用/无目标/无 AI 时跳过），
      // 确保随后并入的「恶堕配置摘要」落在最新进度总则上，避免被重建覆盖
      var corr = null;
      try {
        corr = await ctx.panels.adultConfig.runGenerateCorruptionLore();
      } catch (err) {
        ctx.panels.adultConfig.setCorruptionTip(String(err.message || err), 'err');
      }
      if (corr && corr.error === 'aborted') {
        return { ok: false, reason: 'corruption_aborted' };
      }
      // 纯爱线对称：先写亲密世界书（总则 + 角色档案），再把配置摘要并入「亲密关系总则」
      var aff = null;
      try {
        aff = await ctx.panels.adultConfig.runGenerateAffectionLore();
      } catch (err) {
        ctx.panels.adultConfig.setAffectionTip(String(err.message || err), 'err');
      }
      if (aff && aff.error === 'aborted') {
        return { ok: false, reason: 'affection_aborted' };
      }
      var cfg = window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {};
      if (!hasMeaningfulSystemDigest(cfg)) {
        if (corr && corr.ok) {
          ctx.panels.adultConfig.setSystemDigestTip('已生成恶堕世界书；当前无可固化的体系内容，未写总纲', 'ok');
          return { ok: true, corruptionOnly: true };
        }
        ctx.panels.adultConfig.setSystemDigestTip('尚未配置可固化的体系（世界观/载体/口味/姿势/话风/NTL），请先在上方选择', 'warn');
        return { ok: false, reason: 'empty' };
      }
      var entries = buildAdultSystemDigest(cfg);
      if (!entries.length) {
        if (corr && corr.ok) {
          ctx.panels.adultConfig.setSystemDigestTip('已生成恶堕世界书；无可固化的体系内容，未写总纲', 'ok');
          return { ok: true, corruptionOnly: true };
        }
        ctx.panels.adultConfig.setSystemDigestTip('无可固化的体系内容', 'warn');
        return { ok: false, reason: 'empty' };
      }
      entries = mergeCorruptionConfigNote(entries, cfg);
      entries = mergeAffectionConfigNote(entries, cfg);
      ctx.state.worldbookEntries = upsertSystemDigestEntries(ctx.state.worldbookEntries || [], entries);
      ctx.save();
      if (ctx.panels.worldbook && ctx.panels.worldbook.renderEntriesList) {
        ctx.panels.worldbook.renderEntriesList();
      }
      window.dispatchEvent(new CustomEvent('worldbook-changed'));
      window.dispatchEvent(new CustomEvent('card-builder-data-changed'));
      if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
      var tip = '已写入 ' + entries.length + ' 条体系总纲';
      if (corr && corr.ok) tip += '，并生成恶堕世界书（总则 + ' + corr.archiveCount + ' 条档案）';
      if (aff && aff.ok) tip += '，并生成纯爱线世界书（总则 + ' + aff.archiveCount + ' 条档案）';
      tip += '（constant 常驻，position↑Char）';
      ctx.panels.adultConfig.setSystemDigestTip(tip, 'ok');
      return { ok: true, count: entries.length, corruption: corr && corr.ok ? corr : null, affection: aff && aff.ok ? aff : null };
    },

    removeSystemDigest: function() {
      var stripped = stripCorruptionConfigNote(ctx.state.worldbookEntries || []);
      stripped = stripAffectionConfigNote(stripped);
      ctx.state.worldbookEntries = stripped.filter(function(e) {
        return !isAdultDigestEntry(e);
      });
      ctx.save();
      if (ctx.panels.worldbook && ctx.panels.worldbook.renderEntriesList) {
        ctx.panels.worldbook.renderEntriesList();
      }
      window.dispatchEvent(new CustomEvent('worldbook-changed'));
      ctx.panels.adultConfig.setSystemDigestTip('已移除体系总纲条目（并撤出恶堕/纯爱配置摘要）', 'ok');
      return { ok: true };
    },

    /** 导出兜底：启用且已配置，但卡内尚无总纲条目时静默生成一次（宁缺勿动） */
    ensureSystemDigestSilent: function() {
      var cfg = window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {};
      if (!hasMeaningfulSystemDigest(cfg)) return { ok: false, reason: 'empty' };
      var hasAny = (ctx.state.worldbookEntries || []).some(function(e) {
        return isAdultDigestEntry(e);
      });
      if (hasAny) return { ok: true, skipped: 'exists' };
      var entries = buildAdultSystemDigest(cfg);
      if (!entries.length) return { ok: false, reason: 'empty' };
      entries = mergeCorruptionConfigNote(entries, cfg);
      entries = mergeAffectionConfigNote(entries, cfg);
      ctx.state.worldbookEntries = upsertSystemDigestEntries(ctx.state.worldbookEntries || [], entries);
      ctx.save();
      if (ctx.panels.worldbook && ctx.panels.worldbook.renderEntriesList) {
        ctx.panels.worldbook.renderEntriesList();
      }
      window.dispatchEvent(new CustomEvent('worldbook-changed'));
      window.dispatchEvent(new CustomEvent('card-builder-data-changed'));
      return { ok: true, count: entries.length, auto: true };
    },

    /* ---------- 新增条目的弹窗（分组 → 条目 → 预览 → 确认添加） ---------- */

    _addModalMeta: function(kind) {
      if (kind === 'worldview') {
        return {
          label: '世界观预设',
          hint: '最多 ' + MAX_WORLDVIEW_PRESET_ITEMS + ' 项；首项为主底盘，其余为叠加层',
        };
      }
      if (kind === 'flavor') {
        var max = s.maxFlavorItems();
        return { label: '口味', hint: '最多 ' + max + ' 个；首项为主调色盘' };
      }
      if (kind === 'posture') {
        return { label: '姿势语言', hint: '不占口味槽；可多选；禁止儿童性化' };
      }
      if (kind === 'speech') {
        return { label: '情趣话风', hint: '不占口味槽；可多选；禁止儿童性化' };
      }
      return { label: 'NTL 禁忌', hint: '权力/背德/越界/百破等；多选' };
    },

    _currentItems: function(kind) {
      if (kind === 'worldview') return s.ensureWorldviewPresetItemsOnState();
      if (kind === 'flavor') return s.ensureFlavorItemsOnState();
      if (kind === 'speech') return s.ensureSpeechItemsOnState();
      if (kind === 'posture') return s.ensurePostureItemsOnState();
      return s.ensureNtlItemsOnState();
    },

    _dashedItemHtml: function(kind, it, idx, total, modal) {
      var data = window.__nsfwFlavorData__;
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
        var f = data.presets[it.id] || { label: it.id, summary: '' };
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
        var info = data.tabooTypes[it.id] || { label: it.id, summary: '' };
        title = info.label;
        if (it.id === 'yuri_destruction') tag = '百合破坏';
        blurb = info.summary || '';
        notePlaceholder = '可选：补充该禁忌方向的额外要求';
      }

      var headHtml = '<div class="adult-dashed-item-head">'
        + '<div class="adult-dashed-item-meta">'
        + '<div class="adult-dashed-item-title">' + s.escapeHtml(title)
        + (tag ? '<span class="adult-dashed-tag">' + s.escapeHtml(tag) + '</span>' : '')
        + '</div>'
        + (blurb ? '<div class="adult-dashed-item-desc">' + s.escapeHtml(blurb) + '</div>' : '')
        + '</div>';

      if (modal) {
        var mUp = (idx > 0 && kind !== 'ntl')
          ? '<button type="button" class="adult-dashed-move" data-up="' + idx + '" title="上移">↑</button>' : '';
        var mDown = (idx < total - 1 && kind !== 'ntl')
          ? '<button type="button" class="adult-dashed-move" data-down="' + idx + '" title="下移">↓</button>' : '';
        return '<div class="adult-dashed-item" data-idx="' + idx + '">'
          + headHtml
          + '<div class="adult-dashed-item-actions">'
          + mUp + mDown
          + '<button type="button" class="adult-dashed-remove" data-remove="' + idx + '">移除</button>'
          + '</div></div>'
          + '<textarea data-note="' + idx + '" rows="1" placeholder="' + s.escapeHtml(notePlaceholder) + '">'
          + s.escapeHtml(it.note || '') + '</textarea>'
          + '</div>';
      }

      var attrs;
      if (kind === 'worldview') {
        attrs = { up: 'data-wv-up', down: 'data-wv-down', remove: 'data-wv-remove', note: 'data-wv-note', container: 'data-wv-idx', hasMove: true };
      } else if (kind === 'flavor') {
        attrs = { up: 'data-flavor-up', down: 'data-flavor-down', remove: 'data-flavor-remove', note: 'data-flavor-note', container: 'data-flavor-idx', hasMove: true };
      } else if (kind === 'posture' || kind === 'speech') {
        attrs = { up: 'data-expression-up', down: 'data-expression-down', remove: 'data-expression-remove', note: 'data-expression-note', container: 'data-expression-idx', hasMove: true };
      } else {
        attrs = { up: '', down: '', remove: 'data-ntl-remove', note: 'data-ntl-note', container: 'data-ntl-idx', hasMove: false };
      }
      function tokenFor(a) {
        if ((kind === 'posture' || kind === 'speech') && a) return kind + ':' + idx;
        return idx;
      }
      return '<div class="adult-dashed-item" ' + attrs.container + '="' + tokenFor('container') + '">'
        + headHtml
        + '<div class="adult-dashed-item-actions">'
        + (attrs.hasMove && idx > 0
          ? '<button type="button" class="adult-dashed-move" ' + attrs.up + '="' + tokenFor('up') + '" title="上移">↑</button>' : '')
        + (attrs.hasMove && idx < total - 1
          ? '<button type="button" class="adult-dashed-move" ' + attrs.down + '="' + tokenFor('down') + '" title="下移">↓</button>' : '')
        + '<button type="button" class="adult-dashed-remove" ' + attrs.remove + '="' + tokenFor('remove') + '">移除</button>'
        + '</div></div>'
        + '<textarea ' + attrs.note + '="' + tokenFor('note') + '" rows="1" placeholder="' + s.escapeHtml(notePlaceholder) + '">'
        + s.escapeHtml(it.note || '') + '</textarea>'
        + '</div>';
    },

    _buildAdultAddCatalog: function(kind) {
      var data = window.__nsfwFlavorData__;
      var selected = Object.create(null);
      var out = [];
      if (kind === 'worldview') {
        s.ensureWorldviewPresetItemsOnState().forEach(function(it) { selected[it.id] = true; });
        listWorldviewPresetsByGroup().forEach(function(g) {
          var items = (g.items || []).filter(function(it) { return !selected[it.id]; });
          if (!items.length) return;
          out.push({
            id: g.id,
            label: g.label,
            items: items.map(function(it) {
              var p = getWorldviewPreset(it.id);
              return { id: it.id, label: it.label, summary: it.summary || '', description: it.description || '', full: p || null };
            }),
          });
        });
        return out;
      }
      if (kind === 'flavor') {
        s.ensureFlavorItemsOnState().forEach(function(it) { selected[it.id] = true; });
        var groups = {};
        var groupOrder = [];
        (data.groups || []).forEach(function(g) {
          var gid = typeof g === 'string' ? g : (g.id || g.label);
          if (gid) { groups[gid] = []; groupOrder.push(gid); }
        });
        if (!groupOrder.length) {
          groupOrder = ['情绪基调', '关系动态', '特殊风味', '感官节奏', '异质物质'];
        }
        data.ids.forEach(function(id) {
          if (selected[id]) return;
          var f = data.presets[id];
          var g = (f && f.group) || '特殊风味';
          if (!groups[g]) { groups[g] = []; if (groupOrder.indexOf(g) < 0) groupOrder.push(g); }
          groups[g].push(id);
        });
        groupOrder.forEach(function(g) {
          if (!groups[g] || !groups[g].length) return;
          out.push({
            id: g,
            label: g,
            items: groups[g].map(function(id) {
              var f = data.presets[id];
              return { id: id, label: f.label, summary: f.summary || '', description: f.description || '', full: f || null };
            }),
          });
        });
        return out;
      }
      if (kind === 'posture' || kind === 'speech') {
        var isSpeech = kind === 'speech';
        (isSpeech ? s.ensureSpeechItemsOnState() : s.ensurePostureItemsOnState()).forEach(function(it) { selected[it.id] = true; });
        var presets = isSpeech ? (data.speechPresets || {}) : (data.posturePresets || {});
        var groups = isSpeech ? (data.speechGroups || []) : (data.postureGroups || []);
        var ids = isSpeech ? (data.speechIds || []) : (data.postureIds || []);
        groups.forEach(function(g) {
          var gid = typeof g === 'string' ? g : (g && (g.id || g.label));
          if (!gid) return;
          var groupIds = ids.filter(function(id) {
            var p = presets[id];
            return !selected[id] && p && (p.group || '') === gid;
          });
          if (!groupIds.length) return;
          out.push({
            id: gid,
            label: gid,
            items: groupIds.map(function(id) {
              var p = presets[id];
              return { id: id, label: p.label, summary: p.summary || '', description: p.description || '', full: p || null };
            }),
          });
        });
        var leftovers = ids.filter(function(id) {
          var p = presets[id];
          return !selected[id] && (!p || !p.group || !groups.some(function(g) {
            return (typeof g === 'string' ? g : (g && (g.id || g.label))) === p.group;
          }));
        });
        if (leftovers.length) {
          out.push({
            id: 'other',
            label: '其他',
            items: leftovers.map(function(id) {
              var p = presets[id];
              return { id: id, label: p.label, summary: p.summary || '', description: p.description || '', full: p || null };
            }),
          });
        }
        return out;
      }
      s.ensureNtlItemsOnState().forEach(function(it) { selected[it.id] = true; });
      NTL_GROUP_IDS.forEach(function(gid) {
        var meta = NTL_GROUPS[gid] || { id: gid, label: gid };
        var items = data.tabooIds.filter(function(id) {
          if (selected[id]) return false;
          var t = data.tabooTypes[id];
          return t && (t.group || '') === gid;
        }).map(function(id) {
          var t = data.tabooTypes[id];
          return { id: id, label: t.label, summary: t.summary || '', description: t.description || '', full: t || null };
        });
        if (!items.length) return;
        out.push({ id: gid, label: meta.label, items: items });
      });
      var known = NTL_GROUP_IDS;
      var ntlLeft = data.tabooIds.filter(function(id) {
        if (selected[id]) return false;
        var t = data.tabooTypes[id];
        return t && known.indexOf(t.group) < 0;
      }).map(function(id) {
        var t = data.tabooTypes[id];
        return { id: id, label: t.label, summary: t.summary || '', description: t.description || '', full: t || null };
      });
      if (ntlLeft.length) out.push({ id: 'other', label: '其他', items: ntlLeft });
      return out;
    },

    _applyNotesFromLists: function(attr, items, kindFilter) {
      var roots = [];
      if (attr === 'data-flavor-note') roots.push(document.getElementById('adultNsfwFlavorList'));
      else if (attr === 'data-ntl-note') roots.push(document.getElementById('adultNtlTabooList'));
      else if (attr === 'data-expression-note') {
        roots.push(document.getElementById('adultPostureList'));
        roots.push(document.getElementById('adultSpeechList'));
      }
      var modalEl = ctx.panels.adultConfig._adultModalList();
      if (modalEl) roots.push(modalEl);
      roots.forEach(function(root) {
        if (!root) return;
        var isModal = root === modalEl;
        var selector = isModal ? '[data-note]' : '[' + attr + ']';
        root.querySelectorAll(selector).forEach(function(el) {
          var idx;
          if (isModal) {
            idx = parseInt(el.getAttribute('data-note'), 10);
          } else if (attr === 'data-expression-note') {
            var parts = String(el.getAttribute(attr) || '').split(':');
            if (parts.length !== 2 || parts[0] !== kindFilter) return;
            idx = parseInt(parts[1], 10);
          } else {
            idx = parseInt(el.getAttribute(attr), 10);
          }
          if (isNaN(idx) || !items[idx]) return;
          items[idx].note = String(el.value || '').trim();
        });
      });
    },

    _adultModalList: function() {
      var self = ctx.panels.adultConfig;
      if (!self._adultModalKind) return null;
      var el = self._adultModalListEl;
      return el && el.isConnected ? el : null;
    },

    _refreshAdultModal: function() {
      var self = ctx.panels.adultConfig;
      var kind = self._adultModalKind;
      if (kind && self.renderAdultModalList) self.renderAdultModalList(kind);
    },

    renderAdultModalList: function(kind) {
      var self = ctx.panels.adultConfig;
      if (!kind) kind = self._adultModalKind;
      var el = self._adultModalListEl;
      if (!el || !el.isConnected) return;
      var items = self._currentItems(kind);
      var headEl = self._adultModalHeadEl;
      if (headEl) {
        var cap = kind === 'worldview' ? (' / ' + MAX_WORLDVIEW_PRESET_ITEMS)
          : (kind === 'flavor' ? (' / ' + s.maxFlavorItems()) : '');
        headEl.textContent = '已选择 ' + items.length + cap;
      }
      if (!items.length) {
        el.innerHTML = '<span class="adult-wv-empty">尚未添加——在上方选择分组与条目后点「确认添加」。</span>';
        return;
      }
      el.innerHTML = items.map(function(it, idx) {
        return self._dashedItemHtml(kind, it, idx, items.length, true);
      }).join('');
    },

    openAddModal: function(kind) {
      if (!kind) return;
      var self = ctx.panels.adultConfig;
      var data = window.__nsfwFlavorData__;
      if (!data) return;
      var meta = self._addModalMeta(kind);
      var overlay = document.createElement('div');
      overlay.className = 'app-confirm-overlay adult-add-overlay';
      overlay.setAttribute('role', 'presentation');
      overlay.setAttribute('tabindex', '-1');
      overlay.innerHTML =
        '<div class="app-confirm-dialog adult-add-dialog" role="dialog" aria-modal="true" tabindex="-1">'
        + '<div class="adult-add-head">'
        + '<h3 class="app-confirm-title">添加' + s.escapeHtml(meta.label) + '</h3>'
        + '<span class="adult-add-subtitle">' + s.escapeHtml(meta.hint) + '</span>'
        + '<button type="button" class="adult-add-close" data-adult-add-close aria-label="关闭">×</button>'
        + '</div>'
        + '<div class="adult-add-form">'
        + '<select class="adult-add-group" data-adult-add-group aria-label="选择分组"></select>'
        + '<select class="adult-add-item" data-adult-add-item aria-label="选择条目"></select>'
        + '<button type="button" class="btn btn-add adult-add-confirm" data-adult-add-confirm>确认添加</button>'
        + '</div>'
        + '<div class="adult-add-body">'
        + '<div class="adult-add-preview" data-adult-add-preview></div>'
        + '<div class="adult-add-note"><textarea data-adult-add-note rows="1" placeholder="可选：补充该条额外要求/备注"></textarea></div>'
        + '<div class="adult-add-selected-head" data-adult-add-selected-head></div>'
        + '<div class="adult-add-selected-list adult-dashed-list" data-adult-modal-list></div>'
        + '</div>'
        + '<div class="adult-add-actions">'
        + '<span class="adult-add-msg" data-adult-add-msg></span>'
        + '<button type="button" class="btn btn-ghost" data-adult-add-done>完成</button>'
        + '</div>'
        + '</div>';

      var groupEl = overlay.querySelector('[data-adult-add-group]');
      var itemEl = overlay.querySelector('[data-adult-add-item]');
      var previewEl = overlay.querySelector('[data-adult-add-preview]');
      var noteEl = overlay.querySelector('[data-adult-add-note]');
      var msgEl = overlay.querySelector('[data-adult-add-msg]');
      var modalListEl = overlay.querySelector('[data-adult-modal-list]');
      var headEl = overlay.querySelector('[data-adult-add-selected-head]');
      var catalog = self._buildAdultAddCatalog(kind);

      function closeModal() {
        overlay.remove();
        self._adultModalKind = null;
        self._adultModalListEl = null;
        self._adultModalHeadEl = null;
      }

      function setMsg(text) {
        msgEl.textContent = text || '';
      }

      function fillGroups() {
        var opts = '<option value="">选择分组…</option>';
        catalog.forEach(function(g) {
          opts += '<option value="' + s.escapeHtml(g.id) + '">' + s.escapeHtml(g.label) + '</option>';
        });
        groupEl.innerHTML = opts;
        enhanceSelectMini(groupEl, 'cs-w148');
      }

      function fillItems() {
        var gid = groupEl.value || '';
        var g = null;
        catalog.forEach(function(cg) { if (cg.id === gid) g = cg; });
        var opts = '<option value="">选择条目…</option>';
        if (g) {
          g.items.forEach(function(it) {
            opts += '<option value="' + s.escapeHtml(it.id) + '">'
              + s.escapeHtml(it.label)
              + (it.summary ? ' — ' + s.escapeHtml(it.summary) : '')
              + '</option>';
          });
        }
        itemEl.innerHTML = opts;
        itemEl.value = '';
        enhanceSelectMini(itemEl, 'cs-fill');
        previewEl.classList.remove('show');
        previewEl.innerHTML = '';
      }

      function pvBlock(title, text) {
        var t = String(text == null ? '' : text).trim();
        if (!t) return '';
        return '<div class="adult-add-pv-block">'
          + '<div class="adult-add-pv-label">' + title + '</div>'
          + '<div class="adult-add-pv-text">' + s.escapeHtml(t) + '</div>'
          + '</div>';
      }

      function showPreview() {
        var id = itemEl.value || '';
        if (!id) {
          previewEl.classList.remove('show');
          previewEl.innerHTML = '';
          return;
        }
        var info = null;
        catalog.forEach(function(g) {
          g.items.forEach(function(it) { if (it.id === id) info = it; });
        });
        if (!info) return;
        var html = '<div class="adult-add-preview-title">' + s.escapeHtml(info.label) + '</div>';
        var body = '';
        var full = info.full || null;
        if (full) {
          body += pvBlock('说明', pvArr(full.description));
          body += pvBlock('写法', pvArr(full.writingGuide));
          body += pvBlock('要点', pvArr(full.mustCover));
          body += pvBlock('避免', pvArr(full.avoid));
          body += pvBlock('反模式', pvArr(full.antiPatterns));
          body += pvBlock('焦点', pvArr(full.focus));
          body += pvBlock('色调', pvArr(full.palette));
          body += pvBlock('密度提示', pvArr(full.densityHint));
          body += pvBlock('信号', pvArr(full.signals));
          body += pvBlock('载体映射', pvArr(full.mapsToWorldframe));
          body += pvBlock('语汇', pvArr(full.lexicon));
          body += pvBlock('世界书骨架', pvArr(full.skeletonHints));
          if (full.summary) body = '<div class="adult-add-pv-sum">' + s.escapeHtml(full.summary) + '</div>' + body;
        } else {
          var desc = info.description || info.summary || '';
          if (desc) body += '<div>' + s.escapeHtml(desc) + '</div>';
        }
        if (body) html += '<div class="adult-add-pv-content">' + body + '</div>';
        previewEl.classList.add('show');
        previewEl.innerHTML = html;
      }

      function pvArr(v) {
        return Array.isArray(v) ? v.join(' / ') : (v == null ? '' : String(v));
      }

      function addItem() {
        var id = itemEl.value || '';
        if (!id) { setMsg('请先选择条目'); return; }
        var note = String(noteEl.value || '').trim();
        var existing = self._currentItems(kind);
        if (existing.some(function(it) { return it.id === id; })) {
          setMsg('已添加过该条目');
          return;
        }
        if (kind === 'worldview' && existing.length >= MAX_WORLDVIEW_PRESET_ITEMS) {
          setMsg('已达上限 ' + MAX_WORLDVIEW_PRESET_ITEMS + ' 项');
          return;
        }
        if (kind === 'flavor' && existing.length >= s.maxFlavorItems()) {
          setMsg('已达上限 ' + s.maxFlavorItems() + ' 个');
          return;
        }
        if (kind === 'worldview') self.addWorldviewPresetItem(id, note);
        else if (kind === 'flavor') self.addFlavorItem(id, note);
        else if (kind === 'posture' || kind === 'speech') self.addExpressionItem(kind, id, note);
        else self.addNtlItem(id, note);
        itemEl.value = '';
        previewEl.classList.remove('show');
        previewEl.innerHTML = '';
        noteEl.value = '';
        setMsg('已添加');
        catalog = self._buildAdultAddCatalog(kind);
        var curGroup = groupEl.value;
        fillGroups();
        groupEl.value = curGroup;
        fillItems();
      }

      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeModal();
        if (e.target.closest && e.target.closest('[data-adult-add-close]')) closeModal();
      });
      groupEl.addEventListener('change', fillItems);
      itemEl.addEventListener('change', showPreview);
      overlay.querySelector('[data-adult-add-confirm]').addEventListener('click', addItem);
      overlay.querySelector('[data-adult-add-done]').addEventListener('click', closeModal);

      modalListEl.addEventListener('click', async function(e) {
        var t = e.target && e.target.closest
          ? e.target.closest('[data-remove], [data-up], [data-down]')
          : null;
        if (!t) return;
        var holder = t.closest('.adult-dashed-item');
        var idx = holder ? parseInt(holder.getAttribute('data-idx'), 10) : NaN;
        if (isNaN(idx)) return;
        if (t.hasAttribute('data-remove')) await self.removeItemByKind(kind, idx);
        else if (t.hasAttribute('data-up')) self.moveItemByKind(kind, idx, -1);
        else if (t.hasAttribute('data-down')) self.moveItemByKind(kind, idx, 1);
      });
      modalListEl.addEventListener('change', function(e) {
        if (!e.target || !e.target.matches('[data-note]')) return;
        ctx.panels.adultConfig.syncNsfwBlockFromUi();
        ctx.panels.adultConfig.renderAdultModalList(kind);
      });

      document.body.appendChild(overlay);
      self._adultModalKind = kind;
      self._adultModalListEl = modalListEl;
      self._adultModalHeadEl = headEl;
      fillGroups();
      fillItems();
      self.renderAdultModalList(kind);
    },

    removeItemByKind: function(kind, idx) {
      if (kind === 'flavor') return ctx.panels.adultConfig.removeFlavorItem(idx);
      if (kind === 'posture' || kind === 'speech') return ctx.panels.adultConfig.removeExpressionItem(kind, idx);
      if (kind === 'worldview') return ctx.panels.adultConfig.removeWorldviewPresetItem(idx);
      if (kind === 'ntl') return ctx.panels.adultConfig.removeNtlItem(idx);
    },

    moveItemByKind: function(kind, idx, delta) {
      if (kind === 'flavor') return ctx.panels.adultConfig.moveFlavorItem(idx, delta);
      if (kind === 'posture' || kind === 'speech') return ctx.panels.adultConfig.moveExpressionItem(kind, idx, delta);
      if (kind === 'worldview') return ctx.panels.adultConfig.moveWorldviewPresetItem(idx, delta);
    },

    addNtlItem: function(id, note) {
      id = String(id || '').trim();
      if (!id) return;
      var items = ctx.panels.adultConfig.readNtlItemsFromUi();
      if (items.some(function(it) { return it.id === id; })) return;
      items.push({ id: id, note: String(note || '') });
      ctx.state.ntlTabooItems = items;
      ctx.state.ntlTabooTypes = items.map(function(it) { return it.id; });
      ctx.panels.adultConfig.syncCorruptionBlockFromUi({ skipRender: true, silentEvent: true });
      ctx.panels.adultConfig.renderNsfwBlock();
      ctx.panels.adultConfig._refreshAdultModal();
      ctx.save();
      if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
      window.dispatchEvent(new CustomEvent('nsfw-config-changed', {
        detail: window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {},
      }));
    },

    removeNtlItem: async function(idx) {
      var items = ctx.panels.adultConfig.readNtlItemsFromUi();
      if (idx < 0 || idx >= items.length) return;
      var lab = s.labelNtl(items[idx].id);
      if (!(await s.confirmAdultRemove({ kind: 'NTL', label: lab }))) return;
      items.splice(idx, 1);
      ctx.state.ntlTabooItems = items;
      ctx.state.ntlTabooTypes = items.map(function(it) { return it.id; });
      s.withAppScrollPreserved(function() {
        ctx.panels.adultConfig.syncNsfwBlockFromUi();
      });
      ctx.panels.adultConfig._refreshAdultModal();
    },

    removeWorldviewPresetItem: async function(idx) {
      var items = s.ensureWorldviewPresetItemsOnState().slice();
      if (idx < 0 || idx >= items.length) return;
      var rem = getWorldviewPreset(items[idx].id);
      var remLab = (rem && rem.label) || items[idx].id;
      if (!(await s.confirmAdultRemove({ kind: '世界观预设', label: remLab }))) return;
      items.splice(idx, 1);
      ctx.state.worldviewPresetItems = items;
      s.syncWorldframeFromPresets();
      s.withAppScrollPreserved(function() {
        ctx.panels.adultConfig.renderWorldviewPresetList();
        ctx.panels.adultConfig.renderWorldframeRow();
      });
      ctx.panels.adultConfig._refreshAdultModal();
      ctx.save();
      if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
      window.dispatchEvent(new CustomEvent('nsfw-config-changed', {
        detail: window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {},
      }));
      window.dispatchEvent(new CustomEvent('worldview-presets-changed', {
        detail: { items: items.slice() },
      }));
    },

    moveWorldviewPresetItem: function(idx, delta) {
      var items = s.ensureWorldviewPresetItemsOnState().slice();
      var from = parseInt(idx, 10);
      var to = from + (delta || 0);
      if (isNaN(from) || to < 0 || to >= items.length) return;
      var tmp = items[from];
      items[from] = items[to];
      items[to] = tmp;
      ctx.state.worldviewPresetItems = items;
      s.syncWorldframeFromPresets();
      s.withAppScrollPreserved(function() {
        ctx.panels.adultConfig.renderWorldviewPresetList();
        ctx.panels.adultConfig.renderWorldframeRow();
      });
      ctx.panels.adultConfig._refreshAdultModal();
      ctx.save();
      if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
      window.dispatchEvent(new CustomEvent('nsfw-config-changed', {
        detail: window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {},
      }));
      window.dispatchEvent(new CustomEvent('worldview-presets-changed', {
        detail: { items: items.slice() },
      }));
    }
  });
}
