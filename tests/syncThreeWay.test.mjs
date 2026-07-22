import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectLocalApiConfigPackage,
  applyLocalApiConfigPackage,
  AI_CONFIG_KEY,
  SEARCH_CONFIG_KEY,
  EMBED_URL_LS_KEY,
  EMBED_KEY_LS_KEY,
  EMBED_MODEL_LS_KEY,
  NOVEL_RAG_CFG_KEY,
} from '../src/lib/sync/secrets.mjs';
import {
  readLocalPromptOverrides,
  applyLocalPromptOverrides,
  readLocalUiPrefs,
  applyLocalUiPrefs,
  FX_KEY,
  CURRENT_CARD_KEY,
} from '../src/lib/sync/userPrefsMirror.mjs';
import { PROMPT_STORAGE_KEY } from '../src/lib/promptStore.mjs';
import { avatarDocId } from '../src/lib/sync/docIds.mjs';

function mockStorage() {
  var map = Object.create(null);
  return {
    getItem: function(k) { return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; },
    setItem: function(k, v) { map[k] = String(v); },
    removeItem: function(k) { delete map[k]; },
    _map: map,
  };
}

describe('API 配置包', function() {
  var prev;
  beforeEach(function() {
    prev = globalThis.localStorage;
    globalThis.localStorage = mockStorage();
  });
  afterEach(function() {
    globalThis.localStorage = prev;
  });

  it('collect 合并旁路键与搜索配置', function() {
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify({ url: 'https://api.example', key: 'sk', model: 'm1' }));
    localStorage.setItem(EMBED_URL_LS_KEY, 'https://embed.example');
    localStorage.setItem(EMBED_KEY_LS_KEY, 'ek');
    localStorage.setItem(EMBED_MODEL_LS_KEY, 'text-embedding');
    localStorage.setItem(SEARCH_CONFIG_KEY, JSON.stringify({ enabled: true, apiKey: 'search-key' }));
    var pkg = collectLocalApiConfigPackage();
    assert.equal(pkg.v, 2);
    assert.equal(pkg.aiConfig.url, 'https://api.example');
    assert.equal(pkg.aiConfig.key, 'sk');
    assert.equal(pkg.aiConfig.embeddingApiUrl, 'https://embed.example');
    assert.equal(pkg.aiConfig.embeddingApiKey, 'ek');
    assert.equal(pkg.aiConfig.embeddingModel, 'text-embedding');
    assert.equal(pkg.searchConfig.apiKey, 'search-key');
  });

  it('apply 回写主配置、旁路键与搜索；兼容旧整份 ai_config', function() {
    applyLocalApiConfigPackage({
      v: 2,
      aiConfig: {
        url: 'u',
        key: 'k',
        embeddingApiUrl: 'eu',
        embeddingApiKey: 'ek',
        embeddingModel: 'em',
        novelRag: { enabled: false, budget: 1000 },
      },
      searchConfig: { enabled: false, engine: 'bing' },
    });
    assert.equal(JSON.parse(localStorage.getItem(AI_CONFIG_KEY)).key, 'k');
    assert.equal(localStorage.getItem(EMBED_URL_LS_KEY), 'eu');
    assert.equal(localStorage.getItem(EMBED_KEY_LS_KEY), 'ek');
    assert.equal(localStorage.getItem(EMBED_MODEL_LS_KEY), 'em');
    assert.equal(JSON.parse(localStorage.getItem(NOVEL_RAG_CFG_KEY)).budget, 1000);
    assert.equal(JSON.parse(localStorage.getItem(SEARCH_CONFIG_KEY)).engine, 'bing');

    applyLocalApiConfigPackage({ url: 'legacy', key: 'old' });
    assert.equal(JSON.parse(localStorage.getItem(AI_CONFIG_KEY)).key, 'old');
  });
});

describe('用户配置 prefs 读写', function() {
  var prev;
  beforeEach(function() {
    prev = globalThis.localStorage;
    globalThis.localStorage = mockStorage();
  });
  afterEach(function() {
    globalThis.localStorage = prev;
  });

  it('prompts / ui roundtrip', function() {
    applyLocalPromptOverrides({ charGen: '自定义' });
    assert.equal(readLocalPromptOverrides().charGen, '自定义');
    assert.equal(localStorage.getItem(PROMPT_STORAGE_KEY).indexOf('charGen') >= 0, true);

    applyLocalUiPrefs({ fxEnabled: '0', currentCardId: 'draft_1' });
    var ui = readLocalUiPrefs();
    assert.equal(ui.fxEnabled, '0');
    assert.equal(ui.currentCardId, 'draft_1');
    assert.equal(localStorage.getItem(FX_KEY), '0');
    assert.equal(localStorage.getItem(CURRENT_CARD_KEY), 'draft_1');
  });
});

describe('avatar doc id', function() {
  it('full/thumb', function() {
    assert.equal(avatarDocId('c1', 'full'), 'avatar/c1/full');
    assert.equal(avatarDocId('c1', 'thumb'), 'avatar/c1/thumb');
  });
});
