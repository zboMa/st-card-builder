/**
 * 小说创作模块控制器：状态桥 + AI + 五视图渲染
 */

import {
  normalizeNovel,
  createEmptyNovel,
  genStoryId,
  upsertCatalogEntry,
  removeCatalogEntry,
  discardOutlineFrom,
  syncChaptersFromOutline,
  getActiveChapters,
  getActiveOutline,
} from './state.mjs';
import {
  loadCatalog,
  saveCatalog,
  loadNovel,
  saveNovel,
  deleteNovel,
  loadActiveNovelId,
  saveActiveNovelId,
  saveRelease,
  deleteRelease,
} from './idb.mjs';
import { downloadNovelTxt } from './exportTxt.mjs';
import { seedGraphFromCard, mergeGraphSeed } from './graphSeed.mjs';
import { detectMvuStatusBarDesign, trySyncAfterChapter } from './mvuHook.mjs';
import {
  buildOutlineUserPrompt,
  graphBriefFromNovel,
  parseOutlineAiText,
  CHILD_SAFETY_RULE,
} from './prompts.mjs';
import {
  bumpNovelVersion,
  buildDisplayVersion,
  buildReleasePayload,
  normalizeCharacterVersion,
} from './version.mjs';
import {
  apiCreateNovelShare,
  apiDeleteNovelShare,
  buildLocalShareUrl,
} from './shareClient.mjs';
import { DRAFTS_KEY, CURRENT_KEY } from '../card-builder/state.mjs';
import {
  forkBranchFromChapter,
  setActiveBranch,
  resolveBranchLedger,
  branchBrief,
  getBranch,
  buildBranchTree,
  patchBranch,
  validatePublishReady,
  BRANCH_KIND_ENDING,
} from './branch.mjs';
import { createLedgerItem } from './plotLedger.mjs';
import { listChapterCheckpoints, restoreChapterCheckpoint } from './checkpoint.mjs';
import { tensionCurveFromChapters } from './quality.mjs';
import { runChapterWritePipeline, WRITE_STEPS } from './writePipeline.mjs';
import { collectFeedForwardsBefore } from './feedForward.mjs';

var state = {
  cardId: '',
  catalog: [],
  novel: null,
  status: '',
  busy: false,
};

function $(id) {
  return document.getElementById(id);
}

function setStatus(msg) {
  state.status = String(msg || '');
  ['ssManageStatus', 'ssGraphStatus', 'ssOutlineStatus', 'ssWriteStatus', 'ssReadStatus'].forEach(function(id) {
    var el = $(id);
    if (!el) return;
    el.textContent = state.status;
    if (id === 'ssManageStatus') {
      if (state.status) {
        el.hidden = false;
        el.style.display = '';
      } else {
        el.hidden = true;
      }
    }
  });
}

function getCardId() {
  try {
    var id = localStorage.getItem('st_v3_builder_current_id');
    if (id) return id;
  } catch (e) { /* ignore */ }
  return state.cardId || 'default';
}

function getCardSeed() {
  var charName = '';
  var charDesc = '';
  var wb = [];
  try {
    var nameEl = $('charName');
    var descEl = $('charDesc');
    if (nameEl) charName = nameEl.value || '';
    if (descEl) charDesc = descEl.value || '';
  } catch (e) { /* ignore */ }
  if (window.__getWorldbookEntries__) {
    try { wb = window.__getWorldbookEntries__() || []; } catch (e2) { wb = []; }
  }
  return { charName: charName, charDesc: charDesc, worldbookEntries: wb };
}

function promptText(id, fallback) {
  if (window.__promptStore__ && window.__promptStore__.get) {
    var t = window.__promptStore__.get(id);
    if (t) return t;
  }
  return fallback || '';
}

async function callAI(userContent, systemExtra, signal) {
  var apiUrlEl = $('apiUrl');
  var apiKeyEl = $('apiKey');
  var modelEl = $('modelSelect');
  if (!apiUrlEl || !modelEl || !modelEl.value) throw new Error('未配置 AI 模型（请先到「AI 配置」）');
  var messages = [];
  if (systemExtra) messages.push({ role: 'system', content: systemExtra });
  messages.push({ role: 'user', content: userContent });
  var res = await fetch(String(apiUrlEl.value).replace(/\/$/, '') + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (apiKeyEl ? apiKeyEl.value.trim() : ''),
    },
    body: JSON.stringify({ model: modelEl.value, messages: messages, temperature: 0.7 }),
    signal: signal,
  });
  if (!res.ok) throw new Error(res.status === 429 ? '429 限流' : 'HTTP ' + res.status);
  var data = await res.json();
  var text = data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : '';
  text = String(text || '').trim();
  if (!text) throw new Error('模型返回空内容');
  return text;
}

function runTracked(meta, fn) {
  var center = window.__aiTaskCenter__;
  if (center && typeof center.run === 'function') return center.run(meta, fn);
  return fn({ signal: undefined, id: null });
}

function isAbort(err) {
  if (window.__isAiAbortError__) return window.__isAiAbortError__(err);
  return !!(err && (err.name === 'AbortError' || /abort|取消/i.test(String(err.message || ''))));
}

function getCharacterVersion() {
  try {
    var el = $('characterVersion');
    if (el && String(el.value || '').trim()) {
      return normalizeCharacterVersion(el.value);
    }
  } catch (e) { /* ignore */ }
  try {
    var id = localStorage.getItem(CURRENT_KEY);
    var drafts = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}') || {};
    var d = id && drafts[id];
    if (d && d.characterVersion) return normalizeCharacterVersion(d.characterVersion);
  } catch (e2) { /* ignore */ }
  return '1.0';
}

async function mirrorStoryDocs(cardId, novel, catalog) {
  try {
    var mod = await import('../sync/storyMirror.mjs');
    if (catalog) await mod.mirrorCatalogToPouch(cardId, catalog);
    if (novel) {
      await mod.mirrorNovelToPouch(cardId, novel);
      await mod.mirrorActiveToPouch(cardId, novel.id);
    }
  } catch (e) {
    console.warn('[storyStudio] pouch mirror', e);
  }
}

async function persistNovel() {
  if (!state.novel) return;
  var cardId = getCardId();
  state.novel.cardId = cardId;
  state.novel.updatedAt = Date.now();
  state.novel = normalizeNovel(state.novel);
  await saveNovel(cardId, state.novel.id, state.novel);
  state.catalog = upsertCatalogEntry(state.catalog, state.novel);
  await saveCatalog(cardId, state.catalog);
  await saveActiveNovelId(cardId, state.novel.id);
  await mirrorStoryDocs(cardId, state.novel, state.catalog);
}

async function reloadCatalog() {
  var cardId = getCardId();
  state.cardId = cardId;
  // Story 与卡开包独立：进入创作时再拉云端目录
  try {
    var sync = await import('../sync/index.mjs');
    if (sync.isCloudEnabled && sync.isCloudEnabled()) {
      await sync.pullStoryCatalogToLocal(cardId);
    }
  } catch (e) {
    console.warn('[storyStudio] pull catalog', e);
  }
  state.catalog = await loadCatalog(cardId);
  var activeId = await loadActiveNovelId(cardId);
  if (activeId) {
    var raw = await loadNovelOrPull(cardId, activeId);
    state.novel = raw ? normalizeNovel(raw) : null;
  } else {
    state.novel = null;
  }
  if (!state.novel && state.catalog.length) {
    var first = state.catalog[0];
    var raw2 = await loadNovelOrPull(cardId, first.id);
    if (raw2) {
      state.novel = normalizeNovel(raw2);
      await saveActiveNovelId(cardId, state.novel.id);
    }
  }
}

