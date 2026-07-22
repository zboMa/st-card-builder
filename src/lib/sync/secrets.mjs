/**
 * AI 密钥独立云同步：口令加密后上云，本机解密使用
 * 上下载/清除只 replicate secrets/ai-config，不走全量 runSync。
 */
import { DOC } from './docIds.mjs';
import { getDoc, putDoc, removeDoc, replicateDocIdsWithRemote } from './pouch.mjs';
import { fetchSyncCredentials } from './syncEngine.mjs';
import {
  encryptJsonWithPassphrase,
  decryptJsonWithPassphrase,
  isEncryptedSecretsDoc,
} from './secretCrypto.mjs';

var AI_KEY = 'st_v3_builder_ai_config';

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

function readLocalAiConfig() {
  var raw = localStorage.getItem(AI_KEY);
  try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}

/** 仅推拉 secrets/ai-config，不影响全量同步状态与 syncSecrets 偏好 */
async function replicateAiSecretsOnly() {
  var cred = await fetchSyncCredentials();
  return replicateDocIdsWithRemote(cred, [DOC.aiSecrets]);
}

/** 加密写入本地 Pouch secrets 文档（仍须显式 sync 才上云） */
export async function saveEncryptedAiSecretsToLocalPouch(passphrase) {
  var data = readLocalAiConfig();
  if (!data) throw new Error('no_ai_config');
  var enc = await encryptJsonWithPassphrase(data, passphrase);
  await putDoc({
    _id: DOC.aiSecrets,
    type: 'ai-secrets',
    enc: enc,
    // 不再写明文 data
    data: null,
    encrypted: true,
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

/** 口令加密上传密钥到云端（仅 secrets 文档） */
export async function uploadAiSecretsToCloud(passphrase) {
  if (!passphrase) throw new Error('passphrase_required');
  await saveEncryptedAiSecretsToLocalPouch(passphrase);
  await replicateAiSecretsOnly();
}

/**
 * 从云端拉取密文并用口令解密写入 localStorage
 * @returns {object} 明文配置
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
    // 兼容旧明文文档：拉取后立即用口令重加密覆盖
    plain = doc.data;
    await saveEncryptedAiSecretsToLocalPouch(passphrase);
    await replicateAiSecretsOnly();
  } else {
    throw new Error('no_cloud_secrets');
  }
  localStorage.setItem(AI_KEY, JSON.stringify(plain));
  return plain;
}

export { isEncryptedSecretsDoc };
