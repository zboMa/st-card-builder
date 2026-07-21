/**
 * 账户密码：PBKDF2（与分享口令同算法，账户侧要求更长）
 */
import crypto from 'node:crypto';
import { promisify } from 'node:util';

var pbkdf2 = promisify(crypto.pbkdf2);

var MIN_LEN = 8;
var ITERATIONS = 120000;

export function assertPasswordShape(password) {
  var pass = String(password || '');
  if (pass.length < MIN_LEN) {
    var err = new Error('password_too_short');
    err.code = 'password_too_short';
    err.messageZh = '密码至少 ' + MIN_LEN + ' 位';
    throw err;
  }
  if (pass.length > 128) {
    var err2 = new Error('password_too_long');
    err2.code = 'password_too_long';
    err2.messageZh = '密码过长';
    throw err2;
  }
  return pass;
}

export async function hashAccountPassword(password) {
  var pass = assertPasswordShape(password);
  var salt = crypto.randomBytes(16);
  var derived = await pbkdf2(pass, salt, ITERATIONS, 32, 'sha256');
  return {
    v: 1,
    salt: salt.toString('base64'),
    hash: derived.toString('base64'),
    iterations: ITERATIONS,
  };
}

export async function verifyAccountPassword(password, packed) {
  if (!packed || !packed.hash || !packed.salt) return false;
  var pass = String(password || '');
  if (!pass) return false;
  var salt = Buffer.from(String(packed.salt), 'base64');
  var iterations = packed.iterations || ITERATIONS;
  var derived = await pbkdf2(pass, salt, iterations, 32, 'sha256');
  var a = Buffer.from(String(packed.hash), 'base64');
  var b = derived;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
