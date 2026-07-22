/**
 * 制卡字段字典与 JSON 校验（拆自 browserApp）
 */
var FIELD_DICT = {
  "name": { label: "角色名", tip: "角色的显示名称", type: "string", required: true },
  "description": { label: "角色描述(顶层)", tip: "V2兼容字段，与data.description同步", type: "string" },
  "personality": { label: "性格(顶层)", tip: "通常留空，推荐写入角色描述", type: "string" },
  "scenario": { label: "场景(顶层)", tip: "通常留空，推荐用世界书承载场景", type: "string" },
  "first_mes": { label: "开场白(顶层)", tip: "角色说的第一句话", type: "string" },
  "mes_example": { label: "对话示例(顶层)", tip: "示范角色说话风格", type: "string" },
  "creatorcomment": { label: "作者注释(顶层)", tip: "V2兼容字段", type: "string" },
  "avatar": { label: "头像标记", tip: "头像文件名或none", type: "string" },
  "talkativeness": { label: "话痨程度", tip: "0.0~1.0 控制主动发言频率", type: "string" },
  "fav": { label: "收藏标记", tip: "是否被标记为收藏", type: "boolean" },
  "tags": { label: "标签(顶层)", tip: "分类标签数组", type: "array" },
  "spec": { label: "卡片规格", tip: "固定为chara_card_v3", type: "string", required: true, enum: ["chara_card_v3"] },
  "spec_version": { label: "规格版本", tip: "固定为3.0", type: "string", required: true, enum: ["3.0"] },
  "data.name": { label: "角色名", tip: "主数据层角色名", type: "string", required: true },
  "data.description": { label: "角色描述", tip: "核心描述：外貌、性格、背景", type: "string", required: true },
  "data.personality": { label: "性格", tip: "推荐写在description里", type: "string" },
  "data.scenario": { label: "场景", tip: "推荐用世界书代替", type: "string" },
  "data.first_mes": { label: "开场白", tip: "首次对话角色发送的第一条消息", type: "string", required: true },
  "data.mes_example": { label: "对话示例", tip: "格式：<START>\\n{{char}}: ...", type: "string" },
  "data.creator_notes": { label: "作者注释", tip: "给使用者看的说明，不注入AI", type: "string" },
  "data.system_prompt": { label: "系统提示词", tip: "最高优先级系统指令，慎用", type: "string" },
  "data.post_history_instructions": { label: "历史后指令", tip: "Author's Note位置的指令", type: "string" },
  "data.tags": { label: "标签", tip: "分类标签数组", type: "array" },
  "data.creator": { label: "创作者", tip: "卡片制作者名字", type: "string" },
  "data.character_version": { label: "卡片版本", tip: "迭代版本号", type: "string" },
  "data.alternate_greetings": { label: "备选开场白", tip: "多个可选开场白", type: "array" },
  "data.extensions": { label: "扩展数据", tip: "扩展字段容器", type: "object" },
  "data.extensions.world": { label: "关联世界书", tip: "关联的世界书名称", type: "string" },
  "data.extensions.regex_scripts": { label: "正则脚本列表", tip: "嵌入卡片的正则替换脚本", type: "array" },
};

function getFieldInfo(path) {
  if (FIELD_DICT[path]) return FIELD_DICT[path];
  var n1 = path.replace(/\.(\d+)\./g, '[].');
  if (FIELD_DICT[n1]) return FIELD_DICT[n1];
  var n2 = path.replace(/\.(\d+)$/g, '[]');
  if (FIELD_DICT[n2]) return FIELD_DICT[n2];
  return undefined;
}

function validateField(path, value) {
  var info = getFieldInfo(path);
  if (!info) return null;
  if (info.required && (value === undefined || value === null || value === '')) return '必填字段不能为空';
  if (value !== null && value !== undefined && info.type !== 'any') {
    var t = Array.isArray(value) ? 'array' : typeof value;
    if (t !== info.type) return '类型错误：期望 ' + info.type + '，实际 ' + t;
  }
  if (info.enum && value !== undefined && value !== null && value !== '' && info.enum.indexOf(value) === -1) {
    return '值不在允许范围';
  }
  if (info.range && typeof value === 'number') {
    if (info.range.min !== undefined && value < info.range.min) return '最小值为 ' + info.range.min;
    if (info.range.max !== undefined && value > info.range.max) return '最大值为 ' + info.range.max;
  }
  return null;
}

function validateFullJSON(obj, pp, errs) {
  if (!pp) pp = '';
  if (!errs) errs = [];
  if (obj === null || obj === undefined) return errs;
  if (Array.isArray(obj)) {
    obj.forEach(function(it, i) {
      var p = pp + '.' + i;
      if (typeof it === 'object' && it !== null) validateFullJSON(it, p, errs);
      else {
        var e = validateField(p, it);
        if (e) errs.push({ path: p, message: e, value: it });
      }
    });
  } else if (typeof obj === 'object') {
    Object.keys(obj).forEach(function(k) {
      var fp = pp ? pp + '.' + k : k;
      var v = obj[k];
      var e = validateField(fp, v);
      if (e) errs.push({ path: fp, message: e, value: v });
      if (typeof v === 'object' && v !== null) validateFullJSON(v, fp, errs);
    });
  }
  return errs;
}

function countNovelUnsynced() {
  try {
    var bridge = window.__novelWorkshopBridge__;
    if (!bridge || typeof bridge.getState !== 'function') return 0;
    var st = bridge.getState() || {};
    var entities = Array.isArray(st.entities) ? st.entities : [];
    var n = 0;
    entities.forEach(function(e) {
      if (e && (e.syncStatus === 'unsynced' || e.syncStatus === 'dirty')) n += 1;
    });
    var chars = Array.isArray(st.characters) ? st.characters : [];
    chars.forEach(function(c) {
      if (c && (c.syncStatus === 'unsynced' || c.syncStatus === 'dirty')) n += 1;
    });
    return n;
  } catch (e) {
    return 0;
  }
}

/**
 * 启动制卡主侧（须在 DOM 就绪后调用）
 */

export { FIELD_DICT, getFieldInfo, validateField, validateFullJSON, countNovelUnsynced };
