/**
 * 产出同步：角色设定 / 世界书；冲突策略 overwrite | merge | skip
 * 文风以固定标题「文风」写入主世界书一条
 */

import { formatProfileYaml } from './schema.mjs';
import { formatAdultAttrsForContent } from './nsfwSupport.mjs';

export var SYNC_STATUSES = ['unsynced', 'synced', 'dirty'];
export var CONFLICT_POLICIES = ['overwrite', 'merge', 'skip'];
/** 文风同步到主世界书时的固定条目标题 */
export var STYLE_WB_COMMENT = '文风';
/** 世界书人物条目前缀（与主角 Description 分管道） */
export var PERSON_WB_COMMENT_PREFIX = '[小说人物] ';
export var PERSON_WB_COMMENT_PREFIX_ALT = '[人物] ';

/** 是否为世界书「人物」条目（恶堕/成人层只认这类） */
export function isPersonWorldbookComment(comment) {
  var c = String(comment || '').trim();
  return c.indexOf(PERSON_WB_COMMENT_PREFIX) === 0 || c.indexOf(PERSON_WB_COMMENT_PREFIX_ALT) === 0;
}

/** 从人物世界书 comment 解析显示名 */
export function personNameFromWorldbookComment(comment) {
  var c = String(comment || '').trim();
  var m = c.match(/^\[(?:小说)?人物\]\s*(.+)$/);
  return m ? String(m[1] || '').trim() : '';
}

/** 主角 Description 是否疑似混入了成人/人物档案块 */
export function protagonistDescLooksContaminated(desc) {
  var t = String(desc || '');
  if (!t.trim()) return false;
  if (/NSFW_information|恶堕档案|恶堕进度/i.test(t)) return true;
  if (/【小说人物·/.test(t)) return true;
  if (/desire_palette|sexual_psychology|situational_modulation/i.test(t)) return true;
  return false;
}

