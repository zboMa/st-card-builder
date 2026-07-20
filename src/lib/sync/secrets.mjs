/**
 * AI 密钥独立云同步（默认不同步）
 */
import { DOC } from './docIds.mjs';
import { getDoc, putDoc, removeDoc } from './pouch.mjs';
import { runSync, fetchSyncCredentials } from './syncEngine.mjs';

var AI_KEY = 'st_v3_builder_ai_config';

export async function getSyncSecretsPref() {
  var prefs = await getDoc(DOC.syncPrefs);
  return !!(prefs && prefs.syncSecrets);
}

export async function setSyncSecretsPref(on) {
  await putDoc({
    _id: DOC.syncPrefs,
    type: 'sync-prefs',
    syncSecrets: !!on,
    updatedAt: new Date().toISOString(),
  });
}

/** 将当前 localStorage AI 配置写入本地 secrets 文档（仍须显式 sync 才上云） */
export async function saveAiSecretsToLocalPouch() {
  var raw = localStorage.getItem(AI_KEY);
  var data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch (e) { data = null; }
  if (!data) throw new Error('no_ai_config');
  await putDoc({
    _id: DOC.aiSecrets,
    type: 'ai-secrets',
    data: data,
    updatedAt: new Date().toISOString(),
  });
  return true;
}

export async function loadAiSecretsFromLocalPouch() {
  var doc = await getDoc(DOC.aiSecrets);
  return doc && doc.data ? doc.data : null;
}

export async function clearCloudAiSecrets() {
  await removeDoc(DOC.aiSecrets);
  await setSyncSecretsPref(true);
  await fetchSyncCredentials();
  // 推送删除：需要 includeSecrets
  await runSync({ includeSecrets: true, refreshCred: false });
  await setSyncSecretsPref(false);
}

/** 上传密钥到云端（用户显式操作） */
export async function uploadAiSecretsToCloud() {
  await saveAiSecretsToLocalPouch();
  await setSyncSecretsPref(true);
  await runSync({ includeSecrets: true, refreshCred: true });
}

/** 从云端拉取密钥到 localStorage */
export async function downloadAiSecretsFromCloud() {
  await setSyncSecretsPref(true);
  await runSync({ includeSecrets: true, refreshCred: true });
  var data = await loadAiSecretsFromLocalPouch();
  if (!data) throw new Error('no_cloud_secrets');
  localStorage.setItem(AI_KEY, JSON.stringify(data));
  return data;
}
