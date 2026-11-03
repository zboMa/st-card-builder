/**
 * MVU 变量卡桥：设计与生成存 cardBuilderExtensions，Vue 只读 store 快照。
 */
import {
  inferMvuCandidatesFromCard,
  mergeCandidatesIntoDesign,
  corruptionProgressGap,
} from './inferFromCard.mjs';
import { STATUS_BAR_EXT_KEY } from '../statusBar.mjs';
import { buildGroupedUpdateRules } from '../statusBarBuild.mjs';
import { meterCheckLines } from './meterUpdateRules.mjs';
import { patchForRegistrySlot } from '../worldbook/worldbookEntryBridge.mjs';
import { WB_OWNER } from '../worldbook/worldbookRegistry.mjs';
import {
  UPDATE_FIND,
  INIT_FIND,
  HIDE_FIND,
  FORMAT_TPL,
  buildUpdateDisplayReplace,
} from './updateBlock.mjs';
import { setCardExtensionField } from '../store/cardActions.mjs';
import { cardState } from '../store/cardStore.mjs';
import { patchMvuStore, mvuStore } from '../store/mvuStore.mjs';
import {
  buildGraphView,
  buildInferView,
  buildResultChecklist,
  buildVariableGroups,
  connectionKey,
  isRuntimeNodeReachable,
} from './variableCardViewModel.mjs';

var MVU_EXT_KEY = 'zmer_mvu_design';
var GRAPH_EXT_KEY = 'zmer_mvu_runtime_graph';
var MVU_RUNTIME_SCRIPT = "import 'https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js';";
var SCHEMA_HEAD = "import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';\n\nexport const Schema = ";
var SCHEMA_TAIL = "\n\n$(() => {\n  registerMvuSchema(Schema);\n});";
var VARLIST_TPL = '---\n<status_current_variables>\n{{format_message_variable::stat_data}}\n</status_current_variables>';
var UPDATE_DISPLAY_REPLACE = buildUpdateDisplayReplace();
var REGEX_SCRIPTS = [
  { id:'mvu_hide', scriptName:'[不发送]去除变量更新', findRegex:HIDE_FIND, replaceString:'', trimStrings:[], placement:[2], disabled:false, markdownOnly:false, promptOnly:true, runOnEdit:true, substituteRegex:false, minDepth:null, maxDepth:null },
  { id:'mvu_display', scriptName:'[美化]变量更新状态卡', findRegex:UPDATE_FIND, replaceString:UPDATE_DISPLAY_REPLACE, trimStrings:[], placement:[2], disabled:false, markdownOnly:true, promptOnly:false, runOnEdit:true, substituteRegex:false, minDepth:null, maxDepth:null },
  { id:'mvu_init_hide', scriptName:'[美化]隐藏变量初始化', findRegex:INIT_FIND, replaceString:'', trimStrings:[], placement:[2], disabled:false, markdownOnly:true, promptOnly:false, runOnEdit:true, substituteRegex:false, minDepth:null, maxDepth:null }
];

function emptyGen() {
  return { runtime:'', schema:'', initvar:'', varlist:'', updateRules:'', outputFormat:'', regexScripts:[], summary:'', design:null };
}

function emptyCodes() {
  return { schema:'', initvar:'', update:'', format:'', varlist:'', regex:'' };
}

