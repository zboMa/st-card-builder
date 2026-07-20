/**
 * 小说工坊统一状态与流水线门控
 * 本地状态按角色卡 cardId 分桶；导出角色卡不含小说内容
 */

import { DEFAULT_EXPAND_BUDGET } from './recall.mjs';
import {
  idbGetJson,
  idbSetJson,
  idbDeleteJson,
  idbCopyJson,
  idbNovelKey,
} from '../idbStore.mjs';

/** 旧全局键（仅迁移用，读写请用桶键） */
export var NOVEL_STORAGE_KEY = 'novelWorkshopV3';
/** 分桶前缀：`novelWorkshopV3:card:{cardId}` */
export var NOVEL_BUCKET_PREFIX = 'novelWorkshopV3:card:';
export var NOVEL_V2_STORAGE_KEY = 'novelWorkshopV2';

/** 侧栏小说模块（主路径分析；人物/世界书为结果列表，旧扫描/抽取为降级） */
export var NOVEL_VIEWS = [
  'novel-source',
  'novel-chapters',
  'novel-character-setup',
  'novel-greetings',
  'novel-analyze',
  'novel-characters',
  'novel-worldbook',
  'novel-style',
];

export var WB_FOCUS_OPTIONS = [
  { id: 'worldview', label: '世界观' },
  { id: 'faction', label: '势力' },
  { id: 'location', label: '地点' },
  { id: 'setting', label: '设定' },
  { id: 'history', label: '历史' },
  { id: 'item', label: '重要物品' },
  { id: 'event', label: '事件' },
];

/** 分片字数可选项（拆章 / 人物 / 世界书 / 文风各自选用） */
export var CHUNK_SIZE_OPTIONS = [
  { value: 4000, label: '4,000 字' },
  { value: 8000, label: '8,000 字' },
  { value: 12000, label: '12,000 字' },
  { value: 16000, label: '16,000 字' },
  { value: 24000, label: '24,000 字' },
  { value: 32000, label: '32,000 字' },
  { value: 48000, label: '48,000 字' },
  { value: 64000, label: '64,000 字' },
];

/** @returns {object} */
export function createDefaultNovelState() {
  return {
    sourceText: '',
    fileText: '',
    fileMeta: null,
    contextText: '',
    narrativeMode: 'story',
    // 拆章分片；人物/世界书/文风各自独立
    chunkSize: 8000,
    // 人物/世界书：chars=按字数（默认），chapters=按章节
    charShardMode: 'chars',
    wbShardMode: 'chars',
    charChunkSize: 8000,
    wbChunkSize: 8000,
    charChaptersPerShard: 1,
    wbChaptersPerShard: 1,
    styleChunkSize: 16000,
    concurrency: 3,
    strictQuality: false,
    expandBudget: DEFAULT_EXPAND_BUDGET,
    chapterSplitMode: 'title',
    chapters: [],
    // 小说「角色设定」生成（view: novel-character-setup）
    setupCharName: '',
    setupRangeMode: 'chars',
    setupCharLimit: 16000,
    setupChapterCount: 3,
    // 小说「开场白」生成（view: novel-greetings）
    greetCharName: '',
    greetRangeMode: 'chars',
    greetCharLimit: 16000,
    greetChapterCount: 3,
    greetCount: 3,
    characters: [],
    scanWithIdentity: false,
    splitByStage: false,
    // 兼容旧桶；界面不再编辑，导出/打包用角色设定 wbName
    wbName: '',
    includeAdult: false, // 与 adultMode 同步（兼容旧字段）
    /** 全局 NSFW（原始资料·全局配置唯一入口） */
    adultMode: false,
    /** 全局 NTL：禁忌张力层，与 NSFW 解耦可叠加 */
    ntlMode: false,
    /** NTL 禁忌类型 id 列表（兼容；等于 ntlTabooItems[].id） */
    ntlTabooTypes: [],
    /** NTL 禁忌多选：[{ id, note }] */
    ntlTabooItems: [],
    /** NSFW 主口味 id（兼容旧字段；等于 nsfwFlavorItems[0].id） */
    nsfwFlavor: '',
    /** NSFW 口味多选：[{ id, note }]，最多 5；首项为主调色盘 */
    nsfwFlavorItems: [],
    wbFocus: WB_FOCUS_OPTIONS.map(function(o) { return o.id; }),
    wbEntries: [],
    // 统一知识库（主路径）
    entities: [],
    relations: [],
    analyzeShardMode: 'chars',
    analyzeChunkSize: 8000,
    analyzeChaptersPerShard: 1,
    analyzeIncludeAdult: false, // 与 adultMode 同步
    rag: {
      enabled: true,
      budget: 12000,
      indexStatus: 'idle',
      indexUpdatedAt: '',
      chunkCount: 0,
      embedModel: '',
      sourceFingerprint: '', // 建索引时章节指纹，用于过期检测
    },
    // 分析失败片（骨架/丰满），供「仅重跑失败」
    failedShards: [],
    // 知识图谱（由实体投影；旧一体分析亦可写入）
    knowledgeGraph: { nodes: [], edges: [], updatedAt: '' },
    graphShardMode: 'chars',
    graphChunkSize: 8000,
    graphChaptersPerShard: 1,
    graphIncludeAdult: false,
    styleText: '',
    styleIncludeNSFW: false, // 与 adultMode 同步
    styleCustomReq: '',
    styleSyncStatus: 'unsynced',
    conflictPolicy: 'merge',
    charTasks: [],
    wbTasks: [],
  };
}

