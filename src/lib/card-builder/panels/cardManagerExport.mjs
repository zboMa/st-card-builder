/**
 * 卡片管理：Export（拆自 cardManager）
 */

import { buildCardJSONFromDraft, draftDisplayName } from '../state.mjs';
import { createTextChunk } from '../../utils.mjs';

/** @param {object} ctx @param {object} s @param {object} panel */
export function attachCardManagerExport(ctx, s, panel) {
  // ---- Export ----
  panel.exportDraftAsJson = function (id) {
    if (!id) return;
    var json;
    var name;
    var currentId = s.getCurrentDraftId();
    if (id === currentId) {
      panel.saveCurrentDraft();
      json = buildCardJSONFromDraft(ctx.state);
      name = ctx.state.charName || 'card';
    } else {
      var d = s.getAllDrafts()[id];
      if (!d) {
        s.setCardManagerStatus('找不到该角色卡', true);
        return;
      }
      json = buildCardJSONFromDraft(d);
      name = draftDisplayName(d) || 'card';
    }
    var a = document.createElement('a');
    a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(json, null, 2));
    a.download = name + '.json';
    a.click();
  };

  panel.exportDraftAsPng = async function (id) {
    if (!id) return;
    var json;
    var avatar;
    var name;
    var currentId = s.getCurrentDraftId();
    if (id === currentId) {
      panel.saveCurrentDraft();
      json = buildCardJSONFromDraft(ctx.state);
      name = ctx.state.charName || 'CharacterCard';
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
      var raw = atob(avatar.split(',')[1]);
      var bytes = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      var io = bytes.length - 12;
      var bef = bytes.slice(0, io);
      var ie = bytes.slice(io);
      var fin = new Uint8Array(bef.length + ch.length + ie.length);
      fin.set(bef, 0);
      fin.set(ch, bef.length);
      fin.set(ie, bef.length + ch.length);
      var blob = new Blob([fin], { type: 'image/png' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name + '.png';
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
