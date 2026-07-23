/**
 * 月影朦胧 L3：blend 月华/雾 + ambient 涟漪
 */
var HALO = 'rgba(230, 230, 245, ';
var MIST = 'rgba(200, 210, 230, ';

/** @param {{ blend: CanvasRenderingContext2D|null, ambient: CanvasRenderingContext2D|null }} env */
export function createSceneFx(env) {
  var ctxB = env.blend;
  var ctxA = env.ambient;
  var W = 0;
  var H = 0;
  var mx = 0;
  var my = 0;
  var ripples = [];
  var introT = 0;
  var t = 0;

  function resize(w, h) {
    W = w;
    H = h;
    mx = W * 0.78;
    my = H * 0.14;
  }

  function tickBlend() {
    if (!ctxB) return;
    t += 16;
    if (introT < 1) introT = Math.min(1, introT + 0.011);
    var breath = 0.5 + Math.sin(t * 0.0005) * 0.5;
    var r = Math.min(W, H) * (0.22 + breath * 0.04) * introT;
    var g = ctxB.createRadialGradient(mx, my, 0, mx, my, r);
    g.addColorStop(0, HALO + (introT * 0.12).toFixed(3) + ')');
    g.addColorStop(0.5, HALO + (introT * 0.05).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctxB.fillStyle = g;
    ctxB.beginPath();
    ctxB.arc(mx, my, r, 0, Math.PI * 2);
    ctxB.fill();
    var groundY = H * 0.88;
    var mg = ctxB.createRadialGradient(W * 0.5, groundY, 0, W * 0.5, groundY, W * 0.45);
    mg.addColorStop(0, MIST + (introT * 0.08 * breath).toFixed(3) + ')');
    mg.addColorStop(0.6, MIST + (introT * 0.03).toFixed(3) + ')');
    mg.addColorStop(1, 'rgba(0,0,0,0)');
    ctxB.fillStyle = mg;
    ctxB.fillRect(0, groundY - 40, W, 80);
  }

  function tickAmbient() {
    if (!ctxA) return;
    t += 16;
    if (introT < 1) introT = Math.min(1, introT + 0.011);
    for (var j = ripples.length - 1; j >= 0; j--) {
      var rp = ripples[j];
      rp.life -= 1;
      if (rp.life <= 0) { ripples.splice(j, 1); continue; }
      rp.r += 0.6;
      var ra = rp.life / rp.maxLife;
      ctxA.strokeStyle = HALO + (ra * 0.35).toFixed(3) + ')';
      ctxA.lineWidth = 1.2;
      ctxA.beginPath();
      ctxA.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
      ctxA.stroke();
    }
  }

  function burst(x, y) {
    ripples.push({ x: x, y: y, r: 6, life: 36, maxLife: 36 });
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
