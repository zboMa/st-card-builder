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
import { buildWorldviewHint } from '../src/lib/presets/worldviews/index.mjs';

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
});
