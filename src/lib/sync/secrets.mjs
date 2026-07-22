/**
 * 用户 API 配置包：口令加密上云（主动；走 /api/data/secrets）
 */
import { DOC } from './docIds.mjs';
import * as api from './cloudApi.mjs';
import { enqueueOutbox } from './outbox.mjs';
import { isCloudEnabled } from './cloudStore.mjs';
import {
  encryptJsonWithPassphrase,
  decryptJsonWithPassphrase,
  isEncryptedSecretsDoc,
} from './secretCrypto.mjs';

export var AI_CONFIG_KEY = 'st_v3_builder_ai_config';
export var SEARCH_CONFIG_KEY = 'st_v3_builder_search_config';
export var EMBED_URL_LS_KEY = 'st_v3_builder_embedding_api_url';
export var EMBED_KEY_LS_KEY = 'st_v3_builder_embedding_api_key';
export var EMBED_MODEL_LS_KEY = 'st_v3_builder_embedding_model';
export var NOVEL_RAG_CFG_KEY = 'st_v3_builder_novel_rag';

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    var v = JSON.parse(raw);
    return v == null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

export function collectLocalApiConfigPackage() {
  var ai = parseJson(localStorage.getItem(AI_CONFIG_KEY), null);
  if (!ai || typeof ai !== 'object') ai = {};

  var embedUrl = localStorage.getItem(EMBED_URL_LS_KEY);
  var embedKey = localStorage.getItem(EMBED_KEY_LS_KEY);
  var embedModel = localStorage.getItem(EMBED_MODEL_LS_KEY);
  var novelRag = parseJson(localStorage.getItem(NOVEL_RAG_CFG_KEY), null);
  if (embedUrl && !ai.embeddingApiUrl) ai.embeddingApiUrl = embedUrl;
  if (embedKey && !ai.embeddingApiKey) ai.embeddingApiKey = embedKey;
  if (embedModel && !ai.embeddingModel) ai.embeddingModel = embedModel;
  if (novelRag && !ai.novelRag) ai.novelRag = novelRag;

  var searchConfig = parseJson(localStorage.getItem(SEARCH_CONFIG_KEY), null);

  return {
    v: 2,
    type: 'ai-api-config-package',
    aiConfig: ai,
    searchConfig: searchConfig && typeof searchConfig === 'object' ? searchConfig : null,
  };
}

export function applyLocalApiConfigPackage(pkg) {
  if (!pkg || typeof pkg !== 'object') throw new Error('invalid_api_config_package');

  var ai;
  var search = null;
  if (pkg.aiConfig && typeof pkg.aiConfig === 'object') {
    ai = pkg.aiConfig;
    if (pkg.searchConfig && typeof pkg.searchConfig === 'object') search = pkg.searchConfig;
  } else {
    ai = pkg;
  }

  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(ai));
  if (ai.embeddingApiUrl != null) {
    localStorage.setItem(EMBED_URL_LS_KEY, String(ai.embeddingApiUrl || ''));
  }
  if (ai.embeddingApiKey != null) {
    localStorage.setItem(EMBED_KEY_LS_KEY, String(ai.embeddingApiKey || ''));
  }
  if (ai.embeddingModel != null) {
    localStorage.setItem(EMBED_MODEL_LS_KEY, String(ai.embeddingModel || ''));
  }
  if (ai.novelRag && typeof ai.novelRag === 'object') {
    localStorage.setItem(NOVEL_RAG_CFG_KEY, JSON.stringify(ai.novelRag));
  }
  if (search) {
    localStorage.setItem(SEARCH_CONFIG_KEY, JSON.stringify(search));
  }
  return { aiConfig: ai, searchConfig: search };
}

export async function getSyncSecretsPref() {
  try {
    var raw = localStorage.getItem('st_v3_sync_prefs_v1');
    var prefs = raw ? JSON.parse(raw) : {};
    return !!prefs.syncSecrets;
  } catch (e) {
    return false;
  }
}

export async function setSyncSecretsPref(on) {
  var prefs = {};
  try {
    prefs = JSON.parse(localStorage.getItem('st_v3_sync_prefs_v1') || '{}') || {};
  } catch (e) { prefs = {}; }
  prefs.syncSecrets = !!on;
  prefs.updatedAt = new Date().toISOString();
  localStorage.setItem('st_v3_sync_prefs_v1', JSON.stringify(prefs));
}

export async function saveEncryptedAiSecretsLocal(passphrase) {
  var data = collectLocalApiConfigPackage();
  var hasAny = data.aiConfig && (
    data.aiConfig.url || data.aiConfig.key || data.aiConfig.model
    || data.aiConfig.embeddingApiKey || data.aiConfig.embeddingApiUrl
  );
  if (!hasAny && !data.searchConfig) throw new Error('no_ai_config');
  var enc = await encryptJsonWithPassphrase(data, passphrase);
  try {
    localStorage.setItem('st_v3_ai_secrets_enc_cache', JSON.stringify({
      enc: enc,
      packageVersion: 2,
      updatedAt: new Date().toISOString(),
    }));
  } catch (e) { /* ignore */ }
  return enc;
}

/** @deprecated 兼容旧名 */
export async function saveEncryptedAiSecretsToLocalPouch(passphrase) {
  return saveEncryptedAiSecretsLocal(passphrase);
}

export async function loadAiSecretsEnvelopeFromLocalPouch() {
  try {
    var raw = localStorage.getItem('st_v3_ai_secrets_enc_cache');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export async function clearCloudAiSecrets() {
  try {
    localStorage.removeItem('st_v3_ai_secrets_enc_cache');
  } catch (e) { /* ignore */ }
  if (!isCloudEnabled()) {
    enqueueOutbox({ op: 'deleteSecrets', dedupeKey: 'deleteSecrets' });
    return;
  }
  try {
    await api.deleteAiSecretsEnc();
  } catch (e) {
    enqueueOutbox({ op: 'deleteSecrets', dedupeKey: 'deleteSecrets' });
    throw e;
  }
}

export async function uploadAiSecretsToCloud(passphrase) {
  if (!passphrase) throw new Error('passphrase_required');
  var enc = await saveEncryptedAiSecretsLocal(passphrase);
  if (!isCloudEnabled()) {
    enqueueOutbox({
      op: 'putSecrets',
      body: { enc: enc, packageVersion: 2 },
      dedupeKey: 'putSecrets',
    });
    return;
  }
  await api.putAiSecretsEnc(enc, 2);
}

export async function downloadAiSecretsFromCloud(passphrase) {
  if (!passphrase) throw new Error('passphrase_required');
  var res = await api.getAiSecretsEnc();
  var doc = res && res.doc;
  if (!doc) throw new Error('no_cloud_secrets');

  var plain;
  if (isEncryptedSecretsDoc(doc)) {
    plain = await decryptJsonWithPassphrase(doc.enc, passphrase);
  } else if (doc.data && typeof doc.data === 'object') {
    plain = doc.data;
  } else if (doc.enc) {
    plain = await decryptJsonWithPassphrase(doc.enc, passphrase);
  } else {
    throw new Error('no_cloud_secrets');
  }
  try {
    localStorage.setItem('st_v3_ai_secrets_enc_cache', JSON.stringify({
      enc: doc.enc || null,
      packageVersion: doc.packageVersion || 2,
      updatedAt: doc.updatedAt || new Date().toISOString(),
    }));
  } catch (e) { /* ignore */ }
  return applyLocalApiConfigPackage(plain);
}

export { isEncryptedSecretsDoc, DOC };
