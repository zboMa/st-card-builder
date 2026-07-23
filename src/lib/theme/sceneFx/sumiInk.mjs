/**
 * 水墨 L3：墨团呼吸/慢流 + 溅墨 burst + 切换 bloom
 */

var INK = 'rgba(28, 24, 20, ';
var INK_LIGHT = 'rgba(55, 48, 40, ';
var SPLASH = 'rgba(120, 45, 35, ';

/** @param {CanvasRenderingContext2D} ctx @param {HTMLCanvasElement} canvas */
export function createSceneFx(ctx, canvas) {
  var W = 0;
  var H = 0;
  var blobs = [];
  var splashes = [];
  var introT = 0;
  var t = 0;

  function resize(w, h) {
    W = w;
    H = h;
    if (!blobs.length) {
      blobs = [
        { x: W * 0.14, y: H * 0.12, r: Math.min(W, H) * 0.22, phase: 0, speed: 0.0008 },
        { x: W * 0.78, y: H * 0.82, r: Math.min(W, H) * 0.16, phase: 1.2, speed: 0.0006 },
        { x: W * 0.55, y: H * 0.35, r: Math.min(W, H) * 0.12, phase: 2.4, speed: 0.001 },
      ];
    }
  }

  function drawBlob(b, alpha) {
    var pulse = 1 + Math.sin(t * b.speed * 1000 + b.phase) * 0.06;
    var r = b.r * pulse * (0.85 + introT * 0.15);
    var g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
    g.addColorStop(0, INK + (alpha * 0.35).toFixed(3) + ')');
    g.addColorStop(0.45, INK_LIGHT + (alpha * 0.12).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fill();
    b.x += Math.sin(t * 0.0004 + b.phase) * 0.15;
    b.y += Math.cos(t * 0.00035 + b.phase) * 0.12;
  }

  function tick() {
    t += 16;
    if (introT < 1) introT = Math.min(1, introT + 0.018);

    ctx.clearRect(0, 0, W, H);

    for (var i = 0; i < blobs.length; i++) {
      drawBlob(blobs[i], introT);
    }

    for (var j = splashes.length - 1; j >= 0; j--) {
      var s = splashes[j];
      s.life -= 1;
      if (s.life <= 0) {
        splashes.splice(j, 1);
        continue;
      }
      s.x += s.vx;
      s.y += s.vy;
      s.vx *= 0.96;
      s.vy *= 0.96;
      var a = (s.life / s.maxLife) * 0.55;
      var sg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      sg.addColorStop(0, SPLASH + a.toFixed(3) + ')');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function burst(x, y, kind) {
    var n = kind === 'seal' ? 4 : 6 + Math.floor(Math.random() * 3);
    for (var i = 0; i < n; i++) {
      var ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      var sp = kind === 'seal' ? 1.2 + Math.random() * 1.5 : 2 + Math.random() * 3;
      splashes.push({
        x: x,
        y: y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        r: kind === 'seal' ? 10 + Math.random() * 8 : 6 + Math.random() * 10,
        life: kind === 'seal' ? 28 : 22 + Math.floor(Math.random() * 10),
        maxLife: 32,
      });
    }
  }

  function playIntro() {
    introT = 0;
    blobs.forEach(function(b, i) {
      b.x = W * (0.12 + i * 0.08);
      b.y = H * (0.1 + i * 0.05);
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
