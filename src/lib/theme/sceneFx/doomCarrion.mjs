/**
 * 末日邪鸦 L3：ambient 鸦影掠过 + 羽屑
 */
var CROW = 'rgba(30, 28, 26, ';
var FEATHER = 'rgba(180, 100, 50, ';
var ASH = 'rgba(120, 110, 100, ';

/** @param {{ blend: CanvasRenderingContext2D|null, ambient: CanvasRenderingContext2D|null }} env */
export function createSceneFx(env) {
  var ctxA = env.ambient;
  var W = 0;
  var H = 0;
  var crows = [];
  var feathers = [];
  var introT = 0;
  var t = 0;

  function drawCrow(ctx, cx, cy, sc, wing) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sc, sc);
    ctx.fillStyle = CROW + '0.55)';
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.quadraticCurveTo(-8, -12 - wing * 8, 18, -2);
    ctx.quadraticCurveTo(28, 4, 22, 8);
    ctx.quadraticCurveTo(0, 6, -20, 0);
    ctx.fill();
    ctx.restore();
  }

  function resize(w, h) {
    W = w;
    H = h;
    if (!crows.length) {
      crows = [
        { t: 0, speed: 0.00035, y: 0.22, scale: 1.1, phase: 0 },
        { t: 0.4, speed: 0.00028, y: 0.35, scale: 0.85, phase: 2 },
        { t: 0.7, speed: 0.00032, y: 0.18, scale: 0.95, phase: 4 },
      ];
    }
  }

  function tickAmbient() {
    if (!ctxA) return;
    t += 16;
    if (introT < 1) introT = Math.min(1, introT + 0.012);
    for (var i = 0; i < crows.length; i++) {
      var c = crows[i];
      c.t += c.speed * introT;
      if (c.t > 1.2) c.t = -0.2;
      var cx = c.t * (W + 120) - 60;
      var cy = H * c.y + Math.sin(t * 0.001 + c.phase) * 12;
      var wing = Math.sin(t * 0.004 + c.phase) * 0.5 + 0.5;
      drawCrow(ctxA, cx, cy, c.scale * introT, wing);
    }
    for (var j = feathers.length - 1; j >= 0; j--) {
      var f = feathers[j];
      f.life -= 1;
      if (f.life <= 0) { feathers.splice(j, 1); continue; }
      f.x += f.vx;
      f.y += f.vy;
      f.vy += 0.04;
      var fa = f.life / f.maxLife;
      ctxA.strokeStyle = (f.kind === 'feather' ? FEATHER : ASH) + (fa * 0.6).toFixed(3) + ')';
      ctxA.lineWidth = 1.5;
      ctxA.beginPath();
      ctxA.moveTo(f.x, f.y);
      ctxA.quadraticCurveTo(f.x + f.vx * 3, f.y - 4, f.x + f.vx * 6, f.y + 2);
      ctxA.stroke();
    }
  }

  function burst(x, y, kind) {
    var n = kind === 'eye' ? 8 : 5 + Math.floor(Math.random() * 3);
    for (var i = 0; i < n; i++) {
      var ang = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.5;
      var sp = 1.5 + Math.random() * 3;
      feathers.push({
        x: x, y: y,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 1,
        life: 28 + Math.floor(Math.random() * 10),
        maxLife: 38,
        kind: kind === 'eye' ? 'feather' : 'ash',
      });
    }
  }

  return {
    mount: function() {},
    destroy: function() { feathers = []; introT = 0; },
    resize: resize,
    tickAmbient: tickAmbient,
    burst: burst,
    playIntro: function() { introT = 0; },
  };
}
