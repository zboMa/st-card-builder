/**
 * 进度条更新规则：生成与推定共用，每条最多三句。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { meterCheckLines } from '../src/lib/mvu/meterUpdateRules.mjs';
import { applyBatchFill, buildGroupedUpdateRules } from '../src/lib/statusBarBuild.mjs';
import { candidatesToVariables, inferMvuCandidatesFromCard } from '../src/lib/mvu/inferFromCard.mjs';

describe('meter update rules', function() {
  it('好感、亲密、快感、恶堕按幅度分档，恶堕有次一级', function() {
    var affection = meterCheckLines('好感度');
    var intimacy = meterCheckLines('亲密度');
    var pleasure = meterCheckLines('快感');
    var corruption = meterCheckLines('恶堕进度');
    [affection, intimacy, pleasure, corruption].forEach(function(lines) {
      assert.equal(lines.length, 3);
    });
    assert.match(affection[1], /±1～3/);
    assert.match(affection[2], /±9～15/);
    assert.match(intimacy[0], /\+0～2/);
    assert.match(intimacy[1], /\+4～8/);
    assert.match(intimacy[1], /-6～-15/);
    assert.match(pleasure[1], /\+5～20/);
    assert.match(pleasure[1], /回落 20～50/);
    assert.match(corruption[1], /次一级/);
    assert.match(corruption[1], /\+1～3/);
    assert.match(corruption[1], /25 整数段/);
    assert.match(corruption[2], /\+3～8/);
    assert.doesNotMatch(corruption.join('\n'), /破窗|共犯|告白|污名|沉溺/);
  });

  it('信任和理智只限单轮幅度，体力魔力相同，金钱不套 25 分界', function() {
    var trust = meterCheckLines('信任');
    var sanity = meterCheckLines('理智');
    var stamina = meterCheckLines('体力');
    var mana = meterCheckLines('魔力');
    var money = meterCheckLines('金钱');
    assert.deepEqual(trust, sanity);
    assert.deepEqual(stamina, trust);
    assert.deepEqual(mana, trust);
    assert.equal(trust.length, 3);
    assert.match(trust[2], /单轮不超过 15/);
    assert.match(trust[2], /25 的整数段/);
    assert.equal(money.length, 2);
    assert.match(money[0], /收入或支出/);
    assert.match(money[1], /不套 25 分界/);
    assert.equal(meterCheckLines('情绪'), null);
  });

  it('生成填值和从卡推定写出同一组检查句', function() {
    var filled = applyBatchFill([
      { path: '角色.恶堕进度' },
      { path: '角色.快感' },
      { path: '角色.信任' },
      { path: '角色.金钱' },
    ], {});
    filled.forEach(function(v) {
      var leaf = v.path.split('.').pop();
      assert.deepEqual(v.check, meterCheckLines(leaf));
      if (leaf !== '金钱') {
        assert.equal(v.min, 0);
        assert.equal(v.max, 100);
      } else {
        assert.equal(v.min, 0);
        assert.equal(v.max, undefined);
      }
    });
    var rules = buildGroupedUpdateRules(filled);
    assert.match(rules, /次一级/);
    assert.match(rules, /回落 20～50/);
    assert.match(rules, /不套 25 分界/);
    assert.equal((rules.match(/单轮不超过 15/g) || []).length, 1);

    var cands = inferMvuCandidatesFromCard({
      name: '凌霜',
      statusBarDesign: {
        castMode: 'single',
        moduleFlags: { affection: true, corruption_stage: true, sanity: true },
        nsfw: true,
        mainName: '凌霜',
      },
      adultConfig: { enabled: true, corruptionEnabled: true },
    });
    var corr = cands.find(function(c) { return c.path === '角色.恶堕进度'; });
    var sanity = cands.find(function(c) { return c.path === '角色.理智'; });
    assert.ok(corr);
    assert.ok(sanity);
    var vars = candidatesToVariables([corr, sanity]);
    assert.deepEqual(vars[0].check, meterCheckLines('恶堕进度'));
    assert.deepEqual(vars[1].check, meterCheckLines('理智'));
  });
});
