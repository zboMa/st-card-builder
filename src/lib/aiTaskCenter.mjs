/**
 * 全局 AI 任务中心：统一登记、进度、AbortController 取消
 */

/** @typedef {'queued'|'running'|'success'|'failed'|'cancelled'} TaskStatus */

/** 常见 AI 任务类型（便于列表展示与测试契约） */
export const AI_TASK_TYPES = Object.freeze({
  wb_single: '世界书单条生成',
  wb_organize: '世界书智能整理',
  wb_keygen: '世界书补全触发词',
  wb_rewrite: '世界书重写',
  wb_expand: '世界书扩写',
  engine_generate: 'AI 引擎一键生成',
  char_tags_generate: '角色标签 AI 生成',
  assistant_react: 'AI 助手 ReAct',
  novel_char_scan: '人物扫描',
  novel_char_expand: '人物 AI 扩展',
  novel_wb_extract: '世界书条目抽取',
  novel_wb_expand: '世界书条目 AI 扩展',
  novel_rag_index: '小说向量索引',
  novel_analyze_skeleton: '小说分析·骨架',
  novel_analyze_enrich: '小说分析·丰满',
  novel_analyze_relations: '小说分析·关系',
  novel_style: '文风蒸馏',
  novel_char_setup: '小说角色设定生成',
  novel_greetings: '小说开场白生成',
  story_outline: '小说创作·大纲',
  story_chapter: '小说创作·章文',
  chat_reply: '角色试聊',
  auditor: '世界书内容监测',
  mvu_generate: 'MVU 变量卡生成',
  statusbar_generate: '状态栏变量设计生成',
  statusbar_char_scan: '状态栏人物识别',
  statusbar_custom_layout: '状态栏自定义排版',
  other: '其它 AI 任务',
});

export const TASK_STATUS = Object.freeze({
  queued: 'queued',
  running: 'running',
  success: 'success',
  failed: 'failed',
  cancelled: 'cancelled',
});

var ACTIVE = { queued: 1, running: 1 };

function now() {
  return Date.now();
}

