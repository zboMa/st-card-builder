/**
 * Auth routes: Discord OAuth + 邮箱注册/登录 + 调试用户名登录
 */
import { Router } from 'express';
import crypto from 'node:crypto';
import { config, isAdminUser, getAdminRole } from '../config.mjs';
import {
  discordAuthUrl,
  exchangeDiscordCode,
  fetchDiscordMe,
  fetchGuildMember,
  discordConfigured,
} from './discord.mjs';
import { evaluateDiscordMembership, canAcceptDiscordRegistration } from './membership.mjs';
import {
  upsertUserRegistry,
  getUserRegistry,
  getEmailAuthDoc,
  registerEmailUser,
} from '../couch.mjs';
import { issueBearerToken, revokeBearerToken, listBearerTokensForUser, revokeBearerByDocId } from './bearer.mjs';
import { assertQuota } from '../quota/quotaService.mjs';
import { resolveRequestUser } from './requireUser.mjs';
import { buildReturnToAllowlist, sanitizeReturnTo } from './returnTo.mjs';
import {
  assertEmailShape,
  buildEmailSessionUser,
  inviteCodeAccepted,
} from './emailAuth.mjs';
import { hashAccountPassword, verifyAccountPassword, assertPasswordShape } from './password.mjs';

export var authRouter = Router();

function returnAllow() {
  return buildReturnToAllowlist(config);
}

function safeReturnTo(raw) {
  return sanitizeReturnTo(raw, returnAllow());
}

function defaultSuccessUrl(user) {
  if (isAdminUser(user) && config.publicAdminUrl) {
    return config.publicAdminUrl + '/';
  }
  return config.publicAppUrl + '/#auth?ok=1';
}

function defaultErrorUrl(code, returnTo) {
  var base = returnTo || config.publicAppUrl + '/';
  try {
    var u = new URL(base);
    u.searchParams.set('auth_error', code || 'error');
    return u.toString();
  } catch (e) {
    return config.publicAppUrl + '/#auth?error=' + encodeURIComponent(code || 'error');
  }
}

function publicAuthFlags(req) {
  var user = req.session && req.session.user || null;
  return {
    discordConfigured: discordConfigured(),
    discordLoginEnabled: !!config.discordLoginEnabled,
    enforceMembership: config.authEnforceDiscordMembership,
    canAcceptDiscordRegistration: canAcceptDiscordRegistration(),
    emailAuthEnabled: !!config.emailAuthEnabled,
    /** 是否可注册（邮箱开关开且至少配置了一个邀请码）；从不暴露邀请码本身 */
    emailRegistrationOpen: !!(config.emailAuthEnabled && config.inviteCodes.length),
    devLoginEnabled: config.devLoginEnabled,
    isAdmin: isAdminUser(user),
    adminRole: getAdminRole(user),
    publicAppUrl: config.publicAppUrl,
    publicAdminUrl: config.publicAdminUrl || null,
    publicApiUrl: config.publicApiUrl || null,
  };
}

function authError(res, status, code, messageZh) {
  return res.status(status).json({
    error: code,
    message: messageZh || code,
  });
}

authRouter.get('/status', async function(req, res) {
  var user = req.session && req.session.user || null;
  if (user) {
    try {
      var reg = await getUserRegistry(user.id);
      if (reg && reg.disabled) {
        req.session = null;
        return res.json(Object.assign({ user: null, disabled: true }, publicAuthFlags(req)));
      }
    } catch (e) { /* ignore */ }
  }
  res.json(Object.assign({ user: user }, publicAuthFlags(req)));
});

authRouter.get('/me', function(req, res) {
  if (!req.session || !req.session.user) {
    return res.status(401).json(Object.assign({ error: 'unauthorized' }, publicAuthFlags(req)));
  }
  res.json(Object.assign({ user: req.session.user }, publicAuthFlags(req)));
});

authRouter.get('/public-config', function(req, res) {
  res.json({
    ok: true,
    publicAppUrl: config.publicAppUrl,
    publicAdminUrl: config.publicAdminUrl || null,
    publicApiUrl: config.publicApiUrl || null,
  });
});

authRouter.post('/logout', function(req, res) {
  req.session = null;
  res.json({ ok: true });
});

