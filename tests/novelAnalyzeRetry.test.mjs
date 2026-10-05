import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runWithAutoRetry, isRetryAbort } from '../src/lib/novel/autoRetry.mjs';
import { collapseFailedShards, upsertFailedShard, failedShardKey } from '../src/lib/novel/failedShards.mjs';
import { hydrateNovelState } from '../src/lib/novel/state.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('分析自动重试', function() {
  it('第一次失败、第二次成功', async function() {
    var n = 0;
    var value = await runWithAutoRetry(async function() {
      n++;
      if (n === 1) throw new Error('Failed to fetch');
      return 'ok';
    }, { delayMs: 0 });
    assert.equal(value, 'ok');
    assert.equal(n, 2);
  });

  it('取消不等第二次', async function() {
    var n = 0;
    var signal = { aborted: true };
    await assert.rejects(function() {
      return runWithAutoRetry(async function() {
        n++;
        return 'no';
      }, { signal: signal, delayMs: 0 });
    });
    assert.equal(n, 0);
    assert.equal(isRetryAbort(new Error('已取消'), null), true);
  });

  it('两次都失败抛出最后一次', async function() {
    var n = 0;
    await assert.rejects(function() {
      return runWithAutoRetry(async function() {
        n++;
        throw new Error('第' + n + '次');
      }, { delayMs: 0 });
    }, /第2次/);
    assert.equal(n, 2);
  });
});

describe('失败列表同一条', function() {
  it('重跑再失败覆盖旧记录', function() {
    var list = upsertFailedShard([], {
      phase: 'skeleton',
      shardIndex: 3,
      label: '第三章',
      error: '第一次',
      at: '2026-01-01T00:00:00.000Z',
    });
    list = upsertFailedShard(list, {
      phase: 'skeleton',
      shardIndex: 3,
      label: '第三章',
      error: '第二次',
      at: '2026-01-01T00:01:00.000Z',
    });
    assert.equal(list.length, 1);
    assert.equal(list[0].error, '第二次');
    assert.equal(failedShardKey(list[0]), 'skeleton:3');
  });

  it('读入时归并重复', function() {
    var collapsed = collapseFailedShards([
      { phase: 'enrich', entityId: 'e1', error: '旧', at: '2026-01-01T00:00:00.000Z' },
      { phase: 'enrich', entityId: 'e1', error: '新', at: '2026-01-02T00:00:00.000Z' },
      { phase: 'skeleton', shardIndex: 1, error: '片', at: '2026-01-01T00:00:00.000Z' },
    ]);
    assert.equal(collapsed.length, 2);
    assert.equal(collapsed[0].error, '新');
    var state = hydrateNovelState({
      failedShards: [
        { phase: 'skeleton', shardIndex: 0, error: 'a', at: '2026-01-01T00:00:00.000Z' },
        { phase: 'skeleton', shardIndex: 0, error: 'b', at: '2026-01-03T00:00:00.000Z' },
      ],
    });
    assert.equal(state.failedShards.length, 1);
    assert.equal(state.failedShards[0].error, 'b');
  });
});

describe('分析与任务步骤接线', function() {
  it('骨架、丰满、扫描、抽取写入步骤而不是纯分数', function() {
    const analyze = readFileSync(join(root, 'src/lib/novel/panels/analyzeRun.mjs'), 'utf8');
    assert.match(analyze, /runWithAutoRetry/);
    assert.match(analyze, /noteTaskStep/);
    assert.match(analyze, /已自动重试仍失败/);
    assert.match(analyze, /skLine \+ ' · 实体/);
    assert.doesNotMatch(analyze, /setProgress\(task\.id, \(ri \+ 1\)/);
    const scan = readFileSync(join(root, 'src/lib/novel/panels/charactersScanBind.mjs'), 'utf8');
    assert.match(scan, /noteTaskStep/);
    assert.match(scan, /已发现/);
    const wb = readFileSync(join(root, 'src/lib/novel/panels/worldbookAi.mjs'), 'utf8');
    assert.match(wb, /noteTaskStep/);
    const embed = readFileSync(join(root, 'src/lib/novel/rag/embedClient.mjs'), 'utf8');
    assert.match(embed, /runWithAutoRetry/);
    assert.match(embed, /onBatch/);
  });
});
