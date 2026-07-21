/**
 * 密钥口令加密 + 管理端配置纯函数
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  encryptJsonWithPassphrase,
  decryptJsonWithPassphrase,
  isEncryptedSecretsDoc,
} from '../src/lib/sync/secretCrypto.mjs';
import { isAdminUser, isAdminDiscordId } from '../server/src/config.mjs';

describe('secretCrypto', function() {
  it('口令加密往返', async function() {
    var plain = { apiKey: 'sk-test', apiUrl: 'https://example.com' };
    var enc = await encryptJsonWithPassphrase(plain, 'secret-pass');
    assert.equal(enc.v, 1);
    assert.ok(enc.ciphertext);
    var back = await decryptJsonWithPassphrase(enc, 'secret-pass');
    assert.deepEqual(back, plain);
    await assert.rejects(function() {
      return decryptJsonWithPassphrase(enc, 'wrong-pass');
    });
  });

  it('isEncryptedSecretsDoc', function() {
    assert.equal(isEncryptedSecretsDoc({ enc: { v: 1, ciphertext: 'x' } }), true);
    assert.equal(isEncryptedSecretsDoc({ data: { apiKey: 'x' } }), false);
  });
});

describe('admin config', function() {
  it('isAdminDiscordId 去前缀', function() {
    // 依赖当前进程 env；未配置时皆 false
    assert.equal(typeof isAdminDiscordId('123'), 'boolean');
    assert.equal(isAdminUser(null), false);
    assert.equal(isAdminUser({ provider: 'discord', discordId: '__no_such__' }), false);
  });
});
