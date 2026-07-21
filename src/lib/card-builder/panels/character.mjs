/**
 * 角色面板 — 提取自 index.astro lines 439-498, 500-538, 1000-1087, 3496-3720
 * 注册为 ctx.panels.character；在 bind() 中挂载 DOM 事件与 window 桥接
 */
import { genId, normalizeTags, generateCardJSON } from '../state.mjs';
export function registerCharacter(ctx) {
  var escapeHtml = ctx.escapeHtml;
  var charTagsList, charTagInput, btnAddCharTag, btnAiGenCharTags, charTagsAiTip;
  var charImageInput, avatarImg, avatarPlaceholder;

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


      // 字段输入 → 保存
      var editableFields = ['charName', 'wbName', 'charDesc', 'firstMes', 'creatorNotes'];
      editableFields.forEach(function(id) {
        var el = ctx.$(id);
        if (el) el.addEventListener('input', ctx.save);
      });
      // 版本只读，仅 bump 按钮改值后通过 change 保存
      var verEl = ctx.$('characterVersion');
      if (verEl) verEl.addEventListener('change', ctx.save);

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

      // 初始渲染
      ctx.panels.character.renderCharTags();

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