/** 合并持久化数据，兼容 V2 字段 */
export function hydrateNovelState(raw) {
  var base = createDefaultNovelState();
  if (!raw || typeof raw !== 'object') return base;
  Object.keys(base).forEach(function(k) {
    if (raw[k] !== undefined) base[k] = raw[k];
  });
  // V2 兼容：旧 focus → 非人物 wbFocus
  if (Array.isArray(raw.focus) && (!raw.wbFocus || !raw.wbFocus.length)) {
    base.wbFocus = raw.focus.filter(function(f) {
      return f !== 'character' && f !== 'relation' && f !== 'event' && f !== 'rule';
    });
    if (raw.focus.indexOf('rule') >= 0 && base.wbFocus.indexOf('setting') < 0) base.wbFocus.push('setting');
  }
  if (typeof raw.expandBudget !== 'number' || raw.expandBudget < 1000) {
    base.expandBudget = DEFAULT_EXPAND_BUDGET;
  }
  // 旧版仅有全局 chunkSize：补齐各模块分片默认
  if (raw.charChunkSize == null && raw.chunkSize != null) base.charChunkSize = raw.chunkSize;
  if (raw.wbChunkSize == null && raw.chunkSize != null) base.wbChunkSize = raw.chunkSize;
  if (raw.styleChunkSize == null && raw.chunkSize != null) {
    base.styleChunkSize = Math.min(64000, Math.max(4000, Number(raw.chunkSize) * 2 || 16000));
  }
  // 分片方式兜底
  if (base.charShardMode !== 'chapters') base.charShardMode = 'chars';
  if (base.wbShardMode !== 'chapters') base.wbShardMode = 'chars';
  if (base.graphShardMode !== 'chapters') base.graphShardMode = 'chars';
  if (base.analyzeShardMode !== 'chapters') base.analyzeShardMode = 'chars';
  if (base.setupRangeMode !== 'chapters') base.setupRangeMode = 'chars';
  if (base.greetRangeMode !== 'chapters') base.greetRangeMode = 'chars';
  base.charChaptersPerShard = Math.max(1, Math.floor(Number(base.charChaptersPerShard) || 1));
  base.wbChaptersPerShard = Math.max(1, Math.floor(Number(base.wbChaptersPerShard) || 1));
  base.graphChaptersPerShard = Math.max(1, Math.floor(Number(base.graphChaptersPerShard) || 1));
  base.analyzeChaptersPerShard = Math.max(1, Math.floor(Number(base.analyzeChaptersPerShard) || 1));
  base.graphChunkSize = Math.max(1000, Math.floor(Number(base.graphChunkSize) || 8000));
  base.analyzeChunkSize = Math.max(1000, Math.floor(Number(base.analyzeChunkSize) || 8000));
  if (!Array.isArray(base.entities)) base.entities = [];
  if (!Array.isArray(base.relations)) base.relations = [];
  if (!base.rag || typeof base.rag !== 'object') {
    base.rag = {
      enabled: true,
      budget: 12000,
      indexStatus: 'idle',
      indexUpdatedAt: '',
      chunkCount: 0,
      embedModel: '',
      sourceFingerprint: '',
    };
  } else {
    base.rag.enabled = base.rag.enabled !== false;
    base.rag.budget = Math.max(2000, Math.floor(Number(base.rag.budget) || 12000));
    base.rag.indexStatus = base.rag.indexStatus || 'idle';
    base.rag.chunkCount = Math.max(0, Math.floor(Number(base.rag.chunkCount) || 0));
    base.rag.sourceFingerprint = String(base.rag.sourceFingerprint || '');
  }
  if (!Array.isArray(base.failedShards)) base.failedShards = [];
  // NSFW：显式 adultMode 优先；旧桶用任一子开关推断
  if (raw.adultMode != null) {
    base.adultMode = !!raw.adultMode;
  } else {
    base.adultMode = !!(base.analyzeIncludeAdult || base.includeAdult || base.styleIncludeNSFW);
  }
  base.analyzeIncludeAdult = !!base.adultMode;
  base.includeAdult = !!base.adultMode;
  base.styleIncludeNSFW = !!base.adultMode;
  base.ntlMode = !!base.ntlMode;
  if (!Array.isArray(base.ntlTabooTypes)) base.ntlTabooTypes = [];
  if (!Array.isArray(base.ntlTabooItems)) base.ntlTabooItems = [];
  if (!base.ntlTabooItems.length && base.ntlTabooTypes.length) {
    base.ntlTabooItems = base.ntlTabooTypes.map(function(id) { return { id: id, note: '' }; });
  }
  if (base.ntlTabooItems.length && !base.ntlTabooTypes.length) {
    base.ntlTabooTypes = base.ntlTabooItems.map(function(it) { return it && it.id; }).filter(Boolean);
  }
  if (typeof base.nsfwFlavor !== 'string') base.nsfwFlavor = '';
  if (!Array.isArray(base.nsfwFlavorItems)) base.nsfwFlavorItems = [];
  // 旧桶仅有 nsfwFlavor：迁入 items
  if (!base.nsfwFlavorItems.length && base.nsfwFlavor) {
    base.nsfwFlavorItems = [{ id: base.nsfwFlavor, note: '' }];
  }
  if (base.nsfwFlavorItems.length && !base.nsfwFlavor) {
    base.nsfwFlavor = String(base.nsfwFlavorItems[0].id || '');
  }
  if (!base.knowledgeGraph || typeof base.knowledgeGraph !== 'object') {
    base.knowledgeGraph = { nodes: [], edges: [], updatedAt: '' };
  }
  if (!Array.isArray(base.knowledgeGraph.nodes)) base.knowledgeGraph.nodes = [];
  if (!Array.isArray(base.knowledgeGraph.edges)) base.knowledgeGraph.edges = [];
  base.setupChapterCount = Math.max(1, Math.floor(Number(base.setupChapterCount) || 3));
  base.greetChapterCount = Math.max(1, Math.floor(Number(base.greetChapterCount) || 3));
  base.setupCharLimit = Math.max(1000, Math.floor(Number(base.setupCharLimit) || 16000));
  base.greetCharLimit = Math.max(1000, Math.floor(Number(base.greetCharLimit) || 16000));
  base.greetCount = Math.max(1, Math.min(12, Math.floor(Number(base.greetCount) || 3)));
  return base;
}

