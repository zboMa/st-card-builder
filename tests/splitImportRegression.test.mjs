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

  it('adultConfigPanel 读取 corruptionTargetsCache 走 shared', function() {
    var src = readFileSync(join(root, 'src/lib/card-builder/panels/adultConfigPanel.mjs'), 'utf8');
    assert.match(src, /s\.corruptionTargetsCache\[idx\]/);
    assert.doesNotMatch(src, /[^.]corruptionTargetsCache\[idx\]/);
  });

  it('worldbookBind 事件绑定走 shared 闭包', function() {
    var src = readFileSync(join(root, 'src/lib/card-builder/panels/worldbookBind.mjs'), 'utf8');
    assert.match(src, /s\.toggleCreateEntryForm/);
    assert.doesNotMatch(src, /addEventListener\('click',\s*toggleCreateEntryForm\)/);
  });

  it('aiEnginePanel 预设勾选走 shared.parsedPresetList', function() {
    var src = readFileSync(join(root, 'src/lib/card-builder/panels/aiEnginePanel.mjs'), 'utf8');
    assert.match(src, /s\.parsedPresetList\[/);
    assert.doesNotMatch(src, /[^.]parsedPresetList\[/);
  });

  it('aiEnginePanel 导入 ENGINE_GEN_MODE 与 AI_KEY', function() {
    var src = readFileSync(join(root, 'src/lib/card-builder/panels/aiEnginePanel.mjs'), 'utf8');
    assert.match(src, /import \{ generateCardJSON, AI_KEY \} from '\.\.\/state\.mjs'/);
    assert.match(src, /ENGINE_GEN_MODE_FULL/);
    assert.match(src, /OUTLINE_TYPE_LABELS/);
  });

  it('characters 丰满按钮走 analyze 面板 API', function() {
    var scan = readFileSync(join(root, 'src/lib/novel/panels/charactersScanBind.mjs'), 'utf8');
    var render = readFileSync(join(root, 'src/lib/novel/panels/charactersRender.mjs'), 'utf8');
    assert.match(scan, /ctx\.panels\.analyze\.runAnalyzeEnrich/);
    assert.match(render, /ctx\.panels\.analyze\.runAnalyzeEnrich/);
    assert.doesNotMatch(scan, /ctx\.runAnalyzeEnrich/);
    assert.doesNotMatch(render, /ctx\.runAnalyzeEnrich/);
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