function uid() {
  return 'ait_' + now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/** 是否为 Abort / 用户取消类错误 */
export function isAbortError(err) {
  if (!err) return false;
  if (err.name === 'AbortError') return true;
  var msg = String(err.message || err || '');
  return /abort|取消|已停止|The user aborted/i.test(msg);
}

/**
 * @param {{ onChange?: (snap: object) => void }} [options]
 */
export function createAiTaskCenter(options) {
  var opts = options || {};
  /** @type {Map<string, object>} */
  var tasks = new Map();
  var listeners = [];
  if (typeof opts.onChange === 'function') listeners.push(opts.onChange);

  function snapshot() {
    var list = Array.from(tasks.values()).map(function(t) {
      return {
        id: t.id,
        type: t.type,
        typeLabel: t.typeLabel,
        title: t.title,
        target: t.target,
        status: t.status,
        progress: t.progress,
        progressText: t.progressText,
        error: t.error,
        createdAt: t.createdAt,
        startedAt: t.startedAt,
        endedAt: t.endedAt,
      };
    });
    // 进行中置顶，其次排队，再按创建时间倒序
    list.sort(function(a, b) {
      var rank = function(s) {
        if (s === 'running') return 0;
        if (s === 'queued') return 1;
        return 2;
      };
      var d = rank(a.status) - rank(b.status);
      if (d !== 0) return d;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    var total = list.length;
    var completed = list.filter(function(t) {
      return t.status === 'success' || t.status === 'failed' || t.status === 'cancelled';
    }).length;
    var running = list.filter(function(t) { return t.status === 'running'; }).length;
    var active = list.filter(function(t) { return ACTIVE[t.status]; }).length;
    return {
      tasks: list,
      total: total,
      completed: completed,
      running: running,
      active: active,
      label: completed + '/' + total,
    };
  }

  function emit() {
    var snap = snapshot();
    listeners.forEach(function(fn) {
      try { fn(snap); } catch (e) { console.warn('Listener notification failed', e); }
    });
    return snap;
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return function() {};
    listeners.push(fn);
    return function() {
      listeners = listeners.filter(function(x) { return x !== fn; });
    };
  }

  /**
   * 登记任务（默认 queued，带 AbortController）
   * @param {{ type?: string, title?: string, target?: string, autoStart?: boolean }} meta
   */
  function create(meta) {
    var m = meta || {};
    var type = m.type || 'other';
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var task = {
      id: uid(),
      type: type,
      typeLabel: AI_TASK_TYPES[type] || AI_TASK_TYPES.other,
      title: m.title || AI_TASK_TYPES[type] || 'AI 任务',
      target: m.target || '',
      status: TASK_STATUS.queued,
      progress: null,
      progressText: '',
      error: '',
      createdAt: now(),
      startedAt: null,
      endedAt: null,
      controller: controller,
      signal: controller ? controller.signal : undefined,
    };
    tasks.set(task.id, task);
    if (m.autoStart !== false) start(task.id);
    else emit();
    return task;
  }

  function get(id) {
    return tasks.get(id) || null;
  }

  function start(id) {
    var t = tasks.get(id);
    if (!t || (t.status !== 'queued' && t.status !== 'running')) return false;
    t.status = TASK_STATUS.running;
    if (!t.startedAt) t.startedAt = now();
    emit();
    return true;
  }

  function setProgress(id, progress, text) {
    var t = tasks.get(id);
    if (!t || !ACTIVE[t.status]) return false;
    if (progress != null && Number.isFinite(Number(progress))) {
      t.progress = Math.max(0, Math.min(1, Number(progress)));
    }
    if (text != null) t.progressText = String(text);
    emit();
    return true;
  }

  function succeed(id) {
    var t = tasks.get(id);
    if (!t || !ACTIVE[t.status]) return false;
    t.status = TASK_STATUS.success;
    t.endedAt = now();
    t.progress = 1;
    emit();
    return true;
  }

  function fail(id, error) {
    var t = tasks.get(id);
    if (!t || !ACTIVE[t.status]) return false;
    t.status = TASK_STATUS.failed;
    t.endedAt = now();
    t.error = error ? String(error.message || error) : '失败';
    emit();
    return true;
  }

  function cancel(id) {
    var t = tasks.get(id);
    if (!t || !ACTIVE[t.status]) return false;
    t.status = TASK_STATUS.cancelled;
    t.endedAt = now();
    t.error = t.error || '已取消';
    try {
      if (t.controller) t.controller.abort();
    } catch (e) { console.warn('Task controller abort failed', e); }
    emit();
    return true;
  }

  function cancelAllRunning() {
    var n = 0;
    Array.from(tasks.keys()).forEach(function(id) {
      var t = tasks.get(id);
      if (t && ACTIVE[t.status]) {
        if (cancel(id)) n++;
      }
    });
    return n;
  }

  function clearFinished() {
    var removed = 0;
    Array.from(tasks.entries()).forEach(function(pair) {
      var id = pair[0];
      var t = pair[1];
      if (t.status === 'success' || t.status === 'failed' || t.status === 'cancelled') {
        tasks.delete(id);
        removed++;
      }
    });
    emit();
    return removed;
  }

  /**
   * 包装异步 AI：自动登记 / 成功 / 失败 / 取消
   * @param {{ type?: string, title?: string, target?: string }} meta
   * @param {(task: object) => Promise<any>} fn
   */
  async function run(meta, fn) {
    var task = create(Object.assign({}, meta, { autoStart: true }));
    try {
      var result = await fn(task);
      if (task.status === 'cancelled') {
        var cancelled = new Error('已取消');
        cancelled.name = 'AbortError';
        throw cancelled;
      }
      succeed(task.id);
      return result;
    } catch (err) {
      if (task.status === 'cancelled' || isAbortError(err)) {
        if (task.status !== 'cancelled') cancel(task.id);
        throw err;
      }
      fail(task.id, err);
      throw err;
    }
  }

  return {
    AI_TASK_TYPES: AI_TASK_TYPES,
    TASK_STATUS: TASK_STATUS,
    create: create,
    get: get,
    start: start,
    setProgress: setProgress,
    succeed: succeed,
    fail: fail,
    cancel: cancel,
    cancelAllRunning: cancelAllRunning,
    clearFinished: clearFinished,
    snapshot: snapshot,
    subscribe: subscribe,
    run: run,
    isAbortError: isAbortError,
  };
}
