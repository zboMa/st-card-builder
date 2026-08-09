/**
 * 角色面板 — 提取自 index.astro lines 439-498, 500-538, 1000-1087, 3496-3720
 * 注册为 ctx.panels.character；在 bind() 中挂载 DOM 事件与 window 桥接
 */
import { genId, normalizeTags, generateCardJSON } from '../state.mjs';
import {
  shouldBlockImplicitCardCreate,
  ensureCardCloudIndex,
} from '../../sync/cardCloudIndex.mjs';
import { getDraftsMapSync } from '../../draftsStore.mjs';
import { countTokens, formatTokenCount } from '../../tokenStats.mjs';
import { createAvatarGalleryController } from './avatarGalleryPanel.mjs';
import { MAX_AVATARS_PER_CARD } from '../cardAvatarGallery.mjs';
export function registerCharacter(ctx) {
  var escapeHtml = ctx.escapeHtml;
  var charTagsList, charTagInput, btnAddCharTag, btnAiGenCharTags, charTagsAiTip;
  var charImageInput, avatarImg, avatarPlaceholder;
  var avatarGallery = null;

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

  function hydrateManagerCoverThumb(draftId, coverEl, placeholderEl, avatarId) {
    ensureIdbReady().then(function() {
      if (!window.__avatarIdb__) return '';
      return window.__avatarIdb__.loadAvatarThumbObjectUrl(draftId, avatarId);
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
    if (!ctx.state.draftId) {
      var drafts0 = getDraftsMapSync() || {};
      if (shouldBlockImplicitCardCreate(drafts0)) {
        try {
          await ensureCardCloudIndex();
        } catch (eIdx) { /* ignore */ }
        drafts0 = getDraftsMapSync() || {};
        var keys0 = Object.keys(drafts0);
        if (keys0.length > 0) {
          var pick = keys0[0];
          ctx.sm.loadDraftIntoState(pick);
          if (drafts0[pick] && drafts0[pick]._cloudStub) {
            try {
              var syncAv = await import('../../sync/index.mjs');
              if (syncAv.ensureCardBundleLocal) {
                await syncAv.ensureCardBundleLocal(pick, { force: true });
                ctx.sm.loadDraftIntoState(pick);
              }
            } catch (eBundle) { /* ignore */ }
          }
        }
      }
      if (!ctx.state.draftId) {
        if (shouldBlockImplicitCardCreate(getDraftsMapSync() || {})) {
          alert('云端列表加载中，请稍后再上传头像');
          return;
        }
        ctx.state.draftId = genId();
      }
    }
    try {
      await ensureIdbReady();
      if (!window.__avatarIdb__) throw new Error('IndexedDB 不可用');
    } catch (eReady) {
      alert('头像保存失败：' + (eReady && eReady.message ? eReady.message : eReady));
      return;
    }
    try {
      var avatarId = await window.__avatarIdb__.saveAvatarFromImage(ctx.state.draftId, img);
      if (avatarId) ctx.state.activeAvatarId = avatarId;
      ctx.sm.saveDraft({ reason: 'avatar' });
      if (avatarGallery) await avatarGallery.afterAvatarAdded(avatarId);
      else {
        var url = await window.__avatarIdb__.loadAvatarFullDataUrl(ctx.state.draftId, ctx.state.activeAvatarId);
        if (url) {
          avatarImg.src = url;
          avatarImg.style.display = 'block';
          avatarPlaceholder.style.display = 'none';
        }
      }
    } catch (e) {
      if (e && e.message === 'avatar_gallery_full') {
        if (avatarGallery) avatarGallery.setTip('已达上限 ' + MAX_AVATARS_PER_CARD + ' 张', 'warn');
        else alert('卡面已满（最多 ' + MAX_AVATARS_PER_CARD + ' 张）');
        return;
      }
      alert('头像保存失败：' + (e && e.message ? e.message : e));
    }
  }

  ctx.panels.character = {

    /** AI 生图产物：dataUrl → 头像（复用上传保存链路） */
    applyAvatarDataUrl: function(dataUrl) {
      return new Promise(function(resolve, reject) {
        var img = new Image();
        img.onload = function() {
          applyAvatarFromImage(img).then(resolve, reject);
        };
        img.onerror = function() { reject(new Error('图片加载失败')); };
        img.src = dataUrl;
      });
    },

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
      if (!opts || opts.save !== false) {
        if (ctx.panels.cardManager && ctx.panels.cardManager.saveCurrentDraft) {
          ctx.panels.cardManager.saveCurrentDraft();
        } else {
          ctx.save();
        }
      }
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


      function onEditableFieldInput() {
        scheduleCharacterTokens();
        if (ctx.panels.cardManager && ctx.panels.cardManager.debouncedUpdateAndSave) {
          ctx.panels.cardManager.debouncedUpdateAndSave();
        } else {
          ctx.save();
        }
      }

      var charTokTimer = null;
      function refreshCharacterTokens() {
        function setFieldTok(id, text) {
          var el = ctx.$(id);
          if (!el) return 0;
          var n = countTokens(String(text == null ? '' : text));
          el.textContent = formatTokenCount(n) + ' tok';
          el.title = n + ' tokens';
          return n;
        }
        var sum = 0;
        sum += setFieldTok('charDescTok', (ctx.$('charDesc') || {}).value);
        sum += setFieldTok('creatorNotesTok', (ctx.$('creatorNotes') || {}).value);
        sum += countTokens((ctx.$('charName') || {}).value || '');
        sum += countTokens((ctx.$('wbName') || {}).value || '');
        sum += countTokens((ctx.state.charTags || []).join(' '));
        var totalEl = ctx.$('charTokenCount');
        if (totalEl) {
          totalEl.textContent = formatTokenCount(sum) + ' tok';
          totalEl.title = sum + ' tokens';
        }
      }
      function scheduleCharacterTokens() {
        if (charTokTimer) clearTimeout(charTokTimer);
        charTokTimer = setTimeout(refreshCharacterTokens, 200);
      }

      // 字段输入 → 同步 DOM、debounce 存盘并刷新卡管理列表
      var editableFields = ['charName', 'wbName', 'charDesc', 'firstMes', 'creatorNotes'];
      editableFields.forEach(function(id) {
        var el = ctx.$(id);
        if (el) el.addEventListener('input', onEditableFieldInput);
      });
      // 版本只读，仅 bump 按钮改值后通过 change 保存
      var verEl = ctx.$('characterVersion');
      if (verEl) verEl.addEventListener('change', onEditableFieldInput);

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

      // 头像 AI 生图：弹窗点选后复用 applyAvatarDataUrl 保存
      window.__characterApplyAvatarDataUrl__ = function(dataUrl) {
        return ctx.panels.character.applyAvatarDataUrl(dataUrl);
      };

      // 初始渲染
      avatarGallery = createAvatarGalleryController(ctx);
      avatarGallery.bind();
      ctx.panels.character.renderCharTags();
      scheduleCharacterTokens();

      // 切卡/切换面板时重算字段 token
      window.addEventListener('card-draft-changed', scheduleCharacterTokens);
      window.addEventListener('app-view-changed', scheduleCharacterTokens);

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

    refreshAvatarUi: function() {
      if (!avatarGallery) return Promise.resolve();
      return avatarGallery.refreshAll();
    },
  };
}
