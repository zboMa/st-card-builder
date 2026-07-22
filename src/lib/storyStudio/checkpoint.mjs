/**
 * 章节 checkpoint（写前快照，便于回滚）
 */

import { genStoryId } from './state.mjs';

var MAX_CHECKPOINTS = 5;

/**
 * @param {object} chapter
 * @param {string} [label]
 */
export function pushChapterCheckpoint(chapter, label) {
  var ch = chapter && typeof chapter === 'object' ? chapter : null;
  if (!ch) return null;
  if (!Array.isArray(ch.checkpoints)) ch.checkpoints = [];
  var content = String(ch.content || '');
  if (!content.trim()) return null;
  var snap = {
    id: genStoryId('cp'),
    label: String(label || '自动快照'),
    content: content,
    summary: String(ch.summary || ''),
    advancePrompt: String(ch.advancePrompt || ''),
    feedForward: ch.feedForward && typeof ch.feedForward === 'object'
      ? JSON.parse(JSON.stringify(ch.feedForward))
      : null,
    quality: ch.quality && typeof ch.quality === 'object'
      ? JSON.parse(JSON.stringify(ch.quality))
      : null,
    createdAt: Date.now(),
  };
  ch.checkpoints.unshift(snap);
  if (ch.checkpoints.length > MAX_CHECKPOINTS) {
    ch.checkpoints = ch.checkpoints.slice(0, MAX_CHECKPOINTS);
  }
  return snap;
}

/**
 * @param {object} chapter
 * @param {string} checkpointId
 */
export function restoreChapterCheckpoint(chapter, checkpointId) {
  var ch = chapter && typeof chapter === 'object' ? chapter : null;
  if (!ch || !Array.isArray(ch.checkpoints)) return false;
  var id = String(checkpointId || '');
  var snap = ch.checkpoints.find(function(c) { return c && c.id === id; });
  if (!snap) return false;
  // 恢复前再存当前
  pushChapterCheckpoint(ch, '恢复前');
  ch.content = String(snap.content || '');
  ch.summary = String(snap.summary || '');
  ch.advancePrompt = String(snap.advancePrompt || '');
  if (snap.feedForward) ch.feedForward = JSON.parse(JSON.stringify(snap.feedForward));
  if (snap.quality) ch.quality = JSON.parse(JSON.stringify(snap.quality));
  return true;
}

export function listChapterCheckpoints(chapter) {
  var ch = chapter && typeof chapter === 'object' ? chapter : null;
  return ch && Array.isArray(ch.checkpoints) ? ch.checkpoints.slice() : [];
}
