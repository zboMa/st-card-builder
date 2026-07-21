import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeReleaseDoc, buildShareDocId } from '../src/share/logic.mjs';

describe('share logic', function() {
  it('sanitize 只暴露阅读字段', function() {
    var out = sanitizeReleaseDoc({
      displayVersion: '2.0-1',
      characterVersion: '2.0',
      novelVersion: '1',
      publishedAt: 42,
      data: {
        title: '书名',
        outline: [{ title: '纲', summary: 's', order: 0 }],
        chapters: [{ id: 'c', title: '章', content: '文', order: 0 }],
        writeSettings: { autoContinue: true },
      },
    });
    assert.equal(out.title, '书名');
    assert.equal(out.displayVersion, '2.0-1');
    assert.equal(out.publishedAt, 42);
    assert.equal(out.chapters.length, 1);
    assert.equal(out.writeSettings, undefined);
  });

  it('buildShareDocId', function() {
    assert.equal(buildShareDocId('abc'), 'share/abc');
  });
});
