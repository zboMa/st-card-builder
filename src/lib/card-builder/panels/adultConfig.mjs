/**
 * 卡级成人配置面板（NSFW / NTL / 恶堕）
 * 与角色设定分离：不注入主角 Description / 开场白生成。
 */
import {
  CORRUPTION_PRESETS,
  DEFAULT_CORRUPTION_PRESET,
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
  ensureCorruptionModuleInDesign,
  buildCorruptionExportIssues,
  findWorldbookPersonContext,
  evaluateArchiveRichness,
  CORRUPTION_MIN_CHARS_PER_STAGE,
} from '../../corruptionProgress.mjs';
import {
  isPersonWorldbookComment,
  personNameFromWorldbookComment,
} from '../../novel/sync.mjs';
import { buildPlaceholderPaths, normalizeDesign } from '../../statusBar.mjs';
import { buildAdultCanonDigest, formatCorruptionArchiveDigests } from '../../adult/canon.mjs';
import { CORRUPTION_EXPAND_WB } from '../../novel/contextBudgets.mjs';

export function registerAdultConfig(ctx) {
  var escapeHtml = ctx.escapeHtml;
  var corruptionTargetsCache = [];

  function maxFlavorItems() {
    var data = window.__nsfwFlavorData__;
    return (data && data.maxItems) || 5;
  }

  function ensureNtlItemsOnState() {
    var data = window.__nsfwFlavorData__;
    var valid = (data && data.tabooIds) || [];
    var raw = Array.isArray(ctx.state.ntlTabooItems) ? ctx.state.ntlTabooItems : [];
    var legacy = Array.isArray(ctx.state.ntlTabooTypes) ? ctx.state.ntlTabooTypes : [];
    var items = [];
    var seen = Object.create(null);
    (raw.length ? raw : legacy.map(function(id) { return { id: id, note: '' }; })).forEach(function(it) {
      var id = typeof it === 'string' ? it : String((it && it.id) || '');
      if (!id || seen[id] || (valid.length && valid.indexOf(id) < 0)) return;
      seen[id] = true;
      items.push({
        id: id,
        note: typeof it === 'string' ? '' : String((it && it.note) || ''),
      });
    });
    ctx.state.ntlTabooItems = items;
    ctx.state.ntlTabooTypes = items.map(function(it) { return it.id; });
    return items;
  }

  function normalizeFlavorItems(raw, legacy) {
    var data = window.__nsfwFlavorData__;
    if (data && typeof data.normalizeItems === 'function') {
      return data.normalizeItems(raw, legacy);
    }
    var out = [];
    var seen = Object.create(null);
    (Array.isArray(raw) ? raw : []).forEach(function(it) {
      var id = it && it.id ? String(it.id) : '';
      if (!id || seen[id]) return;
      if (data && data.ids && data.ids.indexOf(id) < 0) return;
      seen[id] = true;
      out.push({ id: id, note: String((it && it.note) || '') });
    });
    if (!out.length && legacy && (!data || !data.ids || data.ids.indexOf(legacy) >= 0)) {
      out.push({ id: String(legacy), note: '' });
    }
    return out.slice(0, maxFlavorItems());
  }

  function ensureFlavorItemsOnState() {
    var items = normalizeFlavorItems(ctx.state.nsfwFlavorItems, ctx.state.nsfwFlavor);
    ctx.state.nsfwFlavorItems = items;
    ctx.state.nsfwFlavor = items.length ? items[0].id : '';
    return items;
  }

  function buildNsfwFlavorHint() {
    var data = window.__nsfwFlavorData__;
    if (!ctx.state.nsfwEnabled || !data) return '';
    var items = ensureFlavorItemsOnState();
    if (!items.length) return '';
    if (typeof data.buildHintFromItems === 'function') {
      return data.buildHintFromItems(items, {
        intro: '（仅用于世界书人物/恶堕，勿写入主角设定）',
      });
    }
    return '';
  }

  function buildNtlHintForPrompt() {
    var data = window.__nsfwFlavorData__;
    if (!ctx.state.ntlEnabled || !data) return '';
    var items = ensureNtlItemsOnState();
    if (!items.length) return '';
    if (typeof data.buildNtlHintFromTypes === 'function') {
      return data.buildNtlHintFromTypes(items, {
        tabooTypes: data.tabooTypes,
        intro: '（仅用于世界书人物/恶堕，勿写入主角设定）',
      });
    }
    return '';
  }

  function inferWorldframeFromCard() {
    var data = window.__nsfwFlavorData__;
    if (!data || typeof data.inferWorldframe !== 'function') {
      return { id: 'generic', label: '通用/未识别', confidence: 0, source: 'unavailable' };
    }
    var novelBridge = window.__novelWorkshopBridge__;
    var novelEntities = (novelBridge && typeof novelBridge.listEntities === 'function')
      ? (novelBridge.listEntities({}) || [])
      : [];
    var novelState = (novelBridge && typeof novelBridge.getState === 'function')
      ? (novelBridge.getState() || {})
      : {};
    return data.inferWorldframe({
      forced: ctx.state.adultWorldframeForced || '',
      contextText: novelState.contextText || ctx.state.creatorNotes || '',
      entities: novelEntities,
      worldbookEntries: ctx.state.worldbookEntries || [],
    });
  }

  ctx.panels.adultConfig = {
    buildNsfwFlavorHint: buildNsfwFlavorHint,
    buildNtlHintForPrompt: buildNtlHintForPrompt,

    renderWorldframeRow: function() {
      var row = document.getElementById('adultWorldframeRow');
      var labelEl = document.getElementById('adultWorldframeLabel');
      var select = document.getElementById('adultWorldframeSelect');
      var data = window.__nsfwFlavorData__;
      if (!row) return;
      // 框架始终展示在最上；不再依赖 NSFW/NTL 开关
      row.style.display = 'flex';
      if (select && data && data.worldframeIds && !select.dataset.filled) {
        var opts = '<option value="">自动</option>';
        data.worldframeIds.forEach(function(id) {
          if (id === 'generic') return;
          var wf = data.worldframes[id];
          var sum = (wf && wf.summary) ? (' — ' + wf.summary) : '';
          opts += '<option value="' + id + '">' + escapeHtml((wf && wf.label) || id) + escapeHtml(sum) + '</option>';
        });
        opts += '<option value="generic">通用</option>';
        select.innerHTML = opts;
        select.dataset.filled = '1';
      }
      var forced = ctx.state.adultWorldframeForced || '';
      if (select) select.value = forced;
      var info = forced && data && data.worldframes[forced]
        ? { id: forced, label: data.worldframes[forced].label, confidence: 1, source: 'forced' }
        : (ctx.state.adultWorldframe && data && data.worldframes[ctx.state.adultWorldframe]
          ? {
            id: ctx.state.adultWorldframe,
            label: data.worldframes[ctx.state.adultWorldframe].label,
            confidence: 0.7,
            source: 'cached',
          }
          : inferWorldframeFromCard());
      if (!forced) {
        ctx.state.adultWorldframe = info.id;
      }
      if (labelEl) {
        var conf = info.confidence != null ? (' · ' + Math.round(info.confidence * 100) + '%') : '';
        var src = info.source === 'forced' ? '手动' : (info.source === 'infer' ? '自动' : (info.source || ''));
        labelEl.textContent = (info.label || info.id || '未推断') + conf + (src ? '（' + src + '）' : '');
      }
      // 同步小说工坊：手动 forced → set；自动建议 → suggest（不抢强制）
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

    getCorruptionConfig: function() {
      return normalizeCorruptionConfig({
        enabled: ctx.state.corruptionEnabled,
        preset: ctx.state.corruptionPreset,
        customBrief: ctx.state.corruptionCustomBrief,
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
        if (!e || !isPersonWorldbookComment(e.comment)) return;
        var name = personNameFromWorldbookComment(e.comment);
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
      corruptionTargetsCache = picks;
      if (!picks.length) {
        box.innerHTML = '<span class="char-nsfw-subtitle">暂无世界书人物条——请先同步/创建「[小说人物] 名字」类条目（主角设定不在此列）</span>';
        return;
      }
      box.innerHTML = picks.map(function(p, i) {
        var meta = p.female ? '女' : (p.male ? '男' : '未知');
        return '<label><input type="checkbox" data-corruption-target="' + i + '"'
          + (p.selected ? ' checked' : '') + ' />'
          + '<span>' + escapeHtml(p.name) + '</span>'
          + '<span class="char-nsfw-subtitle">(' + meta + ')</span></label>';
      }).join('');
    },

    readSelectedCorruptionNames: function() {
      var names = [];
      document.querySelectorAll('#adultCorruptionTargets [data-corruption-target]').forEach(function(el) {
        if (!el.checked) return;
        var idx = parseInt(el.getAttribute('data-corruption-target'), 10);
        if (isNaN(idx) || !corruptionTargetsCache[idx]) return;
        names.push(corruptionTargetsCache[idx].name);
      });
      return names;
    },

    renderFlavorList: function() {
      var data = window.__nsfwFlavorData__;
      var listEl = document.getElementById('adultNsfwFlavorList');
      var picker = document.getElementById('adultNsfwFlavorPicker');
      var capEl = document.getElementById('adultNsfwFlavorCap');
      var addBtn = document.getElementById('btnAddNsfwFlavor');
      if (!listEl || !data) return;

      var items = ensureFlavorItemsOnState();
      var max = maxFlavorItems();
      if (!items.length) {
        listEl.innerHTML = '<span class="char-nsfw-subtitle">尚未添加口味——点击下方「＋添加口味」选择（可不选，用通用写法）</span>';
      } else {
        listEl.innerHTML = items.map(function(it, idx) {
          var f = data.presets[it.id] || { label: it.id, summary: '', description: '' };
          var blurb = f.summary || '';
          return '<div class="adult-flavor-item" data-flavor-idx="' + idx + '">'
            + '<div class="adult-flavor-item-head">'
            + '<div class="adult-flavor-item-meta">'
            + '<div class="adult-flavor-item-title">' + escapeHtml(f.label)
            + (idx === 0 ? '<span class="adult-flavor-primary-tag">主调色盘</span>' : '')
            + '</div>'
            + (blurb ? '<div class="adult-flavor-item-desc">' + escapeHtml(blurb) + '</div>' : '')
            + '</div>'
            + '<button type="button" class="btn btn-ghost" data-flavor-remove="' + idx + '" style="font-size:0.7rem;padding:2px 8px;">移除</button>'
            + '</div>'
            + '<textarea data-flavor-note="' + idx + '" rows="2" placeholder="可选：补充该口味的额外提示（写入世界书管道）">'
            + escapeHtml(it.note || '') + '</textarea>'
            + '</div>';
        }).join('');
      }

      var selected = Object.create(null);
      items.forEach(function(it) { selected[it.id] = true; });
      var groups = {};
      var flavorGroupList = (window.__nsfwFlavorData__ && window.__nsfwFlavorData__.groups)
        || [
          { id: '情绪基调' }, { id: '关系动态' }, { id: '特殊风味' },
          { id: '感官节奏' }, { id: '异质物质' },
        ];
      flavorGroupList.forEach(function(g) {
        var gid = typeof g === 'string' ? g : (g.id || g.label);
        if (gid) groups[gid] = [];
      });
      if (!Object.keys(groups).length) {
        groups = { '情绪基调': [], '关系动态': [], '特殊风味': [], '感官节奏': [], '异质物质': [] };
      }
      data.ids.forEach(function(id) {
        if (selected[id]) return;
        var f = data.presets[id];
        var g = (f && f.group) || '特殊风味';
        if (!groups[g]) groups[g] = [];
        groups[g].push(id);
      });
      if (picker) {
        var opts = '<option value="">选择口味…</option>';
        Object.keys(groups).forEach(function(g) {
          if (!groups[g].length) return;
          opts += '<optgroup label="' + g + '">';
          groups[g].forEach(function(id) {
            var pf = data.presets[id];
            var lab = (pf && pf.label) || id;
            var sm = (pf && pf.summary) ? (' — ' + pf.summary) : '';
            opts += '<option value="' + id + '">' + lab + sm + '</option>';
          });
          opts += '</optgroup>';
        });
        picker.innerHTML = opts;
        picker.disabled = items.length >= max;
      }
      if (addBtn) addBtn.disabled = items.length >= max;
      if (capEl) {
        capEl.textContent = items.length
          ? ('已选 ' + items.length + ' / ' + max)
          : ('最多 ' + max + ' 个');
      }
    },

    renderNsfwBlock: function() {
      var data = window.__nsfwFlavorData__;
      var adultEl = document.getElementById('adultNsfwEnabled');
      var ntlEl = document.getElementById('adultNtlEnabled');
      var flavorSection = document.getElementById('adultFlavorSection');
      var ntlRow = document.getElementById('adultNtlTabooRow');
      var ntlContainer = document.getElementById('adultNtlTabooTypes');

      ensureFlavorItemsOnState();
      if (adultEl && adultEl.checked !== ctx.state.nsfwEnabled) adultEl.checked = ctx.state.nsfwEnabled;
      if (ntlEl && ntlEl.checked !== ctx.state.ntlEnabled) ntlEl.checked = ctx.state.ntlEnabled;

      if (flavorSection) flavorSection.style.display = ctx.state.nsfwEnabled ? 'block' : 'none';
      if (ctx.state.nsfwEnabled) ctx.panels.adultConfig.renderFlavorList();

      if (ntlRow) ntlRow.style.display = ctx.state.ntlEnabled ? 'block' : 'none';
      ctx.panels.adultConfig.renderWorldframeRow();
      ensureNtlItemsOnState();
      if (ntlContainer && data) {
        var activeSet = Object.create(null);
        (ctx.state.ntlTabooTypes || []).forEach(function(id) { activeSet[id] = true; });
        ntlContainer.innerHTML = data.tabooIds.map(function(id) {
          var info = data.tabooTypes[id];
          var active = !!activeSet[id];
          var tip = info.summary || info.label || id;
          return '<button type="button" class="novel-chip-btn' + (active ? ' active' : '') + '"'
            + ' data-adult-ntl="' + id + '" title="' + escapeHtml(tip) + '"'
            + ' aria-pressed="' + (active ? 'true' : 'false') + '">'
            + escapeHtml(info.label)
            + (id === 'yuri_destruction' ? '<span class="char-nsfw-subtitle" style="margin-left:3px;">百合破坏</span>' : '')
            + '</button>';
        }).join('');
        ntlContainer.querySelectorAll('[data-adult-ntl]').forEach(function(btn) {
          btn.addEventListener('click', function() {
            btn.classList.toggle('active');
            btn.setAttribute('aria-pressed', btn.classList.contains('active'));
            ctx.panels.adultConfig.syncNsfwBlockFromUi();
          });
        });
      }
      if (ctx.state.ntlEnabled) ctx.panels.adultConfig.renderNtlList();
      ctx.panels.adultConfig.renderCorruptionBlock();
    },

    renderNtlList: function() {
      var data = window.__nsfwFlavorData__;
      var listEl = document.getElementById('adultNtlTabooList');
      if (!listEl || !data) return;
      var items = ensureNtlItemsOnState();
      if (!items.length) {
        listEl.innerHTML = '<span class="char-nsfw-subtitle">点击上方芯片添加禁忌方向</span>';
        return;
      }
      listEl.innerHTML = items.map(function(it, idx) {
        var info = data.tabooTypes[it.id] || { label: it.id, summary: '' };
        var blurb = info.summary || '';
        return '<div class="adult-flavor-item" data-ntl-idx="' + idx + '">'
          + '<div class="adult-flavor-item-head">'
          + '<div class="adult-flavor-item-meta">'
          + '<div class="adult-flavor-item-title">' + escapeHtml(info.label)
          + (it.id === 'yuri_destruction' ? '<span class="adult-flavor-primary-tag">百合破坏</span>' : '')
          + '</div>'
          + (blurb ? '<div class="adult-flavor-item-desc">' + escapeHtml(blurb) + '</div>' : '')
          + '</div>'
          + '<button type="button" class="btn btn-ghost" data-ntl-remove="' + idx + '" style="font-size:0.7rem;padding:2px 8px;">移除</button>'
          + '</div>'
          + '<textarea data-ntl-note="' + idx + '" rows="2" placeholder="可选：补充该禁忌方向的额外要求（写入世界书管道）">'
          + escapeHtml(it.note || '') + '</textarea>'
          + '</div>';
      }).join('');
    },

    renderCorruptionBlock: function() {
      var wrap = document.getElementById('adultCorruptionBlock');
      var enabledEl = document.getElementById('adultCorruptionEnabled');
      var body = document.getElementById('adultCorruptionBody');
      var presetEl = document.getElementById('adultCorruptionPreset');
      var customRow = document.getElementById('adultCorruptionCustomRow');
      var briefEl = document.getElementById('adultCorruptionCustomBrief');
      var femaleEl = document.getElementById('adultCorruptionFemaleOnly');
      var syncEl = document.getElementById('adultCorruptionSyncSb');

      if (wrap) wrap.style.display = ctx.state.nsfwEnabled ? 'block' : 'none';
      if (!ctx.state.nsfwEnabled) return;

      if (enabledEl) enabledEl.checked = !!ctx.state.corruptionEnabled;
      if (body) body.style.display = ctx.state.corruptionEnabled ? 'block' : 'none';
      if (presetEl) presetEl.value = ctx.state.corruptionPreset || DEFAULT_CORRUPTION_PRESET;
      if (customRow) customRow.style.display = (ctx.state.corruptionPreset === 'custom') ? 'block' : 'none';
      if (briefEl && briefEl.value !== (ctx.state.corruptionCustomBrief || '')) {
        briefEl.value = ctx.state.corruptionCustomBrief || '';
      }
      if (femaleEl) femaleEl.checked = ctx.state.corruptionDefaultFemaleOnly !== false;
      if (syncEl) syncEl.checked = ctx.state.corruptionSyncStatusBar !== false;
      if (ctx.state.corruptionEnabled) ctx.panels.adultConfig.renderCorruptionTargets();
    },

    readFlavorItemsFromUi: function() {
      var items = ensureFlavorItemsOnState().map(function(it) {
        return { id: it.id, note: it.note || '' };
      });
      document.querySelectorAll('#adultNsfwFlavorList [data-flavor-note]').forEach(function(el) {
        var idx = parseInt(el.getAttribute('data-flavor-note'), 10);
        if (isNaN(idx) || !items[idx]) return;
        items[idx].note = String(el.value || '').trim();
      });
      return normalizeFlavorItems(items, '');
    },

    readNtlItemsFromUi: function() {
      var noteMap = Object.create(null);
      ensureNtlItemsOnState().forEach(function(it) { noteMap[it.id] = it.note || ''; });
      document.querySelectorAll('#adultNtlTabooList [data-ntl-note]').forEach(function(el) {
        var idx = parseInt(el.getAttribute('data-ntl-note'), 10);
        var items = ctx.state.ntlTabooItems || [];
        if (isNaN(idx) || !items[idx]) return;
        noteMap[items[idx].id] = String(el.value || '').trim();
      });
      var chips = document.querySelectorAll('[data-adult-ntl].active');
      var out = [];
      chips.forEach(function(c) {
        var id = c.dataset.adultNtl;
        if (!id) return;
        out.push({ id: id, note: noteMap[id] || '' });
      });
      return out;
    },

    syncNsfwBlockFromUi: function() {
      var adultEl = document.getElementById('adultNsfwEnabled');
      var ntlEl = document.getElementById('adultNtlEnabled');

      ctx.state.nsfwEnabled = adultEl ? !!adultEl.checked : false;
      var items = ctx.panels.adultConfig.readFlavorItemsFromUi();
      ctx.state.nsfwFlavorItems = items;
      ctx.state.nsfwFlavor = items.length ? items[0].id : '';
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
      ctx.state.nsfwFlavorItems = normalizeFlavorItems(items, '');
      ctx.state.nsfwFlavor = ctx.state.nsfwFlavorItems.length ? ctx.state.nsfwFlavorItems[0].id : '';
      var adultEl = document.getElementById('adultNsfwEnabled');
      var ntlEl = document.getElementById('adultNtlEnabled');
      var chips = document.querySelectorAll('[data-adult-ntl].active');
      var ntlTypes = [];
      chips.forEach(function(c) { ntlTypes.push(c.dataset.adultNtl); });
      ctx.state.nsfwEnabled = adultEl ? !!adultEl.checked : ctx.state.nsfwEnabled;
      ctx.state.ntlEnabled = ntlEl ? !!ntlEl.checked : ctx.state.ntlEnabled;
      ctx.state.ntlTabooTypes = ntlTypes;
      ctx.panels.adultConfig.syncCorruptionBlockFromUi({ skipRender: true, silentEvent: true });
      ctx.panels.adultConfig.renderNsfwBlock();
      ctx.save();
      if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
      window.dispatchEvent(new CustomEvent('nsfw-config-changed', {
        detail: window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {},
      }));
    },

    addFlavorItem: function(flavorId) {
      var id = String(flavorId || '').trim();
      if (!id) return;
      var items = ctx.panels.adultConfig.readFlavorItemsFromUi();
      if (items.length >= maxFlavorItems()) return;
      if (items.some(function(it) { return it.id === id; })) return;
      items.push({ id: id, note: '' });
      ctx.panels.adultConfig.commitFlavorItems(items);
    },

    removeFlavorItem: function(idx) {
      var items = ctx.panels.adultConfig.readFlavorItemsFromUi();
      if (idx < 0 || idx >= items.length) return;
      items.splice(idx, 1);
      ctx.panels.adultConfig.commitFlavorItems(items);
    },

    syncCorruptionBlockFromUi: function(opts) {
      opts = opts || {};
      var enabledEl = document.getElementById('adultCorruptionEnabled');
      var presetEl = document.getElementById('adultCorruptionPreset');
      var briefEl = document.getElementById('adultCorruptionCustomBrief');
      var femaleEl = document.getElementById('adultCorruptionFemaleOnly');
      var syncEl = document.getElementById('adultCorruptionSyncSb');

      ctx.state.corruptionEnabled = enabledEl ? !!enabledEl.checked : !!ctx.state.corruptionEnabled;
      ctx.state.corruptionPreset = presetEl ? presetEl.value : (ctx.state.corruptionPreset || '5');
      if (!CORRUPTION_PRESETS[ctx.state.corruptionPreset]) ctx.state.corruptionPreset = '5';
      ctx.state.corruptionCustomBrief = briefEl ? briefEl.value : (ctx.state.corruptionCustomBrief || '');
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

    syncCorruptionStatusBar: function(stageNames, selectedNames) {
      if (!window.__statusBarApi__ || typeof window.__statusBarApi__.getDesign !== 'function') {
        return { ok: false, reason: 'status_bar_api_missing' };
      }
      var cur = window.__statusBarApi__.getDesign() || {};
      var names = Array.isArray(selectedNames) ? selectedNames.filter(Boolean) : [];
      if (!names.length) {
        return { ok: false, reason: 'no_worldbook_targets' };
      }
      var next = ensureCorruptionModuleInDesign(Object.assign({}, cur, {
        castMode: 'multi',
        nsfw: true,
        femaleOnly: true,
        characters: names.map(function(n) {
          return { name: n, selected: true, aliases: [] };
        }),
        mainName: names[0],
      }), stageNames);
      next = normalizeDesign(next);
      next.paths = buildPlaceholderPaths(next);
      if (typeof window.__statusBarApi__.setDesign === 'function') {
        window.__statusBarApi__.setDesign(next);
      }
      return { ok: true, castMode: 'multi', names: names.slice() };
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
      if (!selected.length) {
        ctx.panels.adultConfig.setCorruptionTip('请勾选世界书人物（主角不可生成恶堕档案）', 'warn');
        return { ok: false, error: 'no_targets' };
      }
      ctx.state.corruptionSelectedNames = selected.slice();

      var apiUrlEl = ctx.$('apiUrl');
      var modelEl = ctx.$('modelSelect');
      var apiKeyEl = ctx.$('apiKey');
      var url = (apiUrlEl ? apiUrlEl.value : '').replace(/\/$/, '');
      var model = modelEl ? modelEl.value : '';
      var useAi = !!(url && model) && opts.templateOnly !== true;
      if (!useAi) {
        ctx.panels.adultConfig.setCorruptionTip('恶堕档案需配置 AI 后方可生成（禁止写入单薄模板）', 'warn');
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

          if (ctx.state.corruptionPreset === 'custom') {
            var stageResp = await ctx.fetchAIContent({
              context: '恶堕阶段表',
              url: url + '/chat/completions',
              headers: headers,
              model: model,
              messages: [
                { role: 'system', content: buildCustomStagesSystemPrompt() },
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

          var candMap = Object.create(null);
          corruptionTargetsCache.forEach(function(c) { candMap[c.name] = c; });
          ctx.panels.adultConfig.collectCorruptionCandidates().forEach(function(c) {
            if (!candMap[c.name]) candMap[c.name] = c;
          });

          var flavorHint = buildNsfwFlavorHint();
          var ntlHint = buildNtlHintForPrompt();
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
              nsfwFlavorHint: flavorHint,
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
                { role: 'system', content: buildArchiveSystemPrompt() },
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
                  { role: 'system', content: buildArchiveExpandSystemPrompt() },
                  {
                    role: 'user',
                    content: '薄弱阶段：' + richness.weakStages.join('、')
                      + '\n目标每阶段≥' + CORRUPTION_MIN_CHARS_PER_STAGE + '字，全文≥' + minTotal + '字。\n\n'
                      + '【该角色世界书】\n' + worldbookContent.slice(0, CORRUPTION_EXPAND_WB)
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
          '已更新总则 + ' + result.archiveCount + ' 条丰满档案（每阶≥'
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

    bind: function() {
      window.__getNsfwConfig__ = function() {
        var corr = ctx.panels.adultConfig.getCorruptionConfig();
        var items = ensureFlavorItemsOnState();
        return {
          enabled: ctx.state.nsfwEnabled,
          flavor: ctx.state.nsfwFlavor || (items[0] && items[0].id) || '',
          flavorItems: items.map(function(it) {
            return { id: it.id, note: it.note || '' };
          }),
          ntlEnabled: ctx.state.ntlEnabled,
          ntlTabooTypes: ctx.state.ntlTabooTypes.slice(),
          ntlTabooItems: ensureNtlItemsOnState().map(function(it) {
            return { id: it.id, note: it.note || '' };
          }),
          adultWorldframe: ctx.state.adultWorldframe || '',
          adultWorldframeForced: ctx.state.adultWorldframeForced || '',
          corruptionEnabled: corr.enabled,
          corruptionPreset: corr.preset,
          corruptionCustomBrief: corr.customBrief,
          corruptionStageNames: corr.stageNames.slice(),
          corruptionSelectedNames: corr.selectedNames.slice(),
          corruptionDefaultFemaleOnly: corr.defaultFemaleOnly,
          corruptionSyncStatusBar: corr.syncStatusBar,
        };
      };
      window.__setNsfwConfig__ = function(cfg) {
        if (cfg && typeof cfg.enabled === 'boolean') ctx.state.nsfwEnabled = cfg.enabled;
        if (cfg && Array.isArray(cfg.flavorItems)) {
          ctx.state.nsfwFlavorItems = normalizeFlavorItems(cfg.flavorItems, cfg.flavor || '');
          ctx.state.nsfwFlavor = ctx.state.nsfwFlavorItems.length ? ctx.state.nsfwFlavorItems[0].id : '';
        } else if (cfg && typeof cfg.flavor === 'string') {
          ctx.state.nsfwFlavor = cfg.flavor;
          ctx.state.nsfwFlavorItems = cfg.flavor
            ? normalizeFlavorItems([{ id: cfg.flavor, note: '' }], '')
            : [];
        }
        if (cfg && typeof cfg.ntlEnabled === 'boolean') ctx.state.ntlEnabled = cfg.ntlEnabled;
        if (cfg && Array.isArray(cfg.ntlTabooItems)) {
          ctx.state.ntlTabooItems = cfg.ntlTabooItems.map(function(it) {
            return { id: String((it && it.id) || ''), note: String((it && it.note) || '') };
          }).filter(function(it) { return it.id; });
          ctx.state.ntlTabooTypes = ctx.state.ntlTabooItems.map(function(it) { return it.id; });
        } else if (cfg && Array.isArray(cfg.ntlTabooTypes)) {
          ctx.state.ntlTabooTypes = cfg.ntlTabooTypes.slice();
          ctx.state.ntlTabooItems = ctx.state.ntlTabooTypes.map(function(id) { return { id: id, note: '' }; });
        }
        if (cfg && typeof cfg.adultWorldframe === 'string') ctx.state.adultWorldframe = cfg.adultWorldframe;
        if (cfg && typeof cfg.adultWorldframeForced === 'string') {
          ctx.state.adultWorldframeForced = cfg.adultWorldframeForced;
        }
        if (cfg && typeof cfg.corruptionEnabled === 'boolean') ctx.state.corruptionEnabled = cfg.corruptionEnabled;
        if (cfg && typeof cfg.corruptionPreset === 'string') ctx.state.corruptionPreset = cfg.corruptionPreset;
        if (cfg && typeof cfg.corruptionCustomBrief === 'string') ctx.state.corruptionCustomBrief = cfg.corruptionCustomBrief;
        if (cfg && Array.isArray(cfg.corruptionStageNames)) ctx.state.corruptionStageNames = cfg.corruptionStageNames.slice();
        if (cfg && Array.isArray(cfg.corruptionSelectedNames)) ctx.state.corruptionSelectedNames = cfg.corruptionSelectedNames.slice();
        if (cfg && typeof cfg.corruptionDefaultFemaleOnly === 'boolean') {
          ctx.state.corruptionDefaultFemaleOnly = cfg.corruptionDefaultFemaleOnly;
        }
        if (cfg && typeof cfg.corruptionSyncStatusBar === 'boolean') {
          ctx.state.corruptionSyncStatusBar = cfg.corruptionSyncStatusBar;
        }
        ctx.save();
        ctx.panels.adultConfig.renderNsfwBlock();
        if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
        window.dispatchEvent(new CustomEvent('nsfw-config-changed', {
          detail: window.__getNsfwConfig__(),
        }));
      };
      window.__generateCorruptionLore__ = function(o) {
        return ctx.panels.adultConfig.runGenerateCorruptionLore(o || {});
      };
      window.__getCorruptionExportIssues__ = function() {
        return buildCorruptionExportIssues({
          enabled: !!(ctx.state.nsfwEnabled && ctx.state.corruptionEnabled),
          worldbookEntries: ctx.state.worldbookEntries,
          selectedNames: ctx.state.corruptionSelectedNames,
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
        if (ctx.state.nsfwEnabled || ctx.state.ntlEnabled) {
          var wfInfo = inferWorldframeFromCard();
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
              flavorItems: ensureFlavorItemsOnState(),
              ntlItems: ensureNtlItemsOnState(),
              intro: '（仅世界书管道：物化口味/NTL 为世界观载体）',
            });
          }
        }
        return {
          nsfw: buildNsfwFlavorHint(),
          ntl: buildNtlHintForPrompt(),
          canon: canon,
          vessel: vessel,
        };
      };

      var adultEl = document.getElementById('adultNsfwEnabled');
      var ntlEl = document.getElementById('adultNtlEnabled');
      var addFlavorBtn = document.getElementById('btnAddNsfwFlavor');
      var flavorList = document.getElementById('adultNsfwFlavorList');
      if (adultEl) adultEl.addEventListener('change', ctx.panels.adultConfig.syncNsfwBlockFromUi);
      if (ntlEl) ntlEl.addEventListener('change', ctx.panels.adultConfig.syncNsfwBlockFromUi);
      if (addFlavorBtn) {
        addFlavorBtn.addEventListener('click', function() {
          var picker = document.getElementById('adultNsfwFlavorPicker');
          var id = picker ? picker.value : '';
          if (!id) return;
          ctx.panels.adultConfig.addFlavorItem(id);
        });
      }
      if (flavorList) {
        flavorList.addEventListener('click', function(e) {
          var btn = e.target && e.target.closest ? e.target.closest('[data-flavor-remove]') : null;
          if (!btn) return;
          var idx = parseInt(btn.getAttribute('data-flavor-remove'), 10);
          if (!isNaN(idx)) ctx.panels.adultConfig.removeFlavorItem(idx);
        });
        flavorList.addEventListener('change', function(e) {
          if (!e.target || !e.target.matches('[data-flavor-note]')) return;
          ctx.panels.adultConfig.syncNsfwBlockFromUi();
        });
      }
      var wfRefresh = document.getElementById('btnAdultWorldframeRefresh');
      var wfSelect = document.getElementById('adultWorldframeSelect');
      if (wfRefresh) {
        wfRefresh.addEventListener('click', function() {
          ctx.state.adultWorldframeForced = '';
          var info = inferWorldframeFromCard();
          ctx.state.adultWorldframe = info.id;
          ctx.panels.adultConfig.renderWorldframeRow();
          ctx.save();
          if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
          window.dispatchEvent(new CustomEvent('nsfw-config-changed', {
            detail: window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {},
          }));
        });
      }
      if (wfSelect) {
        wfSelect.addEventListener('change', function() {
          var v = wfSelect.value || '';
          ctx.state.adultWorldframeForced = v;
          if (v) ctx.state.adultWorldframe = v;
          else {
            var info = inferWorldframeFromCard();
            ctx.state.adultWorldframe = info.id;
          }
          ctx.panels.adultConfig.renderWorldframeRow();
          ctx.save();
          if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
          window.dispatchEvent(new CustomEvent('nsfw-config-changed', {
            detail: window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {},
          }));
        });
      }

      var ntlList = document.getElementById('adultNtlTabooList');
      if (ntlList) {
        ntlList.addEventListener('click', function(e) {
          var btn = e.target && e.target.closest ? e.target.closest('[data-ntl-remove]') : null;
          if (!btn) return;
          var idx = parseInt(btn.getAttribute('data-ntl-remove'), 10);
          var items = ctx.panels.adultConfig.readNtlItemsFromUi();
          if (isNaN(idx) || idx < 0 || idx >= items.length) return;
          items.splice(idx, 1);
          ctx.state.ntlTabooItems = items;
          ctx.state.ntlTabooTypes = items.map(function(it) { return it.id; });
          ctx.panels.adultConfig.syncNsfwBlockFromUi();
        });
        ntlList.addEventListener('change', function(e) {
          if (!e.target || !e.target.matches('[data-ntl-note]')) return;
          ctx.panels.adultConfig.syncNsfwBlockFromUi();
        });
      }

      var corrEnabled = document.getElementById('adultCorruptionEnabled');
      var corrPreset = document.getElementById('adultCorruptionPreset');
      var corrBrief = document.getElementById('adultCorruptionCustomBrief');
      var corrFemale = document.getElementById('adultCorruptionFemaleOnly');
      var corrSync = document.getElementById('adultCorruptionSyncSb');
      var corrRefresh = document.getElementById('btnRefreshCorruptionTargets');
      var corrGen = document.getElementById('btnGenCorruptionLore');
      if (corrEnabled) corrEnabled.addEventListener('change', function() {
        ctx.panels.adultConfig.syncCorruptionBlockFromUi();
      });
      if (corrPreset) corrPreset.addEventListener('change', function() {
        ctx.panels.adultConfig.syncCorruptionBlockFromUi();
      });
      if (corrBrief) corrBrief.addEventListener('change', function() {
        ctx.panels.adultConfig.syncCorruptionBlockFromUi({ skipRender: true });
      });
      if (corrFemale) corrFemale.addEventListener('change', function() {
        ctx.state.corruptionSelectedNames = [];
        ctx.panels.adultConfig.syncCorruptionBlockFromUi();
      });
      if (corrSync) corrSync.addEventListener('change', function() {
        ctx.panels.adultConfig.syncCorruptionBlockFromUi({ skipRender: true });
      });
      if (corrRefresh) corrRefresh.addEventListener('click', function() {
        ctx.panels.adultConfig.renderCorruptionTargets();
        ctx.panels.adultConfig.setCorruptionTip('已刷新角色列表', 'ok');
      });
      if (corrGen) corrGen.addEventListener('click', function() {
        ctx.panels.adultConfig.runGenerateCorruptionLore();
      });
      var corrTargets = document.getElementById('adultCorruptionTargets');
      if (corrTargets) {
        corrTargets.addEventListener('change', function(e) {
          if (!e.target || !e.target.matches('[data-corruption-target]')) return;
          ctx.state.corruptionSelectedNames = ctx.panels.adultConfig.readSelectedCorruptionNames();
          ctx.save();
        });
      }

      ctx.panels.adultConfig.renderNsfwBlock();
    },
  };
}
