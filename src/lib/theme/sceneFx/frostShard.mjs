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
      var grow = 0.4 + 0.6 * (1 - ba);
      ctxA.lineCap = 'round';
      ctxA.lineJoin = 'round';
      for (var s = 0; s < b.segs.length; s++) {
        var seg = b.segs[s];
        ctxA.strokeStyle = ICE + (ba * 0.75).toFixed(3) + ')';
        ctxA.lineWidth = seg.w;
        ctxA.beginPath();
        ctxA.moveTo(b.x + (seg.x0 - b.x) * grow, b.y + (seg.y0 - b.y) * grow);
        ctxA.lineTo(b.x + (seg.x1 - b.x) * grow, b.y + (seg.y1 - b.y) * grow);
        ctxA.stroke();
      }
    }
  }

  function crackSegments(x, y) {
    var segs = [];
    function walk(x0, y0, ang, len, depth) {
      if (depth <= 0 || len < 6) return;
      var ang2 = ang + (Math.random() - 0.5) * 0.55;
      var x1 = x0 + Math.cos(ang2) * len;
      var y1 = y0 + Math.sin(ang2) * len;
      segs.push({ x0: x0, y0: y0, x1: x1, y1: y1, w: 0.6 + depth * 0.35 });
      walk(x1, y1, ang2, len * 0.62, depth - 1);
      if (depth > 1) {
        walk(
          x0 + (x1 - x0) * 0.55,
          y0 + (y1 - y0) * 0.55,
          ang2 + (Math.random() < 0.5 ? 0.85 : -0.85),
          len * 0.45,
          depth - 1,
        );
      }
    }
    walk(x, y, -Math.PI / 2 + (Math.random() - 0.5) * 0.5, 26 + Math.random() * 14, 4);
    return segs;
  }

  function burst(x, y) {
    bursts.push({
      x: x,
      y: y,
      segs: crackSegments(x, y),
      life: 36,
      maxLife: 36,
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
