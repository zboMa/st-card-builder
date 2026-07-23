/**
 * 云楼 L3：ambient fBm 云团漂移 + 金粉
 */
import { drawCloudBlob, fbm1d } from './sceneFxUtils.mjs';

var CLOUD = 'rgba(230, 220, 200, ';
var GOLD = 'rgba(200, 170, 100, ';

/** @param {{ blend: CanvasRenderingContext2D|null, ambient: CanvasRenderingContext2D|null }} env */
export function createSceneFx(env) {
  var ctxA = env.ambient;
  var W = 0;
  var H = 0;
  var clouds = [];
  var puffs = [];
  var introT = 0;
  var t = 0;

  function resize(w, h) {
    W = w;
    H = h;
    var base = Math.min(W, H);
    clouds = [
      { x: W * 0.18, y: H * 0.12, r: base * 0.2, seed: 0.5, drift: 0.00028 },
      { x: W * 0.72, y: H * 0.2, r: base * 0.16, seed: 2.2, drift: 0.00022 },
      { x: W * 0.42, y: H * 0.06, r: base * 0.14, seed: 4.1, drift: 0.00032 },
      { x: W * 0.88, y: H * 0.35, r: base * 0.11, seed: 6.0, drift: 0.00026 },
    ];
  }

  function tickAmbient() {
    if (!ctxA) return;
    t += 16;
    if (introT < 1) introT = Math.min(1, introT + 0.011);
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      c.x += fbm1d(c.seed, t * c.drift * 800, 3) * 0.55;
      c.y += Math.sin(t * c.drift * 600 + c.seed) * 0.18;
      drawCloudBlob(ctxA, c.x, c.y, c.r, t, c.seed, CLOUD, introT * 0.11);
    }
    for (var j = puffs.length - 1; j >= 0; j--) {
      var p = puffs[j];
      p.life -= 1;
      if (p.life <= 0) { puffs.splice(j, 1); continue; }
      p.x += p.vx;
      p.y += p.vy;
      p.r += 0.12;
      var pa = p.life / p.maxLife;
      var pg = ctxA.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      pg.addColorStop(0, GOLD + (pa * 0.6).toFixed(3) + ')');
      pg.addColorStop(1, 'rgba(0,0,0,0)');
      ctxA.fillStyle = pg;
      ctxA.beginPath();
      ctxA.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctxA.fill();
    }
  }

  function burst(x, y, kind) {
    var n = kind === 'gild' ? 10 : 6;
    for (var i = 0; i < n; i++) {
      var ang = (Math.PI * 2 * i) / n;
      puffs.push({
        x: x, y: y,
        vx: Math.cos(ang) * (1 + Math.random() * 2),
        vy: Math.sin(ang) * (1 + Math.random() * 2) - 0.5,
        r: 6 + Math.random() * 8,
        life: 28, maxLife: 28,
      });
    }
  }

  return {
    mount: function() {},
    destroy: function() { puffs = []; introT = 0; },
    resize: resize,
    tickAmbient: tickAmbient,
    burst: burst,
    playIntro: function() { introT = 0; },
  };
}
