import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.mjs';
import { publicUserDbUrl, userDbName } from '../src/couch.mjs';

describe('public couch db url', function() {
  var prev;

  before(function() {
    prev = config.publicCouchUrl;
    config.publicCouchUrl = 'https://card-api.example/couch';
  });

  after(function() {
    config.publicCouchUrl = prev;
  });

  it('uses PUBLIC_COUCH_URL not loopback', function() {
    var name = userDbName('email_abc');
    var url = publicUserDbUrl(name);
    assert.equal(url, 'https://card-api.example/couch/' + name);
    assert.equal(url.indexOf('127.0.0.1'), -1);
  });
});