export function initVariableCardPanel(ctx) {
  if (!ctx) throw new Error('initVariableCardPanel: 缺少 ctx');
  var gen = emptyGen();
  var cardData = {};
  var lastSyncFingerprint = '';
  var syncTimer = null;
  var suppressAutoSyncUntil = 0;
  var graphLayout = readGraphLayout();
  var graphSaveTimer = null;
  var gapTimer = null;
  var lastCandidates = [];

  function feedback(message, level, extra) {
    ctx.appFeedback(Object.assign({ message: message, level: level || 'info', channel: 'toast' }, extra || {}));
  }

  function setStatus(text, color) {
    var raw = String(text == null ? '' : text).trim();
    if (!raw) {
      patchMvuStore({ statusText: '', statusColor: color || 'var(--color-text-muted)' });
      return;
    }
    if (/^[🧬✅❌⚠️]/.test(raw) || /正在|失败/.test(raw)) {
      patchMvuStore({ statusText: '', statusColor: color || 'var(--color-text-muted)' });
      if (/正在/.test(raw)) {
        feedback(raw, 'info', { channel: 'notify', title: 'MVU' });
        return;
      }
      var level = /❌|失败/.test(raw) ? 'error' : (/⚠️|未检测/.test(raw) ? 'warn' : 'success');
      feedback(raw, level, { channel: level === 'error' ? 'auto' : 'toast' });
      return;
    }
    patchMvuStore({ statusText: raw, statusColor: color || 'var(--color-text-muted)' });
  }

  function readExtension(key) {
    var ext = cardState().cardBuilderExtensions;
    return ext ? ext[key] : null;
  }

  function writeExtension(key, value) {
    suppressAutoSyncUntil = Date.now() + 700;
    setCardExtensionField(key, value);
    if (ctx.save) ctx.save();
  }

  function readGraphLayout() {
    var raw = readExtension(GRAPH_EXT_KEY);
    if (!raw || typeof raw !== 'object') {
      return { positions: {}, connections: null, codes: {}, disabledDynamicConnections: [] };
    }
    return {
      positions: raw.positions && typeof raw.positions === 'object' ? Object.assign({}, raw.positions) : {},
      connections: Array.isArray(raw.connections) ? raw.connections.slice() : null,
      codes: raw.codes && typeof raw.codes === 'object' ? Object.assign({}, raw.codes) : {},
      disabledDynamicConnections: Array.isArray(raw.disabledDynamicConnections)
        ? raw.disabledDynamicConnections.slice()
        : [],
    };
  }

  function saveGraphLayoutSoon() {
    clearTimeout(graphSaveTimer);
    graphSaveTimer = setTimeout(function() {
      writeExtension(GRAPH_EXT_KEY, {
        version: 1,
        positions: graphLayout.positions || {},
        connections: graphLayout.connections || null,
        codes: graphLayout.codes || {},
        disabledDynamicConnections: graphLayout.disabledDynamicConnections || [],
        updatedAt: new Date().toISOString(),
      });
    }, 180);
  }

  function graphSnapshot() {
    var view = buildGraphView(gen.design, graphLayout);
    view.expanded = !!mvuStore.get().graph.expanded;
    return view;
  }

  function publishGraph() {
    patchMvuStore({ graph: graphSnapshot() });
  }

  function publishDesign(design, options) {
    var o = options || {};
    var list = design && Array.isArray(design.variables) ? design.variables : [];
    patchMvuStore({
      design: design || null,
      variables: list,
      groups: buildVariableGroups(list),
      checklist: o.checklist || buildResultChecklist(design),
      summary: o.summary || '',
      hasResult: !!design,
      codes: Object.assign({}, gen.codes || {}),
      graph: graphSnapshot(),
    });
  }

  function currentCharName() {
    return String(ctx.state.charName || '').trim();
  }

  function currentDesc() {
    return String(ctx.state.charDesc || '');
  }

  function currentFirstMes() {
    return String(ctx.state.firstMes || '');
  }

  function worldbookEntries() {
    if (Array.isArray(ctx.state.worldbookEntries)) return ctx.state.worldbookEntries;
    return window.__getWorldbookEntries__ ? window.__getWorldbookEntries__() : [];
  }

  function buildCardLike() {
    return {
      name: currentCharName(),
      description: currentDesc(),
      worldbook: worldbookEntries(),
      adultConfig: window.__getNsfwConfig__ ? (window.__getNsfwConfig__() || {}) : {},
      statusBarDesign: readExtension(STATUS_BAR_EXT_KEY),
      mvuDesign: readExtension(MVU_EXT_KEY),
    };
  }

  function makeMvuFingerprint(name, desc, wbArr) {
    var mvuBits = (wbArr || [])
      .filter(function(e) {
        var c = String(e.comment || '');
        return c.indexOf('[initvar]') >= 0 || c.indexOf('变量初始化') >= 0 || c.indexOf('[mvu_update]') >= 0;
      })
      .map(function(e) {
        return [
          e.comment || '',
          e.strategy || '',
          String(e.content || '').length,
          String(e.content || '').slice(0, 260),
          String(e.content || '').slice(-260)
        ].join('::');
      })
      .join('||');
    return [String(name || '').trim(), String(desc || '').length, (wbArr || []).length, mvuBits].join('###');
  }

  function mvuArtifactNames() {
    return {
      comments: [
        '[initvar]变量初始化勿开',
        '变量列表',
        '[mvu_update]变量更新规则',
        '[mvu_update]变量输出格式'
      ],
      regexNames: REGEX_SCRIPTS.map(function(rx) { return rx.scriptName; }),
      helperNames: ['MVU', (cardData.name || '角色') + 'zod']
    };
  }

  function clearMvuPreview() {
    gen = emptyGen();
    gen.codes = emptyCodes();
    patchMvuStore({
      design: null,
      variables: [],
      groups: [],
      checklist: [],
      summary: '',
      hasResult: false,
      codes: emptyCodes(),
      graph: graphSnapshot(),
    });
  }

  function clearInjectedMvuArtifacts() {
    if (window.__injectMvuEntries__) {
      suppressAutoSyncUntil = Date.now() + 700;
      window.__injectMvuEntries__([
        { comment:'[initvar]变量初始化勿开', content:'', keys:[], strategy:'selective', position:0, depth:0, role:0, order:1000, prob:100, enabled:false },
        { comment:'变量列表', content:'', keys:[], strategy:'constant', position:4, depth:1, role:0, order:950, prob:100, enabled:false },
        { comment:'[mvu_update]变量更新规则', content:'', keys:[], strategy:'constant', position:4, depth:4, role:0, order:900, prob:100, enabled:false },
        { comment:'[mvu_update]变量输出格式', content:'', keys:[], strategy:'constant', position:4, depth:0, role:0, order:890, prob:100, enabled:false }
      ], REGEX_SCRIPTS.map(function(rx) {
        return Object.assign({}, rx, { disabled:true });
      }));
    }
    if (window.__setTavernHelperScript__) {
      window.__setTavernHelperScript__('MVU', '', false);
      window.__setTavernHelperScript__((cardData.name || '角色') + 'zod', '', false);
    }
  }

  function clearAllVariables() {
    if (!window.confirm('清除当前变量卡？\n这会清空变量预览，并禁用已注入的 MVU 世界书条目、正则和助手脚本。')) return;
    clearMvuPreview();
    writeExtension(MVU_EXT_KEY, null);
    clearInjectedMvuArtifacts();
    lastSyncFingerprint = '';
    setStatus('✅ 已清除变量卡并禁用已注入的 MVU 组件', 'var(--color-success)');
    scheduleRefreshSync(true);
  }

  function deleteAllVariables() {
    if (!window.confirm('彻底删除当前卡片中的 MVU 组件？\n这会移除变量世界书条目、正则脚本和助手脚本。')) return;
    clearMvuPreview();
    writeExtension(MVU_EXT_KEY, null);
    if (window.__deleteMvuArtifacts__) {
      suppressAutoSyncUntil = Date.now() + 700;
      window.__deleteMvuArtifacts__(mvuArtifactNames());
    } else {
      clearInjectedMvuArtifacts();
    }
    lastSyncFingerprint = '';
    setStatus('✅ 已删除当前卡片中的 MVU 变量组件', 'var(--color-success)');
    scheduleRefreshSync(true);
  }

  function refreshSync(options) {
    options = options || {};
    var name = currentCharName();
    var desc = currentDesc();
    var fmes = currentFirstMes();
    var wbArr = worldbookEntries();
    cardData = { name: name, desc: desc, firstMes: fmes, wb: wbArr };
    patchMvuStore({ hasCardData: !!(name || desc) });

    var fingerprint = makeMvuFingerprint(name, desc, wbArr);
    if (!options.force && fingerprint === lastSyncFingerprint) return !!(name || desc);
    lastSyncFingerprint = fingerprint;

    if (!name && !desc) {
      setStatus('未检测到角色数据，请先在角色面板填写', 'var(--color-warning)');
      clearMvuPreview();
      return false;
    }
    var parts = ['📛 ' + (name || '?')];
    if (wbArr.length > 0) parts.push('📖 ' + wbArr.length + '条');

    var existingDesign = parseExistingMvuDesign(wbArr);
    if (existingDesign) {
      gen.design = existingDesign;
      gen.summary = existingDesign.summary;
      parts.push('🎛️ MVU ' + existingDesign.variables.length + '个');
      setStatus(parts.join(' · '), '#86efac');
      rebuildOutputsFromDesign(existingDesign, {
        inject: false,
        message: '已从当前角色卡读取已有状态变量',
        checklist: buildResultChecklist(existingDesign, { existing: true }),
      });
    } else {
      parts.push('🎛️ 未读取到MVU');
      setStatus(parts.join(' · '), 'var(--color-text-muted)');
      clearMvuPreview();
    }
    return true;
  }

  function scheduleRefreshSync(force) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function() { refreshSync({ force: !!force }); }, 80);
  }

  function runtimeModuleState() {
    var conns = buildGraphView(gen.design, graphLayout).connections;
    return {
      initvar: true,
      varlist: isRuntimeNodeReachable(conns, 'stat-data') || isRuntimeNodeReachable(conns, 'varmap'),
      updateRules: isRuntimeNodeReachable(conns, 'rule-inject') || isRuntimeNodeReachable(conns, 'update-output') || isRuntimeNodeReachable(conns, 'mvu-patch'),
      outputFormat: isRuntimeNodeReachable(conns, 'rule-inject') || isRuntimeNodeReachable(conns, 'update-output'),
      zod: isRuntimeNodeReachable(conns, 'zod-validate'),
      regex: isRuntimeNodeReachable(conns, 'regex-display')
    };
  }

  function parseScalar(text) {
    var raw = String(text == null ? '' : text).trim();
    if (!raw || raw === '""' || raw === "''") return '';
    if (raw === '{}') return {};
    if (raw === '[]') return [];
    if (/^(true|false)$/i.test(raw)) return raw.toLowerCase() === 'true';
    if (/^-?\d+(?:\.\d+)?$/.test(raw)) return Number(raw);
    if ((raw[0] === '"' && raw[raw.length - 1] === '"') || (raw[0] === "'" && raw[raw.length - 1] === "'")) {
      try { return JSON.parse(raw); } catch(e) { return raw.slice(1, -1); }
    }
    if ((raw[0] === '{' && raw[raw.length - 1] === '}') || (raw[0] === '[' && raw[raw.length - 1] === ']')) {
      try { return JSON.parse(raw); } catch(e) {}
    }
    return raw;
  }

  function parseSimpleYaml(text) {
    var root = {};
    var stack = [{ indent: -1, obj: root }];
    String(text || '').split(/\r?\n/).forEach(function(line) {
      if (!line.trim() || /^\s*#/.test(line) || /^\s*---\s*$/.test(line)) return;
      var m = line.match(/^(\s*)([^:#][^:]*):(?:\s*(.*))?$/);
      if (!m) return;
      var indent = m[1].length;
      var key = m[2].trim();
      var valueText = (m[3] || '').trim();
      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
      var parent = stack[stack.length - 1].obj;
      if (!valueText) {
        parent[key] = parent[key] && typeof parent[key] === 'object' && !Array.isArray(parent[key]) ? parent[key] : {};
        stack.push({ indent: indent, obj: parent[key] });
      } else {
        parent[key] = parseScalar(valueText);
      }
    });
    return root;
  }

  function inferType(value) {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'array';
    if (value && typeof value === 'object') return 'object';
    return 'string';
  }

  function flattenObjectToVariables(obj, prefix, out) {
    Object.keys(obj || {}).forEach(function(key) {
      var value = obj[key];
      var path = prefix ? prefix + '.' + key : key;
      if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length) {
        flattenObjectToVariables(value, path, out);
      } else {
        out.push({
          path: path,
          type: inferType(value),
          default: value,
          description: '从角色卡已有变量初始化中读取',
          check: []
        });
      }
    });
  }

  function parseExistingMvuDesign(wbArr) {
    var initEntry = (wbArr || []).find(function(e) {
      var c = String(e.comment || '');
      return c.indexOf('[initvar]') >= 0 || c.indexOf('变量初始化') >= 0;
    });
    if (!initEntry || !String(initEntry.content || '').trim()) return null;
    var obj = parseSimpleYaml(initEntry.content);
    var variables = [];
    flattenObjectToVariables(obj, '', variables);
    variables = variables.filter(function(v) { return v.path && v.path.indexOf('---') !== 0; });
    if (!variables.length) return null;
    return {
      variables: variables,
      summary: '从角色卡已有 [initvar] 变量初始化中读取',
      source: 'existing-initvar'
    };
  }

  function jsString(value) {
    return JSON.stringify(String(value == null ? '' : value));
  }

  function jsValue(value) {
    if (value === undefined) return 'undefined';
    return JSON.stringify(value);
  }

  function sanitizePath(path) {
    return String(path || '')
      .replace(/[\\/]+/g, '.')
      .split('.')
      .map(function(part) { return part.trim(); })
      .filter(Boolean)
      .join('.');
  }

  function uniqueByPath(vars) {
    var seen = {};
    var out = [];
    (vars || []).forEach(function(v) {
      var path = sanitizePath(v && v.path);
      if (!path || seen[path]) return;
      seen[path] = true;
      v.path = path;
      out.push(v);
    });
    return out;
  }

  function lastPathPart(path) {
    var parts = String(path || '').split('.').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : '';
  }

  function buildFallbackDescription(path, type) {
    var leaf = lastPathPart(path) || '变量';
    var top = String(path || '').split('.').filter(Boolean)[0] || '';
    var typeLabelMap = {
      string: '文本状态',
      number: '数值状态',
      boolean: '布尔状态',
      enum: '枚举状态',
      array: '列表状态',
      object: '对象状态'
    };
    var typeLabel = typeLabelMap[String(type || '').toLowerCase()] || '状态';
    if (top === '世界') return '用于记录世界层面的' + leaf + '，属于' + typeLabel + '。';
    if (top === '主角') return '用于记录主角当前的' + leaf + '，属于' + typeLabel + '。';
    if (top === 'NPC') return '用于记录角色相关的' + leaf + '，属于' + typeLabel + '。';
    if (top === '记忆') return '用于记录长期记忆中的' + leaf + '，属于' + typeLabel + '。';
    if (top === '任务') return '用于记录任务系统中的' + leaf + '，属于' + typeLabel + '。';
    return '用于记录“' + leaf + '”这个' + typeLabel + '。';
  }

  function buildFallbackChecks(path, type) {
    var leaf = lastPathPart(path) || '变量';
    var normalizedType = String(type || '').toLowerCase();
    if (normalizedType === 'number') return ['仅当剧情明确导致' + leaf + '增减时更新；无变化不要输出操作'];
    if (normalizedType === 'boolean') return ['仅当剧情中明确满足或取消“' + leaf + '”条件时切换 true/false'];
    if (normalizedType === 'object' || normalizedType === 'array') return ['仅当剧情明确新增、移除或修改“' + leaf + '”内容时更新'];
    return ['仅当剧情明确导致“' + leaf + '”变化时更新；无变化不要输出操作'];
  }

  function normalizeVariableItem(v) {
    v = v || {};
    var type = String(v.type || 'string').toLowerCase();
    if (['text', 'str'].indexOf(type) >= 0) type = 'string';
    if (['int', 'float', 'integer'].indexOf(type) >= 0) type = 'number';
    if (['bool'].indexOf(type) >= 0) type = 'boolean';
    if (['map', 'record', 'dict'].indexOf(type) >= 0) type = 'object';
    if (['string', 'number', 'boolean', 'enum', 'array', 'object'].indexOf(type) < 0) type = 'string';
    var checks = Array.isArray(v.check) ? v.check : (Array.isArray(v.rules) ? v.rules : (v.check ? [v.check] : []));
    var options = Array.isArray(v.options) ? v.options.map(String).filter(Boolean).slice(0, 16) : [];
    var normalizedPath = sanitizePath(v.path || v.name);
    var normalizedChecks = checks.map(String).filter(Boolean).slice(0, 6);
    var description = String(v.description || v.desc || '').trim();
    var def = v.default;
    if (def === undefined) {
      if (type === 'number') def = 0;
      else if (type === 'boolean') def = false;
      else if (type === 'array') def = [];
      else if (type === 'object') def = {};
      else if (type === 'enum') def = options[0] || '';
      else def = '';
    }
    return {
      path: normalizedPath,
      type: type,
      default: def,
      min: v.min,
      max: v.max,
      options: options,
      format: v.format || '',
      description: description || buildFallbackDescription(normalizedPath, type),
      check: normalizedChecks.length ? normalizedChecks : buildFallbackChecks(normalizedPath, type),
    };
  }

  function guessNpcNames() {
    var names = [];
    (cardData.wb || []).forEach(function(e) {
      var c = String(e.comment || '').replace(/[=\[\]【】_阶段0-9不允许打开勿开]/g, '').trim();
      if (c && c.length >= 2 && c.length <= 6 && names.indexOf(c) < 0) names.push(c);
    });
    return names.slice(0, 6);
  }

  function baseVariables() {
    var npcNames = guessNpcNames();
    var vars = [
      { path:'世界.当前日期', type:'string', default:'第1天', description:'当前剧情日期', check:['随休息、跨天或明确时间跳转推进'] },
      { path:'世界.当前时间', type:'string', default:'08:00', description:'当前时间，HH:MM', format:'HH:MM', check:['根据行动耗时、移动、等待或用户指定时间推进'] },
      { path:'世界.当前地点', type:'string', default:'未确定', description:'当前主要场景地点', check:['随主角移动或场景切换更新'] },
      { path:'世界.当前场景', type:'string', default:'开局', description:'当前剧情场景概括', check:['每轮用短语概括当前场面'] },
      { path:'世界.剧情阶段', type:'string', default:'开局', description:'整体剧情阶段', check:['根据主线进展、关系推进和关键事件更新'] },
      { path:'主角.当前状态', type:'string', default:'正常', description:'主角身体与精神状态', check:['根据疲劳、受伤、疾病、情绪压力更新'] },
      { path:'主角.体力', type:'number', default:100, min:0, max:100, description:'主角可行动体力', check: meterCheckLines('体力') },
      { path:'主角.金钱', type:'number', default:0, min:0, description:'主角当前可用金钱', check: meterCheckLines('金钱') },
      { path:'主角.持有物', type:'object', default:{}, description:'主角持有的重要物品表', check:['获得、消耗、赠送、丢失物品时更新'] },
      { path:'记忆.本轮摘要', type:'string', default:'', description:'本轮剧情摘要', check:['每轮用100字以内记录关键变化'] },
      { path:'记忆.重要线索', type:'object', default:{}, description:'长期保存的重要线索、伏笔、承诺', check:['出现长期影响信息时插入或更新'] },
      { path:'任务.当前目标', type:'string', default:'自由行动', description:'当前主要目标或待办', check:['用户确立目标、接受任务、目标完成时更新'] },
      { path:'任务.进行中', type:'object', default:{}, description:'进行中的任务和约定', check:['新增、完成、失败或取消任务时更新'] },
    ];
    npcNames.forEach(function(name) {
      vars.push(
        { path:'NPC.' + name + '.当前情绪', type:'string', default:'平静', description:name + '当前情绪', check:['根据本轮互动、处境和内心压力更新'] },
        { path:'NPC.' + name + '.当前行动', type:'string', default:'按自己的日程行动', description:name + '当前行动', check:['即使不在场，也根据时间和日程独立更新'] },
        { path:'NPC.' + name + '.关系状态', type:'string', default:'陌生', description:'与主角的关系状态', check:['根据长期互动和关键事件更新'] },
        { path:'NPC.' + name + '.好感度', type:'number', default:0, min:-100, max:100, description:'对主角的好感/信任变化', check: meterCheckLines('好感度') },
        { path:'NPC.' + name + '.印象', type:'string', default:'陌生人-中', description:'对主角的主观印象', check:['根据主角持续行为形成更具体印象，后缀可用正/中/负'] }
      );
    });
    return vars;
  }

  function normalizeVariableDesign(raw) {
    var source = raw || {};
    var vars = [];
    if (Array.isArray(source.variables)) vars = source.variables;
    else if (Array.isArray(source.fields)) vars = source.fields;
    else if (source.design && Array.isArray(source.design.variables)) vars = source.design.variables;
    vars = uniqueByPath(vars.map(normalizeVariableItem).concat(baseVariables())).slice(0, 90);
    return {
      variables: vars,
      summary: String(source.summary || source.variable_summary || '已生成稳定 MVU 变量系统').slice(0, 80),
    };
  }

  function insertTree(root, variable) {
    var parts = variable.path.split('.');
    var node = root;
    parts.forEach(function(part, i) {
      node.children = node.children || {};
      node.children[part] = node.children[part] || { name: part, children: {}, field: null };
      node = node.children[part];
      if (i === parts.length - 1) node.field = variable;
    });
  }

  function buildTree(vars) {
    var root = { children: {} };
    vars.forEach(function(v) { insertTree(root, v); });
    return root;
  }

  function renderLeafSchema(field) {
    var desc = field.description ? '.describe(' + jsString(field.description) + ')' : '';
    var prefault = '.prefault(' + jsValue(field.default) + ')';
    if (field.type === 'number') {
      var expr = 'z.coerce.number()' + desc;
      if (field.min !== undefined || field.max !== undefined) {
        var min = Number.isFinite(Number(field.min)) ? Number(field.min) : 'Number.NEGATIVE_INFINITY';
        var max = Number.isFinite(Number(field.max)) ? Number(field.max) : 'Number.POSITIVE_INFINITY';
        expr += '.transform(v => _.clamp(v, ' + min + ', ' + max + '))';
      }
      return expr + prefault;
    }
    if (field.type === 'boolean') return 'z.boolean()' + desc + prefault;
    if (field.type === 'enum' && field.options.length) return 'z.enum(' + jsValue(field.options) + ')' + desc + prefault;
    if (field.type === 'array') return 'z.array(z.string())' + desc + prefault;
    if (field.type === 'object') return 'z.record(z.string(), z.any())' + desc + prefault;
    return 'z.string()' + desc + prefault;
  }

  function renderNodeSchema(node, indent) {
    var keys = Object.keys(node.children || {});
    if (!keys.length && node.field) return renderLeafSchema(node.field);
    var pad = ' '.repeat(indent);
    var inner = keys.map(function(key) {
      return pad + '  ' + jsString(key) + ': ' + renderNodeSchema(node.children[key], indent + 2);
    }).join(',\n');
    return 'z.object({\n' + inner + '\n' + pad + '}).prefault({})';
  }

  function buildSchemaBody(design) {
    return renderNodeSchema(buildTree(design.variables), 0);
  }

  function setNested(obj, path, value) {
    var parts = path.split('.');
    var cur = obj;
    parts.forEach(function(part, i) {
      if (i === parts.length - 1) { cur[part] = value; return; }
      cur[part] = cur[part] && typeof cur[part] === 'object' && !Array.isArray(cur[part]) ? cur[part] : {};
      cur = cur[part];
    });
  }

  function yamlScalar(value) {
    if (value === null) return 'null';
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.length ? JSON.stringify(value) : '[]';
    if (typeof value === 'object') return '{}';
    var s = String(value);
    if (!s) return '""';
    if (/[:#{}\[\],&*?|\-<>=!%@`]|^\s|\s$/.test(s)) return JSON.stringify(s);
    return s;
  }

  function renderYamlValue(value, indent) {
    var pad = ' '.repeat(indent);
    if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length) {
      return '\n' + Object.keys(value).map(function(k) {
        return pad + k + ':' + renderYamlValue(value[k], indent + 2);
      }).join('\n');
    }
    return ' ' + yamlScalar(value);
  }

  function buildInitYaml(design) {
    var root = {};
    design.variables.forEach(function(v) { setNested(root, v.path, v.default); });
    return Object.keys(root).map(function(k) { return k + ':' + renderYamlValue(root[k], 2); }).join('\n');
  }

  function buildUpdateRules(design) {
    return buildGroupedUpdateRules(design && design.variables);
  }

  function mvuWorldbookEntriesFromCurrent() {
    var modules = runtimeModuleState();
    var varlist = patchForRegistrySlot(WB_OWNER.mvu, 'varlist', {
      content: VARLIST_TPL,
      keys: [],
      strategy: 'constant',
      position: 4,
      depth: 1,
      role: 0,
      order: 950,
      prob: 100,
      enabled: modules.varlist,
    });
    return [
      patchForRegistrySlot(WB_OWNER.mvu, 'initvar', {
        content: gen.initvar,
        keys: [],
        strategy: 'selective',
        position: 0,
        depth: 0,
        role: 0,
        order: 1000,
        prob: 100,
        enabled: false,
      }),
      varlist,
      patchForRegistrySlot(WB_OWNER.mvu, 'update_rules', {
        content: gen.updateRules,
        keys: [],
        strategy: 'constant',
        position: 4,
        depth: 4,
        role: 0,
        order: 900,
        prob: 100,
        enabled: modules.updateRules,
      }),
      patchForRegistrySlot(WB_OWNER.mvu, 'update_format', {
        content: FORMAT_TPL,
        keys: [],
        strategy: 'constant',
        position: 4,
        depth: 0,
        role: 0,
        order: 890,
        prob: 100,
        enabled: modules.outputFormat,
      }),
    ];
  }

  function rebuildOutputsFromDesign(design, options) {
    options = options || {};
    design.variables = uniqueByPath((design.variables || []).map(normalizeVariableItem));
    var schemaBody = buildSchemaBody(design);
    var initYaml = buildInitYaml(design);
    var updateYaml = buildUpdateRules(design);
    var summaryTxt = design.summary || gen.summary || '已更新变量卡';

    gen = {
      runtime: MVU_RUNTIME_SCRIPT,
      schema: SCHEMA_HEAD + schemaBody + SCHEMA_TAIL,
      initvar: initYaml,
      varlist: VARLIST_TPL,
      updateRules: updateYaml,
      outputFormat: FORMAT_TPL,
      regexScripts: REGEX_SCRIPTS,
      summary: summaryTxt,
      design: design,
      codes: {
        schema: SCHEMA_HEAD + schemaBody + SCHEMA_TAIL,
        initvar: initYaml,
        update: updateYaml,
        format: FORMAT_TPL,
        varlist: VARLIST_TPL,
        regex: JSON.stringify(REGEX_SCRIPTS.map(function(r) {
          return { scriptName:r.scriptName, findRegex:r.findRegex, replaceString:r.replaceString||'(空)' };
        }), null, 2),
      },
    };
    design.source = options.source || design.source || 'generated';

    var extPayload = {
      summary: summaryTxt,
      variables: design.variables.map(function(v) {
        return {
          path: v.path,
          type: v.type,
          description: v.description,
          check: Array.isArray(v.check) ? v.check.slice(0, 3) : []
        };
      })
    };
    var prevExt = readExtension(MVU_EXT_KEY);
    var extChanged = JSON.stringify(prevExt || null) !== JSON.stringify(extPayload);
    if (extChanged) writeExtension(MVU_EXT_KEY, extPayload);

    publishDesign(design, {
      checklist: options.checklist || buildResultChecklist(design),
      summary: (options.message || '变量卡已更新') + '。当前共 ' + design.variables.length + ' 个状态变量。',
    });

    if (options.inject !== false) {
      var modules = runtimeModuleState();
      if (window.__injectMvuEntries__) {
        suppressAutoSyncUntil = Date.now() + 700;
        window.__injectMvuEntries__(mvuWorldbookEntriesFromCurrent(), REGEX_SCRIPTS.map(function(rx) {
          return Object.assign({}, rx, { disabled: !modules.regex });
        }));
      }
      if (window.__setTavernHelperScript__) {
        window.__setTavernHelperScript__('MVU', gen.runtime, modules.zod);
        window.__setTavernHelperScript__((cardData.name || '角色') + 'zod', gen.schema, modules.zod);
      }
    }
  }

  function extractJson(text) {
    var m = String(text || '').match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    var raw = m ? m[1].trim() : String(text || '').trim();
    var s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    if (s >= 0 && e > s) raw = raw.substring(s, e + 1);
    return JSON.parse(raw);
  }

  function getAiConfig() {
    var apiUrl = ctx.$('apiUrl');
    var apiKey = ctx.$('apiKey');
    var modelSel = ctx.$('modelSelect');
    if (!apiUrl || !modelSel) throw new Error('找不到 AI 配置面板');
    var model = modelSel.value;
    if (!model) throw new Error('请先在 AI 面板拉取并选择模型');
    return {
      url: String(apiUrl.value || '').replace(/\/$/, '') + '/chat/completions',
      key: (apiKey && apiKey.value || '').trim(),
      model: model
    };
  }

  async function requestSingleVariable(requirement, currentVar) {
    var cfg = getAiConfig();
    var headers = { 'Content-Type': 'application/json' };
    if (cfg.key) headers.Authorization = 'Bearer ' + cfg.key;
    var existing = gen.design && Array.isArray(gen.design.variables) ? gen.design.variables.map(function(v) {
      return { path:v.path, type:v.type, description:v.description };
    }) : [];
    var sys = '你是 SillyTavern MVU 单条变量设计器。只输出严格 JSON 对象，不要解释。'
      + '\n格式：{"path":"点分路径","type":"string|number|boolean|enum|array|object","default":默认值,"description":"用途","check":["何时更新"],"min":可选,"max":可选,"options":可选数组,"format":可选}'
      + '\n要求：路径必须具体、稳定、可被剧情自然更新；不要重复已有路径；如果是在重写已有变量，可保留同一路径。';
    var user = '角色：' + (cardData.name || '') + '\n角色描述：' + (cardData.desc || '').slice(0, 700)
      + '\n已有变量：\n' + JSON.stringify(existing, null, 2)
      + '\n\n本次需求：' + requirement
      + (currentVar ? '\n\n需要重写的旧变量：\n' + JSON.stringify(currentVar, null, 2) : '');
    var res = await fetch(cfg.url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ model: cfg.model, messages: [{ role:'system', content:sys }, { role:'user', content:user }], temperature:0.25 })
    });
    if (!res.ok) throw new Error('API 返回 HTTP ' + res.status);
    var data = await res.json();
    var raw = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
    var parsed = extractJson(raw);
    var item = normalizeVariableItem(parsed.variable || parsed);
    if (!item.path) throw new Error('AI 没有返回有效 path');
    return item;
  }

  function setBusy(patch) {
    var old = mvuStore.get().busy;
    patchMvuStore({ busy: Object.assign({}, old, patch || {}) });
  }

  function addOne(requirement) {
    if (!refreshSync()) {
      feedback('未检测到角色数据，请先在角色面板填写', 'warn');
      return;
    }
    var req = String(requirement || '').trim();
    if (!req) {
      feedback('先写一下你想单独生成什么变量。', 'warn');
      return;
    }
    if (!gen.design) gen.design = { variables: [], summary:'手动追加变量' };
    setBusy({ add: true });
    setStatus('🧬 正在生成单条变量…', 'var(--color-accent-hover)');
    return requestSingleVariable(req, null).then(function(item) {
      var exists = gen.design.variables.findIndex(function(v) { return v.path === item.path; });
      if (exists >= 0) gen.design.variables[exists] = item;
      else gen.design.variables.push(item);
      rebuildOutputsFromDesign(gen.design, { message:'已追加变量「' + item.path + '」并写回角色卡' });
      patchMvuStore({ singleRequirement: '' });
      setStatus('✅ 已生成单条变量：' + item.path, 'var(--color-success)');
      return item;
    }).catch(function(err) {
      setStatus('❌ 单条生成失败: ' + err.message, '#ef4444');
    }).finally(function() {
      setBusy({ add: false });
    });
  }

  function regenVariable(path) {
    if (!gen.design || !Array.isArray(gen.design.variables)) return;
    var idx = gen.design.variables.findIndex(function(v) { return v.path === path; });
    if (idx < 0) return;
    setBusy({ regenPath: path });
    setStatus('🧬 正在单独重写变量：' + path, 'var(--color-accent-hover)');
    return requestSingleVariable('重写这个变量，保持同一主题，必要时优化路径、默认值和更新规则。', gen.design.variables[idx])
      .then(function(next) {
        gen.design.variables[idx] = next;
        rebuildOutputsFromDesign(gen.design, { message:'已重写变量「' + path + '」并写回角色卡' });
        setStatus('✅ 已重写变量：' + next.path, 'var(--color-success)');
        return next;
      })
      .catch(function(err) {
        setStatus('❌ 单条重写失败: ' + err.message, '#ef4444');
      })
      .finally(function() {
        setBusy({ regenPath: '' });
      });
  }

  function deleteVariable(path) {
    if (!gen.design || !Array.isArray(gen.design.variables)) return;
    if (!window.confirm('删除变量「' + path + '」？')) return;
    var idx = gen.design.variables.findIndex(function(v) { return v.path === path; });
    if (idx < 0) return;
    gen.design.variables.splice(idx, 1);
    rebuildOutputsFromDesign(gen.design, { message:'已删除变量「' + path + '」并写回角色卡' });
    setStatus('✅ 已删除变量：' + path, 'var(--color-success)');
  }

  function exportPack() {
    if (!gen.schema) {
      feedback('请先在「状态栏」生成变量设计，或从角色卡同步已有 MVU！', 'warn');
      return;
    }
    var pack = {
      _format:'st_v3_mvu_variable_card_pack', _version:'1.0',
      _generated_at: new Date().toISOString(),
      runtime_script:gen.runtime, schema_script:gen.schema, initvar_yaml:gen.initvar,
      variable_list:gen.varlist, update_rules:gen.updateRules,
      output_format:gen.outputFormat, regex_scripts:gen.regexScripts,
      design:gen.design, summary:gen.summary
    };
    var blob = new Blob([JSON.stringify(pack, null, 2)], { type:'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (cardData.name || 'varcard') + '_mvu_pack.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function setSingleRequirement(value) {
    patchMvuStore({ singleRequirement: String(value == null ? '' : value) });
  }

  function openInfer() {
    lastCandidates = inferMvuCandidatesFromCard(buildCardLike());
    patchMvuStore({ infer: buildInferView(lastCandidates) });
  }

  function closeInfer() {
    var infer = mvuStore.get().infer;
    patchMvuStore({ infer: Object.assign({}, infer, { open: false }) });
  }

  function toggleInfer(index, selected) {
    var c = lastCandidates[index];
    if (!c) return;
    c.selected = !!selected;
    patchMvuStore({ infer: buildInferView(lastCandidates) });
  }

  function selectAllInfer() {
    lastCandidates.forEach(function(c) { if (!c.alreadyPresent) c.selected = true; });
    patchMvuStore({ infer: buildInferView(lastCandidates) });
  }

  function selectNoneInfer() {
    lastCandidates.forEach(function(c) { c.selected = false; });
    patchMvuStore({ infer: buildInferView(lastCandidates) });
  }

  function applyInfer(inject) {
    var paths = lastCandidates.filter(function(c) { return c.selected !== false; }).map(function(c) { return c.path; }).filter(Boolean);
    if (!paths.length) {
      feedback('请至少勾选一个候选变量', 'warn');
      return;
    }
    var existing = readExtension(MVU_EXT_KEY);
    var merged = mergeCandidatesIntoDesign(existing, lastCandidates, {
      selectedPaths: paths,
      onlySelected: true,
    });
    var design = {
      variables: merged.variables,
      summary: merged.summary || ('从卡推定 +' + merged.added),
      source: 'infer_from_card',
    };
    var result = applyExternalDesign({
      design: design,
      source: 'infer_from_card',
      inject: !!inject,
      message: inject
        ? ('已推定合并并注入（+' + merged.added + ' / 更新 ' + merged.updated + '）')
        : ('已推定合并到设计（+' + merged.added + ' / 更新 ' + merged.updated + '）'),
    });
    closeInfer();
    refreshCorruptionGap();
    return result;
  }

  function refreshCorruptionGap() {
    var gap = corruptionProgressGap(buildCardLike());
    patchMvuStore({ gap: { visible: !!gap.gap, message: gap.message || '' } });
  }

  function applyExternalDesign(payload) {
    payload = payload || {};
    var rawDesign = payload.design || payload;
    var rawVars = Array.isArray(rawDesign.variables) ? rawDesign.variables : [];
    if (!rawVars.length) throw new Error('没有可用的变量设计');
    var design = {
      variables: uniqueByPath(rawVars.map(normalizeVariableItem)),
      summary: String(rawDesign.summary || payload.summary || '已导入外部 MVU 变量设计').slice(0, 80),
      source: String(payload.source || rawDesign.source || 'external')
    };
    rebuildOutputsFromDesign(design, {
      message: payload.message || '已从外部工坊刷新 MVU 变量卡',
      inject: payload.inject !== false
    });
    return { count: design.variables.length, summary: design.summary };
  }

  function setGraphPositions(positions) {
    graphLayout.positions = Object.assign({}, graphLayout.positions || {}, positions || {});
    saveGraphLayoutSoon();
    publishGraph();
  }

  function setGraphCode(nodeId, code) {
    if (!nodeId) return;
    graphLayout.codes = Object.assign({}, graphLayout.codes || {});
    graphLayout.codes[nodeId] = String(code == null ? '' : code);
    saveGraphLayoutSoon();
    publishGraph();
  }

  function connectGraph(conn) {
    if (!conn || !conn.from || !conn.to) return;
    var base = Array.isArray(graphLayout.connections)
      ? graphLayout.connections.slice()
      : buildGraphView(gen.design, graphLayout).connections.filter(function(item) { return !item.dynamicVar; });
    base = base.filter(function(item) { return !(item.from === conn.from && item.to === conn.to); });
    base.push({ from: conn.from, to: conn.to, className: conn.className || 'vc-wire-source' });
    graphLayout.connections = base;
    saveGraphLayoutSoon();
    publishGraph();
    if (gen.design) {
      rebuildOutputsFromDesign(gen.design, { message:'已按当前链路刷新变量卡模块启用状态' });
    }
  }

  function removeGraphConnection(conn) {
    if (!conn) return;
    var fromNode = String(conn.from || '').split(':')[0];
    var toNode = String(conn.to || '').split(':')[0];
    if (!window.confirm('断开「' + fromNode + ' → ' + toNode + '」？\n断开后，不可达模块会在变量卡注入时被禁用。')) return;
    if (conn.dynamicVar || conn.stableKey) {
      var disabled = Array.isArray(graphLayout.disabledDynamicConnections)
        ? graphLayout.disabledDynamicConnections.slice()
        : [];
      var key = connectionKey(conn);
      if (key && disabled.indexOf(key) < 0) disabled.push(key);
      graphLayout.disabledDynamicConnections = disabled;
    } else {
      var base = Array.isArray(graphLayout.connections)
        ? graphLayout.connections.slice()
        : buildGraphView(gen.design, graphLayout).connections.filter(function(item) { return !item.dynamicVar; });
      graphLayout.connections = base.filter(function(item) {
        return !(item.from === conn.from && item.to === conn.to);
      });
    }
    saveGraphLayoutSoon();
    publishGraph();
    if (gen.design) {
      rebuildOutputsFromDesign(gen.design, { message:'已按当前链路刷新变量卡模块启用状态' });
    }
  }

  function setGraphExpanded(expanded) {
    var graph = mvuStore.get().graph;
    patchMvuStore({ graph: Object.assign({}, graph, { expanded: !!expanded }) });
  }

  var api = {
    refresh: function() { return refreshSync({ force: true }); },
    openInfer: openInfer,
    closeInfer: closeInfer,
    toggleInfer: toggleInfer,
    selectAllInfer: selectAllInfer,
    selectNoneInfer: selectNoneInfer,
    applyInfer: applyInfer,
    addOne: addOne,
    regenVariable: regenVariable,
    deleteVariable: deleteVariable,
    clearAll: clearAllVariables,
    deleteAll: deleteAllVariables,
    exportPack: exportPack,
    setSingleRequirement: setSingleRequirement,
    saveGraphPositions: setGraphPositions,
    setGraphCode: setGraphCode,
    connectGraph: connectGraph,
    removeGraphConnection: removeGraphConnection,
    setGraphExpanded: setGraphExpanded,
    getSnapshot: function() {
      return {
        design: gen.design,
        summary: gen.summary,
        codes: gen.codes,
        cards: cardData,
      };
    },
  };

  window.__applyExternalVariableDesign__ = applyExternalDesign;
  window.__assistantMvuApi__ = {
    clear: function() {
      clearMvuPreview();
      writeExtension(MVU_EXT_KEY, null);
      if (window.__deleteMvuArtifacts__) {
        suppressAutoSyncUntil = Date.now() + 700;
        window.__deleteMvuArtifacts__(mvuArtifactNames());
      } else {
        clearInjectedMvuArtifacts();
      }
      lastSyncFingerprint = '';
      scheduleRefreshSync(true);
      return { cleared: true };
    },
    upsertDesign: function(payload) {
      payload = payload || {};
      return applyExternalDesign({
        design: payload.design || payload,
        source: 'assistant',
        inject: payload.inject === true,
        message: '助手已写入 MVU 设计',
      });
    },
    upsertVariables: function(payload) {
      payload = payload || {};
      return applyExternalDesign({
        design: payload.design || payload,
        source: 'assistant',
        inject: payload.inject !== false,
        message: '助手已注入 MVU 变量卡',
      });
    },
    patchNode: function(opts) {
      opts = opts || {};
      var path = String(opts.path || '').trim();
      if (!path) throw new Error('缺少 path');
      var design = readExtension(MVU_EXT_KEY);
      if (!design || !Array.isArray(design.variables)) throw new Error('当前无 MVU 设计');
      var vars = design.variables.slice();
      var idx = vars.findIndex(function(v) {
        return String((v && (v.path || v.name)) || '') === path;
      });
      if (idx < 0) throw new Error('未找到节点: ' + path);
      vars[idx] = Object.assign({}, vars[idx], opts.patch || {});
      return applyExternalDesign({
        design: Object.assign({}, design, { variables: vars }),
        source: 'assistant',
        inject: opts.inject !== false,
        message: '助手已补丁 MVU 节点 ' + path,
      });
    },
    inferVariables: function() {
      var cardLike = buildCardLike();
      return {
        candidates: inferMvuCandidatesFromCard(cardLike),
        corruptionGap: corruptionProgressGap(cardLike),
      };
    },
  };
  window.__mvuInferApi__ = {
    infer: function(cardLike) { return inferMvuCandidatesFromCard(cardLike || buildCardLike()); },
    gap: function(cardLike) { return corruptionProgressGap(cardLike || buildCardLike()); },
    merge: function(design, candidates, opts) { return mergeCandidatesIntoDesign(design, candidates, opts); },
    buildCardLike: buildCardLike,
    refreshGap: refreshCorruptionGap,
    openPanel: openInfer,
  };
  window.__mvuPanelApi__ = api;

  refreshSync({ force: true });
  setTimeout(function() { refreshSync({ force:true }); }, 600);
  setInterval(function() { refreshSync(); }, 1200);
  clearInterval(gapTimer);
  gapTimer = setInterval(refreshCorruptionGap, 1600);
  refreshCorruptionGap();

  window.addEventListener('worldbook-changed', function() {
    if (Date.now() < suppressAutoSyncUntil) return;
    scheduleRefreshSync(true);
  });
  window.addEventListener('card-builder-data-changed', function() {
    if (Date.now() < suppressAutoSyncUntil) return;
    graphLayout = readGraphLayout();
    publishGraph();
    scheduleRefreshSync(false);
  });
  window.addEventListener('nsfw-config-changed', refreshCorruptionGap);
  window.addEventListener('card-draft-changed', function() {
    graphLayout = readGraphLayout();
    lastSyncFingerprint = '';
    scheduleRefreshSync(true);
    refreshCorruptionGap();
  });
  window.addEventListener('app-view-changed', function(ev) {
    var view = ev && ev.detail && ev.detail.view;
    if (view !== 'mvu') return;
    graphLayout = readGraphLayout();
    refreshSync({ force: true });
  });
  ['charName', 'charDesc', 'firstMes'].forEach(function(id) {
    var el = ctx.$(id);
    if (el) el.addEventListener('input', function() { scheduleRefreshSync(false); });
  });

  var originalTrigger = window.triggerGlobalUpdate;
  window.triggerGlobalUpdate = function() {
    if (originalTrigger) originalTrigger();
    scheduleRefreshSync(true);
  };

  return api;
}