async function loadNovelOrPull(cardId, novelId) {
  var raw = await loadNovel(cardId, novelId);
  if (raw) return raw;
  try {
    var sync = await import('../sync/index.mjs');
    if (sync.isCloudEnabled && sync.isCloudEnabled()) {
      return await sync.pullStoryNovelToLocal(cardId, novelId);
    }
  } catch (e) {
    console.warn('[storyStudio] pull novel', e);
  }
  return null;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildNovelActionsHtml(item) {
  function iconBtn(act, label, extraClass, svg) {
    var cls = 'btn-icon btn-icon--sm ss-novel-icon' + (extraClass ? ' ' + extraClass : '');
    return '<button type="button" class="' + cls + '" data-ss-act="' + act
      + '" title="' + label + '" aria-label="' + label + '">' + svg + '</button>';
  }
  function textBtn(act, label, title) {
    return '<button type="button" class="btn btn-ghost btn-inline" data-ss-act="'
      + act + '"' + (title ? ' title="' + title + '"' : '') + '>' + label + '</button>';
  }
  var exportSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M5 19h14"/></svg>';
  var deleteSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M10 11v6M14 11v6"/><path d="M7 7l1 12a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9l1-12"/></svg>';
  return ''
    + '<div class="ss-novel-item__actions-group">'
    + iconBtn('export', '导出 TXT', 'ss-novel-icon--export', exportSvg)
    + iconBtn('delete', '删除', 'ss-novel-icon--danger btn-icon--danger', deleteSvg)
    + '</div>'
    + '<div class="ss-novel-item__share">'
    + textBtn('bump', '增版', '把当前草稿固化为分享可见版')
    + textBtn('share', '分享')
    + (item.shareToken ? textBtn('reset-share', '重置链接', '作废旧链接并生成新 token') : '')
    + (item.shareToken ? textBtn('unshare', '停分享') : '')
    + '</div>';
}

function renderManage() {
  var list = $('ssNovelList');
  if (!list) return;
  if (!state.catalog.length) {
    list.innerHTML = '<p class="ss-empty ss-empty--panel ui-empty-tip">尚无小说。点击右上角「新建」开始。</p>';
    return;
  }
  var activeId = state.novel ? state.novel.id : '';
  var charVer = getCharacterVersion();
  list.innerHTML = state.catalog.map(function(item) {
    var active = item.id === activeId ? ' is-active' : '';
    var workVer = buildDisplayVersion(charVer, item.novelVersion || '1');
    var pub = item.publishedDisplayVersion
      ? ('已发布 ' + item.publishedDisplayVersion)
      : '未发布';
    var stale = item.publishedDisplayVersion
      && item.publishedDisplayVersion !== workVer
      ? ' · 草稿已超前'
      : '';
    var share = item.shareToken ? ' · 分享中' : '';
    return (
      '<div class="ss-novel-item' + active + '" data-novel-id="' + escapeHtml(item.id) + '">'
      + '<div class="ss-novel-item__main">'
      + '<button type="button" class="ss-novel-title" data-ss-act="rename" title="点击重命名">'
      + escapeHtml(item.title || '未命名') + '</button>'
      + '<button type="button" class="ss-novel-meta" data-ss-act="open" title="打开">'
      + (item.chapterCount || 0) + ' 章 · '
      + (item.outlineCount || 0) + ' 大纲'
      + (item.branchCount > 1 ? (' · ' + item.branchCount + ' 分支') : '')
      + ' · 工作 ' + escapeHtml(workVer)
      + ' · ' + escapeHtml(pub) + escapeHtml(stale) + escapeHtml(share) + '</button>'
      + '</div>'
      + '<div class="ss-novel-item__actions">'
      + buildNovelActionsHtml(item)
      + '</div></div>'
    );
  }).join('');
}

function renderGraph() {
  var box = $('ssGraphNodes');
  var edgeBox = $('ssGraphEdges');
  var title = $('ssCurrentNovelTitle');
  if (title) title.textContent = state.novel ? state.novel.title : '（未打开小说）';
  if (!box || !edgeBox) return;
  if (!state.novel) {
    box.innerHTML = '<div class="ss-empty ui-empty-tip">请先在「管理」打开一部小说</div>';
    edgeBox.innerHTML = '';
    return;
  }
  var g = state.novel.graph || { nodes: [], edges: [] };
  box.innerHTML = (g.nodes || []).map(function(n, i) {
    return (
      '<div class="ss-graph-row" data-node-idx="' + i + '">'
      + '<select class="ss-node-type" data-f="type">'
      + '<option value="character"' + (n.type === 'character' ? ' selected' : '') + '>人物</option>'
      + '<option value="location"' + (n.type === 'location' ? ' selected' : '') + '>地点</option>'
      + '<option value="other"' + (n.type === 'other' ? ' selected' : '') + '>其他</option>'
      + '</select>'
      + '<input class="ss-node-name" data-f="name" value="' + escapeHtml(n.name) + '" placeholder="名称" />'
      + '<input class="ss-node-note" data-f="note" value="' + escapeHtml(n.note) + '" placeholder="备注" />'
      + '<button type="button" class="btn btn-ghost btn-inline" data-ss-node-del>删</button>'
      + '</div>'
    );
  }).join('') || '<div class="ss-empty ui-empty-tip">暂无节点。可从卡面种子生成。</div>';

  var nodeOpts = (g.nodes || []).map(function(n) {
    return '<option value="' + escapeHtml(n.id) + '">' + escapeHtml(n.name) + '</option>';
  }).join('');
  edgeBox.innerHTML = (g.edges || []).map(function(e, i) {
    return (
      '<div class="ss-graph-row" data-edge-idx="' + i + '">'
      + '<select data-f="from">' + nodeOpts.replace(
        'value="' + escapeHtml(e.from) + '"',
        'value="' + escapeHtml(e.from) + '" selected'
      ) + '</select>'
      + '<input data-f="label" value="' + escapeHtml(e.label) + '" placeholder="关系" />'
      + '<select data-f="to">' + nodeOpts.replace(
        'value="' + escapeHtml(e.to) + '"',
        'value="' + escapeHtml(e.to) + '" selected'
      ) + '</select>'
      + '<button type="button" class="btn btn-ghost btn-inline" data-ss-edge-del>删</button>'
      + '</div>'
    );
  }).join('') || '<div class="ss-empty ui-empty-tip">暂无关系边</div>';
}

function renderOutline() {
  var box = $('ssOutlineList');
  var tensionEl = $('ssOutlineTension');
  var wizBox = $('ssWizardBox');
  if (!box) return;
  if (!state.novel) {
    box.innerHTML = '<div class="ss-empty ui-empty-tip">请先打开一部小说</div>';
    if (tensionEl) tensionEl.hidden = true;
    if (wizBox) wizBox.hidden = true;
    return;
  }
  renderWizardChrome();
  var items = getActiveOutline(state.novel);
  box.innerHTML = items.map(function(o, i) {
    return (
      '<div class="ss-outline-item" data-ol-idx="' + i + '" data-ol-id="' + escapeHtml(o.id) + '">'
      + '<div class="ss-outline-item__head">'
      + '<span class="ss-ol-idx">#' + (i + 1) + '</span>'
      + '<input class="ss-ol-title" value="' + escapeHtml(o.title) + '" />'
      + '<button type="button" class="btn btn-ghost btn-inline" data-ss-ol-discard title="从此章起废弃后续">废弃后续</button>'
      + '<button type="button" class="btn btn-ghost btn-inline" data-ss-ol-del>删</button>'
      + '</div>'
      + '<textarea class="ss-ol-summary" rows="2" placeholder="摘要">' + escapeHtml(o.summary) + '</textarea>'
      + '</div>'
    );
  }).join('') || '<div class="ss-empty ui-empty-tip">暂无大纲。可分段生成或手动添加。</div>';

  var chapters = getActiveChapters(state.novel);
  var curve = tensionCurveFromChapters(chapters);
  if (tensionEl) {
    var hasT = curve.some(function(x) { return x.tension != null; });
    tensionEl.hidden = !hasT;
    if (hasT) {
      tensionEl.innerHTML = '<div class="ui-label-row"><span>张力曲线</span><span class="ui-hint ui-hint--inline">1～10</span></div>'
        + '<div class="ss-tension-bars">'
        + curve.map(function(x) {
          var t = x.tension != null ? x.tension : 0;
          var h = Math.max(4, t * 8);
          return '<div class="ss-tension-bar" title="' + escapeHtml((x.order + 1) + '. ' + x.title + ' · ' + (x.tension != null ? x.tension : '—'))
            + '" style="height:' + h + 'px"></div>';
        }).join('')
        + '</div>';
    }
  }
}

function renderWizardChrome() {
  var wizBox = $('ssWizardBox');
  if (!wizBox || !state.novel) return;
  var step = (state.novel.wizard && state.novel.wizard.step) || '';
  wizBox.hidden = !step;
  if (!step) return;
  wizBox.querySelectorAll('[data-wiz]').forEach(function(el) {
    var s = el.getAttribute('data-wiz');
    el.classList.toggle('is-active', s === step);
    el.classList.toggle('is-done',
      (step === 'outline' && s === 'direction')
      || (step === 'ready' && (s === 'direction' || s === 'outline'))
    );
  });
  var dirEl = $('ssOutlineDirection');
  if (dirEl && state.novel.wizard && state.novel.wizard.direction && !dirEl.value) {
    dirEl.value = state.novel.wizard.direction;
  }
}

function setWriteProgress(activeStep) {
  var box = $('ssWriteProgress');
  if (!box) return;
  if (!activeStep) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  WRITE_STEPS.forEach(function(s) {
    var el = box.querySelector('[data-ss-step="' + s + '"]');
    if (!el) return;
    el.classList.toggle('is-active', s === activeStep);
    el.classList.toggle('is-done', WRITE_STEPS.indexOf(s) < WRITE_STEPS.indexOf(activeStep));
  });
}

function renderBranchTree() {
  var box = $('ssBranchTree');
  if (!box) return;
  if (!state.novel) {
    box.innerHTML = '<div class="ss-empty ui-empty-tip">请先打开小说</div>';
    return;
  }
  var rows = buildBranchTree(state.novel);
  box.innerHTML = rows.map(function(row) {
    var b = row.branch;
    var pad = Math.max(0, row.depth) * 14;
    var active = b.id === state.novel.activeBranchId ? ' is-active' : '';
    var kindTag = b.kind === BRANCH_KIND_ENDING ? '结局' : '支线';
    return (
      '<div class="ss-branch-row' + active + '" data-branch-id="' + escapeHtml(b.id) + '" style="padding-left:' + pad + 'px">'
      + '<button type="button" class="btn btn-ghost btn-inline" data-ss-br-switch title="切换到此分支">'
      + escapeHtml(b.name) + '</button>'
      + '<span class="ss-branch-meta">' + kindTag
      + (b.parentBranchId ? (' · 自第' + (b.forkOrder + 1) + '章') : ' · 根')
      + '</span>'
      + '<label class="ss-branch-ready" title="纳入下次增版/读者选线">'
      + '<input type="checkbox" data-ss-br-ready ' + (b.publishReady ? 'checked' : '') + ' />发布'
      + '</label>'
      + '<button type="button" class="btn btn-ghost btn-inline" data-ss-br-edit>选项文案</button>'
      + '<button type="button" class="btn btn-ghost btn-inline" data-ss-br-ending">'
      + (b.kind === BRANCH_KIND_ENDING ? '取消结局' : '标为结局') + '</button>'
      + '</div>'
    );
  }).join('') || '<div class="ss-empty ui-empty-tip">暂无分支</div>';
}

function renderWrite() {
  var sel = $('ssWriteChapterSelect');
  var titleEl = $('ssWriteChapterTitle');
  var summaryEl = $('ssWriteChapterSummary');
  var contentEl = $('ssWriteChapterContent');
  var advEl = $('ssWriteAdvancePrompt');
  var syncEl = $('ssWriteSyncMvu');
  var warnEl = $('ssWriteMvuWarn');
  var branchSel = $('ssWriteBranchSelect');
  var batchEl = $('ssWriteBatchCount');
  var feedEl = $('ssWriteRunFeed');
  var qaEl = $('ssWriteRunQa');
  var stopEl = $('ssWriteStopOnQa');
  var qaBox = $('ssWriteQaBox');
  var tensionEl = $('ssWriteTension');
  var cpBox = $('ssWriteCheckpointList');
  var ledgerBox = $('ssWriteLedger');

  if (!state.novel) {
    if (sel) sel.innerHTML = '<option value="">请先打开小说</option>';
    if (branchSel) branchSel.innerHTML = '';
    renderBranchTree();
    return;
  }

  var ws = state.novel.writeSettings || {};
  if (batchEl) batchEl.value = String(ws.batchCount || 3);
  if (feedEl) feedEl.checked = ws.runFeedForward !== false;
  if (qaEl) qaEl.checked = ws.runQuality !== false;
  if (stopEl) stopEl.checked = !!ws.stopOnQualityFail;

  if (branchSel) {
    var branches = state.novel.branches || [];
    branchSel.innerHTML = branches.map(function(b) {
      var label = b.name + (b.parentBranchId ? '（分叉）' : '');
      return '<option value="' + escapeHtml(b.id) + '"'
        + (b.id === state.novel.activeBranchId ? ' selected' : '') + '>'
        + escapeHtml(label) + '</option>';
    }).join('');
  }

  var chapters = getActiveChapters(state.novel);
  var curId = sel && sel.value ? sel.value : (chapters[0] && chapters[0].id) || '';
  if (sel) {
    sel.innerHTML = chapters.map(function(c, i) {
      return '<option value="' + escapeHtml(c.id) + '"'
        + (c.id === curId ? ' selected' : '') + '>'
        + (i + 1) + '. ' + escapeHtml(c.title || '未命名')
        + (c.content ? '' : '（空）')
        + '</option>';
    }).join('') || '<option value="">无章节（请先做大纲）</option>';
    curId = sel.value;
  }
  var ch = chapters.find(function(c) { return c.id === curId; });
  if (titleEl) titleEl.value = ch ? ch.title : '';
  if (summaryEl) {
    var sum = ch ? ch.summary : '';
    if (ch && ch.feedForward && ch.feedForward.summary && !sum) sum = ch.feedForward.summary;
    summaryEl.value = sum;
  }
  if (contentEl) contentEl.value = ch ? ch.content : '';
  if (advEl) advEl.value = ch ? ch.advancePrompt : '';
  if (syncEl) syncEl.checked = !!(state.novel.writeSettings && state.novel.writeSettings.syncMvuStatusBar);

  var detect = detectMvuStatusBarDesign(window.__getCardExtension__);
  if (warnEl) {
    if (syncEl && syncEl.checked && !detect.ok) {
      warnEl.hidden = false;
      warnEl.textContent = detect.warning || '缺少 MVU/状态栏 design，同步不会生效。';
    } else {
      warnEl.hidden = true;
      warnEl.textContent = '';
    }
  }

  if (qaBox) {
    if (ch && ch.quality) {
      qaBox.hidden = false;
      var q = ch.quality;
      qaBox.innerHTML = '<div class="ui-label-row"><strong>质检</strong>'
        + '<span class="ui-hint ui-hint--inline">' + (q.ok ? '通过' : '需改') + ' · ' + (q.score != null ? q.score : '—') + '/10</span></div>'
        + (q.issues && q.issues.length
          ? ('<ul class="ss-qa-issues">' + q.issues.map(function(x) {
            return '<li>' + escapeHtml(x) + '</li>';
          }).join('') + '</ul>')
          : '<p class="ss-muted">无明显问题</p>')
        + (q.rewriteHint ? ('<p class="ss-qa-hint">' + escapeHtml(q.rewriteHint) + '</p>') : '');
    } else {
      qaBox.hidden = true;
      qaBox.innerHTML = '';
    }
  }

  if (tensionEl) {
    var curve = tensionCurveFromChapters(chapters);
    var hasT = curve.some(function(x) { return x.tension != null && x.hasContent; });
    tensionEl.hidden = !hasT;
    if (hasT) {
      tensionEl.innerHTML = '<div class="ui-label-row"><span>张力曲线</span><span class="ui-hint ui-hint--inline">分支内</span></div>'
        + '<div class="ss-tension-bars">'
        + curve.map(function(x) {
          var t = x.tension != null ? x.tension : 0;
          return '<div class="ss-tension-bar" style="height:' + Math.max(4, t * 8) + 'px" title="'
            + escapeHtml((x.order + 1) + '. ' + (x.tension != null ? x.tension : '—')) + '"></div>';
        }).join('')
        + '</div>';
    }
  }

  if (cpBox) {
    var cps = ch ? listChapterCheckpoints(ch) : [];
    cpBox.innerHTML = cps.length
      ? ('<div class="ui-label-row"><span>章节快照</span><span class="ui-hint ui-hint--inline">最多 5</span></div>'
        + cps.map(function(cp) {
          return '<button type="button" class="btn btn-ghost btn-inline" data-ss-cp="'
            + escapeHtml(cp.id) + '">' + escapeHtml(cp.label || '快照')
            + ' · ' + new Date(cp.createdAt || 0).toLocaleString() + '</button>';
        }).join(' '))
      : '';
  }

  if (ledgerBox) {
    var items = resolveBranchLedger(state.novel, state.novel.activeBranchId);
    ledgerBox.innerHTML = items.map(function(it) {
      return (
        '<div class="ss-ledger-item" data-ledger-id="' + escapeHtml(it.id) + '">'
        + '<input class="ss-ledger-title" value="' + escapeHtml(it.title) + '" />'
        + '<select class="ss-ledger-status">'
        + ['open', 'planted', 'paid', 'dropped'].map(function(s) {
          return '<option value="' + s + '"' + (it.status === s ? ' selected' : '') + '>' + s + '</option>';
        }).join('')
        + '</select>'
        + '<input class="ss-ledger-note" value="' + escapeHtml(it.note) + '" placeholder="说明" />'
        + '<button type="button" class="btn btn-ghost btn-inline" data-ss-ledger-del>删</button>'
        + '</div>'
      );
    }).join('') || '<div class="ss-empty ui-empty-tip">暂无伏笔。写章后可自动收录，或手动添加。</div>';
  }
  renderBranchTree();
}

function renderRead() {
  var title = $('ssReadTitle');
  var body = $('ssReadBody');
  var toc = $('ssReadToc');
  var modeSel = $('ssReadMode');
  var pageInfo = $('ssReadPageInfo');
  if (!state.novel) {
    if (title) title.textContent = '未打开小说';
    if (body) body.innerHTML = '<div class="ss-empty ui-empty-tip">请先在「管理」打开一部小说</div>';
    if (toc) toc.innerHTML = '';
    return;
  }
  var br = getBranch(state.novel, state.novel.activeBranchId);
  if (title) title.textContent = state.novel.title + (br && br.name ? ' · ' + br.name : '');
  var chapters = getActiveChapters(state.novel);
  var rs = state.novel.readState || {};
  var idx = chapters.findIndex(function(c) { return c.id === rs.chapterId; });
  if (idx < 0) idx = 0;
  var ch = chapters[idx];
  if (modeSel) modeSel.value = rs.mode || 'swipe';

  if (toc) {
    toc.innerHTML = chapters.map(function(c, i) {
      return '<button type="button" class="ss-toc-item' + (i === idx ? ' is-active' : '') + '" data-ch-id="'
        + escapeHtml(c.id) + '">' + (i + 1) + '. ' + escapeHtml(c.title || '未命名') + '</button>';
    }).join('') || '<div class="ss-empty ui-empty-tip">暂无章节</div>';
  }

  if (!ch) {
    if (body) body.innerHTML = '<div class="ss-empty ui-empty-tip">暂无章节</div>';
    if (pageInfo) pageInfo.textContent = '';
    return;
  }

  var text = String(ch.content || '').trim();
  var display = text;
  var isSummary = false;
  if (!display) {
    display = String(ch.summary || '').trim() || '（本章暂无正文与摘要）';
    isSummary = !!ch.summary;
  }

  var mode = rs.mode || 'swipe';
  if (mode === 'page' && text) {
    var pageSize = 900;
    var pages = [];
    for (var p = 0; p < text.length; p += pageSize) pages.push(text.slice(p, p + pageSize));
    if (!pages.length) pages = [display];
    var pi = Math.min(Math.max(0, rs.pageIndex || 0), pages.length - 1);
    state.novel.readState.pageIndex = pi;
    display = pages[pi];
    if (pageInfo) pageInfo.textContent = '第 ' + (idx + 1) + '/' + chapters.length + ' 章 · 页 '
      + (pi + 1) + '/' + pages.length;
    if (body) {
      body.innerHTML = '<div class="ss-read-page" data-page-mode="page">'
        + '<h3>' + escapeHtml(ch.title) + '</h3>'
        + (isSummary ? '<p class="ss-read-summary-tag">摘要</p>' : '')
        + '<div class="ss-read-text">' + escapeHtml(display).replace(/\n/g, '<br/>') + '</div>'
        + '</div>';
    }
  } else {
    if (pageInfo) pageInfo.textContent = '第 ' + (idx + 1) + '/' + chapters.length + ' 章';
    if (body) {
      body.innerHTML = '<div class="ss-read-page" data-page-mode="swipe">'
        + '<h3>' + escapeHtml(ch.title) + '</h3>'
        + (isSummary ? '<p class="ss-read-summary-tag">摘要（无正文）</p>' : '')
        + '<div class="ss-read-text">' + escapeHtml(display).replace(/\n/g, '<br/>') + '</div>'
        + '</div>';
    }
  }

  // bookmarks
  var bmBox = $('ssReadBookmarks');
  if (bmBox) {
    var bms = state.novel.bookmarks || [];
    bmBox.innerHTML = bms.map(function(b) {
      var c = chapters.find(function(x) { return x.id === b.chapterId; })
        || (state.novel.chapters || []).find(function(x) { return x.id === b.chapterId; });
      return '<button type="button" class="ss-bm-item" data-bm-ch="' + escapeHtml(b.chapterId) + '">'
        + escapeHtml((c && c.title) || '书签') + (b.note ? ' · ' + escapeHtml(b.note) : '')
        + '</button>';
    }).join('') || '<span class="ss-muted">暂无书签</span>';
  }
}

function renderAll() {
  renderManage();
  renderGraph();
  renderOutline();
  renderWrite();
  renderRead();
}

async function openNovel(novelId) {
  var cardId = getCardId();
  var raw = await loadNovelOrPull(cardId, novelId);
  if (!raw) {
    setStatus('打开失败：找不到小说');
    return;
  }
  state.novel = normalizeNovel(raw);
  await saveActiveNovelId(cardId, novelId);
  setStatus('已打开：' + state.novel.title);
  renderAll();
}

async function createNovel(opts) {
  opts = opts || {};
  var cardId = getCardId();
  var title = window.prompt('新小说标题', '未命名小说');
  if (title === null) return;
  var novel = createEmptyNovel({ title: String(title || '').trim() || '未命名小说', cardId: cardId });
  if (opts.wizard) {
    var direction = window.prompt('创作方向（向导第一步）', '') || '';
    novel.wizard = {
      step: 'direction',
      direction: String(direction).trim(),
      approvedOutline: false,
    };
  }
  state.novel = novel;
  await persistNovel();
  setStatus(opts.wizard ? ('已创建并向导启动：' + novel.title) : ('已创建：' + novel.title));
  renderAll();
  if (opts.wizard) {
    try {
      if (window.__setAppView__) window.__setAppView__('story-outline');
    } catch (e) { /* ignore */ }
  }
}

async function renameNovel(novelId) {
  var cardId = getCardId();
  var entry = state.catalog.find(function(x) { return x.id === novelId; });
  var next = window.prompt('重命名', (entry && entry.title) || '');
  if (next === null) return;
  next = String(next).trim();
  if (!next) return;
  var raw = await loadNovel(cardId, novelId);
  if (!raw) return;
  var novel = normalizeNovel(raw);
  novel.title = next;
  novel.updatedAt = Date.now();
  await saveNovel(cardId, novelId, novel);
  state.catalog = upsertCatalogEntry(state.catalog, novel);
  await saveCatalog(cardId, state.catalog);
  if (state.novel && state.novel.id === novelId) state.novel = novel;
  setStatus('已重命名');
  renderAll();
}

async function removeNovel(novelId) {
  if (!window.confirm('确定删除这部小说？不可恢复。')) return;
  var cardId = getCardId();
  var raw = await loadNovel(cardId, novelId);
  var token = raw && raw.shareToken;
  if (token) {
    try { await apiDeleteNovelShare(token); } catch (e) { /* ignore */ }
  }
  await deleteNovel(cardId, novelId);
  try { await deleteRelease(cardId, novelId); } catch (e2) { /* ignore */ }
  try {
    var mod = await import('../sync/storyMirror.mjs');
    await mod.removeStoryNovelFromPouch(cardId, novelId);
  } catch (e3) { /* ignore */ }
  state.catalog = removeCatalogEntry(state.catalog, novelId);
  await saveCatalog(cardId, state.catalog);
  await mirrorStoryDocs(cardId, null, state.catalog);
  if (state.novel && state.novel.id === novelId) {
    state.novel = null;
    await saveActiveNovelId(cardId, '');
  }
  setStatus('已删除');
  renderAll();
}

async function bumpNovel(novelId) {
  var cardId = getCardId();
  var raw = await loadNovel(cardId, novelId);
  if (!raw) {
    setStatus('增版失败：找不到小说');
    return;
  }
  var novel = normalizeNovel(raw);
  var check = validatePublishReady(novel);
  if (!check.ok) {
    setStatus('增版校验未通过：' + check.issues.slice(0, 3).join('；'));
    if (!window.confirm(
      '发布校验有问题：\n- ' + check.issues.join('\n- ')
      + '\n\n仍要继续增版吗？（未勾选「纳入发布」的支线不会出现在读者选线中）'
    )) return;
  }
  var charVer = getCharacterVersion();
  var isFirstPublish = !novel.publishedDisplayVersion;
  var nextVer = isFirstPublish
    ? (novel.novelVersion || '1')
    : bumpNovelVersion(novel.novelVersion);
  var display = buildDisplayVersion(charVer, nextVer);
  var readyCount = (novel.branches || []).filter(function(b) { return b.publishReady; }).length;
  if (!window.confirm(
    (isFirstPublish
      ? '首次发布为分享可见版「' + display + '」。\n'
      : '增版并固化为分享可见版「' + display + '」。\n')
    + '将纳入 ' + readyCount + ' 条分支供读者选线。\n'
    + '未再增版前，分享链接不会看到之后的编辑。继续？'
  )) return;

  novel.novelVersion = nextVer;
  var publishedAt = Date.now();
  var release = buildReleasePayload(novel, charVer, {
    novelVersion: nextVer,
    publishedAt: publishedAt,
    filterReady: true,
  });
  novel.publishedDisplayVersion = release.displayVersion;
  novel.publishedAt = publishedAt;
  novel.updatedAt = publishedAt;
  await saveNovel(cardId, novelId, novel);
  await saveRelease(cardId, novelId, release);
  state.catalog = upsertCatalogEntry(state.catalog, novel);
  await saveCatalog(cardId, state.catalog);
  if (state.novel && state.novel.id === novelId) state.novel = novel;
  await mirrorStoryDocs(cardId, novel, state.catalog);
  try {
    var mod = await import('../sync/storyMirror.mjs');
    await mod.mirrorReleaseToPouch(cardId, novelId, release);
  } catch (e) {
    console.warn('[storyStudio] release mirror', e);
  }
  try {
    var sync = await import('../sync/syncEngine.mjs');
    await sync.runSync({ refreshCred: true });
    setStatus('已增版 ' + display + '（' + (release.branches || []).length + ' 支）并已同步');
  } catch (e2) {
    setStatus('已增版 ' + display + '（本地已保存；同步失败：' + (e2.message || e2) + '）');
  }
  renderAll();
}

async function shareNovel(novelId, opts) {
  opts = opts || {};
  var cardId = getCardId();
  var raw = await loadNovel(cardId, novelId);
  if (!raw) {
    setStatus('分享失败：找不到小说');
    return;
  }
  var novel = normalizeNovel(raw);
  if (!novel.publishedDisplayVersion) {
    setStatus('请先「增版」发布后再分享');
    return;
  }
  var charVer = getCharacterVersion();
  var workVer = buildDisplayVersion(charVer, novel.novelVersion);
  if (novel.publishedDisplayVersion !== workVer) {
    if (!window.confirm(
      '当前草稿版号 ' + workVer + ' 已超前于已发布 ' + novel.publishedDisplayVersion
      + '。分享仍只展示已发布版。继续？'
    )) return;
  }
  var expiresInDays = undefined;
  if (!opts.skipExpirePrompt) {
    var expRaw = window.prompt('可选：链接有效天数（留空=不修改过期设置；填 0=永不过期）', '');
    if (expRaw === null) return;
    expRaw = String(expRaw).trim();
    if (expRaw === '0') expiresInDays = 0;
    else if (expRaw) {
      expiresInDays = parseInt(expRaw, 10);
      if (!Number.isFinite(expiresInDays) || expiresInDays < 0) {
        setStatus('有效天数无效');
        return;
      }
    }
  }
  setStatus(opts.resetToken ? '重置分享链接…' : '创建分享链接…');
  try {
    try {
      var sync = await import('../sync/syncEngine.mjs');
      await sync.runSync({ refreshCred: true });
    } catch (e) { /* may be offline login */ }

    var payload = {
      cardId: cardId,
      novelId: novelId,
      token: novel.shareToken || '',
      resetToken: !!opts.resetToken,
    };
    if (expiresInDays === 0) payload.expiresAt = null;
    else if (typeof expiresInDays === 'number' && expiresInDays > 0) {
      payload.expiresInDays = expiresInDays;
    }

    var data = await apiCreateNovelShare(payload);
    novel.shareToken = data.token;
    await saveNovel(cardId, novelId, novel);
    state.catalog = upsertCatalogEntry(state.catalog, novel);
    await saveCatalog(cardId, state.catalog);
    if (state.novel && state.novel.id === novelId) state.novel = novel;
    await mirrorStoryDocs(cardId, novel, state.catalog);

    var url = data.url || buildLocalShareUrl(data.token);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        setStatus('分享链接已复制：' + url
          + (data.expiresAt ? '（到期 ' + data.expiresAt + '）' : ''));
      } else {
        window.prompt('复制分享链接', url);
        setStatus('请复制分享链接');
      }
    } catch (e2) {
      window.prompt('复制分享链接', url);
      setStatus('请复制分享链接');
    }
    renderAll();
  } catch (err) {
    if (err && err.code === 'no_release') {
      setStatus('云端尚无发布版：请先增版并确保已登录同步');
    } else if (err && err.status === 401) {
      setStatus('请先在「账户与同步」登录后再分享');
    } else {
      setStatus('分享失败：' + (err.message || err));
    }
  }
}

