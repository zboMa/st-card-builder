/**
 * 青柠 L3：ambient 果滴漂浮 + zest 迸溅
 */
var DROP = 'rgba(180, 230, 80, ';
var ZEST = 'rgba(220, 255, 100, ';

/** @param {{ blend: CanvasRenderingContext2D|null, ambient: CanvasRenderingContext2D|null }} env */
export function createSceneFx(env) {
  var ctxA = env.ambient;
  var W = 0;
  var H = 0;
  var drops = [];
  var zests = [];
  var introT = 0;
  var t = 0;

  function resize(w, h) {
    W = w;
    H = h;
    if (!drops.length) {
      for (var i = 0; i < 18; i++) {
        drops.push({
          x: Math.random() * W, y: Math.random() * H,
          r: 3 + Math.random() * 5,
          phase: Math.random() * 6.28,
          drift: 0.00035 + Math.random() * 0.00025,
        });
      }
    }
  }

  function tickAmbient() {
    if (!ctxA) return;
    t += 16;
    if (introT < 1) introT = Math.min(1, introT + 0.014);
    for (var i = 0; i < drops.length; i++) {
      var d = drops[i];
      d.x += Math.sin(t * d.drift * 800 + d.phase) * 0.45;
      d.y += Math.cos(t * d.drift * 600 + d.phase) * 0.38;
      var a = introT * 0.16;
      var g = ctxA.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 2.5);
      g.addColorStop(0, ZEST + a.toFixed(3) + ')');
      g.addColorStop(0.6, DROP + (a * 0.4).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctxA.fillStyle = g;
      ctxA.beginPath();
      ctxA.arc(d.x, d.y, d.r * 2.5, 0, Math.PI * 2);
      ctxA.fill();
    }
    for (var j = zests.length - 1; j >= 0; j--) {
      var z = zests[j];
      z.life -= 1;
      if (z.life <= 0) { zests.splice(j, 1); continue; }
      z.x += z.vx;
      z.y += z.vy;
      z.vx *= 0.92;
      z.vy *= 0.92;
      var za = z.life / z.maxLife;
      var zg = ctxA.createRadialGradient(z.x, z.y, 0, z.x, z.y, z.r);
      zg.addColorStop(0, ZEST + (za * 0.75).toFixed(3) + ')');
      zg.addColorStop(1, 'rgba(0,0,0,0)');
      ctxA.fillStyle = zg;
      ctxA.beginPath();
      ctxA.arc(z.x, z.y, z.r, 0, Math.PI * 2);
      ctxA.fill();
    }
  }

  function burst(x, y) {
    var n = 8 + Math.floor(Math.random() * 4);
    for (var i = 0; i < n; i++) {
      var ang = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.4;
      var sp = 2 + Math.random() * 4;
      zests.push({
        x: x, y: y,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        r: 3 + Math.random() * 5,
        life: 22 + Math.floor(Math.random() * 10),
        maxLife: 32,
      });
    }
  }

  return {
    mount: function() {},
    destroy: function() { zests = []; introT = 0; },
    resize: resize,
    tickAmbient: tickAmbient,
    burst: burst,
    playIntro: function() { introT = 0; },
  };
}
