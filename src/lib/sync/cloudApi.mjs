/**
 * 云端数据 REST 客户端（Session Cookie）
 */
import { apiFetch } from '../publicConfig.mjs';

async function readJson(res) {
  var text = await res.text();
  var data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) {
    data = { raw: text };
  }
  return { res: res, data: data };
}

export async function cloudRequest(method, path, body, opts) {
  opts = opts || {};
  var init = {
    method: method,
    headers: {},
  };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  var out = await readJson(await apiFetch(path, init));
  if (out.res.status === 401) {
    var err = new Error('unauthorized');
    err.status = 401;
    err.data = out.data;
    throw err;
  }
  if (!out.res.ok) {
    var msg = (out.data && (out.data.message || out.data.error)) || ('http_' + out.res.status);
    var err2 = new Error(String(msg));
    err2.status = out.res.status;
    err2.data = out.data;
    err2.code = out.data && out.data.error;
    throw err2;
  }
  return out.data;
}

export function cloudGet(path) {
  return cloudRequest('GET', path);
}

export function cloudPut(path, body) {
  return cloudRequest('PUT', path, body);
}

export function cloudDelete(path) {
  return cloudRequest('DELETE', path);
}

export function fetchCloudStatus() {
  return cloudGet('/api/data/status');
}

export function fetchCloudCards() {
  return cloudGet('/api/data/cards');
}

export function fetchCardBundle(cardId) {
  return cloudGet('/api/data/cards/' + encodeURIComponent(cardId) + '/bundle');
}

export function putCardDraft(cardId, draft, opts) {
  opts = opts || {};
  return cloudPut('/api/data/cards/' + encodeURIComponent(cardId), {
    data: draft,
    force: opts.force !== false,
    baseRev: opts.baseRev,
  });
}

export function putCardBundle(cardId, bundle) {
  return cloudPut('/api/data/cards/' + encodeURIComponent(cardId) + '/bundle', {
    bundle: bundle,
    force: true,
  });
}

export function deleteCloudCard(cardId, opts) {
  opts = opts || {};
  var q = opts.deleteStories ? '?deleteStories=1' : '';
  return cloudDelete('/api/data/cards/' + encodeURIComponent(cardId) + q);
}

export function getStoryCatalog(cardId) {
  return cloudGet('/api/data/stories/' + encodeURIComponent(cardId) + '/catalog');
}

export function getStoryActive(cardId) {
  return cloudGet('/api/data/stories/' + encodeURIComponent(cardId) + '/active');
}

export function getStoryNovel(cardId, novelId) {
  return cloudGet(
    '/api/data/stories/' + encodeURIComponent(cardId) + '/' + encodeURIComponent(novelId)
  );
}

export function putCloudDoc(doc, opts) {
  opts = opts || {};
  return cloudPut('/api/data/doc', Object.assign({}, doc, {
    force: opts.force !== false,
    baseRev: opts.baseRev,
  }));
}

export function getCloudDoc(docId) {
  return cloudGet('/api/data/doc?id=' + encodeURIComponent(docId));
}

export function deleteCloudDoc(docId) {
  return cloudDelete('/api/data/doc?id=' + encodeURIComponent(docId) + '&force=1');
}

export function putPrefs(kind, data) {
  return cloudPut('/api/data/prefs/' + encodeURIComponent(kind), { data: data });
}

export function getPrefs(kind) {
  return cloudGet('/api/data/prefs/' + encodeURIComponent(kind));
}

export function putAiSecretsEnc(enc, packageVersion) {
  return cloudPut('/api/data/secrets/ai-config', {
    enc: enc,
    packageVersion: packageVersion || 2,
  });
}

export function getAiSecretsEnc() {
  return cloudGet('/api/data/secrets/ai-config');
}

export function deleteAiSecretsEnc() {
  return cloudDelete('/api/data/secrets/ai-config');
}

export function putNovel(cardId, data) {
  return cloudPut('/api/data/novels/' + encodeURIComponent(cardId), { data: data });
}

export function putRag(cardId, data) {
  return cloudPut('/api/data/rag/' + encodeURIComponent(cardId), { data: data });
}

export function putAvatar(cardId, kind, data, contentType) {
  return cloudPut(
    '/api/data/avatars/' + encodeURIComponent(cardId) + '/' + (kind === 'thumb' ? 'thumb' : 'full'),
    { data: data, contentType: contentType || 'image/jpeg' }
  );
}

export function putStoryCatalog(cardId, list) {
  return cloudPut('/api/data/stories/' + encodeURIComponent(cardId) + '/catalog', { data: list });
}

export function putStoryActive(cardId, novelId) {
  return cloudPut('/api/data/stories/' + encodeURIComponent(cardId) + '/active', {
    data: { novelId: String(novelId || ''), updatedAt: Date.now() },
  });
}

export function putStoryNovel(cardId, novel) {
  var nid = novel && novel.id;
  return cloudPut(
    '/api/data/stories/' + encodeURIComponent(cardId) + '/' + encodeURIComponent(nid),
    { data: novel }
  );
}

export function putStoryRelease(cardId, novelId, release) {
  return cloudPut(
    '/api/data/stories/' + encodeURIComponent(cardId) + '/' + encodeURIComponent(novelId) + '/release',
    { data: release }
  );
}

export function deleteStoryNovel(cardId, novelId) {
  return cloudDelete(
    '/api/data/stories/' + encodeURIComponent(cardId) + '/' + encodeURIComponent(novelId)
  );
}

export function fetchCloudQuota() {
  return cloudGet('/api/data/quota');
}

export function fetchCardConflict(cardId) {
  return cloudGet('/api/data/cards/' + encodeURIComponent(cardId) + '/conflict');
}

export function fetchCloudExport() {
  return cloudGet('/api/data/export');
}

export function fetchAuthTokens() {
  return cloudGet('/api/auth/tokens');
}

export function revokeAuthToken(docId) {
  return cloudDelete('/api/auth/tokens/' + encodeURIComponent(docId));
}