async function unshareNovel(novelId) {
  var cardId = getCardId();
  var raw = await loadNovel(cardId, novelId);
  if (!raw) return;
  var novel = normalizeNovel(raw);
  if (!novel.shareToken) {
    setStatus('未在分享');
    return;
  }
  if (!window.confirm('停止分享后链接将失效，确定？')) return;
  try {
    await apiDeleteNovelShare(novel.shareToken);
  } catch (e) {
    if (!(e && e.status === 401)) {
      setStatus('停分享失败：' + (e.message || e));
      return;
    }
  }
  novel.shareToken = '';
  await saveNovel(cardId, novelId, novel);
  state.catalog = upsertCatalogEntry(state.catalog, novel);
  await saveCatalog(cardId, state.catalog);
  if (state.novel && state.novel.id === novelId) state.novel = novel;
  await mirrorStoryDocs(cardId, novel, state.catalog);
  setStatus('已停止分享');
  renderAll();
}

async function exportNovel(novelId) {
  var cardId = getCardId();
  var raw = await loadNovel(cardId, novelId);
  if (!raw) {
    setStatus('导出失败');
    return;
  }
  downloadNovelTxt(normalizeNovel(raw));
  setStatus('已导出 TXT');
}

function collectGraphFromDom() {
  if (!state.novel) return;
  var nodes = [];
  document.querySelectorAll('#ssGraphNodes .ss-graph-row').forEach(function(row) {
    var typeEl = row.querySelector('[data-f="type"]');
    var nameEl = row.querySelector('[data-f="name"]');
    var noteEl = row.querySelector('[data-f="note"]');
    var prev = state.novel.graph.nodes[Number(row.getAttribute('data-node-idx'))] || {};
    nodes.push({
      id: prev.id || genStoryId('node'),
      type: typeEl ? typeEl.value : 'other',
      name: nameEl ? nameEl.value : '',
      note: noteEl ? noteEl.value : '',
    });
  });
  var edges = [];
  document.querySelectorAll('#ssGraphEdges .ss-graph-row').forEach(function(row) {
    var fromEl = row.querySelector('[data-f="from"]');
    var toEl = row.querySelector('[data-f="to"]');
    var labelEl = row.querySelector('[data-f="label"]');
    var prev = state.novel.graph.edges[Number(row.getAttribute('data-edge-idx'))] || {};
    edges.push({
      id: prev.id || genStoryId('edge'),
      from: fromEl ? fromEl.value : '',
      to: toEl ? toEl.value : '',
      label: labelEl ? labelEl.value : '关系',
    });
  });
  state.novel.graph = { nodes: nodes, edges: edges, updatedAt: new Date().toISOString() };
}