/** 转义 merge 区块正则中的特殊字符 */
function escapeRegExp(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 档案 → 角色字段补丁
 * @param {{ setCharName?: boolean }} [opts] setCharName=false 时不改主卡角色名（多人落卡）
 */
export function profileToCharacterFields(profile, name, policy, currentDesc, opts) {
  opts = opts || {};
  // 主角卡面默认剥离 NSFW_information（成人层只进世界书人物）
  var yaml = formatProfileYaml(profile, name, { omitNsfw: opts.omitNsfw !== false });
  var cur = String(currentDesc || '');
  var p = policy || 'merge';
  var display = name || (profile && profile['Chinese name']) || '';
  if (p === 'skip' && cur.trim()) {
    return { skipped: true, fields: null };
  }
  var fields;
  if (p === 'overwrite' || !cur.trim()) {
    fields = { charDesc: yaml };
  } else {
    // merge：追加区块，避免重复同名标题（角色名转义防正则注入）
    var marker = '【小说人物·' + (name || '未命名') + '】';
    var block = marker + '\n' + yaml;
    var re = new RegExp(escapeRegExp(marker) + '[\\s\\S]*?(?=\\n【小说人物·|$)');
    var next = cur.indexOf(marker) >= 0
      ? cur.replace(re, block)
      : (cur.replace(/\s+$/, '') + '\n\n' + block);
    fields = { charDesc: next };
  }
  if (opts.setCharName !== false) fields.charName = display;
  return { skipped: false, fields: fields };
}

/**
 * 将草稿条目写入世界书列表
 * @param {Array} currentWb
 * @param {Array} drafts { comment, content, keys, strategy?, layer? }
 * @param {'overwrite'|'merge'|'skip'} policy
 */
export function applyDraftsToWorldbook(currentWb, drafts, policy) {
  var wb = (currentWb || []).slice();
  var p = policy || 'merge';
  var added = 0;
  var updated = 0;
  var skipped = 0;

  (drafts || []).forEach(function(d) {
    if (!d) return;
    var comment = String(d.comment || ('[小说]' + (d.name || '条目')));
    var idx = wb.findIndex(function(e) { return String(e.comment || '') === comment; });
    var entry = {
      comment: comment,
      content: String(d.content || ''),
      keys: Array.isArray(d.keys) ? d.keys.slice() : [],
      strategy: d.strategy || (d.layer === 'blue' ? 'constant' : 'selective'),
      position: d.position != null ? d.position : 4,
      depth: d.depth != null ? d.depth : (d.layer === 'blue' ? 2 : 4),
      role: d.role != null ? d.role : 0,
      order: d.order != null ? d.order : 800,
      prob: d.prob != null ? d.prob : 100,
      enabled: d.enabled !== false,
    };

    if (idx < 0) {
      wb.push(entry);
      added++;
      return;
    }
    if (p === 'skip') {
      skipped++;
      return;
    }
    if (p === 'overwrite') {
      wb[idx] = Object.assign({}, wb[idx], entry);
      updated++;
      return;
    }
    // merge：有 provenance 的新内容优先；否则拼接/取更长；keys 去重
    var old = wb[idx];
    var keys = (old.keys || []).slice();
    entry.keys.forEach(function(k) {
      if (k && keys.indexOf(k) < 0) keys.push(k);
    });
    var oldContent = String(old.content || '');
    var neuContent = String(entry.content || '');
    var content = oldContent;
    if (neuContent) {
      if (d.hasProvenance) {
        // 溯源优先：新内容覆盖（除非旧更长且已包含新段）
        if (!oldContent || neuContent.length >= oldContent.length || oldContent.indexOf(neuContent) < 0) {
          content = neuContent.length >= oldContent.length
            ? neuContent
            : (oldContent.indexOf(neuContent) >= 0 ? oldContent : neuContent + '\n\n' + oldContent);
        }
      } else if (oldContent.indexOf(neuContent) < 0) {
        content = oldContent ? (oldContent + '\n\n' + neuContent) : neuContent;
      }
    }
    wb[idx] = Object.assign({}, old, entry, { content: content, keys: keys });
    updated++;
  });

  return { entries: wb, added: added, updated: updated, skipped: skipped };
}

/** 人物档案 → 世界书条目草稿 */
export function profileToWorldbookDraft(profile, name) {
  var yaml = formatProfileYaml(profile, name);
  var keys = [name];
  if (profile && profile.Nickname && typeof profile.Nickname === 'string') {
    profile.Nickname.split(/[,，、]/).forEach(function(k) {
      var t = k.trim();
      if (t && keys.indexOf(t) < 0) keys.push(t);
    });
  }
  return {
    category: 'character',
    layer: 'green',
    name: name,
    comment: '[小说人物] ' + name,
    content: yaml,
    keys: keys.slice(0, 12),
    strategy: 'selective',
  };
}

/** 文风文本合并策略（提示词等非世界书场景仍可用） */
export function mergeStyleText(current, next, policy) {
  var cur = String(current || '');
  var neu = String(next || '');
  if (!neu) return { text: cur, skipped: true };
  if (policy === 'skip' && cur.trim()) return { text: cur, skipped: true };
  if (policy === 'overwrite' || !cur.trim()) return { text: neu, skipped: false };
  if (cur.indexOf(neu) >= 0) return { text: cur, skipped: true };
  return { text: cur.replace(/\s+$/, '') + '\n\n' + neu, skipped: false };
}

/** 文风 → 主世界书单条草稿（标题固定「文风」） */
export function styleToWorldbookDraft(styleText) {
  return {
    comment: STYLE_WB_COMMENT,
    name: STYLE_WB_COMMENT,
    content: String(styleText || ''),
    keys: [],
    strategy: 'constant',
    layer: 'blue',
    position: 0,
    depth: 4,
    role: 0,
    order: 100,
    prob: 100,
    enabled: true,
  };
}

/**
 * person 实体 → 世界书草稿（有 profile 用附录1；否则用 content/summary）
 * @param {object} e
 */
export function entityPersonToWorldbookDraft(e) {
  if (!e) return null;
  var hasProv = Array.isArray(e.provenance) && e.provenance.length > 0;
  if (e.attrs && e.attrs.profile) {
    var d = profileToWorldbookDraft(e.attrs.profile, e.name);
    d.hasProvenance = hasProv;
    return d;
  }
  var body = String(e.content || e.summary || '').trim();
  if (!body) return null;
  return {
    category: 'character',
    layer: e.layer || 'green',
    name: e.name,
    comment: '[小说人物] ' + e.name,
    content: body,
    keys: (e.keys && e.keys.length)
      ? e.keys.slice(0, 12)
      : [e.name].concat(e.aliases || []).slice(0, 12),
    strategy: 'selective',
    hasProvenance: hasProv,
  };
}

/**
 * person 实体 → 角色设定字段（无 profile 时用 content）
 * @param {{ setCharName?: boolean }} [opts]
 */
export function entityPersonToCharacterFields(e, policy, currentDesc, opts) {
  opts = opts || {};
  if (!e) return { skipped: true, fields: null };
  if (e.attrs && e.attrs.profile) {
    return profileToCharacterFields(e.attrs.profile, e.name, policy, currentDesc, opts);
  }
  var body = String(e.content || e.summary || '').trim();
  if (!body) return { skipped: true, fields: null };
  var p = policy || 'merge';
  var cur = String(currentDesc || '');
  if (p === 'skip' && cur.trim()) return { skipped: true, fields: null };
  var marker = '【小说人物·' + (e.name || '未命名') + '】';
  var block = marker + '\n' + body;
  var fields;
  if (p === 'overwrite' || !cur.trim()) {
    fields = { charDesc: body };
  } else {
    var re = new RegExp(escapeRegExp(marker) + '[\\s\\S]*?(?=\\n【小说人物·|$)');
    var next = cur.indexOf(marker) >= 0
      ? cur.replace(re, block)
      : (cur.replace(/\s+$/, '') + '\n\n' + block);
    fields = { charDesc: next };
  }
  if (opts.setCharName !== false) fields.charName = e.name || '';
  return { skipped: false, fields: fields };
}

/**
 * 知识库实体 → 世界书草稿列表（非 person；event 保留 category=event，标题前缀可识别）
 * @param {object[]} entities
 * @param {{ types?: string[], selectedOnly?: boolean, includePersons?: boolean }} [opts]
 */
export function entitiesToWorldbookDrafts(entities, opts) {
  opts = opts || {};
  var typeFilter = opts.types && opts.types.length ? opts.types : null;
  var out = [];
  (entities || []).forEach(function(e) {
    if (!e) return;
    if (opts.selectedOnly && e.selected === false) return;
    if (typeFilter && typeFilter.indexOf(e.type) < 0) return;
    if (e.type === 'person') {
      if (!opts.includePersons) return;
      var pd = entityPersonToWorldbookDraft(e);
      if (pd) out.push(pd);
      return;
    }
    if (!(e.content || e.summary || (e.attrs && e.attrs.adult))) return;
    // event 保留 category；主卡无专用 UI 时靠 comment「[小说event]」识别
    var cat = e.type === 'lore'
      ? ((e.attrs && e.attrs.aspect) || 'setting')
      : (e.type === 'faction' || e.type === 'location' || e.type === 'item' || e.type === 'event' || e.type === 'nsfw'
        ? e.type
        : 'setting');
    var content = e.content || e.summary || '';
    var adultBlock = e.attrs && e.attrs.adult ? formatAdultAttrsForContent(e.attrs.adult) : '';
    if (adultBlock && content.indexOf('【成人向用法】') < 0) {
      content = String(content || '').replace(/\s+$/, '') + (content ? '\n\n' : '') + adultBlock;
    }
    out.push({
      category: cat,
      name: e.name,
      comment: '[小说' + cat + '] ' + e.name,
      content: content,
      keys: (e.keys && e.keys.length) ? e.keys.slice() : [e.name].concat(e.aliases || []).slice(0, 6),
      strategy: e.layer === 'blue' ? 'constant' : 'selective',
      layer: e.layer || 'green',
      hasProvenance: Array.isArray(e.provenance) && e.provenance.length > 0,
    });
  });
  return out;
}

/**
 * 同步实体到主世界书（人物另走 profile 路径）
 * @returns {{ added, updated, skipped, drafts }}
 */
export function syncEntitiesToWorldbook(currentWb, entities, policy, opts) {
  var drafts = entitiesToWorldbookDrafts(entities, opts);
  var r = applyDraftsToWorldbook(currentWb, drafts, policy);
  return {
    entries: r.entries,
    added: r.added,
    updated: r.updated,
    skipped: r.skipped,
    drafts: drafts,
  };
}
