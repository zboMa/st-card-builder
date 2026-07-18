/**
 * Embedding API 配置解析：独立 URL/Key/Model，空字段回退主 Chat API。
 */
import { DEFAULT_EMBED_MODEL } from './embedClient.mjs';

export var EMBEDDING_API_URL_KEY = 'st_v3_builder_embedding_api_url';
export var EMBEDDING_API_KEY_KEY = 'st_v3_builder_embedding_api_key';
export var EMBEDDING_MODEL_KEY = 'st_v3_builder_embedding_model';

/**
 * 解析 Embedding 配置：独立字段优先，空则回退主 API；模型空则默认 text-embedding-3-small。
 *
 * @param {{
 *   embeddingApiUrl?: string,
 *   embeddingApiKey?: string,
 *   embeddingModel?: string,
 *   apiUrl?: string,
 *   apiKey?: string,
 * }} raw
 * @returns {{ apiUrl: string, apiKey: string, embeddingModel: string }}
 */
export function getEmbeddingConfig(raw) {
  raw = raw || {};
  var apiUrl = String(raw.embeddingApiUrl || '').trim() || String(raw.apiUrl || '').trim();
  apiUrl = apiUrl.replace(/\/$/, '');
  var apiKey = String(raw.embeddingApiKey || '').trim() || String(raw.apiKey || '').trim();
  var embeddingModel = String(raw.embeddingModel || '').trim() || DEFAULT_EMBED_MODEL;
  return {
    apiUrl: apiUrl,
    apiKey: apiKey,
    embeddingModel: embeddingModel,
  };
}
