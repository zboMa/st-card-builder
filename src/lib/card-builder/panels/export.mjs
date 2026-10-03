/**
 * 导出/导入面板 — 提取自 index.astro lines 736–802, 982–998, 3344–3486
 * 注册为 ctx.panels.export；处理 JSON/PNG 导出和 JSON 卡片导入
 */
import {
  buildCardJSONFromDraft,
  generateCardJSON,
  draftDisplayName,
  normalizeTags,
  tagsFromImportJson,
} from '../state.mjs';
import { fromStImportEntry } from '../../worldbook/worldbookEntryBridge.mjs';
import { resolveEntryPosition } from '../../worldbook/entryPosition.mjs';
import { suggestContractLift } from '../worldbookAdmissionAudit.mjs';
import { showConfirmDialog } from '../../ui/confirmDialog.mjs';
import { applyGreetingTexts } from '../../mvu/greetingInit.mjs';
import { crc32, createTextChunk, embedTextChunkIntoPng } from '../../utils.mjs';
import { dataUrlToPngDataUrl } from '../../avatarIdb.mjs';

export function registerExport(ctx) {
  var panel = {};

  // ---- IDB helpers ----
  function ensureIdbReady() {
    if (typeof window.__ensureIdbReady__ === 'function') return window.__ensureIdbReady__();
    return window.__idbReady__ ? window.__idbReady__.catch(function() { return null; }) : Promise.resolve(null);
  }

  function syncDomFieldsToState() {
    var fn = function (id) { var el = ctx.$(id); return el ? el.value.trim() : ''; };
    ctx.state.charName = fn('charName');
    ctx.state.wbName = fn('wbName');
    ctx.state.charDesc = fn('charDesc');
    ctx.state.firstMes = fn('firstMes');
    ctx.state.creatorNotes = fn('creatorNotes');
    var ver = fn('characterVersion');
    ctx.state.characterVersion = ver || '1.0';
    if (typeof window !== 'undefined' && Array.isArray(window.__altGreetings__)) {
      ctx.state.altGreetings = window.__altGreetings__.slice();
    }
    if (typeof window !== 'undefined') {
      ctx.state.greetingInitMain = window.__greetingInitMain__ && typeof window.__greetingInitMain__ === 'object'
        ? window.__greetingInitMain__
        : {};
      ctx.state.greetingInitAlts = Array.isArray(window.__greetingInitAlts__)
        ? window.__greetingInitAlts__
        : [];
    }
  }

  function getCurrentDraftId() {
    return ctx.sm.getCurrentDraftId();
  }

  function getAllDrafts() {
    return ctx.sm.getAllDrafts();
  }

  // ---- JSON 生成（委托给 state.mjs） ----
  panel.buildCardJSONFromDraft = function (d) {
    return buildCardJSONFromDraft(d);
  };

  panel.generateFullJSON = function () {
    syncDomFieldsToState();
    return generateCardJSON(ctx.state);
  };

  // ---- PNG chunk 工具 ----
  panel.createTextChunk = function (kw, text) {
    return createTextChunk(kw, text);
  };

  // ---- 导出指定卡 JSON ----
  panel.exportDraftAsJson = function (id) {
    if (!id) return;
    var json;
    var name;
    var version;
    var currentId = getCurrentDraftId();
    if (id === currentId) {
      if (ctx.panels.cardManager && ctx.panels.cardManager.saveCurrentDraft) {
        ctx.panels.cardManager.saveCurrentDraft();
      }
      // 导出兜底：成人配置已启用但卡内无体系总纲时自动生成（宁缺勿动）
      if (ctx.panels.adultConfig && typeof ctx.panels.adultConfig.ensureSystemDigestSilent === 'function') {
        ctx.panels.adultConfig.ensureSystemDigestSilent();
      }
      json = panel.generateFullJSON();
      name = ctx.state.charName || 'card';
      version = ctx.state.characterVersion || json.data.character_version || '1.0';
    } else {
      var d = getAllDrafts()[id];
      if (!d) return alert('\u274C \u627E\u4E0D\u5230\u8BE5\u89D2\u8272\u5361');
      json = buildCardJSONFromDraft(d);
      name = draftDisplayName(d) || 'card';
      version = d.characterVersion || '1.0';
    }
    var a = document.createElement('a');
    a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(json, null, 2));
    a.download = name + '_v' + version + '.json';
    a.click();
  };

  // ---- 导出指定卡 PNG ----
  panel.exportDraftAsPng = async function (id) {
    if (!id) return;
    var json;
    var avatar;
    var name;
    var version;
    var currentId = getCurrentDraftId();
    if (id === currentId) {
      if (ctx.panels.cardManager && ctx.panels.cardManager.saveCurrentDraft) {
        ctx.panels.cardManager.saveCurrentDraft();
      }
      if (ctx.panels.adultConfig && typeof ctx.panels.adultConfig.ensureSystemDigestSilent === 'function') {
        ctx.panels.adultConfig.ensureSystemDigestSilent();
      }
      json = panel.generateFullJSON();
      name = ctx.state.charName || 'CharacterCard';
      version = ctx.state.characterVersion || json.data.character_version || '1.0';
      if (ctx.state.activeAvatarId || ctx.state.avatarInIdb) {
        await ensureIdbReady();
        avatar = window.__avatarIdb__
          ? await window.__avatarIdb__.loadAvatarFullDataUrl(id, ctx.state.activeAvatarId)
          : '';
      } else {
        avatar = ctx.state.avatarBase64;
      }
    } else {
      var d = getAllDrafts()[id];
      if (!d) return alert('\u274C \u627E\u4E0D\u5230\u8BE5\u89D2\u8272\u5361');
      json = buildCardJSONFromDraft(d);
      name = draftDisplayName(d) || 'CharacterCard';
      version = d.characterVersion || '1.0';
      if (d.activeAvatarId || d.avatarInIdb) {
        await ensureIdbReady();
        avatar = window.__avatarIdb__
          ? await window.__avatarIdb__.loadAvatarFullDataUrl(id, d.activeAvatarId)
          : '';
      } else {
        avatar = d.avatarBase64 || '';
      }
    }
    if (!avatar) return alert('\u274C \u8BE5\u5361\u5C1A\u672A\u4E0A\u4F20\u5934\u50CF\uFF0C\u65E0\u6CD5\u5BFC\u51FA PNG');
    try {
      var ch = createTextChunk('chara', JSON.stringify(json));
      // 头像可能是 JPEG（avatarIdb 存 jpeg）：先转真 PNG，再按 IEND 定位嵌入
      var pngDataUrl = await dataUrlToPngDataUrl(avatar);
      var raw = atob(pngDataUrl.split(',')[1]);
      var bytes = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      var fin = embedTextChunkIntoPng(bytes, ch);
      var blob = new Blob([fin], { type: 'image/png' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name + '_v' + version + '.png';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      alert('\u274C \u5BFC\u51FA\u5931\u8D25: ' + err.message);
    }
  };

  // ---- 从编辑器 JSON 导入卡片 ----
  panel.applyJSONFromEditor = function (json, opts) {
    if (!json || !json.data) return;
    opts = opts || {};

    // 导入 = 新建草稿，不覆盖当前卡（预览面板行内编辑不传 asNew，保持原地编辑）
    if (opts.asNew) {
      if (ctx.panels.cardManager && typeof ctx.panels.cardManager.createBlankDraft === 'function') {
        ctx.panels.cardManager.createBlankDraft({ jumpToCharacter: false });
      } else {
        ctx.sm.createBlank();
      }
    }

    ctx.state.cardBuilderExtensions = Object.assign({}, (json.data && json.data.extensions) || {});

    var charName = ctx.$('charName');
    var wbName = ctx.$('wbName');
    var charDesc = ctx.$('charDesc');
    var firstMes = ctx.$('firstMes');
    var creatorNotes = ctx.$('creatorNotes');
    var characterVersion = ctx.$('characterVersion');

    if (charName) charName.value = json.data.name || json.name || '';
    if (wbName) wbName.value = (json.data.extensions && json.data.extensions.world) || '';
    if (charDesc) charDesc.value = json.data.description || '';
    if (firstMes) firstMes.value = json.data.first_mes || '';
    if (creatorNotes) creatorNotes.value = json.data.creator_notes || '';
    if (characterVersion) {
      characterVersion.value = String(json.data.character_version || '1.0').trim() || '1.0';
    }
    ctx.state.characterVersion = String(json.data.character_version || '1.0').trim() || '1.0';

    syncDomFieldsToState();

    ctx.state.charTags = tagsFromImportJson(json);
    if (ctx.panels.character && ctx.panels.character.renderCharTags) {
      ctx.panels.character.renderCharTags();
    } else if (window.__setCharTags__ && typeof window.__setCharTags__ === 'function') {
      window.__setCharTags__(ctx.state.charTags);
    }

    if (json.data.character_book && json.data.character_book.entries) {
      ctx.state.worldbookEntries = json.data.character_book.entries.map(function (e) {
        return fromStImportEntry({
          comment: e.comment || '',
          content: e.content || '',
          keys: e.keys || [],
          enabled: e.enabled !== false,
          strategy: e.constant
            ? 'constant'
            : (e.extensions && e.extensions.vectorized ? 'vectorized' : 'selective'),
          position: resolveEntryPosition(e),
          extensions: e.extensions,
          depth: (e.extensions && e.extensions.depth !== undefined) ? e.extensions.depth : 4,
          role: (e.extensions && e.extensions.role !== undefined) ? e.extensions.role : 0,
          order: e.insertion_order || 100,
          prob: (e.extensions && e.extensions.probability !== undefined) ? e.extensions.probability : 100,
        });
      });
    } else {
      ctx.state.worldbookEntries = [];
    }
    if (ctx.panels.worldbook && ctx.panels.worldbook.renderEntriesList) {
      ctx.panels.worldbook.renderEntriesList();
    }

    ctx.state.regexScripts = (json.data.extensions && Array.isArray(json.data.extensions.regex_scripts))
      ? json.data.extensions.regex_scripts
      : [];

    if (json.data.extensions && json.data.extensions.tavern_helper && json.data.extensions.tavern_helper.scripts) {
      var ths = json.data.extensions.tavern_helper.scripts;
      ctx.state.tavernHelperScripts = Array.isArray(ths) ? ths : [];
    } else {
      ctx.state.tavernHelperScripts = [];
    }

    var importedGreetings = applyGreetingTexts({
      firstMes: (firstMes && firstMes.value) || json.data.first_mes || '',
      altGreetings: (json.data.alternate_greetings && json.data.alternate_greetings.length)
        ? json.data.alternate_greetings
        : [],
      entries: ctx.state.worldbookEntries,
      resetMissing: true,
    });
    if (firstMes) firstMes.value = importedGreetings.firstMes;
    ctx.state.firstMes = importedGreetings.firstMes;
    ctx.state.greetingInitMain = importedGreetings.greetingInitMain;
    ctx.state.greetingInitAlts = importedGreetings.greetingInitAlts;
    ctx.state.altGreetings = importedGreetings.altGreetings;
    if (importedGreetings.baselineInstalled) {
      ctx.state.worldbookEntries = importedGreetings.entries;
      if (ctx.panels.worldbook && ctx.panels.worldbook.renderEntriesList) {
        ctx.panels.worldbook.renderEntriesList();
      }
    }
    window.__greetingInitMain__ = importedGreetings.greetingInitMain;
    window.__greetingInitAlts__ = importedGreetings.greetingInitAlts.slice();
    window.__altGreetings__ = importedGreetings.altGreetings.slice();
    if (window.__renderAltGreetings__) window.__renderAltGreetings__();

    // R1 水合：卡携带的成人配置快照 → 覆盖本地并回填面板
    var adultSnap = ctx.state.cardBuilderExtensions && ctx.state.cardBuilderExtensions['st-builder.adultConfig'];
    if (adultSnap && typeof window.__setNsfwConfig__ === 'function') {
      try { window.__setNsfwConfig__(adultSnap); } catch (e) { /* 忽略：面板未就绪时下次水合 */ }
    }

    var lift = suggestContractLift({
      description: ctx.state.charDesc || (charDesc && charDesc.value) || '',
      systemPrompt: json.data.system_prompt || '',
      entries: ctx.state.worldbookEntries,
    });
    if (lift && !opts.skipContractLift) {
      showConfirmDialog({
        title: '把契约放到描述？',
        message: 'Description 是空的。可以从「' + lift.name + '」复制一段到描述，作为总在场的契约。原条目保留，取消则保持描述为空。',
        okText: '放到描述',
        cancelText: '保持原样',
        danger: false,
      }).then(function(ok) {
        if (!ok) return;
        ctx.state.charDesc = lift.text;
        if (charDesc) charDesc.value = lift.text;
        if (ctx.save) ctx.save();
        window.dispatchEvent(new CustomEvent('card-builder-data-changed'));
      });
    }

    if (ctx.panels.cardManager && ctx.panels.cardManager.saveCurrentDraft) {
      ctx.panels.cardManager.saveCurrentDraft();
    }
    if (ctx.panels.cardManager && ctx.panels.cardManager.debouncedUpdateAndSave) {
      ctx.panels.cardManager.debouncedUpdateAndSave();
    }
    window.dispatchEvent(new CustomEvent('card-builder-data-changed'));
  };

  // ---- 导入卡片时恢复头像（给角色卡管理的 PNG 导入调用；统一走 IndexedDB） ----
  panel.setImportedAvatar = function (base64) {
    if (!base64) return;
    var img = new Image();
    img.onload = function () {
      applyAvatarFromImage(img);
    };
    img.onerror = function () {
      ctx.state.avatarBase64 = base64;
      ctx.state.avatarInIdb = false;
      var avatarImg = ctx.$('avatarImg');
      var avatarPlaceholder = ctx.$('avatarPlaceholder');
      if (avatarImg) {
        avatarImg.src = base64;
        avatarImg.style.display = 'block';
      }
      if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
      if (ctx.panels.cardManager && ctx.panels.cardManager.saveCurrentDraft) {
        ctx.panels.cardManager.saveCurrentDraft({ reason: 'avatar' });
      }
    };
    img.src = base64;
  };

  async function applyAvatarFromImage(img) {
    var currentId = getCurrentDraftId();
    if (!currentId) {
      currentId = '';
      // 确保有草稿 ID
      if (ctx.state.draftId) {
        currentId = ctx.state.draftId;
      }
    }
    try {
      await ensureIdbReady();
      if (!window.__avatarIdb__) throw new Error('IndexedDB \u4E0D\u53EF\u7528');
      var avatarId = await window.__avatarIdb__.saveAvatarFromImage(currentId, img);
      if (avatarId) ctx.state.activeAvatarId = avatarId;
      if (ctx.panels.character && ctx.panels.character.refreshAvatarUi) {
        await ctx.panels.character.refreshAvatarUi();
      } else {
        var url = await window.__avatarIdb__.loadAvatarFullDataUrl(currentId, ctx.state.activeAvatarId);
        if (url) {
          var avatarImg = ctx.$('avatarImg');
          var avatarPlaceholder = ctx.$('avatarPlaceholder');
          if (avatarImg) {
            avatarImg.src = url;
            avatarImg.style.display = 'block';
          }
          if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
        }
      }
      if (ctx.panels.cardManager && ctx.panels.cardManager.saveCurrentDraft) {
        ctx.panels.cardManager.saveCurrentDraft({ reason: 'avatar' });
      }
    } catch (e) {
      alert('\u5934\u50CF\u4FDD\u5B58\u5931\u8D25\uFF1A' + (e && e.message ? e.message : e));
    }
  }

  // ---- 桥接全局 API（供 window.applyJSONFromEditor / window.__setImportedAvatar__ 使用） ----
  window.applyJSONFromEditor = panel.applyJSONFromEditor;
  window.__setImportedAvatar__ = panel.setImportedAvatar;

  // Mount
  ctx.panels.export = panel;
  return panel;
}
