/**
 * ST Card Builder API — Node + CouchDB
 */
import express from 'express';
import cors from 'cors';
import cookieSession from 'cookie-session';
import { config } from './config.mjs';
import { couchHealth } from './couch.mjs';
import { authRouter } from './auth/routes.mjs';
import { syncRouter } from './sync/routes.mjs';

var app = express();

app.set('trust proxy', 1);
app.use(cors({
  origin: function(origin, cb) {
    if (!origin) return cb(null, true);
    var allowed = [config.publicAppUrl, 'http://localhost:4321', 'http://127.0.0.1:4321'];
    cb(null, allowed.indexOf(origin) >= 0);
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(cookieSession({
  name: 'stcb_sess',
  keys: [config.sessionSecret],
  maxAge: 14 * 24 * 60 * 60 * 1000,
  sameSite: 'lax',
  httpOnly: true,
  secure: false,
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
    },
  });
});

app.use('/api/auth', authRouter);
app.use('/api/sync', syncRouter);

app.use(function(err, req, res, next) {
  console.error('[api]', err);
  res.status(500).json({ error: 'internal', message: String(err && err.message || err) });
});

app.listen(config.port, function() {
  console.log('[server] listening on :' + config.port);
  console.log('[server] DEV_LOGIN_ENABLED=' + config.devLoginEnabled
    + ' AUTH_ENFORCE=' + config.authEnforceDiscordMembership);
});