/** 全文（文件 + 手动补充） */
export function getFullSourceText(state) {
  return String((state && state.fileText) || '').trim()
    + (state && state.sourceText ? ('\n' + String(state.sourceText)) : '');
}

/**
 * 流水线门控
 * @returns {{ hasSource: boolean, hasChapters: boolean, canExtract: boolean, reasons: string[] }}
 */
export function getPipelineGates(state) {
  var full = getFullSourceText(state).trim();
  var hasSource = full.length > 0;
  var enabledCh = (state.chapters || []).filter(function(c) { return c.enabled !== false; });
  var hasChapters = enabledCh.length > 0;
  var reasons = [];
  if (!hasSource) reasons.push('请先在「原始资料」导入或粘贴小说文本');
  else if (!hasChapters) reasons.push('请先在「拆章」生成并启用章节');
  return {
    hasSource: hasSource,
    hasChapters: hasChapters,
    canExtract: hasSource && hasChapters,
    reasons: reasons,
    sourceLen: full.length,
    chapterCount: (state.chapters || []).length,
    enabledChapterCount: enabledCh.length,
    characterCount: (state.characters || []).length,
    wbEntryCount: (state.wbEntries || []).length,
    hasStyle: !!(state.styleText && String(state.styleText).trim()),
  };
}

