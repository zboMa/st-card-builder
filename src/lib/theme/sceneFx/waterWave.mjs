/**
 * 水浪 L3：层波流动 + 涟漪
 */

var WAVE = 'rgba(80, 160, 200, ';
var RIPPLE = 'rgba(120, 200, 230, ';

/** @param {CanvasRenderingContext2D} ctx @param {HTMLCanvasElement} canvas */
export function createSceneFx(ctx, canvas) {
  var W = 0;
  var H = 0;
  var waves = [];
  var ripples = [];
  var introT = 0;
  var t = 0;

  function resize(w, h) {
    W = w;
    H = h;
    if (!waves.length) {
      waves = [
        { y: H * 0.65, amp: 12, freq: 0.008, phase: 0, speed: 0.0004 },
        { y: H * 0.75, amp: 8, freq: 0.012, phase: 1.5, speed: 0.0005 },
        { y: H * 0.85, amp: 6, freq: 0.01, phase: 3, speed: 0.00035 },
      ];
    }
  }

  function tick() {
    t += 16;
    if (introT < 1) introT = Math.min(1, introT + 0.012);
    ctx.clearRect(0, 0, W, H);

    for (var i = 0; i < waves.length; i++) {
      var wv = waves[i];
      ctx.beginPath();
      ctx.moveTo(0, wv.y);
      for (var x = 0; x <= W; x += 8) {
        var y = wv.y + Math.sin(x * wv.freq + t * wv.speed * 2000 + wv.phase) * wv.amp * introT;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      var a = introT * (0.06 + i * 0.02);
      ctx.fillStyle = WAVE + a.toFixed(3) + ')';
      ctx.fill();
    }

    for (var j = ripples.length - 1; j >= 0; j--) {
      var r = ripples[j];
      r.life -= 1;
      if (r.life <= 0) { ripples.splice(j, 1); continue; }
      r.r += 1.2;
      var ra = r.life / r.maxLife;
      ctx.strokeStyle = RIPPLE + (ra * 0.5).toFixed(3) + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function burst(x, y) {
    ripples.push({ x: x, y: y, r: 4, life: 32, maxLife: 32 });
    ripples.push({ x: x, y: y, r: 2, life: 24, maxLife: 24 });
  }

  function playIntro() { introT = 0; }

  return {
    mount: function() {},
    destroy: function() { ripples = []; introT = 0; },
    resize: resize,
    tick: tick,
    burst: burst,
    playIntro: playIntro,
  };
}
