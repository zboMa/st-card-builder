/**
 * 邮箱注册/登录：纯逻辑（校验、归一化、用户 ID、邀请码）
 */
import crypto from 'node:crypto';

var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function assertEmailShape(email) {
  var e = normalizeEmail(email);
  if (!e || e.length > 254 || !EMAIL_RE.test(e)) {
    var err = new Error('invalid_email');
    err.code = 'invalid_email';
    err.messageZh = '请输入有效邮箱';
    throw err;
  }
  return e;
}

/** 稳定用户 ID：email_ + sha256(email) 前 24 hex */
export function emailUserId(normalizedEmail) {
  var hex = crypto.createHash('sha256').update(normalizeEmail(normalizedEmail)).digest('hex');
  return 'email_' + hex.slice(0, 24);
}

export function emailLocalPart(normalizedEmail) {
  var e = String(normalizedEmail || '');
  var i = e.indexOf('@');
  var local = i > 0 ? e.slice(0, i) : e;
  return local.slice(0, 32) || 'user';
}

export function buildEmailSessionUser(normalizedEmail) {
  var email = normalizeEmail(normalizedEmail);
  var local = emailLocalPart(email);
  return {
    id: emailUserId(email),
    provider: 'email',
    email: email,
    username: local,
    displayName: local,
  };
}

/**
 * @param {string} inviteCode
 * @param {string[]} allowedCodes
 */
export function inviteCodeAccepted(inviteCode, allowedCodes) {
  var code = String(inviteCode || '').trim();
  if (!code) return false;
  var list = Array.isArray(allowedCodes) ? allowedCodes : [];
  return list.indexOf(code) >= 0;
}

export function emailAuthLookupDocId(normalizedEmail) {
  return 'email-auth/' + normalizeEmail(normalizedEmail);
}
