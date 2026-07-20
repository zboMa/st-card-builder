/**
 * Auth routes: Discord OAuth + 调试用户名登录
 */
import { Router } from 'express';
import crypto from 'node:crypto';
import { config } from '../config.mjs';
import {
  discordAuthUrl,
  exchangeDiscordCode,
  fetchDiscordMe,
  fetchGuildMember,
  discordConfigured,
} from './discord.mjs';
import { evaluateDiscordMembership, canAcceptDiscordRegistration } from './membership.mjs';

export var authRouter = Router();

function publicAuthFlags() {
  return {
    discordConfigured: discordConfigured(),
    enforceMembership: config.authEnforceDiscordMembership,
    canAcceptDiscordRegistration: canAcceptDiscordRegistration(),
    devLoginEnabled: config.devLoginEnabled,
  };
}

authRouter.get('/status', function(req, res) {
  res.json(Object.assign({ user: req.session && req.session.user || null }, publicAuthFlags()));
});

authRouter.get('/me', function(req, res) {
  if (!req.session || !req.session.user) {
    return res.status(401).json(Object.assign({ error: 'unauthorized' }, publicAuthFlags()));
  }
  res.json(Object.assign({ user: req.session.user }, publicAuthFlags()));
});

authRouter.post('/logout', function(req, res) {
  req.session = null;
  res.json({ ok: true });
});

/** 调试登录：临时用户名 */
authRouter.post('/dev-login', function(req, res) {
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
  res.redirect(discordAuthUrl(state));
});

authRouter.get('/discord/callback', async function(req, res) {
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
    res.redirect(config.publicAppUrl + '/#auth?ok=1');
  } catch (e) {
    console.error('[auth/discord/callback]', e);
    res.redirect(config.publicAppUrl + '/#auth?error=callback_failed');
  }
});
