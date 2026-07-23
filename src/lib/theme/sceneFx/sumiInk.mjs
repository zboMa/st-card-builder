/**
 * 水墨 L3：可见墨晕流动 + 淡墨洗 + 溅墨/钤印
 */

var WASH = 'rgba(210, 200, 185, ';
var INK = 'rgba(45, 38, 32, ';
var SPLASH_DARK = 'rgba(35, 28, 24, ';
var SPLASH_SEAL = 'rgba(160, 55, 42, ';

/** @param {CanvasRenderingContext2D} ctx @param {HTMLCanvasElement} canvas */
export function createSceneFx(ctx, canvas) {
  var W = 0;
  var H = 0;
  var washes = [];
  var veins = [];
  var splashes = [];
  var introT = 0;
  var t = 0;

  function resize(w, h) {
    W = w;
    H = h;
    if (!washes.length) {
      washes = [
        { x: W * 0.18, y: H * 0.22, r: Math.min(W, H) * 0.38, phase: 0, drift: 0.00045 },
        { x: W * 0.72, y: H * 0.68, r: Math.min(W, H) * 0.32, phase: 1.4, drift: 0.00038 },
        { x: W * 0.48, y: H * 0.45, r: Math.min(W, H) * 0.28, phase: 2.8, drift: 0.00052 },
        { x: W * 0.32, y: H * 0.55, r: Math.min(W, H) * 0.22, phase: 3.5, drift: 0.00048 },
      ];
      veins = [
        { x: W * 0.1, y: H * 0.15, r: Math.min(W, H) * 0.2, phase: 0.5 },
        { x: W * 0.85, y: H * 0.78, r: Math.min(W, H) * 0.14, phase: 2.1 },
      ];
    }
  }

  function drawWash(b, alpha) {
    var pulse = 1 + Math.sin(t * b.drift * 1200 + b.phase) * 0.12;
    var r = b.r * pulse * (0.7 + introT * 0.3);
    b.x += Math.sin(t * b.drift * 800 + b.phase) * 0.55;
    b.y += Math.cos(t * b.drift * 700 + b.phase) * 0.4;
    var g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
    g.addColorStop(0, WASH + (alpha * 0.32).toFixed(3) + ')');
    g.addColorStop(0.35, WASH + (alpha * 0.14).toFixed(3) + ')');
    g.addColorStop(0.7, INK + (alpha * 0.1).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawVein(b, alpha) {
    var r = b.r * (0.9 + Math.sin(t * 0.0006 + b.phase) * 0.08);
    var g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
    g.addColorStop(0, INK + (alpha * 0.55).toFixed(3) + ')');
    g.addColorStop(0.5, INK + (alpha * 0.18).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function tick() {
    t += 16;
    if (introT < 1) introT = Math.min(1, introT + 0.012);

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';

    for (var i = 0; i < washes.length; i++) {
      drawWash(washes[i], introT);
    }
    ctx.globalCompositeOperation = 'multiply';
    for (var v = 0; v < veins.length; v++) {
      drawVein(veins[v], introT);
    }
    ctx.globalCompositeOperation = 'source-over';

    for (var j = splashes.length - 1; j >= 0; j--) {
      var s = splashes[j];
      s.life -= 1;
      if (s.life <= 0) {
        splashes.splice(j, 1);
        continue;
      }
      s.x += s.vx;
      s.y += s.vy;
      s.vx *= 0.94;
      s.vy *= 0.94;
      s.r += s.kind === 'seal' ? 0.15 : 0.08;
      var a = (s.life / s.maxLife);
      var base = s.kind === 'seal' ? SPLASH_SEAL : SPLASH_DARK;
      var sg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      sg.addColorStop(0, base + Math.min(0.85, a * 0.9).toFixed(3) + ')');
      sg.addColorStop(0.45, base + (a * 0.35).toFixed(3) + ')');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      if (s.kind === 'seal' && s.life > s.maxLife - 8) {
        ctx.strokeStyle = SPLASH_SEAL + (a * 0.7).toFixed(3) + ')';
        ctx.lineWidth = 2;
        ctx.strokeRect(s.x - s.r * 0.5, s.y - s.r * 0.35, s.r, s.r * 0.7);
      }
    }
  }

  function burst(x, y, kind) {
    var n = kind === 'seal' ? 10 : 8 + Math.floor(Math.random() * 4);
    for (var i = 0; i < n; i++) {
      var ang = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.6;
      var sp = kind === 'seal' ? 2.5 + Math.random() * 3 : 3 + Math.random() * 5;
      splashes.push({
        x: x,
        y: y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        r: kind === 'seal' ? 14 + Math.random() * 10 : 8 + Math.random() * 14,
        life: kind === 'seal' ? 42 : 36 + Math.floor(Math.random() * 12),
        maxLife: 48,
        kind: kind || 'splash',
      });
    }
    splashes.push({
      x: x, y: y, vx: 0, vy: 0, r: kind === 'seal' ? 28 : 22,
      life: 24, maxLife: 24, kind: kind || 'splash',
    });
  }

  function playIntro() {
    introT = 0;
    washes.forEach(function(b, i) {
      b.x = W * (0.15 + i * 0.12);
      b.y = H * (0.18 + i * 0.08);
    });
  }

  return {
    mount: function() {},
    destroy: function() {
      splashes = [];
      introT = 0;
    },
    resize: resize,
    tick: tick,
    burst: burst,
    playIntro: playIntro,
  };
}
