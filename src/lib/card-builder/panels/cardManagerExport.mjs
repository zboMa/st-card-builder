/**
 * 卡片管理：Export（拆自 cardManager）
 */

import { buildCardJSONFromDraft, draftDisplayName } from '../state.mjs';
import { createTextChunk, embedTextChunkIntoPng } from '../../utils.mjs';
import { dataUrlToPngDataUrl } from '../../avatarIdb.mjs';

/** @param {object} ctx @param {object} s @param {object} panel */
export function attachCardManagerExport(ctx, s, panel) {
  // ---- Export ----
  panel.exportDraftAsJson = function (id) {
    if (!id) return;
    var json;
    var name;
    var version;
    var currentId = s.getCurrentDraftId();
    if (id === currentId) {
      panel.saveCurrentDraft();
      json = buildCardJSONFromDraft(ctx.state);
      name = ctx.state.charName || 'card';
      version = ctx.state.characterVersion || json.data.character_version || '1.0';
    } else {
      var d = s.getAllDrafts()[id];
      if (!d) {
        s.setCardManagerStatus('找不到该角色卡', true);
        return;
      }
      json = buildCardJSONFromDraft(d);
      name = draftDisplayName(d) || 'card';
      version = d.characterVersion || '1.0';
    }
    var a = document.createElement('a');
    a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(json, null, 2));
    a.download = name + '_v' + version + '.json';
    a.click();
  };

  panel.exportDraftAsPng = async function (id) {
    if (!id) return;
    var json;
    var avatar;
    var name;
    var version;
    var currentId = s.getCurrentDraftId();
    if (id === currentId) {
      panel.saveCurrentDraft();
      json = buildCardJSONFromDraft(ctx.state);
      name = ctx.state.charName || 'CharacterCard';
      version = ctx.state.characterVersion || json.data.character_version || '1.0';
      if (ctx.state.avatarInIdb) {
        await s.ensureIdbReady();
        avatar = window.__avatarIdb__
          ? await window.__avatarIdb__.loadAvatarFullDataUrl(id)
          : '';
      } else {
        avatar = ctx.state.avatarBase64;
      }
    } else {
      var d = s.getAllDrafts()[id];
      if (!d) {
        s.setCardManagerStatus('找不到该角色卡', true);
        return;
      }
      json = buildCardJSONFromDraft(d);
      name = draftDisplayName(d) || 'CharacterCard';
      version = d.characterVersion || '1.0';
      if (d.avatarInIdb) {
        await s.ensureIdbReady();
        avatar = window.__avatarIdb__
          ? await window.__avatarIdb__.loadAvatarFullDataUrl(id)
          : '';
      } else {
        avatar = d.avatarBase64 || '';
      }
    }
    if (!avatar) {
      s.setCardManagerStatus('该卡尚未上传头像，无法导出 PNG', true);
      return;
    }
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
      s.setCardManagerStatus('导出失败: ' + err.message, true);
    }
  };

  // ---- generateCardJSON ----
  panel.generateCardJSON = function () {
    s.syncDomFieldsToState();
    return buildCardJSONFromDraft(ctx.state);
  };
  panel.buildCardJSONFromDraft = function (d) {
    return buildCardJSONFromDraft(d);
  };
  return panel;
}
