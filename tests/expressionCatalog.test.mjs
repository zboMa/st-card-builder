import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EROTIC_POSTURE_PRESETS,
  EROTIC_POSTURE_IDS,
  EROTIC_SPEECH_PRESETS,
  EROTIC_SPEECH_IDS,
  normalizeExpressionItems,
  checkExpressionEntryQuality,
} from '../src/lib/adult/expression/index.mjs';

describe('expression catalog', function() {
  it('姿势与话风条目数充足且 id 唯一', function() {
    assert.ok(EROTIC_POSTURE_IDS.length >= 70, 'posture ids: ' + EROTIC_POSTURE_IDS.length);
    assert.ok(EROTIC_SPEECH_IDS.length >= 70, 'speech ids: ' + EROTIC_SPEECH_IDS.length);
    assert.equal(new Set(EROTIC_POSTURE_IDS).size, EROTIC_POSTURE_IDS.length);
    assert.equal(new Set(EROTIC_SPEECH_IDS).size, EROTIC_SPEECH_IDS.length);
  });

  it('全部条目通过表达层质量门', function() {
    EROTIC_POSTURE_IDS.forEach(function(id) {
      assert.deepEqual(checkExpressionEntryQuality(EROTIC_POSTURE_PRESETS[id]), [], 'posture ' + id);
    });
    EROTIC_SPEECH_IDS.forEach(function(id) {
      assert.deepEqual(checkExpressionEntryQuality(EROTIC_SPEECH_PRESETS[id]), [], 'speech ' + id);
    });
  });

  it('表达层 normalize 不与 flavor 五槽耦合', function() {
    var six = normalizeExpressionItems([
      { id: EROTIC_POSTURE_IDS[0], note: 'a' },
      { id: EROTIC_POSTURE_IDS[1], note: 'b' },
      { id: EROTIC_POSTURE_IDS[2], note: 'c' },
      { id: EROTIC_POSTURE_IDS[3], note: 'd' },
      { id: EROTIC_POSTURE_IDS[4], note: 'e' },
      { id: EROTIC_POSTURE_IDS[5], note: 'f' },
      { id: EROTIC_POSTURE_IDS[0], note: 'dup' },
    ]);
    assert.equal(six.length, 6);
    assert.equal(six[5].note, 'f');
  });
});
