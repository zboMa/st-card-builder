/**
 * 角色面板 — 提取自 index.astro lines 439-498, 500-538, 1000-1087, 3496-3720
 * 注册为 ctx.panels.character；在 bind() 中挂载 DOM 事件与 window 桥接
 */
import { genId, normalizeTags, generateCardJSON } from '../state.mjs';
import {
  CORRUPTION_PRESETS,
  DEFAULT_CORRUPTION_PRESET,
  normalizeCorruptionConfig,
  resolveStageNames,
  parseStageNamesFromAiText,
  pickCorruptionTargets,
  buildRulesWorldbookEntry,
  buildArchiveWorldbookEntry,
  buildArchiveContentTemplate,
  buildCustomStagesSystemPrompt,
  buildCustomStagesUserPrompt,
  buildArchiveSystemPrompt,
  buildArchiveUserPrompt,
  upsertWorldbookByComment,
  ensureCorruptionModuleInDesign,
  buildCorruptionExportIssues,
} from '../../corruptionProgress.mjs';

export function registerCharacter(ctx) {
  var escapeHtml = ctx.escapeHtml;
  var charTagsList, charTagInput, btnAddCharTag, btnAiGenCharTags, charTagsAiTip;
  var charImageInput, avatarImg, avatarPlaceholder;
  var corruptionTargetsCache = [];

  var managerThumbUrls = [];

  function ensureIdbReady() {
    if (typeof window.__ensureIdbReady__ === 'function') return window.__ensureIdbReady__();
    return window.__idbReady__ ? window.__idbReady__.catch(function() { return null; }) : Promise.resolve(null);
  }

  function revokeManagerThumbs() {
    managerThumbUrls.forEach(function(u) {
      try { URL.revokeObjectURL(u); } catch (e) { console.warn('Revoking object URL failed', e); }
    });
    managerThumbUrls = [];
  }

  function hydrateManagerCoverThumb(draftId, coverEl, placeholderEl) {
    ensureIdbReady().then(function() {
      if (!window.__avatarIdb__) return '';
      return window.__avatarIdb__.loadAvatarThumbObjectUrl(draftId);
    }).then(function(url) {
      if (!url || !coverEl.isConnected) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      if (placeholderEl && placeholderEl.parentNode) placeholderEl.remove();
      var coverImg = document.createElement('img');
      coverImg.src = url;
      coverImg.alt = '';
      managerThumbUrls.push(url);
      coverEl.insertBefore(coverImg, coverEl.firstChild);
    }).catch(function(err) {
      console.warn('[card-manager] 封面加载失败 draft=' + draftId, err);
    });
  }

  async function applyAvatarFromImage(img) {
    if (!ctx.state.draftId) ctx.state.draftId = genId();
    try {
      await ensureIdbReady();
      if (!window.__avatarIdb__) throw new Error('IndexedDB 不可用');
      await window.__avatarIdb__.saveAvatarFromImage(ctx.state.draftId, img);
      ctx.state.avatarInIdb = true;
      ctx.state.avatarBase64 = '';
      var url = await window.__avatarIdb__.loadAvatarFullDataUrl(ctx.state.draftId);
      if (url) {
        avatarImg.src = url;
        avatarImg.style.display = 'block';
        avatarPlaceholder.style.display = 'none';
      }
      ctx.sm.saveDraft({ reason: 'avatar' });
    } catch (e) {
      alert('头像保存失败：' + (e && e.message ? e.message : e));
    }
  }

  ctx.panels.character = {

    renderCharTags: function() {
      if (!charTagsList) return;
      ctx.state.charTags = normalizeTags(ctx.state.charTags);
      charTagsList.innerHTML = ctx.state.charTags.map(function(tag, i) {
        return (
          '<span class="char-tag-chip" data-tag-index="' + i + '">' +
            '<span class="char-tag-chip-text">' + escapeHtml(tag) + '</span>' +
            '<button type="button" class="char-tag-chip-remove" data-tag-action="remove" data-tag-index="' + i + '" title="移除" aria-label="移除标签">×</button>' +
          '</span>'
        );
      }).join('');
    },

    setCharTags: function(next, opts) {
      ctx.state.charTags = normalizeTags(next);
      ctx.panels.character.renderCharTags();
      if (!opts || opts.save !== false) ctx.save();
    },

    addCharTagFromInput: function() {
      if (!charTagInput) return;
      var raw = charTagInput.value.trim();
      if (!raw) return;
      var parts = raw.split(/[,，]/).map(function(s) { return s.trim(); }).filter(Boolean);
      ctx.panels.character.setCharTags(ctx.state.charTags.concat(parts));
      charTagInput.value = '';
      charTagInput.focus();
    },

    setCharTagsAiTip: function(text, kind) {
      if (!charTagsAiTip) return;
      charTagsAiTip.textContent = text || '';
      charTagsAiTip.classList.remove('is-warn', 'is-ok', 'is-err');
      if (kind) charTagsAiTip.classList.add('is-' + kind);
    },

    buildNsfwFlavorHint: function() {
      var data = window.__nsfwFlavorData__;
      if (!ctx.state.nsfwEnabled || !ctx.state.nsfwFlavor || !data) return '';
      var p = data.presets[ctx.state.nsfwFlavor];
      if (!p) return '';
      return '\n【生成风格·' + p.label + '】' + p.description
        + '\n温度=' + p.palette.temperature + ' | 触感=' + p.palette.texture
        + '\n重点：' + p.focus.join(' / ')
        + '\n避免：' + p.avoid.join(' / ');
    },

    buildNtlHintForPrompt: function() {
      var data = window.__nsfwFlavorData__;
      if (!ctx.state.ntlEnabled || !ctx.state.ntlTabooTypes.length || !data) return '';
      var lines = ['\n【NTL 禁忌方向】'];
      ctx.state.ntlTabooTypes.forEach(function(t) {
        var info = data.tabooTypes[t];
        if (info) lines.push('- ' + info.label + '：' + info.description);
      });
      return lines.join('\n');
    },

    renderNsfwBlock: function() {
      var data = window.__nsfwFlavorData__;
      var adultEl = document.getElementById('charNsfwEnabled');
      var ntlEl = document.getElementById('charNtlEnabled');
      var flavorEl = document.getElementById('charNsfwFlavor');
      var flavorRow = document.getElementById('charNsfwFlavorRow');
      var flavorDesc = document.getElementById('charNsfwFlavorDesc');
      var ntlRow = document.getElementById('charNtlTabooRow');
      var ntlContainer = document.getElementById('charNtlTabooTypes');

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
            + ' data-char-ntl="' + id + '" title="' + info.description + '"'
            + ' aria-pressed="' + active + '">' + info.label + '</button>';
        }).join('');
        ntlContainer.querySelectorAll('[data-char-ntl]').forEach(function(btn) {
          btn.addEventListener('click', function() {
            btn.classList.toggle('active');
            btn.setAttribute('aria-pressed', btn.classList.contains('active'));
            ctx.panels.character.syncNsfwBlockFromUi();
          });
        });
      }
      if (ctx.panels.character.renderCorruptionBlock) ctx.panels.character.renderCorruptionBlock();
    },

    syncNsfwBlockFromUi: function() {
      var adultEl = document.getElementById('charNsfwEnabled');
      var ntlEl = document.getElementById('charNtlEnabled');
      var flavorEl = document.getElementById('charNsfwFlavor');
      var chips = document.querySelectorAll('[data-char-ntl].active');
      var ntlTypes = [];
      chips.forEach(function(c) { ntlTypes.push(c.dataset.charNtl); });

      ctx.state.nsfwEnabled = adultEl ? !!adultEl.checked : false;
      ctx.state.nsfwFlavor = flavorEl ? flavorEl.value : '';
      ctx.state.ntlEnabled = ntlEl ? !!ntlEl.checked : false;
      ctx.state.ntlTabooTypes = ntlTypes;

      ctx.panels.character.syncCorruptionBlockFromUi({ skipRender: true, silentEvent: true });
      ctx.panels.character.renderNsfwBlock();
      ctx.save();
      window.dispatchEvent(new CustomEvent('nsfw-config-changed', {
        detail: window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {
          enabled: ctx.state.nsfwEnabled,
          flavor: ctx.state.nsfwFlavor,
          ntlEnabled: ctx.state.ntlEnabled,
          ntlTabooTypes: ctx.state.ntlTabooTypes.slice(),
        }
      }));
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
      var tip = document.getElementById('charCorruptionTip');
      if (!tip) return;
      tip.textContent = text || '';
      tip.classList.remove('is-warn', 'is-ok', 'is-err');
      if (kind) tip.classList.add('is-' + kind);
    },

    collectCorruptionCandidates: function() {
      var out = [];
      var seen = Object.create(null);
      function pushCand(c) {
        if (!c || !c.name) return;
        var name = String(c.name).trim();
        if (!name || seen[name]) return;
        seen[name] = true;
        out.push({
          name: name,
          aliases: Array.isArray(c.aliases) ? c.aliases.slice() : [],
          gender: c.gender == null ? '' : String(c.gender),
          identity: c.identity || '',
          selected: c.selected !== false,
        });
      }

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
          pushCand({
            name: e.name,
            aliases: aliases,
            gender: gender,
            identity: identity,
            selected: e.selected !== false,
          });
        });
      }

      if (!out.length && window.__statusBarApi__ && typeof window.__statusBarApi__.getDesign === 'function') {
        var design = window.__statusBarApi__.getDesign() || {};
        (design.characters || []).forEach(function(c) {
          pushCand({ name: c.name, aliases: c.aliases, gender: '', selected: c.selected !== false });
        });
        if (design.mainName) pushCand({ name: design.mainName, gender: '', selected: true });
      }

      var mainName = (ctx.state.charName || '').trim();
      if (mainName) {
        if (!seen[mainName]) {
          pushCand({ name: mainName, gender: '', selected: true });
        }
      }
      return out;
    },

    renderCorruptionTargets: function() {
      var box = document.getElementById('charCorruptionTargets');
      if (!box) return;
      var femaleOnly = ctx.state.corruptionDefaultFemaleOnly !== false;
      var selectedNames = Array.isArray(ctx.state.corruptionSelectedNames)
        ? ctx.state.corruptionSelectedNames.slice()
        : [];
      var candidates = ctx.panels.character.collectCorruptionCandidates();
      var onlyMain = candidates.length === 1 && !(window.__novelWorkshopBridge__ && window.__novelWorkshopBridge__.listEntities);
      var picks = pickCorruptionTargets(candidates, {
        defaultFemaleOnly: femaleOnly,
        selectedNames: selectedNames,
        includeUnknown: onlyMain || !femaleOnly,
      });
      corruptionTargetsCache = picks;
      if (!picks.length) {
        box.innerHTML = '<span class="char-nsfw-subtitle">暂无角色——请先填写角色名或从小说分析抽取人物</span>';
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
      document.querySelectorAll('#charCorruptionTargets [data-corruption-target]').forEach(function(el) {
        if (!el.checked) return;
        var idx = parseInt(el.getAttribute('data-corruption-target'), 10);
        if (isNaN(idx) || !corruptionTargetsCache[idx]) return;
        names.push(corruptionTargetsCache[idx].name);
      });
      return names;
    },

    renderCorruptionBlock: function() {
      var wrap = document.getElementById('charCorruptionBlock');
      var enabledEl = document.getElementById('charCorruptionEnabled');
      var body = document.getElementById('charCorruptionBody');
      var presetEl = document.getElementById('charCorruptionPreset');
      var customRow = document.getElementById('charCorruptionCustomRow');
      var briefEl = document.getElementById('charCorruptionCustomBrief');
      var femaleEl = document.getElementById('charCorruptionFemaleOnly');
      var syncEl = document.getElementById('charCorruptionSyncSb');

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
      if (ctx.state.corruptionEnabled) ctx.panels.character.renderCorruptionTargets();
    },

    syncCorruptionBlockFromUi: function(opts) {
      opts = opts || {};
      var enabledEl = document.getElementById('charCorruptionEnabled');
      var presetEl = document.getElementById('charCorruptionPreset');
      var briefEl = document.getElementById('charCorruptionCustomBrief');
      var femaleEl = document.getElementById('charCorruptionFemaleOnly');
      var syncEl = document.getElementById('charCorruptionSyncSb');

      ctx.state.corruptionEnabled = enabledEl ? !!enabledEl.checked : !!ctx.state.corruptionEnabled;
      ctx.state.corruptionPreset = presetEl ? presetEl.value : (ctx.state.corruptionPreset || '5');
      if (!CORRUPTION_PRESETS[ctx.state.corruptionPreset]) ctx.state.corruptionPreset = '5';
      ctx.state.corruptionCustomBrief = briefEl ? briefEl.value : (ctx.state.corruptionCustomBrief || '');
      ctx.state.corruptionDefaultFemaleOnly = femaleEl ? !!femaleEl.checked : true;
      ctx.state.corruptionSyncStatusBar = syncEl ? !!syncEl.checked : true;
      if (document.getElementById('charCorruptionTargets')) {
        ctx.state.corruptionSelectedNames = ctx.panels.character.readSelectedCorruptionNames();
      }
      ctx.state.corruptionStageNames = resolveStageNames(
        ctx.state.corruptionPreset,
        ctx.state.corruptionStageNames,
        ctx.state.corruptionCustomBrief
      );

      if (!opts.skipRender) ctx.panels.character.renderCorruptionBlock();
      if (!opts.skipSave) ctx.save();
      if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();
      if (!opts.silentEvent) {
        window.dispatchEvent(new CustomEvent('nsfw-config-changed', {
          detail: window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {},
        }));
      }
    },

    syncCorruptionStatusBar: function(stageNames) {
      if (!window.__statusBarApi__ || typeof window.__statusBarApi__.getDesign !== 'function') {
        return { ok: false, reason: 'status_bar_api_missing' };
      }
      var cur = window.__statusBarApi__.getDesign();
      var next = ensureCorruptionModuleInDesign(cur, stageNames);
      if (typeof window.__statusBarApi__.setDesign === 'function') {
        window.__statusBarApi__.setDesign(next);
      }
      return { ok: true };
    },

    runGenerateCorruptionLore: async function(opts) {
      opts = opts || {};
      ctx.panels.character.syncCorruptionBlockFromUi({ skipRender: true });
      if (!ctx.state.nsfwEnabled) {
        ctx.panels.character.setCorruptionTip('请先启用 NSFW', 'warn');
        return { ok: false, error: 'nsfw_disabled' };
      }
      if (!ctx.state.corruptionEnabled) {
        ctx.panels.character.setCorruptionTip('请先启用恶堕进度', 'warn');
        return { ok: false, error: 'corruption_disabled' };
      }

      var selected = ctx.panels.character.readSelectedCorruptionNames();
      if (!selected.length && Array.isArray(opts.selectedNames)) selected = opts.selectedNames.slice();
      if (!selected.length) {
        ctx.panels.character.setCorruptionTip('请至少勾选一名角色', 'warn');
        return { ok: false, error: 'no_targets' };
      }
      ctx.state.corruptionSelectedNames = selected.slice();

      var apiUrlEl = ctx.$('apiUrl');
      var modelEl = ctx.$('modelSelect');
      var apiKeyEl = ctx.$('apiKey');
      var url = (apiUrlEl ? apiUrlEl.value : '').replace(/\/$/, '');
      var model = modelEl ? modelEl.value : '';
      var useAi = !!(url && model) && opts.templateOnly !== true;
      if (!useAi && ctx.state.corruptionPreset === 'custom' && !resolveStageNames('custom', ctx.state.corruptionStageNames, ctx.state.corruptionCustomBrief).length) {
        ctx.panels.character.setCorruptionTip('自定义模式需要 AI 或可解析的阶段描述', 'warn');
        return { ok: false, error: 'custom_needs_ai' };
      }

      var btn = document.getElementById('btnGenCorruptionLore');
      if (btn) btn.disabled = true;
      ctx.panels.character.setCorruptionTip(useAi ? '正在生成恶堕世界书…' : '正在写入模板档案…', null);

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

          if (ctx.state.corruptionPreset === 'custom' && useAi) {
            var headers0 = { 'Content-Type': 'application/json' };
            var key0 = apiKeyEl ? apiKeyEl.value.trim() : '';
            if (key0) headers0['Authorization'] = 'Bearer ' + key0;
            var stageResp = await ctx.fetchAIContent({
              context: '恶堕阶段表',
              url: url + '/chat/completions',
              headers: headers0,
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
          ctx.panels.character.collectCorruptionCandidates().forEach(function(c) {
            if (!candMap[c.name]) candMap[c.name] = c;
          });

          var headers = { 'Content-Type': 'application/json' };
          var key = apiKeyEl ? apiKeyEl.value.trim() : '';
          if (key) headers['Authorization'] = 'Bearer ' + key;
          var flavorHint = ctx.panels.character.buildNsfwFlavorHint();

          for (var i = 0; i < selected.length; i++) {
            var name = selected[i];
            var meta = candMap[name] || { name: name, aliases: [] };
            var content = '';
            if (useAi) {
              var aiResp = await ctx.fetchAIContent({
                context: '恶堕档案·' + name,
                url: url + '/chat/completions',
                headers: headers,
                model: model,
                messages: [
                  { role: 'system', content: buildArchiveSystemPrompt() },
                  {
                    role: 'user',
                    content: buildArchiveUserPrompt({
                      charName: name,
                      stageNames: stageNames,
                      charDesc: ctx.state.charDesc,
                      identity: meta.identity || '',
                      customBrief: ctx.state.corruptionCustomBrief,
                      nsfwFlavorHint: flavorHint,
                    }),
                  },
                ],
                temperature: 0.7,
                httpErrorPrefix: '恶堕档案生成失败 HTTP ',
                signal: task && task.signal,
              });
              content = String(aiResp.content || '').trim();
            }
            if (!content || content.length < 40) {
              content = buildArchiveContentTemplate(name, stageNames);
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
            sb = ctx.panels.character.syncCorruptionStatusBar(stageNames);
          }
          if (typeof window.__persistAiConfig__ === 'function') window.__persistAiConfig__();

          return {
            ok: true,
            stageNames: stageNames,
            rulesComment: '恶堕进度总则',
            archiveCount: selected.length,
            selectedNames: selected.slice(),
            usedAi: useAi,
            statusBar: sb,
          };
        });

        ctx.panels.character.setCorruptionTip(
          '已更新总则 + ' + result.archiveCount + ' 条档案（' + result.stageNames.length + ' 阶）',
          'ok'
        );
        return result;
      } catch (err) {
        if (ctx.isTrackedAbort(err)) {
          ctx.panels.character.setCorruptionTip('已停止', 'warn');
          return { ok: false, error: 'aborted' };
        }
        ctx.panels.character.setCorruptionTip(String(err.message || err), 'err');
        return { ok: false, error: String(err.message || err) };
      } finally {
        if (btn) btn.disabled = false;
      }
    },

    bind: function() {
      charTagsList = ctx.$('charTagsList');
      charTagInput = ctx.$('charTagInput');
      btnAddCharTag = ctx.$('btnAddCharTag');
      btnAiGenCharTags = ctx.$('btnAiGenCharTags');
      charTagsAiTip = ctx.$('charTagsAiTip');
      charImageInput = ctx.$('charImageInput');
      avatarImg = ctx.$('avatarImg');
      avatarPlaceholder = ctx.$('avatarPlaceholder');
      var tagContextCharsEl = ctx.$('tagContextChars');

      window.__getCharTags__ = function() {
        return normalizeTags(ctx.state.charTags);
      };
      window.__setCharTags__ = function(next) {
        ctx.panels.character.setCharTags(next, { save: true });
      };

      window.__getNsfwConfig__ = function() {
        var corr = ctx.panels.character.getCorruptionConfig();
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
        if (ctx.panels.character.renderNsfwBlock) ctx.panels.character.renderNsfwBlock();
        if (ctx.panels.character.renderCorruptionBlock) ctx.panels.character.renderCorruptionBlock();
        window.dispatchEvent(new CustomEvent('nsfw-config-changed', {
          detail: window.__getNsfwConfig__()
        }));
      };
      window.__generateCorruptionLore__ = function(o) {
        return ctx.panels.character.runGenerateCorruptionLore(o || {});
      };
      window.__getCorruptionExportIssues__ = function() {
        return buildCorruptionExportIssues({
          enabled: !!(ctx.state.nsfwEnabled && ctx.state.corruptionEnabled),
          worldbookEntries: ctx.state.worldbookEntries,
          selectedNames: ctx.state.corruptionSelectedNames,
        });
      };

      // 字段输入 → 保存
      var editableFields = ['charName', 'wbName', 'charDesc', 'firstMes', 'creatorNotes'];
      editableFields.forEach(function(id) {
        var el = ctx.$(id);
        if (el) el.addEventListener('input', ctx.save);
      });

      // 角色标签芯片操作
      if (btnAddCharTag) btnAddCharTag.addEventListener('click', ctx.panels.character.addCharTagFromInput);
      if (charTagInput) {
        charTagInput.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            ctx.panels.character.addCharTagFromInput();
          }
        });
      }
      if (charTagsList) {
        charTagsList.addEventListener('click', function(e) {
          var btn = e.target.closest('[data-tag-action="remove"]');
          if (!btn) return;
          var idx = parseInt(btn.getAttribute('data-tag-index'), 10);
          if (isNaN(idx) || idx < 0 || idx >= ctx.state.charTags.length) return;
          var next = ctx.state.charTags.slice();
          next.splice(idx, 1);
          ctx.panels.character.setCharTags(next);
        });
      }

      // AI 生成角色标签
      if (btnAiGenCharTags) {
        btnAiGenCharTags.addEventListener('click', async function() {
          var apiUrlEl = ctx.$('apiUrl');
          var modelEl = ctx.$('modelSelect');
          var apiKeyEl = ctx.$('apiKey');
          var charDescEl = ctx.$('charDesc');
          var firstMesEl = ctx.$('firstMes');
          var charNameEl = ctx.$('charName');

          var url = (apiUrlEl ? apiUrlEl.value : '').replace(/\/$/, '');
          var model = modelEl ? modelEl.value : '';
          if (!url || !model) {
            ctx.panels.character.setCharTagsAiTip('请先在「AI 配置」填写接口与模型', 'warn');
            return;
          }
          var lib = window.__charTagsLib__ || {};
          var maxChars = window.__getTagContextChars__
            ? window.__getTagContextChars__()
            : (lib.DEFAULT_TAG_CONTEXT_CHARS || 12000);
          var ctxBuilder = lib.buildTagGenContext;
          var tagCtx = ctxBuilder
            ? ctxBuilder({
                description: charDescEl ? charDescEl.value : '',
                firstMes: firstMesEl ? firstMesEl.value : '',
                altGreetings: ctx.state.altGreetings || [],
                worldbookEntries: ctx.state.worldbookEntries,
              }, maxChars)
            : String(charDescEl ? charDescEl.value : '');
          if (!String(tagCtx || '').trim()) {
            ctx.panels.character.setCharTagsAiTip('请先填写角色设定或开场白等内容', 'warn');
            return;
          }

          var key = apiKeyEl ? apiKeyEl.value.trim() : '';
          var headers = { 'Content-Type': 'application/json' };
          if (key) headers['Authorization'] = 'Bearer ' + key;

          var sysPrompt = ctx.promptText('charTagsGen')
            || '根据角色设定与世界书，生成 5-12 个短中文分类标签。只输出 JSON 数组，例如 ["奇幻","恋爱"]。不要解释。';
          sysPrompt += ctx.panels.character.buildNsfwFlavorHint();

          btnAiGenCharTags.disabled = true;
          var oldLabel = btnAiGenCharTags.textContent;
          btnAiGenCharTags.textContent = '生成中…';
          ctx.panels.character.setCharTagsAiTip('正在生成标签…', null);

          try {
            await ctx.runTracked({
              type: 'char_tags_generate',
              title: '角色标签 AI 生成',
              target: (charNameEl ? charNameEl.value : '').trim().slice(0, 40) || '标签',
            }, async function(task) {
              var aiResp = await ctx.fetchAIContent({
                context: '角色标签生成',
                url: url + '/chat/completions',
                headers: headers,
                model: model,
                messages: [
                  { role: 'system', content: sysPrompt },
                  { role: 'user', content: tagCtx },
                ],
                temperature: 0.4,
                httpErrorPrefix: '标签生成失败 HTTP ',
                signal: task && task.signal,
              });
              var parsed = lib.parseTagsFromAiText
                ? lib.parseTagsFromAiText(aiResp.content)
                : [];
              if (!parsed.length) throw new Error('未解析到有效标签');
              var merged = lib.mergeCharTags
                ? lib.mergeCharTags(ctx.state.charTags, parsed)
                : normalizeTags(ctx.state.charTags.concat(parsed));
              var added = merged.length - normalizeTags(ctx.state.charTags).length;
              ctx.panels.character.setCharTags(merged);
              ctx.panels.character.setCharTagsAiTip(
                added > 0 ? ('已合并 ' + added + ' 个新标签（共 ' + merged.length + '）') : '无新增（已与现有标签去重）',
                'ok'
              );
            });
          } catch (err) {
            if (ctx.isTrackedAbort(err)) {
              ctx.panels.character.setCharTagsAiTip('已停止', 'warn');
            } else {
              ctx.panels.character.setCharTagsAiTip(String(err.message || err), 'err');
            }
          } finally {
            btnAiGenCharTags.disabled = false;
            btnAiGenCharTags.textContent = oldLabel || 'AI 生成';
          }
        });
      }

      // 头像上传
      if (charImageInput) {
        charImageInput.addEventListener('change', function(e) {
          var file = e.target.files[0];
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function(ev) {
            var img = new Image();
            img.onload = function() { applyAvatarFromImage(img); };
            img.src = ev.target.result;
          };
          reader.readAsDataURL(file);
        });
      }

      // NSFW 配置绑定
      var adultEl = document.getElementById('charNsfwEnabled');
      var ntlEl = document.getElementById('charNtlEnabled');
      var flavorEl = document.getElementById('charNsfwFlavor');
      if (adultEl) adultEl.addEventListener('change', ctx.panels.character.syncNsfwBlockFromUi);
      if (ntlEl) ntlEl.addEventListener('change', ctx.panels.character.syncNsfwBlockFromUi);
      if (flavorEl) flavorEl.addEventListener('change', ctx.panels.character.syncNsfwBlockFromUi);

      var corrEnabled = document.getElementById('charCorruptionEnabled');
      var corrPreset = document.getElementById('charCorruptionPreset');
      var corrBrief = document.getElementById('charCorruptionCustomBrief');
      var corrFemale = document.getElementById('charCorruptionFemaleOnly');
      var corrSync = document.getElementById('charCorruptionSyncSb');
      var corrRefresh = document.getElementById('btnRefreshCorruptionTargets');
      var corrGen = document.getElementById('btnGenCorruptionLore');
      if (corrEnabled) corrEnabled.addEventListener('change', function() {
        ctx.panels.character.syncCorruptionBlockFromUi();
      });
      if (corrPreset) corrPreset.addEventListener('change', function() {
        ctx.panels.character.syncCorruptionBlockFromUi();
      });
      if (corrBrief) corrBrief.addEventListener('change', function() {
        ctx.panels.character.syncCorruptionBlockFromUi({ skipRender: true });
      });
      if (corrFemale) corrFemale.addEventListener('change', function() {
        ctx.state.corruptionSelectedNames = [];
        ctx.panels.character.syncCorruptionBlockFromUi();
      });
      if (corrSync) corrSync.addEventListener('change', function() {
        ctx.panels.character.syncCorruptionBlockFromUi({ skipRender: true });
      });
      if (corrRefresh) corrRefresh.addEventListener('click', function() {
        ctx.panels.character.renderCorruptionTargets();
        ctx.panels.character.setCorruptionTip('已刷新角色列表', 'ok');
      });
      if (corrGen) corrGen.addEventListener('click', function() {
        ctx.panels.character.runGenerateCorruptionLore();
      });
      var corrTargets = document.getElementById('charCorruptionTargets');
      if (corrTargets) {
        corrTargets.addEventListener('change', function(e) {
          if (!e.target || !e.target.matches('[data-corruption-target]')) return;
          ctx.state.corruptionSelectedNames = ctx.panels.character.readSelectedCorruptionNames();
          ctx.save();
        });
      }

      // 初始渲染
      ctx.panels.character.renderCharTags();
      ctx.panels.character.renderNsfwBlock();
      ctx.panels.character.renderCorruptionBlock();

      // 预览更新监听：保存后更新预览面板
      ctx.sm.on(function() {
        var fj = generateCardJSON(ctx.state);
        if (window.updatePreviewPanel) window.updatePreviewPanel(fj);
      });
    },

    tagsFromImportJson: function(json) {
      var lib = window.__charTagsLib__;
      if (lib && lib.tagsFromCardJson) return lib.tagsFromCardJson(json);
      if (!json || typeof json !== 'object') return [];
      if (json.data && Array.isArray(json.data.tags)) return normalizeTags(json.data.tags);
      if (Array.isArray(json.tags)) return normalizeTags(json.tags);
      return [];
    },

    hydrateManagerCoverThumb: hydrateManagerCoverThumb,

    revokeManagerThumbs: revokeManagerThumbs,
  };
}
