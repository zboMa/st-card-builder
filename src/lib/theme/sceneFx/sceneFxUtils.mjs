/**
 * SceneFx 轻量算法工具（无外部依赖）
 * - fBm：多层 sin 叠加，模拟云/雾/热浪扰动
 * - 雨丝池、余烬池、云团绘制
 */

/** @param {number} x @param {number} t @param {number} [octaves] */
export function fbm1d(x, t, octaves) {
  octaves = octaves || 4;
  var amp = 1;
  var freq = 1;
  var sum = 0;
  var norm = 0;
  for (var i = 0; i < octaves; i++) {
    sum += Math.sin(x * freq + t * (0.6 + i * 0.15)) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.05;
  }
  return sum / norm;
}

/** @param {number} x @param {number} y @param {number} t @param {number} [octaves] */
export function fbm2d(x, y, t, octaves) {
  return (fbm1d(x * 0.012 + y * 0.008, t, octaves) + fbm1d(y * 0.015 - x * 0.006, t * 1.1, octaves)) * 0.5;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx @param {number} cy @param {number} r @param {number} t @param {number} seed
 * @param {string} colorRgbaPrefix e.g. 'rgba(230,220,200,'
 * @param {number} alpha
 */
export function drawCloudBlob(ctx, cx, cy, r, t, seed, colorRgbaPrefix, alpha) {
  var lobes = 5;
  for (var i = 0; i < lobes; i++) {
    var ang = (Math.PI * 2 * i) / lobes + seed;
    var wobble = fbm1d(seed + i * 1.7, t * 0.0004, 3) * r * 0.22;
    var lx = cx + Math.cos(ang) * (r * 0.38 + wobble);
    var ly = cy + Math.sin(ang) * (r * 0.22 + wobble * 0.5);
    var lr = r * (0.42 + Math.sin(t * 0.0003 + seed + i) * 0.06);
    var g = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
    var a = alpha * (0.85 - i * 0.08);
    g.addColorStop(0, colorRgbaPrefix + a.toFixed(3) + ')');
    g.addColorStop(0.55, colorRgbaPrefix + (a * 0.35).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(lx, ly, lr, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{x:number,y:number,len:number,vy:number,vx:number,depth:number}>} streaks
 * @param {number} W @param {number} H @param {number} introT @param {string} colorPrefix
 */
export function tickRain(ctx, streaks, W, H, introT, colorPrefix) {
  for (var i = 0; i < streaks.length; i++) {
    var s = streaks[i];
    s.y += s.vy * introT * (0.7 + s.depth * 0.3);
    s.x += s.vx * introT;
    if (s.y > H + 24) {
      s.y = -16 - Math.random() * 40;
      s.x = Math.random() * W;
    }
    if (s.x < -20) s.x = W + 10;
    if (s.x > W + 20) s.x = -10;
    var a = introT * (0.22 + s.depth * 0.28);
    ctx.strokeStyle = colorPrefix + a.toFixed(3) + ')';
    ctx.lineWidth = 0.8 + s.depth * 0.9;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + s.vx * (2.5 + s.depth), s.y + s.len * (0.85 + s.depth * 0.2));
    ctx.stroke();
  }
}

/** @param {number} n @param {number} W @param {number} H */
export function seedRain(n, W, H) {
  var streaks = [];
  for (var i = 0; i < n; i++) {
    var depth = Math.random();
    streaks.push({
      x: Math.random() * W,
      y: Math.random() * H,
      len: 10 + depth * 18,
      vy: 4 + depth * 5,
      vx: -0.8 - depth * 0.6,
      depth: depth,
    });
  }
  return streaks;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{x:number,y:number,r:number,vy:number,vx:number,phase:number,heat:number}>} embers
 * @param {number} W @param {number} H @param {number} t @param {number} introT
 * @param {string} hotPrefix @param {string} coolPrefix
 */
export function tickEmbers(ctx, embers, W, H, t, introT, hotPrefix, coolPrefix) {
  for (var i = 0; i < embers.length; i++) {
    var e = embers[i];
    e.heat = Math.max(0, e.heat - 0.0012 * introT);
    var rise = (0.35 + e.heat * 0.9) * introT;
    e.y += e.vy * rise;
    e.x += e.vx + Math.sin(t * 0.0025 + e.phase) * 0.35 + fbm1d(e.phase, t * 0.001, 2) * 0.25;
    if (e.y < -12 || e.heat < 0.08) {
      e.y = H + Math.random() * 30;
      e.x = Math.random() * W;
      e.heat = 0.65 + Math.random() * 0.35;
      e.vy = -0.5 - Math.random() * 1.1;
    }
    var flicker = 0.55 + Math.sin(t * 0.004 + e.phase) * 0.35;
    var a = introT * flicker * (0.2 + e.heat * 0.35);
    var prefix = e.heat > 0.45 ? hotPrefix : coolPrefix;
    var g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * (3 + e.heat * 2));
    g.addColorStop(0, prefix + a.toFixed(3) + ')');
    g.addColorStop(0.55, prefix + (a * 0.35).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r * (3 + e.heat * 2), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** @param {number} n @param {number} W @param {number} H */
export function seedEmbers(n, W, H) {
  var embers = [];
  for (var i = 0; i < n; i++) {
    embers.push({
      x: Math.random() * W,
      y: H + Math.random() * 40,
      r: 1.2 + Math.random() * 2.2,
      vy: -0.45 - Math.random() * 0.9,
      vx: (Math.random() - 0.5) * 0.35,
      phase: Math.random() * 6.28,
      heat: 0.65 + Math.random() * 0.35,
    });
  }
  return embers;
}

/**
 * 底部热浪洗（blend 层）
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} W @param {number} H @param {number} t @param {number} introT
 * @param {string} colorPrefix
 */
export function drawHeatHaze(ctx, W, H, t, introT, colorPrefix) {
  var baseY = H * 0.72;
  var pulse = 0.5 + Math.sin(t * 0.0018) * 0.5;
  for (var band = 0; band < 3; band++) {
    var y = baseY + band * 28 + fbm1d(band * 2.1, t * 0.0008, 3) * 12;
    var g = ctx.createLinearGradient(0, y, 0, H);
    var a = introT * (0.05 + pulse * 0.04) * (1 - band * 0.22);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.35, colorPrefix + a.toFixed(3) + ')');
    g.addColorStop(1, colorPrefix + (a * 0.55).toFixed(3) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, y, W, H - y);
  }
}
