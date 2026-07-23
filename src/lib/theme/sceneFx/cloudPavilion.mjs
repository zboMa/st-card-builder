/**
 * 云楼 L3：云气漂移 + 金粉 puff
 */

var CLOUD = 'rgba(230, 220, 200, ';
var GOLD = 'rgba(200, 170, 100, ';

/** @param {CanvasRenderingContext2D} ctx @param {HTMLCanvasElement} canvas */
export function createSceneFx(ctx, canvas) {
  var W = 0;
  var H = 0;
  var clouds = [];
  var puffs = [];
  var introT = 0;
  var t = 0;

  function resize(w, h) {
    W = w;
    H = h;
    if (!clouds.length) {
      clouds = [
        { x: W * 0.2, y: H * 0.15, r: Math.min(W, H) * 0.18, phase: 0, drift: 0.0003 },
        { x: W * 0.7, y: H * 0.25, r: Math.min(W, H) * 0.14, phase: 2, drift: 0.00025 },
        { x: W * 0.45, y: H * 0.08, r: Math.min(W, H) * 0.12, phase: 4, drift: 0.00035 },
      ];
    }
  }

  function tick() {
    t += 16;
    if (introT < 1) introT = Math.min(1, introT + 0.011);
    ctx.clearRect(0, 0, W, H);

    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      c.x += Math.sin(t * c.drift * 900 + c.phase) * 0.35;
      var a = introT * 0.08;
      var g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
      g.addColorStop(0, CLOUD + a.toFixed(3) + ')');
      g.addColorStop(0.6, CLOUD + (a * 0.3).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (var j = puffs.length - 1; j >= 0; j--) {
      var p = puffs[j];
      p.life -= 1;
      if (p.life <= 0) { puffs.splice(j, 1); continue; }
      p.x += p.vx;
      p.y += p.vy;
      p.r += 0.12;
      var pa = p.life / p.maxLife;
      var pg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      pg.addColorStop(0, GOLD + (pa * 0.6).toFixed(3) + ')');
      pg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
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

  function playIntro() { introT = 0; }

  return {
    mount: function() {},
    destroy: function() { puffs = []; introT = 0; },
    resize: resize,
    tick: tick,
    burst: burst,
    playIntro: playIntro,
  };
}
