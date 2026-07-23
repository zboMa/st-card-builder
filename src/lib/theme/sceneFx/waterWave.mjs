/**
 * 水浪 L3：blend 正弦层波 + ambient 涟漪
 */
import { fbm1d } from './sceneFxUtils.mjs';

var WAVE = 'rgba(80, 160, 200, ';
var RIPPLE = 'rgba(120, 200, 230, ';

/** @param {{ blend: CanvasRenderingContext2D|null, ambient: CanvasRenderingContext2D|null }} env */
export function createSceneFx(env) {
  var ctxB = env.blend;
  var ctxA = env.ambient;
  var W = 0;
  var H = 0;
  var waves = [];
  var ripples = [];
  var introT = 0;
  var t = 0;

  function resize(w, h) {
    W = w;
    H = h;
    waves = [
      { y: H * 0.62, amp: 14, freq: 0.007, phase: 0, speed: 0.0004 },
      { y: H * 0.72, amp: 10, freq: 0.011, phase: 1.5, speed: 0.0005 },
      { y: H * 0.82, amp: 7, freq: 0.009, phase: 3, speed: 0.00035 },
    ];
  }

  function tickBlend() {
    if (!ctxB) return;
    t += 16;
    if (introT < 1) introT = Math.min(1, introT + 0.012);
    for (var i = 0; i < waves.length; i++) {
      var wv = waves[i];
      ctxB.beginPath();
      ctxB.moveTo(0, wv.y);
      for (var x = 0; x <= W; x += 8) {
        var y = wv.y
          + Math.sin(x * wv.freq + t * wv.speed * 2000 + wv.phase) * wv.amp * introT
          + fbm1d(x * 0.02 + i, t * 0.0005, 2) * 4 * introT;
        ctxB.lineTo(x, y);
      }
      ctxB.lineTo(W, H);
      ctxB.lineTo(0, H);
      ctxB.closePath();
      var a = introT * (0.07 + i * 0.025);
      ctxB.fillStyle = WAVE + a.toFixed(3) + ')';
      ctxB.fill();
    }
  }

  function tickAmbient() {
    if (!ctxA) return;
    t += 16;
    if (introT < 1) introT = Math.min(1, introT + 0.012);
    for (var j = ripples.length - 1; j >= 0; j--) {
      var r = ripples[j];
      r.life -= 1;
      if (r.life <= 0) { ripples.splice(j, 1); continue; }
      r.r += 1.2;
      var ra = r.life / r.maxLife;
      ctxA.strokeStyle = RIPPLE + (ra * 0.55).toFixed(3) + ')';
      ctxA.lineWidth = 1.5;
      ctxA.beginPath();
      ctxA.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctxA.stroke();
    }
  }

  function burst(x, y) {
    ripples.push({ x: x, y: y, r: 4, life: 32, maxLife: 32 });
    ripples.push({ x: x, y: y, r: 2, life: 24, maxLife: 24 });
  }

  return {
    mount: function() {},
    destroy: function() { ripples = []; introT = 0; },
    resize: resize,
    tickBlend: tickBlend,
    tickAmbient: tickAmbient,
    burst: burst,
    playIntro: function() { introT = 0; },
  };
}
