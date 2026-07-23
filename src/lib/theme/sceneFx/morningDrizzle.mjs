/**
 * 清晨细雨 L3：雨丝下落 + 溅水
 */

var RAIN = 'rgba(180, 210, 240, ';
var SPLASH = 'rgba(200, 225, 250, ';

/** @param {CanvasRenderingContext2D} ctx @param {HTMLCanvasElement} canvas */
export function createSceneFx(ctx, canvas) {
  var W = 0;
  var H = 0;
  var streaks = [];
  var splashes = [];
  var introT = 0;
  var t = 0;

  function resize(w, h) {
    W = w;
    H = h;
    if (!streaks.length) {
      for (var i = 0; i < 80; i++) {
        streaks.push({
          x: Math.random() * W,
          y: Math.random() * H,
          len: 8 + Math.random() * 14,
          vy: 3 + Math.random() * 4,
          vx: -0.5 - Math.random() * 0.5,
        });
      }
    }
  }

  function tick() {
    t += 16;
    if (introT < 1) introT = Math.min(1, introT + 0.015);
    ctx.clearRect(0, 0, W, H);

    for (var i = 0; i < streaks.length; i++) {
      var s = streaks[i];
      s.y += s.vy * introT;
      s.x += s.vx * introT;
      if (s.y > H + 20) {
        s.y = -20;
        s.x = Math.random() * W;
      }
      var a = introT * 0.42;
      ctx.strokeStyle = RAIN + a.toFixed(3) + ')';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + s.vx * 3, s.y + s.len);
      ctx.stroke();
    }

    for (var j = splashes.length - 1; j >= 0; j--) {
      var sp = splashes[j];
      sp.life -= 1;
      if (sp.life <= 0) { splashes.splice(j, 1); continue; }
      sp.r += 0.8;
      var spa = sp.life / sp.maxLife;
      ctx.strokeStyle = SPLASH + (spa * 0.45).toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.r, Math.PI, 0);
      ctx.stroke();
    }
  }

  function burst(x, y) {
    splashes.push({ x: x, y: y, r: 3, life: 20, maxLife: 20 });
    splashes.push({ x: x + 4, y: y, r: 2, life: 16, maxLife: 16 });
  }

  function playIntro() { introT = 0; }

  return {
    mount: function() {},
    destroy: function() { splashes = []; introT = 0; },
    resize: resize,
    tick: tick,
    burst: burst,
    playIntro: playIntro,
  };
}
