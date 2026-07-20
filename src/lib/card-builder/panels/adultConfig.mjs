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

export function registerAdultConfig(ctx) {
  var escapeHtml = ctx.escapeHtml;
  var corruptionTargetsCache = [];

  function buildNsfwFlavorHint() {
    var data = window.__nsfwFlavorData__;
    if (!ctx.state.nsfwEnabled || !ctx.state.nsfwFlavor || !data) return '';
    var p = data.presets[ctx.state.nsfwFlavor];
    if (!p) return '';
    return '\n【生成风格·' + p.label + '】（仅用于世界书人物/恶堕，勿写入主角设定）'
      + p.description
      + '\n温度=' + p.palette.temperature + ' | 触感=' + p.palette.texture
      + '\n重点：' + p.focus.join(' / ')
      + '\n避免：' + p.avoid.join(' / ');
  }

  function buildNtlHintForPrompt() {
    var data = window.__nsfwFlavorData__;
    if (!ctx.state.ntlEnabled || !ctx.state.ntlTabooTypes.length || !data) return '';
    var lines = ['\n【NTL 禁忌方向】（仅用于世界书人物/恶堕，勿写入主角设定）'];
    ctx.state.ntlTabooTypes.forEach(function(t) {
      var info = data.tabooTypes[t];
      if (info) lines.push('- ' + info.label + '：' + info.description);
    });
    return lines.join('\n');
  }

  ctx.panels.adultConfig = {
    buildNsfwFlavorHint: buildNsfwFlavorHint,
    buildNtlHintForPrompt: buildNtlHintForPrompt,

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

    renderNsfwBlock: function() {
      var data = window.__nsfwFlavorData__;
      var adultEl = document.getElementById('adultNsfwEnabled');
      var ntlEl = document.getElementById('adultNtlEnabled');
      var flavorEl = document.getElementById('adultNsfwFlavor');
      var flavorRow = document.getElementById('adultNsfwFlavorRow');
      var flavorDesc = document.getElementById('adultNsfwFlavorDesc');
      var ntlRow = document.getElementById('adultNtlTabooRow');
      var ntlContainer = document.getElementById('adultNtlTabooTypes');

      if (adultEl && adultEl.checked !== ctx.state.nsfwEnabled) adultEl.checked = ctx.state.nsfwEnabled;
      if (ntlEl && ntlEl.checked !== ctx.state.ntlEnabled) ntlEl.checked = ctx.state.ntlEnabled;

      if (flavorRow) flavorRow.style.display = ctx.state.nsfwEnabled ? 'flex' : 'none';
      if (flavorEl && !flavorEl.dataset.filled && data) {
        var groups = { '情绪基调': [], '关系动态': [], '特殊风味': [] };
        data.ids.forEach(function(id) {
          var f = data.presets[id];
          var g = f.group || '特殊风味';
          if (!groups[g]) groups[g] = [];
          groups[g].push(id);
        });
        var opts = '<option value="">默认（通用）</option>';
        Object.keys(groups).forEach(function(g) {
          var ids = groups[g];
          if (!ids.length) return;
          opts += '<optgroup label="' + g + '">';
          ids.forEach(function(id) {
            opts += '<option value="' + id + '">' + data.presets[id].label + '</option>';
          });
          opts += '</optgroup>';
        });
        flavorEl.innerHTML = opts;
        flavorEl.dataset.filled = '1';
      }
      if (flavorEl) flavorEl.value = ctx.state.nsfwFlavor;
      if (flavorDesc && data) {
        var f = data.presets[ctx.state.nsfwFlavor];
        flavorDesc.textContent = f ? f.description : '';
      }

      if (ntlRow) ntlRow.style.display = ctx.state.ntlEnabled ? 'block' : 'none';
      if (ntlContainer && data) {
        ntlContainer.innerHTML = data.tabooIds.map(function(id) {
          var info = data.tabooTypes[id];
          var active = ctx.state.ntlTabooTypes.indexOf(id) >= 0;
          return '<button type="button" class="novel-chip-btn' + (active ? ' active' : '') + '"'
            + ' data-adult-ntl="' + id + '" title="' + info.description + '"'
            + ' aria-pressed="' + active + '">' + info.label + '</button>';
        }).join('');
        ntlContainer.querySelectorAll('[data-adult-ntl]').forEach(function(btn) {
          btn.addEventListener('click', function() {
            btn.classList.toggle('active');
            btn.setAttribute('aria-pressed', btn.classList.contains('active'));
            ctx.panels.adultConfig.syncNsfwBlockFromUi();
          });
        });
      }
      ctx.panels.adultConfig.renderCorruptionBlock();
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

    syncNsfwBlockFromUi: function() {
      var adultEl = document.getElementById('adultNsfwEnabled');
      var ntlEl = document.getElementById('adultNtlEnabled');
      var flavorEl = document.getElementById('adultNsfwFlavor');
      var chips = document.querySelectorAll('[data-adult-ntl].active');
      var ntlTypes = [];
      chips.forEach(function(c) { ntlTypes.push(c.dataset.adultNtl); });

      ctx.state.nsfwEnabled = adultEl ? !!adultEl.checked : false;
      ctx.state.nsfwFlavor = flavorEl ? flavorEl.value : '';
      ctx.state.ntlEnabled = ntlEl ? !!ntlEl.checked : false;
      ctx.state.ntlTabooTypes = ntlTypes;

      ctx.panels.adultConfig.syncCorruptionBlockFromUi({ skipRender: true, silentEvent: true });
      ctx.panels.adultConfig.renderNsfwBlock();
      ctx.save();
      if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
      window.dispatchEvent(new CustomEvent('nsfw-config-changed', {
        detail: window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {},
      }));
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

          for (var i = 0; i < selected.length; i++) {
            var name = selected[i];
            var meta = candMap[name] || { name: name, aliases: [] };
            var wbCtx = findWorldbookPersonContext(entries, name);
            var worldbookContent = (meta.worldbookContent || (wbCtx && wbCtx.content) || '').trim();
            if (!worldbookContent) {
              throw new Error('「' + name + '」缺少世界书人物正文，请先完善该人物条目再生成恶堕档案');
            }

            var userPrompt = buildArchiveUserPrompt({
              charName: name,
              stageNames: stageNames,
              worldbookContent: worldbookContent,
              identity: meta.identity || '',
              customBrief: ctx.state.corruptionCustomBrief,
              nsfwFlavorHint: flavorHint,
              ntlHint: ntlHint,
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
                      + '【该角色世界书】\n' + worldbookContent.slice(0, 4000)
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
        return {
          enabled: ctx.state.nsfwEnabled,
          flavor: ctx.state.nsfwFlavor,
          ntlEnabled: ctx.state.ntlEnabled,
          ntlTabooTypes: ctx.state.ntlTabooTypes.slice(),
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
        if (cfg && typeof cfg.flavor === 'string') ctx.state.nsfwFlavor = cfg.flavor;
        if (cfg && typeof cfg.ntlEnabled === 'boolean') ctx.state.ntlEnabled = cfg.ntlEnabled;
        if (cfg && Array.isArray(cfg.ntlTabooTypes)) ctx.state.ntlTabooTypes = cfg.ntlTabooTypes.slice();
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
      // 兼容旧桥：世界书生成仍可读
      window.__buildAdultPromptHints__ = function() {
        return {
          nsfw: buildNsfwFlavorHint(),
          ntl: buildNtlHintForPrompt(),
        };
      };

      var adultEl = document.getElementById('adultNsfwEnabled');
      var ntlEl = document.getElementById('adultNtlEnabled');
      var flavorEl = document.getElementById('adultNsfwFlavor');
      if (adultEl) adultEl.addEventListener('change', ctx.panels.adultConfig.syncNsfwBlockFromUi);
      if (ntlEl) ntlEl.addEventListener('change', ctx.panels.adultConfig.syncNsfwBlockFromUi);
      if (flavorEl) flavorEl.addEventListener('change', ctx.panels.adultConfig.syncNsfwBlockFromUi);

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