/** 按类型统计实体数 */
function entityCountsByType(entities) {
  var counts = {
    person: 0, faction: 0, location: 0, item: 0, event: 0, lore: 0, nsfw: 0,
  };
  (entities || []).forEach(function(e) {
    if (!e) return;
    if (counts[e.type] != null) counts[e.type]++;
    else counts.lore++;
  });
  return counts;
}

/** 助手/UI 用摘要 */
export function summarizeNovelState(state) {
  var g = getPipelineGates(state);
  var entityCounts = entityCountsByType(state && state.entities);
  return {
    available: true,
    views: NOVEL_VIEWS.slice(),
    sourceLen: g.sourceLen,
    contextLen: String((state && state.contextText) || '').length,
    narrativeMode: state.narrativeMode,
    expandBudget: state.expandBudget,
    chapterCount: g.chapterCount,
    enabledChapterCount: g.enabledChapterCount,
    characterCount: g.characterCount,
    expandedCount: (state.characters || []).filter(function(c) { return c.profile; }).length,
    wbEntryCount: g.wbEntryCount,
    entityCount: ((state && state.entities) || []).length,
    entityCounts: entityCounts,
    relationCount: ((state && state.relations) || []).length,
    failedShardCount: ((state && state.failedShards) || []).length,
    graphNodeCount: ((state.knowledgeGraph && state.knowledgeGraph.nodes) || []).length,
    graphEdgeCount: ((state.knowledgeGraph && state.knowledgeGraph.edges) || []).length,
    rag: state && state.rag ? {
      enabled: state.rag.enabled !== false,
      budget: state.rag.budget || 12000,
      indexStatus: state.rag.indexStatus || 'idle',
      chunkCount: state.rag.chunkCount || 0,
      stale: false, // 调用方可用指纹再判；摘要默认 false
    } : null,
    hasStyle: g.hasStyle,
    conflictPolicy: state.conflictPolicy,
    adultMode: !!(state && state.adultMode),
    ntlMode: !!(state && state.ntlMode),
    canExtract: g.canExtract,
    gates: g,
  };
}

/** 分桶 localStorage 键 */
export function novelBucketKey(cardId) {
  var id = String(cardId || '').trim();
  if (!id) return '';
  return NOVEL_BUCKET_PREFIX + id;
}

/** 桶/旧全局是否有实质内容（避免空对象误迁） */
export function novelStateHasContent(raw) {
  if (!raw || typeof raw !== 'object') return false;
  if (getFullSourceText(raw).trim()) return true;
  if (Array.isArray(raw.chapters) && raw.chapters.length) return true;
  if (Array.isArray(raw.characters) && raw.characters.length) return true;
  if (Array.isArray(raw.wbEntries) && raw.wbEntries.length) return true;
  if (Array.isArray(raw.entities) && raw.entities.length) return true;
  if (raw.knowledgeGraph && (
    (Array.isArray(raw.knowledgeGraph.nodes) && raw.knowledgeGraph.nodes.length)
    || (Array.isArray(raw.knowledgeGraph.edges) && raw.knowledgeGraph.edges.length)
  )) return true;
  if (raw.styleText && String(raw.styleText).trim()) return true;
  if (raw.contextText && String(raw.contextText).trim()) return true;
  return false;
}

/**
 * 从 storage-like 读取某卡桶（不做迁移）
 * @param {{ getItem: Function }} storage
 */
export function readNovelBucket(storage, cardId) {
  var key = novelBucketKey(cardId);
  if (!key || !storage || typeof storage.getItem !== 'function') return null;
  try {
    return JSON.parse(storage.getItem(key) || 'null');
  } catch (e) {
    return null;
  }
}

