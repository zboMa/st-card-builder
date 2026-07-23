/**
 * 碎冰 L3：ambient 霜雾漂移 + 冰晶迸裂
 */
var FROST = 'rgba(200, 230, 255, ';
var ICE = 'rgba(120, 180, 220, ';

/** @param {{ blend: CanvasRenderingContext2D|null, ambient: CanvasRenderingContext2D|null }} env */
export function createSceneFx(env) {
  var ctxA = env.ambient;
  var W = 0;
  var H = 0;
  var flakes = [];
  var bursts = [];
  var introT = 0;
  var t = 0;

  function resize(w, h) {
    W = w;
    H = h;
    if (!flakes.length) {
      for (var i = 0; i < 22; i++) {
        flakes.push({
          x: Math.random() * W, y: Math.random() * H,
          r: 2 + Math.random() * 4,
          phase: Math.random() * 6.28,
          drift: 0.0002 + Math.random() * 0.0003,
        });
      }
    }
  }

  function tickAmbient() {
    if (!ctxA) return;
    t += 16;
    if (introT < 1) introT = Math.min(1, introT + 0.014);
    for (var i = 0; i < flakes.length; i++) {
      var f = flakes[i];
      f.x += Math.sin(t * f.drift * 900 + f.phase) * 0.35;
      f.y += Math.cos(t * f.drift * 700 + f.phase) * 0.28;
      if (f.x < 0) f.x = W;
      if (f.x > W) f.x = 0;
      if (f.y < 0) f.y = H;
      if (f.y > H) f.y = 0;
      var a = introT * (0.1 + Math.sin(t * 0.001 + f.phase) * 0.05);
      var g = ctxA.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 3);
      g.addColorStop(0, FROST + a.toFixed(3) + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctxA.fillStyle = g;
      ctxA.beginPath();
      ctxA.arc(f.x, f.y, f.r * 3, 0, Math.PI * 2);
      ctxA.fill();
    }
    for (var j = bursts.length - 1; j >= 0; j--) {
      var b = bursts[j];
      b.life -= 1;
      if (b.life <= 0) { bursts.splice(j, 1); continue; }
      var ba = b.life / b.maxLife;
      ctxA.strokeStyle = ICE + (ba * 0.7).toFixed(3) + ')';
      ctxA.lineWidth = 1.2;
      ctxA.beginPath();
      for (var k = 0; k < b.lines; k++) {
        var ang = (Math.PI * 2 * k) / b.lines + b.rot;
        ctxA.moveTo(b.x, b.y);
        ctxA.lineTo(b.x + Math.cos(ang) * b.r * ba, b.y + Math.sin(ang) * b.r * ba);
      }
      ctxA.stroke();
      b.r += 0.6;
    }
  }

  function burst(x, y, kind) {
    bursts.push({
      x: x, y: y, r: 8 + Math.random() * 6,
      lines: kind === 'crystal' ? 10 : 8,
      rot: Math.random() * 0.5,
      life: 28, maxLife: 28,
    });
  }

  return {
    mount: function() {},
    destroy: function() { bursts = []; introT = 0; },
    resize: resize,
    tickAmbient: tickAmbient,
    burst: burst,
    playIntro: function() { introT = 0; },
  };
}
