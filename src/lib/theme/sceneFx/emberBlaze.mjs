/**
 * 烈焰 L3：blend 底部热浪 + ambient 余烬上升/火星
 */
import { drawHeatHaze, seedEmbers, tickEmbers } from './sceneFxUtils.mjs';

var SPARK = 'rgba(255, 180, 80, ';
var COOL = 'rgba(180, 80, 40, ';
var HEAT = 'rgba(255, 140, 60, ';

/** @param {{ blend: CanvasRenderingContext2D|null, ambient: CanvasRenderingContext2D|null }} env */
export function createSceneFx(env) {
  var ctxB = env.blend;
  var ctxA = env.ambient;
  var W = 0;
  var H = 0;
  var embers = [];
  var sparks = [];
  var introT = 0;
  var t = 0;

  function resize(w, h) {
    W = w;
    H = h;
    embers = seedEmbers(48, W, H);
  }

  function tickBlend() {
    if (!ctxB) return;
    t += 16;
    if (introT < 1) introT = Math.min(1, introT + 0.012);
    drawHeatHaze(ctxB, W, H, t, introT, HEAT);
  }

  function tickAmbient() {
    if (!ctxA) return;
    t += 16;
    if (introT < 1) introT = Math.min(1, introT + 0.012);
    tickEmbers(ctxA, embers, W, H, t, introT, SPARK, COOL);
    for (var j = sparks.length - 1; j >= 0; j--) {
      var s = sparks[j];
      s.life -= 1;
      if (s.life <= 0) { sparks.splice(j, 1); continue; }
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.08;
      s.vx *= 0.96;
      var sa = s.life / s.maxLife;
      var sg = ctxA.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      sg.addColorStop(0, SPARK + (sa * 0.85).toFixed(3) + ')');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctxA.fillStyle = sg;
      ctxA.beginPath();
      ctxA.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctxA.fill();
    }
  }

  function burst(x, y, kind) {
    var n = kind === 'heat' ? 12 : 8 + Math.floor(Math.random() * 4);
    for (var i = 0; i < n; i++) {
      var ang = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.5;
      var sp = 2 + Math.random() * 4;
      sparks.push({
        x: x, y: y,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 1.5,
        r: 4 + Math.random() * 6,
        life: 24 + Math.floor(Math.random() * 12),
        maxLife: 36,
      });
    }
  }

  return {
    mount: function() {},
    destroy: function() { sparks = []; introT = 0; },
    resize: resize,
    tickBlend: tickBlend,
    tickAmbient: tickAmbient,
    burst: burst,
    playIntro: function() { introT = 0; },
  };
}
