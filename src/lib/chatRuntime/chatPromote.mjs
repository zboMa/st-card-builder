/**
 * 试聊 Episode → Story Promote（§6.3.8 · D12）
 * 浏览器侧：通过 IDB 读写 novel；不依赖 Story Studio 已打开。
 */

import { loadNovel, saveNovel, loadCatalog, saveCatalog, loadActiveNovelId } from '../storyStudio/idb.mjs';
import { createEmptyNovel, createEmptyChapter, normalizeNovel } from '../storyStudio/state.mjs';
import { createLedgerItem, LEDGER_STATUSES } from '../storyStudio/plotLedger.mjs';
import { appendEpisode, updateEpisode } from './episodeStore.mjs';
import { formatChatTranscriptVerbatim, pickMessagesByIds, transcriptDigestFromMessages } from './transcriptFormat.mjs';
import { appendPromotionLog } from '../promotionLog.mjs';

function upsertCatalogEntry(catalog, novel) {
  var list = Array.isArray(catalog) ? catalog.slice() : [];
  var id = novel && novel.id;
  if (!id) return list;
  var idx = list.findIndex(function(x) { return x && (x.id === id || x.novelId === id); });
  var entry = {
    id: id,
    novelId: id,
    title: String(novel.title || '未命名小说'),
    updatedAt: Date.now(),
  };
  if (idx >= 0) list[idx] = Object.assign({}, list[idx], entry);
  else list.push(entry);
  return list;
}

function maxChapterOrder(chapters, branchId) {
  var max = -1;
  (chapters || []).forEach(function(c) {
    if (!c) return;
    if (branchId && c.branchId && c.branchId !== branchId) return;
    if (typeof c.order === 'number' && c.order > max) max = c.order;
  });
  return max;
}

/**
 * @param {object} opts
 * @param {string} opts.draftId
 * @param {string} opts.novelId
 * @param {string[]} opts.messageIds
 * @param {object[]} opts.allMessages session messages
 * @param {string} opts.userName
 * @param {string} opts.sceneName
 * @param {object} [opts.chapterDraft]
 * @param {object} [opts.plotLedger]
 * @param {object} [opts.mvuSnapshot]
 * @param {string} [opts.episodeId]
 */
export async function promoteChatEpisodeToStory(opts) {
  var o = opts || {};
  var draftId = String(o.draftId || '').trim();
  var novelId = String(o.novelId || '').trim();
  if (!draftId || !novelId) {
    return { ok: false, error: '缺少 draftId 或 novelId' };
  }

  var picked = pickMessagesByIds(o.allMessages || [], o.messageIds || []);
  if (o.chapterDraft && picked.messages.length === 0) {
    return { ok: false, error: '选段已过期，请重新选段' };
  }

  var novel = await loadNovel(draftId, novelId);
  if (!novel) {
    novel = createEmptyNovel({ cardId: draftId, title: '未命名小说' });
    novel.id = novelId;
  }
  novel = normalizeNovel(novel);

  var episodeId = o.episodeId || '';
  var digest = transcriptDigestFromMessages(picked.messages);
  if (!episodeId) {
    var ep = await appendEpisode(draftId, {
      messageIds: (o.messageIds || []).slice(),
      transcriptDigest: digest,
    });
    episodeId = ep.id;
  }

  var branchId = String(novel.activeBranchId || '');
  var result = { ok: true, episodeId: episodeId, novelId: novelId, skippedMessages: picked.skipped };

  if (o.chapterDraft) {
    var cd = o.chapterDraft;
    var mode = cd.mode === 'polish' ? 'polish' : 'verbatim';
    var content = mode === 'verbatim'
      ? formatChatTranscriptVerbatim(picked.messages, {
        userName: o.userName,
        sceneName: o.sceneName,
        episodeId: episodeId,
      })
      : String(cd.content || '');
    var ch = createEmptyChapter({
      title: String(cd.title || ('试聊归档 · ' + new Date().toISOString().slice(0, 10))),
      summary: digest.slice(0, 200),
      content: content,
      order: maxChapterOrder(novel.chapters, branchId) + 1,
      branchId: branchId,
    });
    ch.sourceMeta = {
      kind: 'chat_episode',
      episodeId: episodeId,
      messageIds: (o.messageIds || []).slice(),
      promotedAt: Date.now(),
      mode: mode,
    };
    if (!Array.isArray(novel.chapters)) novel.chapters = [];
    novel.chapters.push(ch);
    result.chapterId = ch.id;
  }

  if (o.plotLedger && o.plotLedger.title) {
    if (!Array.isArray(novel.plotLedger)) novel.plotLedger = [];
    var st = String(o.plotLedger.status || 'open');
    if (LEDGER_STATUSES.indexOf(st) < 0) st = 'open';
    if (result.chapterId && o.plotLedger.linkChapter !== false) st = 'planted';
    var ledger = createLedgerItem({
      title: o.plotLedger.title,
      note: String(o.plotLedger.note || ''),
      status: st,
      plantedChapterId: result.chapterId || '',
      branchId: branchId,
    });
    if (o.plotLedger.includeMvu && o.mvuSnapshot) {
      ledger.mvuSnapshot = o.mvuSnapshot;
    }
    ledger.source = {
      kind: 'chat_episode',
      episodeId: episodeId,
      messageIds: (o.messageIds || []).slice(),
    };
    novel.plotLedger.push(ledger);
    result.plotLedgerId = ledger.id;
  }

  novel.updatedAt = Date.now();
  await saveNovel(draftId, novelId, novel);
  var catalog = await loadCatalog(draftId);
  await saveCatalog(draftId, upsertCatalogEntry(catalog, novel));

  await updateEpisode(draftId, episodeId, {
    promoted: {
      at: Date.now(),
      novelId: novelId,
      chapterId: result.chapterId,
      plotLedgerId: result.plotLedgerId,
    },
    transcriptDigest: digest,
  });

  await appendPromotionLog(draftId, {
    kind: 'story_from_chat',
    source: { view: 'chat_playground', episodeId: episodeId },
    target: { novelId: novelId, chapterId: result.chapterId, plotLedgerId: result.plotLedgerId },
    actor: o.chapterDraft && o.chapterDraft.mode === 'polish' ? 'assistant' : 'user',
    summary: '试聊归档：' + picked.messages.length + ' 条 → ' + String(novel.title || novelId),
  });

  return result;
}

/** 列出该卡 Story catalog（Promote 弹窗用） */
export async function listStoryCatalogForCard(draftId) {
  return loadCatalog(draftId);
}

export async function getActiveStoryNovelIdForCard(draftId) {
  return loadActiveNovelId(draftId);
}

export async function createBlankStoryNovel(draftId, title) {
  var novel = createEmptyNovel({ cardId: draftId, title: String(title || '').trim() || '未命名小说' });
  await saveNovel(draftId, novel.id, novel);
  var catalog = await loadCatalog(draftId);
  await saveCatalog(draftId, upsertCatalogEntry(catalog, novel));
  return novel;
}
