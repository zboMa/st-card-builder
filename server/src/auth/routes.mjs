/**
 * Auth routes: Discord OAuth + 调试用户名登录
 */
import { Router } from 'express';
import crypto from 'node:crypto';
import { config, isAdminUser } from '../config.mjs';
import {
  discordAuthUrl,
  exchangeDiscordCode,
  fetchDiscordMe,
  fetchGuildMember,
  discordConfigured,
} from './discord.mjs';
import { evaluateDiscordMembership, canAcceptDiscordRegistration } from './membership.mjs';
import { upsertUserRegistry, getUserRegistry } from '../couch.mjs';
import { issueBearerToken, revokeBearerToken } from './bearer.mjs';
import { resolveRequestUser } from './requireUser.mjs';

export var authRouter = Router();

function publicAuthFlags(req) {
  var user = req.session && req.session.user || null;
  return {
    discordConfigured: discordConfigured(),
    enforceMembership: config.authEnforceDiscordMembership,
    canAcceptDiscordRegistration: canAcceptDiscordRegistration(),
    devLoginEnabled: config.devLoginEnabled,
    isAdmin: isAdminUser(user),
  };
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
  res.redirect(discordAuthUrl(state));
});

authRouter.get('/discord/callback', async function(req, res) {
  var oauthClient = (req.session && req.session.oauthClient) || '';
  try {
    if (!discordConfigured()) {
      return res.redirect(config.publicAppUrl + '/#auth?error=discord_not_configured');
    }
    if (!canAcceptDiscordRegistration()) {
      return res.redirect(config.publicAppUrl + '/#auth?error=discord_registration_closed');
    }
    var state = String(req.query.state || '');
    if (!req.session || !req.session.oauthState || state !== req.session.oauthState) {
      return res.redirect(config.publicAppUrl + '/#auth?error=bad_state');
    }
    req.session.oauthState = null;
    req.session.oauthClient = null;
    var code = String(req.query.code || '');
    if (!code) return res.redirect(config.publicAppUrl + '/#auth?error=no_code');

    var token = await exchangeDiscordCode(code);
    var me = await fetchDiscordMe(token.access_token);
    var member = await fetchGuildMember(token.access_token, config.discord.guildId);
    var gate = evaluateDiscordMembership(member);
    if (!gate.ok) {
      return res.redirect(
        config.publicAppUrl + '/#auth?error=' + encodeURIComponent(gate.reason || 'membership')
      );
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
      var issued = await issueBearerToken(req.session.user);
      return res.redirect('/api/auth/plugin-done#token=' + encodeURIComponent(issued.token)
        + '&expiresAt=' + encodeURIComponent(issued.expiresAt));
    }

    var dest = isAdminUser(req.session.user)
      ? (config.publicAppUrl + '/admin')
      : (config.publicAppUrl + '/#auth?ok=1');
    res.redirect(dest);
  } catch (e) {
    console.error('[auth/discord/callback]', e);
    res.redirect(config.publicAppUrl + '/#auth?error=callback_failed');
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
