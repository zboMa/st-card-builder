/**
 * 清晨细雨 L3：ambient 算法雨丝 + 溅水
 */
import { seedRain, tickRain } from './sceneFxUtils.mjs';

var RAIN = 'rgba(180, 210, 240, ';
var SPLASH = 'rgba(200, 225, 250, ';

/** @param {{ blend: CanvasRenderingContext2D|null, ambient: CanvasRenderingContext2D|null }} env */
export function createSceneFx(env) {
  var ctxA = env.ambient;
  var W = 0;
  var H = 0;
  var streaks = [];
  var splashes = [];
  var introT = 0;
  var t = 0;

  function resize(w, h) {
    W = w;
    H = h;
    streaks = seedRain(Math.min(140, 60 + Math.floor(W / 12)), W, H);
  }

  function tickAmbient() {
    if (!ctxA) return;
    t += 16;
    if (introT < 1) introT = Math.min(1, introT + 0.015);
    tickRain(ctxA, streaks, W, H, introT, RAIN);
    if (Math.random() < 0.04 * introT) {
      splashes.push({
        x: Math.random() * W,
        y: H * (0.82 + Math.random() * 0.12),
        r: 2 + Math.random() * 4,
        life: 14 + Math.floor(Math.random() * 8),
        maxLife: 22,
      });
    }
    for (var j = splashes.length - 1; j >= 0; j--) {
      var sp = splashes[j];
      sp.life -= 1;
      if (sp.life <= 0) { splashes.splice(j, 1); continue; }
      sp.r += 0.9;
      var spa = sp.life / sp.maxLife;
      ctxA.strokeStyle = SPLASH + (spa * 0.5).toFixed(3) + ')';
      ctxA.lineWidth = 1;
      ctxA.beginPath();
      ctxA.arc(sp.x, sp.y, sp.r, Math.PI, 0);
      ctxA.stroke();
    }
  }

  function burst(x, y) {
    splashes.push({ x: x, y: y, r: 3, life: 20, maxLife: 20 });
    splashes.push({ x: x + 4, y: y, r: 2, life: 16, maxLife: 16 });
  }

  return {
    mount: function() {},
    destroy: function() { splashes = []; introT = 0; },
    resize: resize,
    tickAmbient: tickAmbient,
    burst: burst,
    playIntro: function() { introT = 0; },
  };
}