/** 调试登录：临时用户名 */
authRouter.post('/dev-login', async function(req, res) {
  if (!config.devLoginEnabled) {
    return res.status(403).json({ error: 'dev_login_disabled', message: '调试登录未开启' });
  }
  var name = String((req.body && req.body.username) || '').trim().slice(0, 32);
  if (!name) return res.status(400).json({ error: 'username_required' });
  var safeId = 'dev_' + name.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 24);
  req.session.user = {
    id: safeId,
    username: name,
    provider: 'dev',
    displayName: name,
  };
  try { await upsertUserRegistry(req.session.user); } catch (e) { console.warn('[auth] registry', e); }
  res.json({ ok: true, user: req.session.user });
});

/**
 * 邮箱注册：{ email, password, inviteCode }
 */
authRouter.post('/register', async function(req, res) {
  if (!config.emailAuthEnabled) {
    return authError(res, 403, 'email_auth_disabled', '邮箱注册未开启');
  }
  if (!config.inviteCodes.length) {
    return authError(res, 403, 'registration_closed', '暂未开放注册，请联系管理员');
  }
  var body = req.body || {};
  var email;
  try {
    email = assertEmailShape(body.email);
  } catch (e) {
    return authError(res, 400, e.code || 'invalid_email', e.messageZh || '请输入有效邮箱');
  }
  if (!inviteCodeAccepted(body.inviteCode, config.inviteCodes)) {
    return authError(res, 403, 'invalid_invite', '邀请码无效');
  }
  var password;
  try {
    password = assertPasswordShape(body.password);
  } catch (e) {
    return authError(res, 400, e.code || 'password_too_short', e.messageZh || '密码不符合要求');
  }

  try {
    var packed = await hashAccountPassword(password);
    var sessionUser = buildEmailSessionUser(email);
    await registerEmailUser(sessionUser, packed);
    req.session.user = sessionUser;
    res.json({ ok: true, user: sessionUser });
  } catch (e) {
    if (e && e.code === 'email_taken') {
      return authError(res, 409, 'email_taken', '该邮箱已注册，请直接登录');
    }
    console.error('[auth/register]', e);
    return authError(res, 500, 'register_failed', '注册失败，请稍后重试');
  }
});

/**
 * 邮箱登录：{ email, password }
 */
authRouter.post('/login', async function(req, res) {
  if (!config.emailAuthEnabled) {
    return authError(res, 403, 'email_auth_disabled', '邮箱登录未开启');
  }
  var body = req.body || {};
  var email;
  try {
    email = assertEmailShape(body.email);
  } catch (e) {
    return authError(res, 400, e.code || 'invalid_email', e.messageZh || '请输入有效邮箱');
  }
  var password = String(body.password || '');
  if (!password) {
    return authError(res, 400, 'password_required', '请输入密码');
  }

  try {
    var authDoc = await getEmailAuthDoc(email);
    if (!authDoc || !authDoc.passwordHash) {
      return authError(res, 401, 'invalid_credentials', '邮箱或密码错误');
    }
    var ok = await verifyAccountPassword(password, authDoc.passwordHash);
    if (!ok) {
      return authError(res, 401, 'invalid_credentials', '邮箱或密码错误');
    }
    var reg = await getUserRegistry(authDoc.userId);
    if (reg && reg.disabled) {
      return authError(res, 403, 'account_disabled', '账号已被禁用');
    }
    var sessionUser = buildEmailSessionUser(email);
    if (reg && reg.displayName) sessionUser.displayName = reg.displayName;
    if (reg && reg.username) sessionUser.username = reg.username;
    req.session.user = sessionUser;
    try { await upsertUserRegistry(sessionUser); } catch (e) { console.warn('[auth] registry', e); }
    res.json({ ok: true, user: sessionUser });
  } catch (e) {
    console.error('[auth/login]', e);
    return authError(res, 500, 'login_failed', '登录失败，请稍后重试');
  }
});

/**
 * Discord OAuth 入口：
 * 1) 记 return_to / state
 * 2) 302 → https://discord.com/api/oauth2/authorize?...
 */
authRouter.get('/discord', function(req, res) {
  if (!discordConfigured()) {
    return res.status(503).json({ error: 'discord_not_configured' });
  }
  if (!canAcceptDiscordRegistration()) {
    return res.status(403).json({
      error: 'discord_registration_closed',
      message: '正式注册已启用校验，但服务器/身份组未配置，拒绝所有 Discord 注册。',
    });
  }
  var state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;
  var client = String(req.query.client || '');
  req.session.oauthClient = client === 'st_plugin' ? 'st_plugin' : '';
  req.session.oauthReturnTo = safeReturnTo(req.query.return_to) || '';
  res.redirect(discordAuthUrl(state));
});

