/**
 * 水墨 L3：小墨点/淡晕（避中心）+ 溅墨/钤印
 * 禁止大半径 wash 居中 —— 会读成灰块而非墨韵
 */

var INK = 'rgba(22, 22, 22, ';
var WASH = 'rgba(240, 240, 238, ';
var SPLASH_DARK = 'rgba(14, 14, 14, ';
var SPLASH_SEAL = 'rgba(160, 55, 42, ';

/** @param {number} x @param {number} y @param {number} W @param {number} H */
function inCenterZone(x, y, W, H) {
  return x > W * 0.28 && x < W * 0.72 && y > H * 0.2 && y < H * 0.78;
}

/** @param {CanvasRenderingContext2D} ctx @param {HTMLCanvasElement} canvas */
export function createSceneFx(ctx, canvas) {
  var W = 0;
  var H = 0;
  var motes = [];
  var splashes = [];
  var introT = 0;
  var t = 0;

  function seedMotes() {
    motes = [];
    var base = Math.min(W, H);
    var n = 16 + Math.floor(base / 80);
    for (var i = 0; i < n; i++) {
      var x = Math.random() * W;
      var y = Math.random() * H;
      var tries = 0;
      while (inCenterZone(x, y, W, H) && tries < 12) {
        x = Math.random() * W;
        y = Math.random() * H;
        tries++;
      }
      motes.push({
        x: x,
        y: y,
        r: 8 + Math.random() * 28,
        phase: Math.random() * 6.28,
        drift: 0.00025 + Math.random() * 0.00035,
        kind: Math.random() > 0.65 ? 'wash' : 'dot',
      });
    }
    // 底部边缘淡墨洗（仅宽浅条，不向上侵）
    motes.push(
      { x: W * 0.15, y: H * 0.92, r: base * 0.12, phase: 0, drift: 0.0002, kind: 'edge' },
      { x: W * 0.85, y: H * 0.9, r: base * 0.1, phase: 1.5, drift: 0.00022, kind: 'edge' },
    );
  }

  function resize(w, h) {
    W = w;
    H = h;
    seedMotes();
  }

  function drawMote(m, alpha) {
    var pulse = 1 + Math.sin(t * m.drift * 900 + m.phase) * 0.06;
    var r = m.r * pulse;
    var mx = m.x + Math.sin(t * m.drift * 600 + m.phase) * 0.35;
    var my = m.y + Math.cos(t * m.drift * 500 + m.phase) * 0.28;
    if (inCenterZone(mx, my, W, H) && m.kind !== 'edge') return;

    var peak = m.kind === 'edge' ? alpha * 0.06 : m.kind === 'wash' ? alpha * 0.07 : alpha * 0.12;
    var g = ctx.createRadialGradient(mx, my, 0, mx, my, r);
    if (m.kind === 'wash' || m.kind === 'edge') {
      g.addColorStop(0, WASH + (peak * 0.5).toFixed(3) + ')');
      g.addColorStop(0.45, INK + (peak * 0.35).toFixed(3) + ')');
    } else {
      g.addColorStop(0, INK + peak.toFixed(3) + ')');
      g.addColorStop(0.55, INK + (peak * 0.35).toFixed(3) + ')');
    }
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function tick() {
    t += 16;
    if (introT < 1) introT = Math.min(1, introT + 0.018);

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'multiply';

    for (var i = 0; i < motes.length; i++) {
      drawMote(motes[i], introT);
    }

    ctx.globalCompositeOperation = 'source-over';

    for (var j = splashes.length - 1; j >= 0; j--) {
      var s = splashes[j];
      s.life -= 1;
      if (s.life <= 0) {
        splashes.splice(j, 1);
        continue;
      }
      s.x += s.vx;
      s.y += s.vy;
      s.vx *= 0.92;
      s.vy *= 0.92;
      s.r += s.kind === 'seal' ? 0.12 : 0.5;
      var a = s.life / s.maxLife;
      var base = s.kind === 'seal' ? SPLASH_SEAL : SPLASH_DARK;
      var sg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      sg.addColorStop(0, base + Math.min(0.75, a * 0.85).toFixed(3) + ')');
      sg.addColorStop(0.5, base + (a * 0.25).toFixed(3) + ')');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      if (s.kind === 'seal' && s.life > s.maxLife - 8) {
        ctx.strokeStyle = SPLASH_SEAL + (a * 0.65).toFixed(3) + ')';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(s.x - s.r * 0.45, s.y - s.r * 0.32, s.r * 0.9, s.r * 0.64);
      }
    }
  }

  function burst(x, y, kind) {
    var n = kind === 'seal' ? 8 : 5 + Math.floor(Math.random() * 4);
    for (var i = 0; i < n; i++) {
      var ang = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.7;
      var sp = kind === 'seal' ? 2 + Math.random() * 2.5 : 2.5 + Math.random() * 4;
      splashes.push({
        x: x,
        y: y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        r: kind === 'seal' ? 6 + Math.random() * 6 : 3 + Math.random() * 8,
        life: kind === 'seal' ? 36 : 28 + Math.floor(Math.random() * 10),
        maxLife: 40,
        kind: kind || 'splash',
      });
    }
  }

  function playIntro() {
    introT = 0;
    seedMotes();
  }

  return {
    mount: function() {},
    destroy: function() {
      splashes = [];
      introT = 0;
    },
    resize: resize,
    tick: tick,
    burst: burst,
    playIntro: playIntro,
  };
}
