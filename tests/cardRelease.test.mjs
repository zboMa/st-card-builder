import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeCharacterVersion,
  parseCharacterVersion,
  bumpCharacterVersionMajor,
  bumpCharacterVersionMinor,
  buildCardReleasePayload,
} from '../src/lib/card-builder/cardRelease.mjs';
import {
  parseCardShareToken,
} from '../src/lib/card-builder/cardShareClient.mjs';
import {
  cardReleaseDocId,
  cardReleaseVersionDocId,
} from '../src/lib/sync/docIds.mjs';

describe('cardRelease', function() {
  it('normalizeCharacterVersion 默认 1.0', function() {
    assert.equal(normalizeCharacterVersion(''), '1.0');
    assert.equal(normalizeCharacterVersion(' 2.1 '), '2.1');
  });

  it('bump major / minor', function() {
    assert.equal(bumpCharacterVersionMajor('1.0'), '2.0');
    assert.equal(bumpCharacterVersionMajor('2.5'), '3.0');
    assert.equal(bumpCharacterVersionMinor('1.0'), '1.1');
    assert.equal(bumpCharacterVersionMinor('1.9'), '1.10');
    assert.equal(parseCharacterVersion('x').display, '1.0');
  });

  it('buildCardReleasePayload 使用 character_version', function() {
    var release = buildCardReleasePayload({
      draftId: 'd1',
      charName: '测试角色',
      characterVersion: '3.2',
      charDesc: 'desc',
      firstMes: 'hi',
      worldbookEntries: [],
    }, { publishedAt: 100 });
    assert.equal(release.type, 'card-release');
    assert.equal(release.cardId, 'd1');
    assert.equal(release.characterVersion, '3.2');
    assert.equal(release.publishedAt, 100);
    assert.equal(release.cardJson.data.character_version, '3.2');
    assert.equal(release.cardJson.data.name, '测试角色');
  });

  it('docIds 含 release 路径', function() {
    assert.equal(cardReleaseDocId('abc'), 'card/abc/release');
    assert.equal(
      cardReleaseVersionDocId('abc', '1.0+beta'),
      'card/abc/release/' + encodeURIComponent('1.0+beta')
    );
  });

  it('parseCardShareToken', function() {
    assert.equal(
      parseCardShareToken('https://card-api.taojiu.love/api/share/cards/AbC_123-xyz'),
      'AbC_123-xyz'
    );
    assert.equal(parseCardShareToken('AbC_123-xyz'), 'AbC_123-xyz');
    assert.equal(parseCardShareToken(''), '');
  });
});
