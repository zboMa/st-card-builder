/**
 * ST Card Builder API — Node + CouchDB
 */
import express from 'express';
import cors from 'cors';
import cookieSession from 'cookie-session';
import { config, corsAllowlist } from './config.mjs';
import { couchHealth } from './couch.mjs';
import { authRouter } from './auth/routes.mjs';
import { syncRouter } from './sync/routes.mjs';
import { shareRouter } from './share/routes.mjs';
import { cardShareRouter } from './share/cardRoutes.mjs';
import { adminRouter } from './admin/routes.mjs';

var app = express();
var allow = corsAllowlist();

app.set('trust proxy', 1);
app.use(cors({
  origin: function(origin, cb) {
    if (!origin) return cb(null, true);
    if (allow.indexOf(origin) >= 0) return cb(null, true);
    // SillyTavern 常见本地端口放宽；生产可再用 CORS_ORIGINS 加源
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
      return cb(null, true);
    }
    cb(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '25mb' }));
app.use(cookieSession({
  name: 'stcb_sess',
  keys: [config.sessionSecret],
  maxAge: 14 * 24 * 60 * 60 * 1000,
  sameSite: 'lax',
  httpOnly: true,
  secure: !!config.cookieSecure,
  domain: config.sessionCookieDomain || undefined,
}));

app.get('/api/health', async function(req, res) {
  var couch = await couchHealth();
  res.status(couch.ok ? 200 : 503).json({
    ok: couch.ok,
    service: 'st-card-builder-server',
    couch: couch,
    auth: {
      devLoginEnabled: config.devLoginEnabled,
      enforceMembership: config.authEnforceDiscordMembership,
      cookieSecure: config.cookieSecure,
      adminIdsConfigured: config.adminDiscordIds.length > 0,
    },
  });
});

app.use('/api/auth', authRouter);
app.use('/api/sync', syncRouter);
app.use('/api/share/cards', cardShareRouter);
app.use('/api/share', shareRouter);
app.use('/api/admin', adminRouter);

app.use(function(err, req, res, next) {
  console.error('[api]', err);
  res.status(500).json({ error: 'internal', message: String(err && err.message || err) });
});

app.listen(config.port, function() {
  console.log('[server] listening on :' + config.port);
  console.log('[server] DEV_LOGIN_ENABLED=' + config.devLoginEnabled
    + ' AUTH_ENFORCE=' + config.authEnforceDiscordMembership
    + ' COOKIE_SECURE=' + config.cookieSecure
    + ' ADMIN_IDS=' + config.adminDiscordIds.length);
});
