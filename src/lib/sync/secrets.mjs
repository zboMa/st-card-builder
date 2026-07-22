/**
 * 用户 API 配置包：口令加密上云（主动同步，不进全量 runSync）
 * 包内含完整 AI 面板配置 + 联网搜索，下载后回写旁路 Embedding 键。
 */
import { DOC } from './docIds.mjs';
import { getDoc, putDoc, removeDoc, replicateDocIdsWithRemote } from './pouch.mjs';
import { fetchSyncCredentials } from './syncEngine.mjs';
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

/**
 * 汇总本机完整 API 配置包（含旁路键与搜索）
 * @returns {{ v: number, aiConfig: object, searchConfig: object|null }}
 */
export function collectLocalApiConfigPackage() {
  var ai = parseJson(localStorage.getItem(AI_CONFIG_KEY), null);
  if (!ai || typeof ai !== 'object') ai = {};

  // 旁路键补齐（面板可能只写了独立 LS）
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

/**
 * 将配置包写回 localStorage（兼容旧版「整份 ai_config」明文）
 * @param {object} pkg
 */
export function applyLocalApiConfigPackage(pkg) {
  if (!pkg || typeof pkg !== 'object') throw new Error('invalid_api_config_package');

  var ai;
  var search = null;
  if (pkg.aiConfig && typeof pkg.aiConfig === 'object') {
    ai = pkg.aiConfig;
    if (pkg.searchConfig && typeof pkg.searchConfig === 'object') search = pkg.searchConfig;
  } else {
    // 旧格式：加密对象本身就是 ai_config
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
  var prefs = await getDoc(DOC.syncPrefs);
  return !!(prefs && prefs.syncSecrets);
}

export async function setSyncSecretsPref(on) {
  var prefs = await getDoc(DOC.syncPrefs);
  var next = Object.assign({}, prefs || {}, {
    _id: DOC.syncPrefs,
    type: 'sync-prefs',
    syncSecrets: !!on,
    updatedAt: new Date().toISOString(),
  });
  await putDoc(next, { skipDirty: true });
}

async function replicateAiSecretsOnly() {
  var cred = await fetchSyncCredentials();
  return replicateDocIdsWithRemote(cred, [DOC.aiSecrets]);
}

export async function saveEncryptedAiSecretsToLocalPouch(passphrase) {
  var data = collectLocalApiConfigPackage();
  if (!data.aiConfig || (typeof data.aiConfig === 'object' && !Object.keys(data.aiConfig).length && !data.searchConfig)) {
    // 允许仅有空对象时仍报错，避免无意义上传
    var hasAny = data.aiConfig && (
      data.aiConfig.url || data.aiConfig.key || data.aiConfig.model
      || data.aiConfig.embeddingApiKey || data.aiConfig.embeddingApiUrl
    );
    if (!hasAny && !data.searchConfig) throw new Error('no_ai_config');
  }
  var enc = await encryptJsonWithPassphrase(data, passphrase);
  await putDoc({
    _id: DOC.aiSecrets,
    type: 'ai-secrets',
    enc: enc,
    data: null,
    encrypted: true,
    packageVersion: 2,
    updatedAt: new Date().toISOString(),
  });
  return true;
}

export async function loadAiSecretsEnvelopeFromLocalPouch() {
  return getDoc(DOC.aiSecrets);
}

export async function clearCloudAiSecrets() {
  await removeDoc(DOC.aiSecrets);
  await replicateAiSecretsOnly();
}

/** 口令加密上传完整 AI API 配置到云端 */
export async function uploadAiSecretsToCloud(passphrase) {
  if (!passphrase) throw new Error('passphrase_required');
  await saveEncryptedAiSecretsToLocalPouch(passphrase);
  await replicateAiSecretsOnly();
}

/**
 * 从云端拉取并解密写入本地
 * @returns {{ aiConfig: object, searchConfig: object|null }}
 */
export async function downloadAiSecretsFromCloud(passphrase) {
  if (!passphrase) throw new Error('passphrase_required');
  await replicateAiSecretsOnly();
  var doc = await loadAiSecretsEnvelopeFromLocalPouch();
  if (!doc) throw new Error('no_cloud_secrets');

  var plain;
  if (isEncryptedSecretsDoc(doc)) {
    plain = await decryptJsonWithPassphrase(doc.enc, passphrase);
  } else if (doc.data && typeof doc.data === 'object') {
    plain = doc.data;
    // 旧明文：用新包装重加密
    await saveEncryptedAiSecretsToLocalPouch(passphrase);
    await replicateAiSecretsOnly();
  } else {
    throw new Error('no_cloud_secrets');
  }
  return applyLocalApiConfigPackage(plain);
}

export { isEncryptedSecretsDoc };