/**
 * 写入某卡桶
 * @param {{ setItem: Function }} storage
 */
export function writeNovelBucket(storage, cardId, state) {
  var key = novelBucketKey(cardId);
  if (!key || !storage || typeof storage.setItem !== 'function') return false;
  try {
    storage.setItem(key, JSON.stringify(state || createDefaultNovelState()));
    return true;
  } catch (e) {
    return false;
  }
}

/** 删除某卡桶（删卡时清理） */
export function removeNovelBucket(storage, cardId) {
  var key = novelBucketKey(cardId);
  if (!key || !storage || typeof storage.removeItem !== 'function') return;
  try { storage.removeItem(key); } catch (e) { console.warn('Removing novel bucket from storage failed', e); }
}

/**
 * 复制桶（复制角色卡时绑定本地小说草稿）
 * @returns {boolean} 是否写入了目标桶
 */
export function copyNovelBucket(storage, fromCardId, toCardId) {
  if (!toCardId || fromCardId === toCardId) return false;
  var raw = readNovelBucket(storage, fromCardId);
  if (!novelStateHasContent(raw)) return false;
  return writeNovelBucket(storage, toCardId, hydrateNovelState(raw));
}

/**
 * 加载卡对应桶；必要时将旧全局 V3（及空桶时的 V2 源文本）迁入当前 cardId
 * 导入角色卡不会触发此迁移（仅本地编辑绑定）
 * @param {{ getItem: Function, setItem: Function, removeItem?: Function }} storage
 * @returns {{ state: object, migrated: boolean, from: string|null }}
 */
export function loadNovelStateForCard(storage, cardId) {
  var id = String(cardId || '').trim();
  var bucketRaw = id ? readNovelBucket(storage, id) : null;
  // 已有桶（含空状态）则以桶为准，避免导入/切卡时误绑旧全局
  if (bucketRaw != null && typeof bucketRaw === 'object') {
    return { state: hydrateNovelState(bucketRaw), migrated: false, from: null };
  }

  var migrated = false;
  var from = null;
  var state = createDefaultNovelState();

  // 旧全局 V3 → 当前卡（仅目标桶尚不存在时）
  if (id && storage && typeof storage.getItem === 'function') {
    try {
      var legacy = JSON.parse(storage.getItem(NOVEL_STORAGE_KEY) || 'null');
      if (novelStateHasContent(legacy)) {
        state = hydrateNovelState(legacy);
        migrated = true;
        from = NOVEL_STORAGE_KEY;
        writeNovelBucket(storage, id, state);
        if (typeof storage.removeItem === 'function') storage.removeItem(NOVEL_STORAGE_KEY);
      }
    } catch (e) { console.warn('Migrating legacy novel data failed', e); }
  }

  // V2 源文本兜底（桶与全局 V3 皆空时）
  if (!novelStateHasContent(state) && storage && typeof storage.getItem === 'function') {
    try {
      var v2 = JSON.parse(storage.getItem(NOVEL_V2_STORAGE_KEY) || 'null');
      if (v2 && (v2.sourceText || v2.contextText)) {
        state.sourceText = v2.sourceText || '';
        state.contextText = v2.contextText || '';
        state.narrativeMode = v2.narrativeMode || state.narrativeMode;
        state.chunkSize = v2.chunkSize || state.chunkSize;
        state.concurrency = v2.concurrency || state.concurrency;
        if (id) {
          writeNovelBucket(storage, id, state);
          migrated = true;
          from = from || NOVEL_V2_STORAGE_KEY;
        }
      }
    } catch (e) { console.warn('Migrating V2 novel data failed', e); }
  }

  // 新卡写空桶，标记「已绑定」以免后续误迁全局
  if (id && !migrated) writeNovelBucket(storage, id, state);

  return { state: state, migrated: migrated, from: from };
}

// ── IndexedDB 桶（大文本 / 全状态；键与 novelBucketKey 一致便于迁移） ──

/** 从 IndexedDB 读取小说桶 */
export async function readNovelBucketIdb(cardId) {
  var key = idbNovelKey(cardId);
  if (!key) return null;
  try {
    return await idbGetJson(key);
  } catch (e) {
    return null;
  }
}