function collectOutlineFromDom() {
  if (!state.novel) return;
  var branchId = state.novel.activeBranchId;
  var byId = {};
  (state.novel.outline || []).forEach(function(o) {
    if (o && o.id) byId[o.id] = o;
  });
  document.querySelectorAll('#ssOutlineList .ss-outline-item').forEach(function(row, i) {
    var titleEl = row.querySelector('.ss-ol-title');
    var sumEl = row.querySelector('.ss-ol-summary');
    var id = row.getAttribute('data-ol-id') || '';
    var prev = (id && byId[id]) || {};
    var next = {
      id: prev.id || id || genStoryId('ol'),
      title: titleEl ? titleEl.value : '',
      summary: sumEl ? sumEl.value : '',
      order: typeof prev.order === 'number' ? prev.order : i,
      branchId: prev.branchId || branchId,
    };
    // 可见列表下标作为阅读序；写回 order（主线用下标；分支保留原 order 若已有）
    if (!prev.branchId || prev.branchId === branchId) {
      var br = getBranch(state.novel, branchId);
      if (!br.parentBranchId) next.order = i;
      else if (typeof prev.order !== 'number') next.order = i;
    }
    if (id && byId[id]) {
      Object.assign(byId[id], next);
    } else {
      state.novel.outline.push(next);
      byId[next.id] = next;
    }
  });
}

