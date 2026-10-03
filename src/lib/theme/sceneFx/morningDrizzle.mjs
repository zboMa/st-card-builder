/**
 * 清晨细雨：窗玻璃上的水珠。映出背后的界面，带高光；大滴下滑、拖小珠、碰上会合。
 * 观感对齐 rainyday.js，不引入该库，也不每帧截屏。
 */

var RADII = [
  '48% 52% 46% 54% / 52% 46% 54% 48%',
  '58% 42% 50% 50% / 46% 54% 42% 58%',
  '50% 50% 44% 56% / 56% 44% 50% 50%',
  '46% 54% 58% 42% / 50% 48% 52% 50%',
];

/** @param {{ blend: CanvasRenderingContext2D|null, ambient: CanvasRenderingContext2D|null }} _env */
export function createSceneFx(_env) {
  var layer = null;
  var drops = [];
  var animate = true;
  var W = 0;
  var H = 0;
  var frame = 0;

  function paint(d) {
    d.el.style.width = d.s + 'px';
    d.el.style.height = (d.s * d.aspect) + 'px';
    d.el.style.transform = 'translate3d(' + d.x.toFixed(1) + 'px,' + d.y.toFixed(1) + 'px,0)';
    d.el.style.opacity = String(d.opacity);
  }

  function addDrop(spec) {
    if (!layer) return null;
    var d = {
      x: spec.x,
      y: spec.y,
      s: spec.s,
      aspect: spec.aspect || (0.86 + Math.random() * 0.22),
      vy: spec.vy || 0,
      vx: spec.vx || 0,
      kind: spec.kind || 'bead',
      opacity: spec.opacity == null ? 1 : spec.opacity,
      life: spec.life == null ? -1 : spec.life,
      maxLife: spec.life == null ? -1 : spec.life,
      trail: 0,
    };
    var el = document.createElement('div');
    el.className = 'scene-glass-drop scene-glass-drop--' + d.kind;
    el.style.borderRadius = RADII[Math.floor(Math.random() * RADII.length)];
    layer.appendChild(el);
    d.el = el;
    drops.push(d);
    paint(d);
    return d;
  }

  function removeAt(i) {
    var d = drops[i];
    if (d && d.el && d.el.parentNode) d.el.parentNode.removeChild(d.el);
    drops.splice(i, 1);
  }

  function seed() {
    var beadN = animate ? 28 : 14;
    var slideN = animate ? 8 : 4;
    var heavyN = animate ? 3 : 1;
    var i;
    for (i = 0; i < beadN; i++) {
      addDrop({
        x: Math.random() * W,
        y: Math.random() * H,
        s: 4 + Math.random() * 4,
        kind: 'bead',
      });
    }
    for (i = 0; i < slideN; i++) {
      addDrop({
        x: Math.random() * W,
        y: Math.random() * H,
        s: 12 + Math.random() * 5,
        kind: 'slide',
        vy: 0.35 + Math.random() * 0.35,
        vx: -0.12 - Math.random() * 0.1,
      });
    }
    for (i = 0; i < heavyN; i++) {
      addDrop({
        x: Math.random() * W,
        y: Math.random() * H * 0.7,
        s: 20 + Math.random() * 6,
        kind: 'heavy',
        vy: 0.85 + Math.random() * 0.45,
        vx: -0.2 - Math.random() * 0.12,
      });
    }
  }

  function tickAmbient() {
    if (!animate || !layer) return;
    frame += 1;
    for (var i = drops.length - 1; i >= 0; i--) {
      var d = drops[i];
      if (d.life > 0) {
        d.life -= 1;
        d.opacity = Math.max(0, d.life / d.maxLife);
        if (d.life <= 0) {
          removeAt(i);
          continue;
        }
      }
      if (d.kind === 'bead') {
        paint(d);
        continue;
      }
      d.y += d.vy;
      d.x += d.vx;
      if (d.kind === 'heavy') {
        d.trail += d.vy;
        if (d.trail > 22 && drops.length < 56) {
          d.trail = 0;
          addDrop({
            x: d.x + d.s * 0.3,
            y: d.y - 4,
            s: 3 + Math.random() * 3,
            kind: 'bead',
            life: 80,
          });
        }
      }
      if (d.y > H + 8) {
        d.y = -d.s;
        d.x = Math.random() * W;
        d.opacity = 1;
        d.life = -1;
      }
      if (d.x < -20) d.x = W - 10;
      paint(d);
    }
    if (frame % 12 === 0) merge();
  }

  function merge() {
    for (var i = 0; i < drops.length; i++) {
      var a = drops[i];
      if (!a || (a.kind !== 'slide' && a.kind !== 'heavy')) continue;
      for (var j = i + 1; j < drops.length; j++) {
        var b = drops[j];
        if (!b || (b.kind !== 'slide' && b.kind !== 'heavy')) continue;
        var dx = a.x - b.x;
        var dy = a.y - b.y;
        var touch = (a.s + b.s) * 0.45;
        if (dx * dx + dy * dy < touch * touch) {
          if (a.s >= b.s) {
            a.s = Math.min(32, a.s + b.s * 0.25);
            removeAt(j);
            paint(a);
          } else {
            b.s = Math.min(32, b.s + a.s * 0.25);
            removeAt(i);
            paint(b);
          }
          return;
        }
      }
    }
  }

  function burst(x, y) {
    addDrop({
      x: x,
      y: y,
      s: 10 + Math.random() * 6,
      kind: 'slide',
      vy: 0.5,
      vx: -0.15,
      life: 70,
    });
  }

  return {
    mount: function(opts) {
      animate = !(opts && opts.animate === false);
      if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
      drops = [];
      layer = document.createElement('div');
      layer.className = 'scene-glass-layer';
      layer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(layer);
      if (W > 0 && H > 0) seed();
    },
    destroy: function() {
      drops = [];
      if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
      layer = null;
    },
    resize: function(w, h) {
      W = w;
      H = h;
    },
    tickAmbient: tickAmbient,
    burst: burst,
    playIntro: function() {},
  };
}
