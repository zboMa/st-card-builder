/**
 * 试聊 Episode 元数据（§6.3.8 · D12）
 * IDB: chatEpisodeV1:card:{draftId}
 */

import { idbGetJson, idbSetJson, idbDeleteJson } from '../idbStore.mjs';

export var EPISODE_STORE_PREFIX = 'chatEpisodeV1:card:';

export function chatEpisodeKey(draftId) {
  var id = String(draftId || '').trim();
  if (!id) return '';
  return EPISODE_STORE_PREFIX + id;
}

function genEpisodeId() {
  return 'ep_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export function createEpisodeRecord(partial) {
  var p = partial && typeof partial === 'object' ? partial : {};
  return {
    id: p.id || genEpisodeId(),
    messageIds: Array.isArray(p.messageIds) ? p.messageIds.map(String) : [],
    transcriptDigest: String(p.transcriptDigest != null ? p.transcriptDigest : ''),
    createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
    labels: Array.isArray(p.labels) ? p.labels.map(String) : undefined,
    promoted: p.promoted && typeof p.promoted === 'object' ? p.promoted : undefined,
  };
}

export async function loadEpisodes(draftId) {
  var key = chatEpisodeKey(draftId);
  if (!key) return [];
  var raw = await idbGetJson(key);
  return Array.isArray(raw) ? raw.map(createEpisodeRecord) : [];
}

export async function saveEpisodes(draftId, list) {
  var key = chatEpisodeKey(draftId);
  if (!key) return false;
  await idbSetJson(key, Array.isArray(list) ? list : []);
  return true;
}

export async function appendEpisode(draftId, partial) {
  var list = await loadEpisodes(draftId);
  var row = createEpisodeRecord(partial);
  list.push(row);
  await saveEpisodes(draftId, list);
  return row;
}

export async function updateEpisode(draftId, episodeId, patch) {
  var list = await loadEpisodes(draftId);
  var idx = list.findIndex(function(x) { return x && x.id === episodeId; });
  if (idx < 0) return null;
  list[idx] = createEpisodeRecord(Object.assign({}, list[idx], patch, { id: episodeId }));
  await saveEpisodes(draftId, list);
  return list[idx];
}

export async function deleteEpisodesForCard(draftId) {
  var key = chatEpisodeKey(draftId);
  if (!key) return false;
  await idbDeleteJson(key);
  return true;
}
