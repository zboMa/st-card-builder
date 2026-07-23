/**
 * 翠竹 L3：风纹飘动 + 风切线
 */

var WIND = 'rgba(100, 180, 130, ';
var CUT = 'rgba(140, 220, 160, ';

/** @param {CanvasRenderingContext2D} ctx @param {HTMLCanvasElement} canvas */
export function createSceneFx(ctx, canvas) {
  var W = 0;
  var H = 0;
  var lines = [];
  var cuts = [];
  var introT = 0;
  var t = 0;

  function resize(w, h) {
    W = w;
    H = h;
    if (!lines.length) {
      for (var i = 0; i < 6; i++) {
        lines.push({
          y: H * (0.15 + i * 0.14),
          len: W * (0.3 + Math.random() * 0.4),
          phase: Math.random() * 6.28,
          speed: 0.0003 + Math.random() * 0.0002,
        });
      }
    }
  }

  function tick() {
    t += 16;
    if (introT < 1) introT = Math.min(1, introT + 0.013);
    ctx.clearRect(0, 0, W, H);

    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      var ox = Math.sin(t * ln.speed * 1000 + ln.phase) * W * 0.08;
      var a = introT * 0.12;
      ctx.strokeStyle = WIND + a.toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(W * 0.1 + ox, ln.y);
      ctx.lineTo(W * 0.1 + ox + ln.len, ln.y - 8);
      ctx.stroke();
    }

    for (var j = cuts.length - 1; j >= 0; j--) {
      var c = cuts[j];
      c.life -= 1;
      if (c.life <= 0) { cuts.splice(j, 1); continue; }
      var ca = c.life / c.maxLife;
      ctx.strokeStyle = CUT + (ca * 0.8).toFixed(3) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(c.x - c.len * ca, c.y - c.len * 0.3 * ca);
      ctx.lineTo(c.x + c.len * ca, c.y + c.len * 0.3 * ca);
      ctx.stroke();
    }
  }

  function burst(x, y, kind) {
    cuts.push({
      x: x, y: y,
      len: 30 + Math.random() * 25,
      life: 18, maxLife: 18,
    });
    if (kind === 'windcut') {
      cuts.push({
        x: x + 8, y: y - 4,
        len: 20 + Math.random() * 15,
        life: 14, maxLife: 14,
      });
    }
  }

  function playIntro() { introT = 0; }

  return {
    mount: function() {},
    destroy: function() { cuts = []; introT = 0; },
    resize: resize,
    tick: tick,
    burst: burst,
    playIntro: playIntro,
  };
}
