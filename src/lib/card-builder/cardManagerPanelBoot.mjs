import { engineTryAllowed } from '../actionEngine/helpers.mjs';
/**
 * 卡管理面板：JSON/PNG 导入 boot（从 CardManagerPanel.astro 外提）
 */

export function initCardManagerPanelImport() {
  // 导入入口在本面板；导出 JSON/PNG 由 index 绑到各卡底部（导出该卡，不含小说）
  var importStatusBar = document.getElementById('importStatusBar');
  var btnImportCard = document.getElementById('btnImportCard');
  var importCardInput = document.getElementById('importCardInput');
  if (!btnImportCard || !importCardInput) return;

  btnImportCard.addEventListener('click', function() {
    if (!engineTryAllowed('lifecycle.card.import').ok) return;
    importCardInput.value = '';
    importCardInput.click();
  });

  importCardInput.addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'json') importFromJSON(file);
    else if (ext === 'png') importFromPNG(file);
    else showImportStatus('❌ 不支持的文件格式，请选择 .json 或 .png', 'error');
  });

  function importFromJSON(file) {
    showImportStatus('⏳ 解析 JSON...', 'info');
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        applyImportedCard(JSON.parse(ev.target.result), file.name);
      } catch (err) {
        showImportStatus('❌ JSON 解析失败：' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  function importFromPNG(file) {
    showImportStatus('⏳ 解析 PNG 元数据...', 'info');
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var bytes = new Uint8Array(ev.target.result);
        var charaB64 = extractPNGCharaChunk(bytes);
        if (!charaB64) {
          showImportStatus('❌ 未找到角色数据，该 PNG 可能不是酒馆卡片', 'error');
          return;
        }
        var jsonStr = decodeURIComponent(escape(atob(charaB64)));
        var json = JSON.parse(jsonStr);
        var dataUrl = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function() {
          var cv = document.createElement('canvas');
          cv.width = img.width;
          cv.height = img.height;
          cv.getContext('2d').drawImage(img, 0, 0);
          var base64 = cv.toDataURL('image/png');
          URL.revokeObjectURL(dataUrl);
          if (window.__setImportedAvatar__) window.__setImportedAvatar__(base64);
          applyImportedCard(json, file.name);
        };
        img.onerror = function() {
          URL.revokeObjectURL(dataUrl);
          applyImportedCard(json, file.name);
        };
        img.src = dataUrl;
      } catch (err) {
        showImportStatus('❌ PNG 解析失败：' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function extractPNGCharaChunk(bytes) {
    var i = 8;
    while (i < bytes.length - 12) {
      var length =
        (bytes[i] << 24 | bytes[i + 1] << 16 |
          bytes[i + 2] << 8 | bytes[i + 3]) >>> 0;
      var type = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]);
      if (type === 'tEXt') {
        var data = bytes.slice(i + 8, i + 8 + length);
        var nullPos = data.indexOf(0);
        if (nullPos < 0) { i += 12 + length; continue; }
        var keyword = '';
        for (var k = 0; k < nullPos; k++) keyword += String.fromCharCode(data[k]);
        if (keyword === 'chara') {
          var value = '';
          for (var v = nullPos + 1; v < data.length; v++) value += String.fromCharCode(data[v]);
          return value;
        }
      }
      if (type === 'IEND') break;
      i += 12 + length;
    }
    return null;
  }

  function applyImportedCard(json, filename) {
    if (!engineTryAllowed('lifecycle.card.import').ok) return;
    try {
      var normalized = normalizeCardJSON(json);
      if (!normalized) {
        showImportStatus('❌ 无法识别卡片格式，请确认是支持的角色卡文件', 'error');
        return;
      }
      if (window.applyJSONFromEditor) window.applyJSONFromEditor(normalized);
      if (window.updatePreviewPanel) window.updatePreviewPanel(normalized);
      var charName = (normalized.data && normalized.data.name) || normalized.name || '未知角色';
      showImportStatus(
        '✅ 已导入「' + charName + '」← ' + filename + '（记得检查各字段后再导出）',
        'success'
      );
    } catch (err) {
      showImportStatus('❌ 应用失败：' + err.message, 'error');
    }
  }

  function normalizeCardJSON(json) {
    if (json && json.spec === 'chara_card_v3' && json.data) return json;
    if (json && json.data && json.data.name) {
      json.spec = json.spec || 'chara_card_v3';
      json.spec_version = json.spec_version || '3.0';
      return json;
    }
    if (json && json.name) {
      return {
        name: json.name || '',
        description: json.description || '',
        personality: json.personality || '',
        scenario: json.scenario || '',
        first_mes: json.first_mes || '',
        mes_example: json.mes_example || '',
        creatorcomment: json.creatorcomment || '',
        avatar: 'none',
        talkativeness: '0.5',
        fav: false,
        tags: json.tags || [],
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: {
          name: json.name || '',
          description: json.description || '',
          personality: json.personality || '',
          scenario: json.scenario || '',
          first_mes: json.first_mes || '',
          mes_example: json.mes_example || '',
          creator_notes: json.creatorcomment || '',
          system_prompt: '',
          post_history_instructions: '',
          tags: json.tags || [],
          creator: '',
          character_version: (json.character_version || (json.data && json.data.character_version) || '1.0'),
          alternate_greetings: json.alternate_greetings || [],
          extensions: { world: '', regex_scripts: [] },
          character_book: json.character_book || { name: '', entries: [] },
        }
      };
    }
    return null;
  }

  function showImportStatus(msg, type) {
    if (!importStatusBar) return;
    var colors = {
      info: { color: 'var(--color-accent-hover)', bg: 'rgba(56,189,248,0.08)', border: 'rgba(56,189,248,0.2)' },
      success: { color: 'var(--color-success)', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
      error: { color: 'var(--color-danger)', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' },
    };
    var c = colors[type] || colors.info;
    importStatusBar.style.cssText =
      'display:block;padding:8px 12px;font-size:0.78rem;border-radius:8px;margin-bottom:12px;' +
      'color:' + c.color + ';background:' + c.bg + ';border-left:3px solid ' + c.border + ';';
    importStatusBar.textContent = msg;
    if (type === 'success') {
      setTimeout(function() { importStatusBar.style.display = 'none'; }, 5000);
    }
  }
}
