/**
 * 分享访问口令：PBKDF2 哈希（服务端校验，不明文存储）
 */
import crypto from 'node:crypto';
import { promisify } from 'node:util';

var pbkdf2 = promisify(crypto.pbkdf2);

export async function hashSharePassword(password) {
  var pass = String(password || '');
  if (pass.length < 4) throw new Error('password_too_short');
  var salt = crypto.randomBytes(16);
  var derived = await pbkdf2(pass, salt, 120000, 32, 'sha256');
  return {
    v: 1,
    salt: salt.toString('base64'),
    hash: derived.toString('base64'),
    iterations: 120000,
  };
}

export async function verifySharePassword(password, packed) {
  if (!packed || !packed.hash || !packed.salt) return false;
  var pass = String(password || '');
  if (!pass) return false;
  var salt = Buffer.from(String(packed.salt), 'base64');
  var iterations = packed.iterations || 120000;
  var derived = await pbkdf2(pass, salt, iterations, 32, 'sha256');
  var a = Buffer.from(String(packed.hash), 'base64');
  var b = derived;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
