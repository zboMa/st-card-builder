import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

describe('split import regression', function() {
  it('adultConfigPanel 从 shared 挂载 hint 方法而非裸引用', function() {
    var src = readFileSync(join(root, 'src/lib/card-builder/panels/adultConfigPanel.mjs'), 'utf8');
    assert.match(src, /buildNsfwFlavorHint:\s*s\.buildNsfwFlavorHint/);
    assert.doesNotMatch(src, /buildNsfwFlavorHint:\s*buildNsfwFlavorHint/);
  });

  it('bootSetupGreetings 导入 buildSetupCorpus 与 RAG 依赖', function() {
    var src = readFileSync(join(root, 'src/lib/novel/bootSetupGreetings.mjs'), 'utf8');
    assert.match(src, /import \{ buildSetupCorpus \} from '\.\/chapters\.mjs'/);
    assert.match(src, /import \{ DEFAULT_EXPAND_BUDGET \} from '\.\/recall\.mjs'/);
    assert.match(src, /import \{ findEntityMatch \} from '\.\/entityStore\.mjs'/);
    assert.match(src, /import \{ hybridSearch \} from '\.\/rag\/hybridSearch\.mjs'/);
    assert.match(src, /import \{ buildRagInjectBlock, pickRelatedEntities \} from '\.\/rag\/inject\.mjs'/);
  });
});
