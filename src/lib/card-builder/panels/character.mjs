/**
 * 角色设定：纯逻辑 API。DOM 由 Vue 接管，本文件不再查询/写入输入框。
 */
import { normalizeTags, generateCardJSON } from '../state.mjs';
import { normalizeCharacterVersion, bumpCharacterVersionMajor, bumpCharacterVersionMinor } from '../cardRelease.mjs';
import { setCardKey } from '../../store/cardStore.mjs';
import { setTagBusy, setVersionBaseline, characterUiStore, bumpTokenTick } from '../../store/characterStore.mjs';
import { feedbackFromKind } from '../../ui/appMessage.mjs';
import {
  applyAvatarFromImage,
  applyAvatarDataUrl,
  uploadAvatarFile,
  refreshAvatars,
  setActiveAvatar,
  removeAvatar,
  revokeAvatarUrls,
} from './characterAvatar.mjs';
import { installCharacterBridge } from './characterBridge.mjs';

export function registerCharacter(ctx) {
  var tokenTimer = null;

  function scheduleTokens() {
    if (tokenTimer) clearTimeout(tokenTimer);
    tokenTimer = setTimeout(function () {
      tokenTimer = null;
      bumpTokenTick();
    }, 200);
  }

  function saveAfterEdit() {
    if (ctx.panels.cardManager && ctx.panels.cardManager.debouncedUpdateAndSave) {
      ctx.panels.cardManager.debouncedUpdateAndSave();
    } else {
      ctx.save();
    }
  }

  function saveForTags() {
    if (ctx.panels.cardManager && ctx.panels.cardManager.saveCurrentDraft) {
      ctx.panels.cardManager.saveCurrentDraft();
    } else {
      ctx.save();
    }
  }

  function setField(key, value) {
    var allowed = { charName: 1, wbName: 1, charDesc: 1, creatorNotes: 1, characterVersion: 1 };
    if (!allowed[key]) return;
    setCardKey(key, value == null ? '' : String(value));
    scheduleTokens();
    saveAfterEdit();
  }

  function setCharTags(next, opts) {
    var normalized = normalizeTags(next);
    setCardKey('charTags', normalized);
    scheduleTokens();
    if (!opts || opts.save !== false) saveForTags();
    return normalized;
  }

  function addCharTagFromInput(raw) {
    var text = String(raw == null ? '' : raw).trim();
    if (!text) return [];
    var parts = text.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!parts.length) return [];
    return setCharTags(normalizeTags((ctx.state.charTags || []).concat(parts)));
  }

  function removeCharTag(index) {
    var idx = parseInt(index, 10);
    var list = Array.isArray(ctx.state.charTags) ? ctx.state.charTags.slice() : [];
    if (isNaN(idx) || idx < 0 || idx >= list.length) return list;
    list.splice(idx, 1);
    return setCharTags(list);
  }

  function setCharTagsAiTip(text, kind) {
    feedbackFromKind(ctx, text, kind);
  }

  function readChatConfig() {
    var read = function (id) {
      var el = document.getElementById(id);
      return el && el.value != null ? String(el.value).trim() : '';
    };
    return { url: read('apiUrl').replace(/\/$/, ''), model: read('modelSelect'), key: read('apiKey') };
  }

  async function generateTags() {
    if (characterUiStore.get().tagBusy) return false;
    var ai = readChatConfig();
    if (!ai.url || !ai.model) {
      setCharTagsAiTip('请先在「AI 配置」填写接口与模型', 'warn');
      return false;
    }
    var lib = window.__charTagsLib__ || {};
    var maxChars = window.__getTagContextChars__
      ? window.__getTagContextChars__()
      : (lib.DEFAULT_TAG_CONTEXT_CHARS || 12000);
    var tagCtx = lib.buildTagGenContext
      ? lib.buildTagGenContext({
        description: ctx.state.charDesc || '',
        firstMes: ctx.state.firstMes || '',
        altGreetings: ctx.state.altGreetings || [],
        worldbookEntries: ctx.state.worldbookEntries,
      }, maxChars)
      : String(ctx.state.charDesc || '');
    if (!String(tagCtx || '').trim()) {
      setCharTagsAiTip('请先填写角色设定或开场白内容', 'warn');
      return false;
    }
    var sysPrompt = ctx.promptText('charTagsGen')
      || '根据角色设定与开场白，给出 5-12 个精炼的风格标签；只输出 JSON 数组，例如 ["标签","风格"]，不要解释。';
    var headers = { 'Content-Type': 'application/json' };
    if (ai.key) headers.Authorization = 'Bearer ' + ai.key;
    setTagBusy(true);
    try {
      await ctx.runTracked({
        type: 'char_tags_generate',
        title: '角色标签 AI 生成',
        target: String(ctx.state.charName || '').trim().slice(0, 40) || '标签',
      }, async function (task) {
        var aiResp = await ctx.fetchAIContent({
          context: '角色标签生成',
          url: ai.url + '/chat/completions',
          headers: headers,
          model: ai.model,
          messages: [
            { role: 'system', content: sysPrompt },
            { role: 'user', content: tagCtx },
          ],
          temperature: 0.4,
          httpErrorPrefix: '标签生成失败 HTTP ',
          signal: task && task.signal,
        });
        var parsed = lib.parseTagsFromAiText ? lib.parseTagsFromAiText(aiResp.content) : [];
        if (!parsed.length) throw new Error('未解析到有效标签');
        var before = normalizeTags(ctx.state.charTags || []).length;
        var merged = lib.mergeCharTags
          ? lib.mergeCharTags(ctx.state.charTags || [], parsed)
          : normalizeTags((ctx.state.charTags || []).concat(parsed));
        var added = merged.length - before;
        setCharTags(merged);
        setCharTagsAiTip(
          added > 0 ? ('已合并 ' + added + ' 个新标签（共 ' + merged.length + '）') : '生成内容已在标签列表中，已去重。',
          'ok'
        );
      });
      return true;
    } catch (err) {
      if (ctx.isTrackedAbort(err)) setCharTagsAiTip('已停止', 'warn');
      else setCharTagsAiTip(String(err.message || err), 'err');
      return false;
    } finally {
      setTagBusy(false);
    }
  }

  function captureVersionBaseline() {
    setVersionBaseline(normalizeCharacterVersion(ctx.state.characterVersion));
  }

  function applyVersion(next) {
    setCardKey('characterVersion', normalizeCharacterVersion(next));
    saveAfterEdit();
  }

  async function bumpVersion(which) {
    var kind = which === 'major' ? 'major' : 'minor';
    var api = window.__assistantCardApi__ || window.__cardManagerPanel__;
    if (api && typeof api.bumpVersion === 'function') {
      await api.bumpVersion(kind);
      return true;
    }
    var from = normalizeCharacterVersion(ctx.state.characterVersion);
    var to = kind === 'major' ? bumpCharacterVersionMajor(from) : bumpCharacterVersionMinor(from);
    var message = kind === 'major'
      ? '升级大版本从 ' + from + ' 到 ' + to + '？\n小版本将归零。'
      : '升级小版本从 ' + from + ' 到 ' + to + '？';
    if (!window.confirm(message)) return false;
    applyVersion(to);
    return true;
  }

  async function revertVersion() {
    var current = normalizeCharacterVersion(ctx.state.characterVersion);
    var baseline = normalizeCharacterVersion(characterUiStore.get().versionBaseline);
    if (current === baseline) return false;
    var api = window.__assistantCardApi__ || window.__cardManagerPanel__;
    if (api && typeof api.switchVersion === 'function') {
      var ok = window.confirm
        ? window.confirm('回退到版本列表中的 v' + baseline + '，当前草稿会写入版本列表。')
        : true;
      if (!ok) return false;
      try {
        await api.switchVersion(baseline);
        captureVersionBaseline();
        return true;
      } catch (e) {
        alert('回退失败：' + (e && e.message || e));
        return false;
      }
    }
    if (!window.confirm('回退版本号从 ' + current + ' 到 ' + baseline + '？\n未进入版本列表时仅改编号，不恢复内容。')) return false;
    applyVersion(baseline);
    return true;
  }

  function tagsFromImportJson(json) {
    var lib = window.__charTagsLib__;
    if (lib && lib.tagsFromCardJson) return lib.tagsFromCardJson(json);
    if (!json || typeof json !== 'object') return [];
    if (json.data && Array.isArray(json.data.tags)) return normalizeTags(json.data.tags);
    if (Array.isArray(json.tags)) return normalizeTags(json.tags);
    return [];
  }

  var panel = {
    renderCharTags: function () {},
    setField: setField,
    setCharTags: setCharTags,
    addCharTagFromInput: addCharTagFromInput,
    removeCharTag: removeCharTag,
    setCharTagsAiTip: setCharTagsAiTip,
    generateTags: generateTags,
    scheduleTokens: scheduleTokens,
    captureVersionBaseline: captureVersionBaseline,
    bumpVersion: bumpVersion,
    revertVersion: revertVersion,
    tagsFromImportJson: tagsFromImportJson,

    applyAvatarDataUrl: function (dataUrl) {
      return applyAvatarDataUrl(ctx, dataUrl);
    },
    uploadAvatarFile: function (file) {
      return uploadAvatarFile(ctx, file).catch(function (e) {
        feedbackFromKind(ctx, '头像读取失败：' + (e && e.message ? e.message : e), 'err');
        return false;
      });
    },
    selectAvatar: function (avatarId) {
      return setActiveAvatar(ctx, avatarId).catch(function (e) {
        feedbackFromKind(ctx, '切换卡面失败：' + (e && e.message ? e.message : e), 'err');
      });
    },
    removeAvatar: function (avatarId) {
      return removeAvatar(ctx, avatarId).catch(function (e) {
        feedbackFromKind(ctx, '删除卡面失败：' + (e && e.message ? e.message : e), 'err');
      });
    },
    refreshAvatarUi: function () {
      return refreshAvatars(ctx);
    },
    revokeAvatarUrls: revokeAvatarUrls,
    applyAvatarFromImage: function (img) {
      return applyAvatarFromImage(ctx, img);
    },

    bind: function () {
      installCharacterBridge(ctx, panel);
      window.__getCharTags__ = function () {
        return normalizeTags(ctx.state.charTags || []);
      };
      window.__setCharTags__ = function (next) {
        return panel.setCharTags(next, { save: true });
      };
      window.__characterApplyAvatarDataUrl__ = function (dataUrl) {
        return panel.applyAvatarDataUrl(dataUrl);
      };
      ctx.sm.on(function () {
        if (window.updatePreviewPanel) {
          var fj = generateCardJSON(ctx.state);
          window.updatePreviewPanel(fj);
        }
      });
    },
  };

  ctx.panels.character = panel;
  return panel;
}