/** 写入 IndexedDB 小说桶 */
export async function writeNovelBucketIdb(cardId, state) {
  var key = idbNovelKey(cardId);
  if (!key) return false;
  try {
    await idbSetJson(key, state || createDefaultNovelState());
    return true;
  } catch (e) {
    return false;
  }
}

/** 删除 IDB 桶并清理 localStorage 同名键（删卡） */
export async function removeNovelBucketIdb(cardId, lsStorage) {
  var key = idbNovelKey(cardId);
  if (key) {
    try { await idbDeleteJson(key); } catch (e) { console.warn('Deleting novel bucket from IDB failed', e); }
  }
  removeNovelBucket(lsStorage, cardId);
}

/** 复制小说桶（IDB 优先，回退 localStorage） */
export async function copyNovelBucketIdb(fromCardId, toCardId, lsStorage) {
  if (!toCardId || fromCardId === toCardId) return false;
  var fromKey = idbNovelKey(fromCardId);
  var toKey = idbNovelKey(toCardId);
  if (fromKey && toKey) {
    try {
      if (await idbCopyJson(fromKey, toKey)) return true;
    } catch (e) { console.warn('Copying novel bucket in IDB failed', e); }
  }
  var raw = readNovelBucket(lsStorage, fromCardId);
  if (!novelStateHasContent(raw)) return false;
  return writeNovelBucketIdb(toCardId, hydrateNovelState(raw));
}

/**
 * 加载卡对应桶：IndexedDB 优先，localStorage / 旧全局 V3 / V2 迁入 IDB
 * @param {string} cardId
 * @param {{ getItem: Function, setItem?: Function, removeItem?: Function }} lsStorage
 */
export async function loadNovelStateForCardIdb(cardId, lsStorage) {
  var id = String(cardId || '').trim();

  var idbRaw = id ? await readNovelBucketIdb(id) : null;
  if (idbRaw != null && typeof idbRaw === 'object') {
    return { state: hydrateNovelState(idbRaw), migrated: false, from: 'idb' };
  }

  var bucketRaw = id ? readNovelBucket(lsStorage, id) : null;
  if (bucketRaw != null && typeof bucketRaw === 'object') {
    await writeNovelBucketIdb(id, bucketRaw);
    removeNovelBucket(lsStorage, id);
    return { state: hydrateNovelState(bucketRaw), migrated: true, from: 'localStorage_bucket' };
  }

  var migrated = false;
  var from = null;
  var state = createDefaultNovelState();

  if (id && lsStorage && typeof lsStorage.getItem === 'function') {
    try {
      var legacy = JSON.parse(lsStorage.getItem(NOVEL_STORAGE_KEY) || 'null');
      if (novelStateHasContent(legacy)) {
        state = hydrateNovelState(legacy);
        migrated = true;
        from = NOVEL_STORAGE_KEY;
        await writeNovelBucketIdb(id, state);
        if (typeof lsStorage.removeItem === 'function') lsStorage.removeItem(NOVEL_STORAGE_KEY);
      }
    } catch (e) { console.warn('Migrating legacy novel data to IDB failed', e); }
  }

  if (!novelStateHasContent(state) && lsStorage && typeof lsStorage.getItem === 'function') {
    try {
      var v2 = JSON.parse(lsStorage.getItem(NOVEL_V2_STORAGE_KEY) || 'null');
      if (v2 && (v2.sourceText || v2.contextText)) {
        state.sourceText = v2.sourceText || '';
        state.contextText = v2.contextText || '';
        state.narrativeMode = v2.narrativeMode || state.narrativeMode;
        state.chunkSize = v2.chunkSize || state.chunkSize;
        state.concurrency = v2.concurrency || state.concurrency;
        if (id) {
          await writeNovelBucketIdb(id, state);
          migrated = true;
          from = from || NOVEL_V2_STORAGE_KEY;
        }
      }
    } catch (e) { console.warn('Migrating V2 novel data to IDB failed', e); }
  }

  if (id && !migrated) await writeNovelBucketIdb(id, state);

  return { state: state, migrated: migrated, from: from };
}