function collectWriteFromDom() {
  if (!state.novel) return;
  var sel = $('ssWriteChapterSelect');
  if (!sel || !sel.value) return;
  var ch = state.novel.chapters.find(function(c) { return c.id === sel.value; });
  if (!ch) return;
  var titleEl = $('ssWriteChapterTitle');
  var summaryEl = $('ssWriteChapterSummary');
  var contentEl = $('ssWriteChapterContent');
  var advEl = $('ssWriteAdvancePrompt');
  var syncEl = $('ssWriteSyncMvu');
  var batchEl = $('ssWriteBatchCount');
  var feedEl = $('ssWriteRunFeed');
  var qaEl = $('ssWriteRunQa');
  var stopEl = $('ssWriteStopOnQa');
  if (titleEl) ch.title = titleEl.value;
  if (summaryEl) ch.summary = summaryEl.value;
  if (contentEl) ch.content = contentEl.value;
  if (advEl) ch.advancePrompt = advEl.value;
  if (!state.novel.writeSettings) state.novel.writeSettings = {};
  if (syncEl) state.novel.writeSettings.syncMvuStatusBar = !!syncEl.checked;
  if (batchEl) {
    state.novel.writeSettings.batchCount = Math.max(1, Math.min(20, parseInt(batchEl.value, 10) || 3));
  }
  if (feedEl) state.novel.writeSettings.runFeedForward = !!feedEl.checked;
  if (qaEl) state.novel.writeSettings.runQuality = !!qaEl.checked;
  if (stopEl) state.novel.writeSettings.stopOnQualityFail = !!stopEl.checked;
}

function collectLedgerFromDom() {
  if (!state.novel) return;
  var byId = {};
  (state.novel.plotLedger || []).forEach(function(it) {
    if (it && it.id) byId[it.id] = it;
  });
  document.querySelectorAll('#ssWriteLedger .ss-ledger-item').forEach(function(row) {
    var id = row.getAttribute('data-ledger-id');
    var it = byId[id];
    if (!it) return;
    var titleEl = row.querySelector('.ss-ledger-title');
    var statusEl = row.querySelector('.ss-ledger-status');
    var noteEl = row.querySelector('.ss-ledger-note');
    if (titleEl) it.title = titleEl.value;
    if (statusEl) it.status = statusEl.value;
    if (noteEl) it.note = noteEl.value;
    it.updatedAt = Date.now();
  });
}

async function seedGraph() {
  if (!state.novel) {
    setStatus('请先打开小说');
    return;
  }
  var seeded = seedGraphFromCard(getCardSeed());
  state.novel.graph = mergeGraphSeed(state.novel.graph, seeded);
  await persistNovel();
  setStatus('已从卡面种子生成图谱（' + state.novel.graph.nodes.length + ' 节点）');
  renderGraph();
}

async function generateOutline(mode) {
  if (!state.novel) {
    setStatus('请先打开小说');
    return;
  }
  collectOutlineFromDom();
  var directionEl = $('ssOutlineDirection');
  var direction = directionEl ? directionEl.value : '';
  if (state.novel.wizard && state.novel.wizard.direction && !direction) {
    direction = state.novel.wizard.direction;
  }
  var branchId = state.novel.activeBranchId;
  var visible = getActiveOutline(state.novel);
  var existing = visible.map(function(o, i) {
    return (i + 1) + '. ' + o.title + ' — ' + o.summary;
  }).join('\n');
  var chapters = getActiveChapters(state.novel);
  var feeds = collectFeedForwardsBefore(chapters, chapters.length);
  var feedBrief = feeds.slice(0, 6).map(function(f) {
    return (f.order + 1) + '. ' + f.title + ' — ' + String(f.summary || '').slice(0, 100);
  }).join('\n');
  var segmentHint = mode === 'continue'
    ? '在已有大纲之后续写 3～5 章。'
    : '生成完整分段大纲，约 8～12 章。';
  if (mode === 'branch') {
    segmentHint = '这是分支世界的续写大纲，请按分支方向续写 3～6 章，承接分叉前剧情但走向不同。';
  }

  var system = promptText(
    'storyOutlineGen',
    '你是长篇小说大纲策划。输出结构化章节大纲（标题+摘要）。' + CHILD_SAFETY_RULE
  );
  var user = buildOutlineUserPrompt({
    title: state.novel.title,
    direction: direction,
    branchHint: branchBrief(state.novel, branchId),
    graphBrief: graphBriefFromNovel(state.novel),
    existingOutline: existing,
    feedForwardBrief: feedBrief,
    segmentHint: segmentHint,
  });

  setStatus('正在生成大纲…');
  try {
    await runTracked({
      type: 'story_outline',
      typeLabel: '小说创作·大纲',
      title: mode === 'continue' ? '续写大纲' : '生成大纲',
      target: state.novel.title,
    }, async function(task) {
      var text = await callAI(user, system, task.signal);
      var parsed = parseOutlineAiText(text);
      if (!parsed.length) throw new Error('未能解析大纲 JSON');
      var br = getBranch(state.novel, branchId);
      var baseOrder = visible.length
        ? (typeof visible[visible.length - 1].order === 'number'
          ? visible[visible.length - 1].order + 1
          : visible.length)
        : (br.forkOrder >= 0 ? br.forkOrder + 1 : 0);

      if (mode !== 'continue' && mode !== 'branch' && !visible.length) {
        // 主线空大纲：替换写入本分支
        parsed.forEach(function(p, i) {
          state.novel.outline.push({
            id: genStoryId('ol'),
            title: p.title,
            summary: p.summary,
            order: i,
            branchId: branchId,
          });
        });
      } else {
        parsed.forEach(function(p, i) {
          state.novel.outline.push({
            id: genStoryId('ol'),
            title: p.title,
            summary: p.summary,
            order: baseOrder + i,
            branchId: branchId,
          });
        });
      }
      state.novel = syncChaptersFromOutline(state.novel);
      if (state.novel.wizard && state.novel.wizard.step === 'direction') {
        state.novel.wizard.step = 'outline';
      }
      await persistNovel();
    });
    setStatus('大纲已更新');
    renderAll();
  } catch (err) {
    if (isAbort(err)) setStatus('已取消');
    else setStatus('大纲生成失败：' + (err.message || err));
  }
}