authRouter.get('/discord/callback', async function(req, res) {
  var oauthClient = (req.session && req.session.oauthClient) || '';
  var returnTo = safeReturnTo(req.session && req.session.oauthReturnTo);
  try {
    if (!discordConfigured()) {
      return res.redirect(defaultErrorUrl('discord_not_configured', returnTo));
    }
    if (!canAcceptDiscordRegistration()) {
      return res.redirect(defaultErrorUrl('discord_registration_closed', returnTo));
    }
    var state = String(req.query.state || '');
    if (!req.session || !req.session.oauthState || state !== req.session.oauthState) {
      return res.redirect(defaultErrorUrl('bad_state', returnTo));
    }
    req.session.oauthState = null;
    req.session.oauthClient = null;
    req.session.oauthReturnTo = null;
    var code = String(req.query.code || '');
    if (!code) return res.redirect(defaultErrorUrl('no_code', returnTo));

    var token = await exchangeDiscordCode(code);
    var me = await fetchDiscordMe(token.access_token);
    var member = await fetchGuildMember(token.access_token, config.discord.guildId);
    var gate = evaluateDiscordMembership(member);
    if (!gate.ok) {
      return res.redirect(defaultErrorUrl(gate.reason || 'membership', returnTo));
    }

    req.session.user = {
      id: 'discord_' + me.id,
      username: me.username || me.global_name || me.id,
      provider: 'discord',
      displayName: me.global_name || me.username || me.id,
      discordId: me.id,
      avatar: me.avatar || null,
    };
    try { await upsertUserRegistry(req.session.user); } catch (e) { console.warn('[auth] registry', e); }

    if (oauthClient === 'st_plugin') {
      await assertQuota(req.session.user, 'issue_bearer');
      var issued = await issueBearerToken(req.session.user);
      return res.redirect('/api/auth/plugin-done#token=' + encodeURIComponent(issued.token)
        + '&expiresAt=' + encodeURIComponent(issued.expiresAt));
    }

    if (returnTo) {
      return res.redirect(returnTo);
    }
    res.redirect(defaultSuccessUrl(req.session.user));
  } catch (e) {
    console.error('[auth/discord/callback]', e);
    res.redirect(defaultErrorUrl('callback_failed', returnTo));
  }
});

/** 插件登录完成页：把 token postMessage 给 opener */
authRouter.get('/plugin-done', function(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send('<!doctype html><meta charset="utf-8"><title>登录完成</title>'
    + '<p>登录成功，可关闭此窗口返回酒馆。</p>'
    + '<script>(function(){'
    + 'var h=location.hash.replace(/^#/,"");'
    + 'var p=new URLSearchParams(h);'
    + 'var token=p.get("token")||"";'
    + 'var expiresAt=p.get("expiresAt")||"";'
    + 'if(window.opener){try{window.opener.postMessage({type:"stcb-plugin-auth",token:token,expiresAt:expiresAt},"*");}catch(e){}}'
    + '})();</script>');
});

authRouter.get('/plugin-me', async function(req, res) {
  var user = await resolveRequestUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  res.json({ ok: true, user: user });
});

authRouter.post('/plugin-logout', async function(req, res) {
  var hdr = String(req.headers.authorization || '');
  var m = /^Bearer\s+(.+)$/i.exec(hdr);
  if (m) {
    try { await revokeBearerToken(m[1]); } catch (e) { /* ignore */ }
  }
  res.json({ ok: true });
});

/** 当前用户的插件 Bearer 设备列表 */
authRouter.get('/tokens', async function(req, res) {
  var user = await resolveRequestUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  try {
    var tokens = await listBearerTokensForUser(user.id);
    res.json({ ok: true, tokens: tokens });
  } catch (e) {
    res.status(500).json({ error: 'tokens_failed', message: String(e && e.message || e) });
  }
});

/** 吊销指定设备（doc id bearer/...） */
authRouter.delete('/tokens/:docId', async function(req, res) {
  var user = await resolveRequestUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  var docId = decodeURIComponent(String(req.params.docId || ''));
  try {
    var tokens = await listBearerTokensForUser(user.id);
    var owned = tokens.some(function(t) { return t.id === docId; });
    if (!owned) return res.status(403).json({ error: 'forbidden' });
    await revokeBearerByDocId(docId);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'token_revoke_failed', message: String(e && e.message || e) });
  }
});
