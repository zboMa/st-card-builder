/**
 * 扩展目录契约：拆分后每条均有 enrichment/overlay，成年边界措辞
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NSFWFLAVOR_IDS, NSFW_FLAVOR_PRESETS } from '../src/lib/adult/flavors/index.mjs';
import { NSFW_FLAVOR_ENRICHMENT } from '../src/lib/adult/flavors/enrichment/catalog.mjs';
import { NTL_TABOO_IDS, NTL_TABOO_TYPES } from '../src/lib/adult/ntl/index.mjs';
import { NTL_TABOO_ENRICHMENT } from '../src/lib/adult/ntl/enrichment/catalog.mjs';
import {
  WORLDFRAME_IDS,
  FLAVOR_VESSEL_OVERLAYS,
  NTL_VESSEL_OVERLAYS,
  buildVesselHint,
} from '../src/lib/adult/vessels/index.mjs';
import {
  ADULT_CONSENT_BOUNDARY,
  ADULT_CONSENT_BOUNDARY_SHORT,
} from '../src/lib/adult/shared/consentBoundary.mjs';
import { buildWorldviewHint, WORLDVIEW_PRESETS } from '../src/lib/presets/worldviews/index.mjs';

var BANNED_FORMULA_PHRASES = [
  '更适合把这种',
  '写法上至少把',
  '务必把',
  '世界层要把',
  '把关键张力落成可执行的场景流程与事后复盘',
  '只给标签氛围却不给可演机制',
  '双方须为已完成设定成年礼的成人；禁止儿童性化；冲突要写可见代价与可叙述的伦理账',
  '只剩口味标签却不给场景机制、边界反馈或事后余波',
  '把人物主体感让位给廉价刺激清单',
  '只喊禁忌氛围却不给制度、证据链或事后合理化机制',
  '把代价抹平到只剩廉价刺激或一次性反转',
  '只有角色口头偏好，没有制度、器物或空间去承托该风味',
  '像基础设施一样存在',
  '不必每次解释，但一开门',
  '挂到门禁、公共设施、维护清单或行业黑话里',
  '只有角色私欲，没有制度、档案、门禁或舆论流程承托禁忌',
  '把世界写成无后果背景板，无法解释禁忌为何持续逼人',
  '最好安排一场让',
  '角色会立刻长出选择压力',
  '往往比空洞口号更先决定人的日子怎么过',
  '这类口味最怕只剩标签',
  '写进可被旁人撞见的门禁记录',
  '留下可稽核的公共痕迹',
  '与其只让角色口头偏好',
  '好的 overlay 会让',
  '读者只要看见门禁灯',
];

describe('adultCatalogExpand', function() {
  it('口味≥60 且每条有 enrichment/overlay；含异质物质组', function() {
    assert.ok(NSFWFLAVOR_IDS.length >= 60, 'got ' + NSFWFLAVOR_IDS.length);
    assert.ok(NSFW_FLAVOR_PRESETS.tentacle, 'tentacle');
    assert.ok(NSFW_FLAVOR_PRESETS.bodily_fluids, 'bodily_fluids');
    NSFWFLAVOR_IDS.forEach(function(id) {
      assert.ok(NSFW_FLAVOR_PRESETS[id], id);
      assert.ok(NSFW_FLAVOR_ENRICHMENT[id], 'en ' + id);
      assert.ok(FLAVOR_VESSEL_OVERLAYS[id], 'vessel ov ' + id);
    });
  });

  it('NTL≥35 且每条有 enrichment/overlay；age_gap 区分礼法成年', function() {
    assert.ok(NTL_TABOO_IDS.length >= 35, 'got ' + NTL_TABOO_IDS.length);
    assert.match(String(NTL_TABOO_TYPES.age_gap.description || ''), /成年礼/);
    assert.match(String(NTL_TABOO_TYPES.age_gap.description || ''), /儿童性化/);
    NTL_TABOO_IDS.forEach(function(id) {
      assert.ok(NTL_TABOO_ENRICHMENT[id], 'en ' + id);
      assert.ok(NTL_VESSEL_OVERLAYS[id], 'vessel ov ' + id);
    });
  });

  it('载体框架≥20 含血月卡界触手等', function() {
    assert.ok(WORLDFRAME_IDS.length >= 20, 'got ' + WORLDFRAME_IDS.length);
    ['matriarchy', 'court', 'pirate', 'wasteland', 'idol_industry', 'medical', 'mecha', 'honghuang',
      'blood_moon', 'card_world', 'tentacle_abyss', 'slime_ecology', 'time_loop', 'bio_hive']
      .forEach(function(id) {
        assert.ok(WORLDFRAME_IDS.indexOf(id) >= 0, id);
      });
  });

  it('成年边界文案区分制度与情欲', function() {
    assert.match(ADULT_CONSENT_BOUNDARY, /礼法成年/);
    assert.match(ADULT_CONSENT_BOUNDARY, /儿童性化/);
    assert.match(ADULT_CONSENT_BOUNDARY, /不得以历史早婚/);
    assert.match(ADULT_CONSENT_BOUNDARY_SHORT, /礼法成年|成年礼/);
    var hint = buildWorldviewHint('xianxia', { stage: 'char' });
    assert.match(hint, /成年与情欲边界|礼法成年/);
    var vh = buildVesselHint({ worldframe: 'court' });
    assert.match(vh, /儿童性化|成年/);
  });

  it('源目录不含公式化 premium filler 语句', function() {
    [
      ['flavor presets', JSON.stringify(NSFW_FLAVOR_PRESETS)],
      ['flavor enrichment', JSON.stringify(NSFW_FLAVOR_ENRICHMENT)],
      ['flavor overlays', JSON.stringify(FLAVOR_VESSEL_OVERLAYS)],
      ['ntl types', JSON.stringify(NTL_TABOO_TYPES)],
      ['ntl enrichment', JSON.stringify(NTL_TABOO_ENRICHMENT)],
      ['ntl overlays', JSON.stringify(NTL_VESSEL_OVERLAYS)],
      ['worldview presets', JSON.stringify(WORLDVIEW_PRESETS)],
    ].forEach(function(tuple) {
      var label = tuple[0];
      var text = tuple[1];
      BANNED_FORMULA_PHRASES.forEach(function(phrase) {
        assert.equal(text.includes(phrase), false, label + ' contains banned filler: ' + phrase);
      });
    });
  });
});