async function writeChapter(autoNext, opts) {
  opts = opts || {};
  if (!state.novel) {
    setStatus('请先打开小说');
    return null;
  }
  if (state.novel.wizard && state.novel.wizard.step && state.novel.wizard.step !== 'ready'
    && !state.novel.wizard.approvedOutline) {
    setStatus('请先在大纲页完成向导审批（或跳过向导）');
    return null;
  }
  collectWriteFromDom();
  collectLedgerFromDom();
  var sel = $('ssWriteChapterSelect');
  if (!sel || !sel.value) {
    setStatus('没有可写章节，请先生成大纲');
    return null;
  }
  var chapters = getActiveChapters(state.novel);
  var idx = chapters.findIndex(function(c) { return c.id === sel.value; });
  if (idx < 0) return null;
  var ch = chapters[idx];

  setStatus('正在撰写：' + ch.title);
  setWriteProgress('plan');
  try {
    var result = null;
    await runTracked({
      type: 'story_chapter',
      typeLabel: '小说创作·章文',
      title: opts.rewriteOnly ? '改写章节' : '撰写章节',
      target: ch.title,
    }, async function(task) {
      result = await runChapterWritePipeline({
        callAI: callAI,
        promptText: promptText,
        signal: task.signal,
        onStep: setWriteProgress,
      }, state.novel, idx, {
        skipDraft: !!opts.skipDraft,
        skipFeed: !!opts.skipFeed,
        skipQa: !!opts.skipQa,
        rewriteOnly: !!opts.rewriteOnly,
      });

      var wantSync = !!(state.novel.writeSettings && state.novel.writeSettings.syncMvuStatusBar);
      var syncResult = trySyncAfterChapter({
        enabled: wantSync,
        getExtension: window.__getCardExtension__,
        setExtension: window.__setCardExtension__,
        chapterTitle: ch.title,
        chapterSummary: ch.summary,
        chapterContent: ch.content,
      });
      if (wantSync && syncResult.skipped && syncResult.reason === 'no_design') {
        setStatus('章节已写完；同步未生效：' + (syncResult.warning || ''));
      }
      await persistNovel();
    });

    setWriteProgress(null);
    var qa = result && result.quality;
    var qaMsg = qa ? ('质检 ' + (qa.ok ? '通过' : '需改') + ' ' + qa.score + '/10') : '';

    if (autoNext) {
      var nextChapters = getActiveChapters(state.novel);
      if (idx + 1 < nextChapters.length) {
        sel.value = nextChapters[idx + 1].id;
        renderWrite();
        setStatus('本章完成' + (qaMsg ? '（' + qaMsg + '）' : '') + '，已切到下一章');
      } else {
        setStatus('章节撰写完成' + (qaMsg ? ' · ' + qaMsg : '') + '（已无下一章）');
        renderWrite();
        renderRead();
      }
    } else {
      setStatus('章节撰写完成' + (qaMsg ? ' · ' + qaMsg : ''));
      renderWrite();
      renderRead();
    }
    return result;
  } catch (err) {
    setWriteProgress(null);
    if (isAbort(err)) setStatus('已取消');
    else setStatus('撰写失败：' + (err.message || err));
    return null;
  }
}

async function writeBatchChapters() {
  if (!state.novel) {
    setStatus('请先打开小说');
    return;
  }
  collectWriteFromDom();
  var n = Math.max(1, Math.min(20, (state.novel.writeSettings && state.novel.writeSettings.batchCount) || 3));
  var sel = $('ssWriteChapterSelect');
  if (!sel || !sel.value) {
    setStatus('没有可写章节');
    return;
  }
  var stopOnFail = !!(state.novel.writeSettings && state.novel.writeSettings.stopOnQualityFail);
  setStatus('连写 ' + n + ' 章…');
  for (var i = 0; i < n; i++) {
    var chapters = getActiveChapters(state.novel);
    var idx = chapters.findIndex(function(c) { return c.id === sel.value; });
    if (idx < 0) break;
    // 跳到下一空章或当前章
    var targetIdx = idx;
    while (targetIdx < chapters.length && String(chapters[targetIdx].content || '').trim() && i === 0 && targetIdx === idx) {
      // 若当前已有正文，从下一空章开始
      var nextEmpty = -1;
      for (var j = idx; j < chapters.length; j++) {
        if (!String(chapters[j].content || '').trim()) { nextEmpty = j; break; }
      }
      if (nextEmpty >= 0) {
        sel.value = chapters[nextEmpty].id;
        targetIdx = nextEmpty;
      }
      break;
    }
    var result = await writeChapter(true);
    if (!result) break;
    if (stopOnFail && result.quality && !result.quality.ok) {
      setStatus('质检未通过，已熔断连写（第 ' + (i + 1) + '/' + n + ' 章）');
      break;
    }
  }
  renderAll();
}

async function forkCurrentChapterBranch() {
  if (!state.novel) {
    setStatus('请先打开小说');
    return;
  }
  collectWriteFromDom();
  var sel = $('ssWriteChapterSelect');
  if (!sel || !sel.value) {
    setStatus('请先选择分叉章节');
    return;
  }
  var name = window.prompt('新分支名称', '平行线');
  if (name === null) return;
  var choiceLabel = window.prompt('读者选项文案（选线时显示）', String(name).trim() || '平行线');
  if (choiceLabel === null) return;
  var direction = window.prompt('分支方向 / 偏好（写入后续生成）', '') || '';
  var asEnding = window.confirm('将此分支标为「结局支」？（可稍后在分支树改）');
  try {
    var out = forkBranchFromChapter(state.novel, {
      fromChapterId: sel.value,
      name: String(name).trim() || '平行线',
      choiceLabel: String(choiceLabel).trim() || String(name).trim(),
      direction: String(direction).trim(),
      kind: asEnding ? BRANCH_KIND_ENDING : 'path',
      endingTitle: asEnding ? (String(choiceLabel).trim() || String(name).trim()) : '',
      publishReady: true,
    });
    state.novel = normalizeNovel(out.novel);
    await persistNovel();
    setStatus('已开分支「' + out.branch.name + '」，自「' + (out.forkChapter.title || '') + '」分叉');
    renderAll();
    if (direction) {
      if (window.confirm('是否立即按分支方向续写大纲？')) {
        await generateOutline('branch');
      }
    }
  } catch (err) {
    setStatus('开分支失败：' + (err.message || err));
  }
}

