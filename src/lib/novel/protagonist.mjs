/**
 * 卡面主角：工坊设定名 → 主卡角色名；图谱锚点；列表/世界书排除
 */
import { emptyEntity, findEntityMatch } from './entityStore.mjs';
import { graphNodeId } from './graphMerge.mjs';

/** @param {object} ent */
export function isProtagonistEntity(ent) {
  if (!ent) return false;
  if (ent.role === 'protagonist') return true;
  return !!(ent.attrs && ent.attrs.role === 'protagonist');
}

/**
 * 解析主角名：小说工坊 setupCharName → 主卡 charName
 * @param {object} state
 * @returns {{ name: string, source: 'workshop'|'card'|'' }}
 */
export function resolveProtagonistName(state) {
  var workshop = String((state && state.setupCharName) || '').trim();
  if (workshop) return { name: workshop, source: 'workshop' };
  var card = '';
  try {
    if (typeof window !== 'undefined' && window.__getCharacterFields__) {
      var f = window.__getCharacterFields__() || {};
      card = String(f.charName || f.name || '').trim();
    }
  } catch (e) { /* ignore */ }
  if (!card && typeof document !== 'undefined') {
    var el = document.getElementById('charName');
    if (el) card = String(el.value || '').trim();
  }
  if (card) return { name: card, source: 'card' };
  return { name: '', source: '' };
}

function normName(s) {
  return String(s || '').trim().toLowerCase();
}

/** 名称/别名是否命中主角 */
export function matchesProtagonist(name, aliases, protagonistName) {
  var p = normName(protagonistName);
  if (!p) return false;
  if (normName(name) === p) return true;
  var list = Array.isArray(aliases) ? aliases : [];
  for (var i = 0; i < list.length; i++) {
    if (normName(list[i]) === p) return true;
  }
  return false;
}

/**
 * 确保 entities 中有主角锚点（进图谱，不进人物列表投影）
 * @returns {object|null} entity
 */
export function ensureProtagonistEntity(state, protagonistName) {
  var name = String(protagonistName || '').trim();
  if (!name) return null;
  if (!state.entities) state.entities = [];
  var hit = findEntityMatch(state.entities, name, []);
  if (hit && hit.type === 'person') {
    hit.role = 'protagonist';
    if (!hit.attrs) hit.attrs = {};
    hit.attrs.role = 'protagonist';
    hit.name = hit.name || name;
    return hit;
  }
  var ent = emptyEntity('person', name);
  ent.id = graphNodeId('person', name);
  ent.role = 'protagonist';
  ent.attrs = { role: 'protagonist' };
  ent.summary = '卡面主角（角色设定）';
  ent.source = 'card';
  ent.selected = false;
  state.entities.push(ent);
  return ent;
}

/**
 * 去掉重复主角 person，关系端点归一到锚点；供骨架后调用
 * @returns {{ removed: number, relRewritten: number }}
 */
export function reconcileProtagonistAfterExtract(state, protagonistName) {
  var name = String(protagonistName || '').trim();
  var out = { removed: 0, relRewritten: 0 };
  if (!name) return out;
  var anchor = ensureProtagonistEntity(state, name);
  if (!anchor) return out;
  var dropIds = {};
  state.entities = (state.entities || []).filter(function(e) {
    if (!e || e.id === anchor.id) return true;
    if (e.type !== 'person') return true;
    if (!matchesProtagonist(e.name, e.aliases, name) && !isProtagonistEntity(e)) return true;
    dropIds[e.id] = true;
    out.removed++;
    return false;
  });
  (state.relations || []).forEach(function(r) {
    if (!r) return;
    if (dropIds[r.fromId]) {
      r.fromId = anchor.id;
      r.from = anchor.id;
      out.relRewritten++;
    }
    if (dropIds[r.toId]) {
      r.toId = anchor.id;
      r.to = anchor.id;
      out.relRewritten++;
    }
  });
  // 自环去掉
  state.relations = (state.relations || []).filter(function(r) {
    return r && r.fromId && r.toId && r.fromId !== r.toId;
  });
  return out;
}

/** 骨架提示块 */
export function buildProtagonistHintBlock(protagonistName) {
  var name = String(protagonistName || '').trim();
  if (!name) return '';
  return '\n【卡面主角】' + name
    + '\n- 勿再输出与该名（及明显同指别名）的 person 实体；主角设定在「角色设定」，不进人物列表/世界书 NPC。'
    + '\n- 关系边仍可用该名作 from/to，系统会挂到主角锚点。'
    + '\n';
}

/** 软提示文案 */
export function protagonistMissingTip() {
  return '未设定主角名：请先在「角色设定」填写名称，或填写主卡「角色名」。有主角名后图谱会固定锚点并排除列表重复。';
}
