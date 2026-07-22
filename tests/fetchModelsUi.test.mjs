import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { readAiEnginePanelSources, readAiConfigPanelSources } from './helpers/uiSources.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('拉取模型 UI 反馈', function() {
  it('API 配置页有可见状态位，且 fetchModels 写入该位', function() {
    var aiPanel = readAiConfigPanelSources(root);
    assert.match(aiPanel, /id="fetchModelsStatus"/);
    assert.match(aiPanel, /type="button"[^>]*id="btnFetchModels"|id="btnFetchModels"[^>]*type="button"/);

    var engine = readAiEnginePanelSources(root);
    assert.match(engine, /fetchModelsStatus/);
    assert.match(engine, /CORS|跨域/);
    assert.match(engine, /chat\/completions/);
    assert.match(engine, /res\.ok/);
  });
});
