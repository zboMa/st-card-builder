/**
 * 角色卡导入解析（JSON / PNG）— 纯解析逻辑 + 浏览器文件读取。
 * 从 cardManagerPanelBoot 抽出，供 Vue 工具栏调用，可单测纯函数。
 */

export function normalizeCardJSON(json) {
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
      },
    };
  }
  return null;
}

export function extractPNGCharaChunk(bytes) {
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

function readFileAsText(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function (ev) { resolve(ev.target.result); };
    reader.onerror = function () { reject(reader.error || new Error('读取文件失败')); };
    reader.readAsText(file);
  });
}

function readFileAsArrayBuffer(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function (ev) { resolve(ev.target.result); };
    reader.onerror = function () { reject(reader.error || new Error('读取文件失败')); };
    reader.readAsArrayBuffer(file);
  });
}

function pngFileToDataUrl(file) {
  return new Promise(function (resolve) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      try {
        var cv = document.createElement('canvas');
        cv.width = img.width;
        cv.height = img.height;
        cv.getContext('2d').drawImage(img, 0, 0);
        resolve(cv.toDataURL('image/png'));
      } catch (e) {
        resolve('');
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      resolve('');
    };
    img.src = url;
  });
}

/**
 * @param {File} file
 * @returns {Promise<{ cardJson: object, avatarBase64: string }>}
 */
export async function parseCardFile(file) {
  var ext = String(file && file.name || '').split('.').pop().toLowerCase();
  if (ext === 'json') {
    var text = await readFileAsText(file);
    var normalized = normalizeCardJSON(JSON.parse(text));
    if (!normalized) throw new Error('无法识别卡片格式，请确认是支持的角色卡文件');
    return { cardJson: normalized, avatarBase64: '' };
  }
  if (ext === 'png') {
    var bytes = new Uint8Array(await readFileAsArrayBuffer(file));
    var charaB64 = extractPNGCharaChunk(bytes);
    if (!charaB64) throw new Error('未找到角色数据，该 PNG 可能不是酒馆卡片');
    var jsonStr = decodeURIComponent(escape(atob(charaB64)));
    var normalizedPng = normalizeCardJSON(JSON.parse(jsonStr));
    if (!normalizedPng) throw new Error('无法识别卡片格式，请确认是支持的角色卡文件');
    var avatarBase64 = await pngFileToDataUrl(file);
    return { cardJson: normalizedPng, avatarBase64: avatarBase64 };
  }
  throw new Error('不支持的文件格式，请选择 .json 或 .png');
}
