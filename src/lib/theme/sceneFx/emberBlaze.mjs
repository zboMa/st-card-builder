/**
 * 烈焰 L3：余烬上升 + 火星迸溅
 */

var EMBER = 'rgba(220, 120, 50, ';
var SPARK = 'rgba(255, 180, 80, ';

/** @param {CanvasRenderingContext2D} ctx @param {HTMLCanvasElement} canvas */
export function createSceneFx(ctx, canvas) {
  var W = 0;
  var H = 0;
  var embers = [];
  var sparks = [];
  var introT = 0;
  var t = 0;

  function resize(w, h) {
    W = w;
    H = h;
    if (!embers.length) {
      for (var i = 0; i < 40; i++) {
        embers.push({
          x: Math.random() * W,
          y: H + Math.random() * 40,
          r: 1.5 + Math.random() * 2.5,
          vy: -0.4 - Math.random() * 0.8,
          vx: (Math.random() - 0.5) * 0.3,
          phase: Math.random() * 6.28,
        });
      }
    }
  }

  function tick() {
    t += 16;
    if (introT < 1) introT = Math.min(1, introT + 0.012);
    ctx.clearRect(0, 0, W, H);

    for (var i = 0; i < embers.length; i++) {
      var e = embers[i];
      e.y += e.vy * introT;
      e.x += e.vx + Math.sin(t * 0.002 + e.phase) * 0.2;
      if (e.y < -10) {
        e.y = H + Math.random() * 20;
        e.x = Math.random() * W;
      }
      var flicker = 0.5 + Math.sin(t * 0.004 + e.phase) * 0.3;
      var a = introT * flicker * 0.35;
      var g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 4);
      g.addColorStop(0, SPARK + a.toFixed(3) + ')');
      g.addColorStop(0.5, EMBER + (a * 0.5).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * 4, 0, Math.PI * 2);
      ctx.fill();
    }

    for (var j = sparks.length - 1; j >= 0; j--) {
      var s = sparks[j];
      s.life -= 1;
      if (s.life <= 0) { sparks.splice(j, 1); continue; }
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.08;
      s.vx *= 0.96;
      var sa = s.life / s.maxLife;
      var sg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      sg.addColorStop(0, SPARK + (sa * 0.85).toFixed(3) + ')');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function burst(x, y, kind) {
    var n = kind === 'heat' ? 12 : 8 + Math.floor(Math.random() * 4);
    for (var i = 0; i < n; i++) {
      var ang = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.5;
      var sp = 2 + Math.random() * 4;
      sparks.push({
        x: x, y: y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 1.5,
        r: 4 + Math.random() * 6,
        life: 24 + Math.floor(Math.random() * 12),
        maxLife: 36,
      });
    }
  }

  function playIntro() { introT = 0; }

  return {
    mount: function() {},
    destroy: function() { sparks = []; introT = 0; },
    resize: resize,
    tick: tick,
    burst: burst,
    playIntro: playIntro,
  };
}
