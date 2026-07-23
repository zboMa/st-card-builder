/**
 * 月影朦胧 L3：月华呼吸 + 薄雾 shear
 */

var HALO = 'rgba(230, 230, 245, ';
var MIST = 'rgba(200, 210, 230, ';

/** @param {CanvasRenderingContext2D} ctx @param {HTMLCanvasElement} canvas */
export function createSceneFx(ctx, canvas) {
  var W = 0;
  var H = 0;
  var mx = 0;
  var my = 0;
  var ripples = [];
  var introT = 0;
  var t = 0;
  var breath = 0;

  function resize(w, h) {
    W = w;
    H = h;
    mx = W * 0.78;
    my = H * 0.14;
  }

  function tick() {
    t += 16;
    if (introT < 1) introT = Math.min(1, introT + 0.011);
    breath = 0.5 + Math.sin(t * 0.0005) * 0.5;
    ctx.clearRect(0, 0, W, H);

    var r = Math.min(W, H) * (0.22 + breath * 0.04) * introT;
    var g = ctx.createRadialGradient(mx, my, 0, mx, my, r);
    g.addColorStop(0, HALO + (introT * 0.12).toFixed(3) + ')');
    g.addColorStop(0.5, HALO + (introT * 0.05).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, Math.PI * 2);
    ctx.fill();

    var groundY = H * 0.88;
    var mg = ctx.createRadialGradient(W * 0.5, groundY, 0, W * 0.5, groundY, W * 0.45);
    mg.addColorStop(0, MIST + (introT * 0.08 * breath).toFixed(3) + ')');
    mg.addColorStop(0.6, MIST + (introT * 0.03).toFixed(3) + ')');
    mg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(0, groundY - 40, W, 80);

    for (var j = ripples.length - 1; j >= 0; j--) {
      var rp = ripples[j];
      rp.life -= 1;
      if (rp.life <= 0) { ripples.splice(j, 1); continue; }
      rp.r += 0.6;
      var ra = rp.life / rp.maxLife;
      ctx.strokeStyle = HALO + (ra * 0.35).toFixed(3) + ')';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function burst(x, y) {
    ripples.push({ x: x, y: y, r: 6, life: 36, maxLife: 36 });
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