function bindEvents() {
  var root = document.getElementById('storyStudioRoot') || document;

  var btnNew = $('btnSsNewNovel');
  if (btnNew) btnNew.addEventListener('click', function() { createNovel(); });
  var btnNewWiz = $('btnSsNewNovelWizard');
  if (btnNewWiz) btnNewWiz.addEventListener('click', function() { createNovel({ wizard: true }); });

  var list = $('ssNovelList');
  if (list) {
    list.addEventListener('click', function(ev) {
      var btn = ev.target.closest('[data-ss-act]');
      if (!btn) return;
      var item = btn.closest('[data-novel-id]');
      if (!item) return;
      var id = item.getAttribute('data-novel-id');
      var act = btn.getAttribute('data-ss-act');
      if (act === 'open') openNovel(id);
      else if (act === 'rename') renameNovel(id);
      else if (act === 'bump') bumpNovel(id);
      else if (act === 'share') shareNovel(id);
      else if (act === 'reset-share') shareNovel(id, { resetToken: true });
      else if (act === 'unshare') unshareNovel(id);
      else if (act === 'export') exportNovel(id);
      else if (act === 'delete') removeNovel(id);
    });
    list.addEventListener('keydown', function(ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      var openBtn = ev.target.closest('[data-ss-act="open"]');
      if (!openBtn) return;
      ev.preventDefault();
      var item = openBtn.closest('[data-novel-id]');
      if (!item) return;
      openNovel(item.getAttribute('data-novel-id'));
    });
  }

  var btnSeed = $('btnSsSeedGraph');
  if (btnSeed) btnSeed.addEventListener('click', function() { seedGraph(); });

  var btnAddNode = $('btnSsAddNode');
  if (btnAddNode) {
    btnAddNode.addEventListener('click', async function() {
      if (!state.novel) return;
      collectGraphFromDom();
      state.novel.graph.nodes.push({
        id: genStoryId('node'),
        type: 'character',
        name: '新节点',
        note: '',
      });
      await persistNovel();
      renderGraph();
    });
  }

  var btnAddEdge = $('btnSsAddEdge');
  if (btnAddEdge) {
    btnAddEdge.addEventListener('click', async function() {
      if (!state.novel || !state.novel.graph.nodes.length) return;
      collectGraphFromDom();
      var a = state.novel.graph.nodes[0];
      var b = state.novel.graph.nodes[1] || a;
      state.novel.graph.edges.push({
        id: genStoryId('edge'),
        from: a.id,
        to: b.id,
        label: '关系',
      });
      await persistNovel();
      renderGraph();
    });
  }

  var btnSaveGraph = $('btnSsSaveGraph');
  if (btnSaveGraph) {
    btnSaveGraph.addEventListener('click', async function() {
      if (!state.novel) return;
      collectGraphFromDom();
      await persistNovel();
      setStatus('图谱已保存');
    });
  }

  var graphNodes = $('ssGraphNodes');
  if (graphNodes) {
    graphNodes.addEventListener('click', async function(ev) {
      var del = ev.target.closest('[data-ss-node-del]');
      if (!del) return;
      var row = del.closest('[data-node-idx]');
      if (!row || !state.novel) return;
      collectGraphFromDom();
      var i = Number(row.getAttribute('data-node-idx'));
      state.novel.graph.nodes.splice(i, 1);
      await persistNovel();
      renderGraph();
    });
  }
  var graphEdges = $('ssGraphEdges');
  if (graphEdges) {
    graphEdges.addEventListener('click', async function(ev) {
      var del = ev.target.closest('[data-ss-edge-del]');
      if (!del) return;
      var row = del.closest('[data-edge-idx]');
      if (!row || !state.novel) return;
      collectGraphFromDom();
      var i = Number(row.getAttribute('data-edge-idx'));
      state.novel.graph.edges.splice(i, 1);
      await persistNovel();
      renderGraph();
    });
  }

  var btnOlGen = $('btnSsOutlineGen');
  if (btnOlGen) btnOlGen.addEventListener('click', function() { generateOutline('segment'); });
  var btnOlCont = $('btnSsOutlineContinue');
  if (btnOlCont) btnOlCont.addEventListener('click', function() { generateOutline('continue'); });
  var btnOlAdd = $('btnSsOutlineAdd');
  if (btnOlAdd) {
    btnOlAdd.addEventListener('click', async function() {
      if (!state.novel) return;
      collectOutlineFromDom();
      var branchId = state.novel.activeBranchId;
      var visible = getActiveOutline(state.novel);
      var nextOrder = visible.length
        ? (typeof visible[visible.length - 1].order === 'number'
          ? visible[visible.length - 1].order + 1
          : visible.length)
        : 0;
      state.novel.outline.push({
        id: genStoryId('ol'),
        title: '第' + (visible.length + 1) + '章',
        summary: '',
        order: nextOrder,
        branchId: branchId,
      });
      state.novel = syncChaptersFromOutline(state.novel);
      await persistNovel();
      renderOutline();
      renderWrite();
    });
  }
  var btnOlSave = $('btnSsOutlineSave');
  if (btnOlSave) {
    btnOlSave.addEventListener('click', async function() {
      if (!state.novel) return;
      collectOutlineFromDom();
      state.novel = syncChaptersFromOutline(state.novel);
      await persistNovel();
      setStatus('大纲已保存');
      renderAll();
    });
  }

  var olList = $('ssOutlineList');
  if (olList) {
    olList.addEventListener('click', async function(ev) {
      if (!state.novel) return;
      var discard = ev.target.closest('[data-ss-ol-discard]');
      var del = ev.target.closest('[data-ss-ol-del]');
      var row = ev.target.closest('[data-ol-idx]');
      if (!row) return;
      var i = Number(row.getAttribute('data-ol-idx'));
      if (discard) {
        if (!window.confirm('从此章起废弃后续大纲与对应章节？')) return;
        collectOutlineFromDom();
        state.novel = discardOutlineFrom(state.novel, i);
        await persistNovel();
        setStatus('已废弃后续');
        renderAll();
        return;
      }
      if (del) {
        collectOutlineFromDom();
        var visible = getActiveOutline(state.novel);
        var target = visible[i];
        if (!target) return;
        var br = getBranch(state.novel, state.novel.activeBranchId);
        // 不可删继承自父线的章
        if (br.parentBranchId && target.branchId !== br.id) {
          setStatus('继承章不可删；请开分支后编辑分支私有部分');
          return;
        }
        state.novel.outline = state.novel.outline.filter(function(o) { return o.id !== target.id; });
        state.novel.chapters = state.novel.chapters.filter(function(c) {
          return !(c.branchId === target.branchId && c.order === target.order);
        });
        state.novel = syncChaptersFromOutline(state.novel);
        await persistNovel();
        renderAll();
      }
    });
  }

  var writeSel = $('ssWriteChapterSelect');
  if (writeSel) {
    writeSel.addEventListener('change', function() {
      collectWriteFromDom();
      renderWrite();
    });
  }
  var branchSel = $('ssWriteBranchSelect');
  if (branchSel) {
    branchSel.addEventListener('change', async function() {
      if (!state.novel) return;
      collectWriteFromDom();
      collectLedgerFromDom();
      try {
        state.novel = setActiveBranch(state.novel, branchSel.value);
        await persistNovel();
        setStatus('已切换分支');
        renderAll();
      } catch (e) {
        setStatus(e.message || String(e));
      }
    });
  }
  var btnFork = $('btnSsForkBranch');
  if (btnFork) btnFork.addEventListener('click', function() { forkCurrentChapterBranch(); });

  var branchTree = $('ssBranchTree');
  if (branchTree) {
    branchTree.addEventListener('click', async function(ev) {
      if (!state.novel) return;
      var row = ev.target.closest('[data-branch-id]');
      if (!row) return;
      var id = row.getAttribute('data-branch-id');
      if (ev.target.closest('[data-ss-br-switch]')) {
        try {
          state.novel = setActiveBranch(state.novel, id);
          await persistNovel();
          setStatus('已切换分支');
          renderAll();
        } catch (e) {
          setStatus(e.message || String(e));
        }
        return;
      }
      if (ev.target.closest('[data-ss-br-edit]')) {
        var br = getBranch(state.novel, id);
        var label = window.prompt('读者选项文案', br.choiceLabel || br.name || '');
        if (label === null) return;
        var teaser = window.prompt('选项短提示（可选）', br.choiceTeaser || br.direction || '');
        if (teaser === null) return;
        var endingTitle = br.kind === BRANCH_KIND_ENDING
          ? window.prompt('结局标题', br.endingTitle || br.name || '')
          : br.endingTitle;
        if (endingTitle === null) return;
        state.novel = patchBranch(state.novel, id, {
          choiceLabel: label,
          choiceTeaser: teaser,
          endingTitle: endingTitle,
        });
        await persistNovel();
        renderBranchTree();
        setStatus('已更新分支文案');
        return;
      }
      if (ev.target.closest('[data-ss-br-ending]')) {
        var cur = getBranch(state.novel, id);
        var nextKind = cur.kind === BRANCH_KIND_ENDING ? 'path' : BRANCH_KIND_ENDING;
        var et = cur.endingTitle;
        if (nextKind === BRANCH_KIND_ENDING && !et) {
          et = window.prompt('结局标题', cur.choiceLabel || cur.name || '结局') || cur.name;
        }
        state.novel = patchBranch(state.novel, id, {
          kind: nextKind,
          endingTitle: nextKind === BRANCH_KIND_ENDING ? et : '',
        });
        await persistNovel();
        renderBranchTree();
        setStatus(nextKind === BRANCH_KIND_ENDING ? '已标为结局支' : '已取消结局标记');
      }
    });
    branchTree.addEventListener('change', async function(ev) {
      if (!state.novel) return;
      var ready = ev.target.closest('[data-ss-br-ready]');
      if (!ready) return;
      var row = ready.closest('[data-branch-id]');
      if (!row) return;
      state.novel = patchBranch(state.novel, row.getAttribute('data-branch-id'), {
        publishReady: !!ready.checked,
      });
      await persistNovel();
      setStatus(ready.checked ? '已纳入发布' : '已移出发布');
    });
  }

  var btnWrite = $('btnSsWriteChapter');
  if (btnWrite) btnWrite.addEventListener('click', function() { writeChapter(false); });
  var btnWriteNext = $('btnSsWriteAutoNext');
  if (btnWriteNext) btnWriteNext.addEventListener('click', function() { writeChapter(true); });
  var btnWriteBatch = $('btnSsWriteBatch');
  if (btnWriteBatch) btnWriteBatch.addEventListener('click', function() { writeBatchChapters(); });
  var btnWriteQa = $('btnSsWriteQa');
  if (btnWriteQa) {
    btnWriteQa.addEventListener('click', function() {
      writeChapter(false, { skipDraft: true, skipFeed: true });
    });
  }
  var btnWriteRewrite = $('btnSsWriteRewrite');
  if (btnWriteRewrite) {
    btnWriteRewrite.addEventListener('click', function() {
      writeChapter(false, { rewriteOnly: true });
    });
  }
  var btnWriteSave = $('btnSsWriteSave');
  if (btnWriteSave) {
    btnWriteSave.addEventListener('click', async function() {
      collectWriteFromDom();
      collectLedgerFromDom();
      await persistNovel();
      setStatus('章节已保存');
      renderRead();
    });
  }
  var syncEl = $('ssWriteSyncMvu');
  if (syncEl) {
    syncEl.addEventListener('change', function() {
      collectWriteFromDom();
      renderWrite();
      persistNovel();
    });
  }

  var btnLedgerAdd = $('btnSsLedgerAdd');
  if (btnLedgerAdd) {
    btnLedgerAdd.addEventListener('click', async function() {
      if (!state.novel) return;
      collectLedgerFromDom();
      if (!Array.isArray(state.novel.plotLedger)) state.novel.plotLedger = [];
      state.novel.plotLedger.push(createLedgerItem({
        title: '新伏笔',
        status: 'open',
        branchId: state.novel.activeBranchId,
      }));
      await persistNovel();
      renderWrite();
    });
  }
  var ledgerBox = $('ssWriteLedger');
  if (ledgerBox) {
    ledgerBox.addEventListener('click', async function(ev) {
      var del = ev.target.closest('[data-ss-ledger-del]');
      if (!del || !state.novel) return;
      collectLedgerFromDom();
      var row = del.closest('[data-ledger-id]');
      if (!row) return;
      var id = row.getAttribute('data-ledger-id');
      state.novel.plotLedger = (state.novel.plotLedger || []).filter(function(x) { return x.id !== id; });
      await persistNovel();
      renderWrite();
    });
  }
  var cpBox = $('ssWriteCheckpointList');
  if (cpBox) {
    cpBox.addEventListener('click', async function(ev) {
      var btn = ev.target.closest('[data-ss-cp]');
      if (!btn || !state.novel) return;
      var sel = $('ssWriteChapterSelect');
      if (!sel || !sel.value) return;
      var ch = state.novel.chapters.find(function(c) { return c.id === sel.value; });
      if (!ch) return;
      if (!window.confirm('恢复到该快照？当前正文会先自动存一份。')) return;
      if (restoreChapterCheckpoint(ch, btn.getAttribute('data-ss-cp'))) {
        await persistNovel();
        setStatus('已恢复快照');
        renderWrite();
      }
    });
  }

  // Wizard
  var btnWizStart = $('btnSsWizardStart');
  if (btnWizStart) {
    btnWizStart.addEventListener('click', async function() {
      if (!state.novel) return;
      var dirEl = $('ssOutlineDirection');
      state.novel.wizard = {
        step: 'direction',
        direction: dirEl ? dirEl.value : '',
        approvedOutline: false,
      };
      await persistNovel();
      renderOutline();
      setStatus('向导已启动：请确认方向');
    });
  }
  var btnWizDir = $('btnSsWizardApproveDir');
  if (btnWizDir) {
    btnWizDir.addEventListener('click', async function() {
      if (!state.novel) return;
      var dirEl = $('ssOutlineDirection');
      if (!state.novel.wizard) state.novel.wizard = {};
      state.novel.wizard.direction = dirEl ? dirEl.value : '';
      state.novel.wizard.step = 'direction';
      await persistNovel();
      await generateOutline(getActiveOutline(state.novel).length ? 'continue' : 'segment');
    });
  }
  var btnWizOl = $('btnSsWizardApproveOl');
  if (btnWizOl) {
    btnWizOl.addEventListener('click', async function() {
      if (!state.novel) return;
      if (!state.novel.wizard) state.novel.wizard = {};
      state.novel.wizard.approvedOutline = true;
      state.novel.wizard.step = 'ready';
      await persistNovel();
      setStatus('大纲已批准，可以开始写作');
      renderOutline();
      try {
        if (window.__setAppView__) window.__setAppView__('story-write');
      } catch (e) { /* ignore */ }
    });
  }
  var btnWizSkip = $('btnSsWizardSkip');
  if (btnWizSkip) {
    btnWizSkip.addEventListener('click', async function() {
      if (!state.novel) return;
      state.novel.wizard = { step: '', direction: '', approvedOutline: true };
      await persistNovel();
      renderOutline();
      setStatus('已跳过向导');
    });
  }

  // Read
  var toc = $('ssReadToc');
  if (toc) {
    toc.addEventListener('click', async function(ev) {
      var btn = ev.target.closest('[data-ch-id]');
      if (!btn || !state.novel) return;
      state.novel.readState.chapterId = btn.getAttribute('data-ch-id');
      state.novel.readState.pageIndex = 0;
      await persistNovel();
      renderRead();
    });
  }
  var modeSel = $('ssReadMode');
  if (modeSel) {
    modeSel.addEventListener('change', async function() {
      if (!state.novel) return;
      state.novel.readState.mode = modeSel.value;
      state.novel.readState.pageIndex = 0;
      await persistNovel();
      renderRead();
    });
  }
  var btnPrev = $('btnSsReadPrev');
  if (btnPrev) {
    btnPrev.addEventListener('click', async function() {
      if (!state.novel) return;
      var chapters = getActiveChapters(state.novel);
      var idx = chapters.findIndex(function(c) { return c.id === state.novel.readState.chapterId; });
      if (idx < 0) idx = 0;
      var mode = state.novel.readState.mode || 'swipe';
      if (mode === 'page' && state.novel.readState.pageIndex > 0) {
        state.novel.readState.pageIndex -= 1;
      } else if (idx > 0) {
        state.novel.readState.chapterId = chapters[idx - 1].id;
        state.novel.readState.pageIndex = 0;
      }
      await persistNovel();
      renderRead();
    });
  }
  var btnNext = $('btnSsReadNext');
  if (btnNext) {
    btnNext.addEventListener('click', async function() {
      if (!state.novel) return;
      var chapters = getActiveChapters(state.novel);
      var idx = chapters.findIndex(function(c) { return c.id === state.novel.readState.chapterId; });
      if (idx < 0) idx = 0;
      var mode = state.novel.readState.mode || 'swipe';
      var ch = chapters[idx];
      if (mode === 'page' && ch && ch.content) {
        var pageSize = 900;
        var pages = Math.max(1, Math.ceil(ch.content.length / pageSize));
        if ((state.novel.readState.pageIndex || 0) + 1 < pages) {
          state.novel.readState.pageIndex = (state.novel.readState.pageIndex || 0) + 1;
          await persistNovel();
          renderRead();
          return;
        }
      }
      if (idx + 1 < chapters.length) {
        state.novel.readState.chapterId = chapters[idx + 1].id;
        state.novel.readState.pageIndex = 0;
        await persistNovel();
        renderRead();
      }
    });
  }
  var btnBm = $('btnSsReadBookmark');
  if (btnBm) {
    btnBm.addEventListener('click', async function() {
      if (!state.novel) return;
      var chapters = getActiveChapters(state.novel);
      var chId = state.novel.readState.chapterId || (chapters[0] && chapters[0].id);
      if (!chId) return;
      state.novel.bookmarks = state.novel.bookmarks || [];
      var exists = state.novel.bookmarks.some(function(b) { return b.chapterId === chId; });
      if (!exists) {
        state.novel.bookmarks.push({
          id: genStoryId('bm'),
          chapterId: chId,
          note: '',
          createdAt: Date.now(),
        });
      }
      await persistNovel();
      setStatus('已添加书签');
      renderRead();
    });
  }
  var bmBox = $('ssReadBookmarks');
  if (bmBox) {
    bmBox.addEventListener('click', async function(ev) {
      var btn = ev.target.closest('[data-bm-ch]');
      if (!btn || !state.novel) return;
      state.novel.readState.chapterId = btn.getAttribute('data-bm-ch');
      state.novel.readState.pageIndex = 0;
      await persistNovel();
      renderRead();
    });
  }
  var btnFs = $('btnSsReadFullscreen');
  if (btnFs) {
    btnFs.addEventListener('click', function() {
      var el = $('ssReadStage');
      if (!el) return;
      if (!document.fullscreenElement) {
        if (el.requestFullscreen) el.requestFullscreen();
      } else if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    });
  }

  // swipe on read body
  var readBody = $('ssReadBody');
  if (readBody) {
    var touchX = 0;
    readBody.addEventListener('touchstart', function(ev) {
      if (ev.changedTouches && ev.changedTouches[0]) touchX = ev.changedTouches[0].clientX;
    }, { passive: true });
    readBody.addEventListener('touchend', function(ev) {
      if (!ev.changedTouches || !ev.changedTouches[0]) return;
      var dx = ev.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) < 60) return;
      if (dx < 0 && btnNext) btnNext.click();
      else if (dx > 0 && btnPrev) btnPrev.click();
    }, { passive: true });
  }

  window.addEventListener('card-draft-changed', function() {
    reloadCatalog().then(renderAll);
  });
  window.addEventListener('app-view-changed', function(ev) {
    var v = ev && ev.detail && ev.detail.view;
    if (v && String(v).indexOf('story-') === 0) {
      reloadCatalog().then(renderAll);
    }
  });
}

export async function initStoryStudio() {
  if (window.__storyStudioReady__) return;
  window.__storyStudioReady__ = true;
  bindEvents();
  try {
    await reloadCatalog();
  } catch (e) {
    console.warn('[storyStudio] load failed', e);
  }
  renderAll();
  window.__storyStudio__ = {
    getState: function() { return state; },
    reload: reloadCatalog,
    render: renderAll,
  };
}
