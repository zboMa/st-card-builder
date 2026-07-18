/**
 * Embedding API 独立配置解析
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getEmbeddingConfig,
  EMBEDDING_API_URL_KEY,
  EMBEDDING_API_KEY_KEY,
  EMBEDDING_MODEL_KEY,
} from '../src/lib/novel/rag/embeddingConfig.mjs';
import { DEFAULT_EMBED_MODEL } from '../src/lib/novel/rag/embedClient.mjs';

describe('getEmbeddingConfig', function() {
  it('独立 Embedding 配置优先于主 API', function() {
    var resolved = getEmbeddingConfig({
      apiUrl: 'https://chat.example/v1',
      apiKey: 'chat-key',
      embeddingApiUrl: 'https://embed.example/v1/',
      embeddingApiKey: 'embed-key',
      embeddingModel: 'bge-m3',
    });
    assert.equal(resolved.apiUrl, 'https://embed.example/v1');
    assert.equal(resolved.apiKey, 'embed-key');
    assert.equal(resolved.embeddingModel, 'bge-m3');
  });

  it('Embedding URL/Key 留空时回退主 API', function() {
    var resolved = getEmbeddingConfig({
      apiUrl: 'https://chat.example/v1/',
      apiKey: 'chat-key',
      embeddingApiUrl: '  ',
      embeddingApiKey: '',
      embeddingModel: '',
    });
    assert.equal(resolved.apiUrl, 'https://chat.example/v1');
    assert.equal(resolved.apiKey, 'chat-key');
    assert.equal(resolved.embeddingModel, DEFAULT_EMBED_MODEL);
  });

  it('仅填 Embedding URL 时 Key 仍回退主 API', function() {
    var resolved = getEmbeddingConfig({
      apiUrl: 'https://chat.example/v1',
      apiKey: 'chat-key',
      embeddingApiUrl: 'https://embed.example/v1',
      embeddingApiKey: '',
      embeddingModel: 'text-embedding-3-large',
    });
    assert.equal(resolved.apiUrl, 'https://embed.example/v1');
    assert.equal(resolved.apiKey, 'chat-key');
    assert.equal(resolved.embeddingModel, 'text-embedding-3-large');
  });

  it('导出 localStorage key 常量', function() {
    assert.equal(EMBEDDING_API_URL_KEY, 'st_v3_builder_embedding_api_url');
    assert.equal(EMBEDDING_API_KEY_KEY, 'st_v3_builder_embedding_api_key');
    assert.equal(EMBEDDING_MODEL_KEY, 'st_v3_builder_embedding_model');
  });
});
