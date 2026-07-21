/**
 * 密钥口令加密（Web Crypto：PBKDF2 + AES-GCM）
 * 服务端只存密文；口令永不上传。
 */

var ENC_VERSION = 1;
var PBKDF2_ITERATIONS = 210000;

function getSubtle() {
  var c = globalThis.crypto;
  if (!c || !c.subtle) throw new Error('webcrypto_unavailable');
  return c.subtle;
}

function bytesToB64(buf) {
  var u8 = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(u8).toString('base64');
  }
  var s = '';
  for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

function b64ToBytes(b64) {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(String(b64), 'base64'));
  }
  var bin = atob(String(b64));
  var u8 = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

async function deriveKey(passphrase, saltBytes) {
  var subtle = getSubtle();
  var enc = new TextEncoder();
  var baseKey = await subtle.importKey(
    'raw',
    enc.encode(String(passphrase)),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * @returns {{ v: number, alg: string, salt: string, iv: string, ciphertext: string }}
 */
export async function encryptJsonWithPassphrase(obj, passphrase) {
  if (!passphrase || String(passphrase).length < 6) {
    throw new Error('passphrase_too_short');
  }
  var subtle = getSubtle();
  var salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  var iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  var key = await deriveKey(passphrase, salt);
  var plain = new TextEncoder().encode(JSON.stringify(obj));
  var cipherBuf = await subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, plain);
  return {
    v: ENC_VERSION,
    alg: 'PBKDF2-AES-GCM',
    iterations: PBKDF2_ITERATIONS,
    salt: bytesToB64(salt),
    iv: bytesToB64(iv),
    ciphertext: bytesToB64(cipherBuf),
  };
}

export async function decryptJsonWithPassphrase(envelope, passphrase) {
  if (!envelope || envelope.v !== ENC_VERSION) throw new Error('bad_envelope');
  if (!passphrase) throw new Error('passphrase_required');
  var subtle = getSubtle();
  var salt = b64ToBytes(envelope.salt);
  var iv = b64ToBytes(envelope.iv);
  var key = await deriveKey(passphrase, salt);
  var cipher = b64ToBytes(envelope.ciphertext);
  try {
    var plainBuf = await subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, cipher);
    var text = new TextDecoder().decode(plainBuf);
    return JSON.parse(text);
  } catch (e) {
    var err = new Error('decrypt_failed');
    err.cause = e;
    throw err;
  }
}

export function isEncryptedSecretsDoc(doc) {
  return !!(doc && doc.enc && doc.enc.v === ENC_VERSION && doc.enc.ciphertext);
}
