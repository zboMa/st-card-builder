/**
 * SecurityCordon boot（从 SecurityCordon.astro 外提）
 */

export function initSecurityCordon() {
  document.querySelectorAll('.security-cordon-wrapper').forEach(function(wrapper) {
    var unlockThreshold = parseInt(wrapper.dataset.unlock) || 10;
    var overlay     = wrapper.querySelector('.cordon-overlay');
    var fxContainer = wrapper.querySelector('.cordon-fx-container');
    var tapes       = wrapper.querySelectorAll('.cordon-tape');
    var badge       = wrapper.querySelector('.cordon-center-badge');

    var clickCount = 0;
    var isUnlocked = false;

    // ── 生成电弧 SVG ──
    function createArc(x, y) {
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'cordon-arc');
      svg.style.left = (x - 50) + 'px';
      svg.style.top  = (y - 50) + 'px';
      svg.setAttribute('width', '100');
      svg.setAttribute('height', '100');
      svg.setAttribute('viewBox', '0 0 100 100');

      for (var i = 0; i < 3; i++) {
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        var segs = 'M50,50 ';
        var cx = 50, cy = 50;
        for (var s = 0; s < 4; s++) {
          cx += (Math.random() - 0.5) * 40;
          cy += (Math.random() - 0.5) * 40;
          cx = Math.max(5, Math.min(95, cx));
          cy = Math.max(5, Math.min(95, cy));
          segs += 'L' + cx.toFixed(1) + ',' + cy.toFixed(1) + ' ';
        }
        path.setAttribute('d', segs);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', i === 0 ? 'var(--color-warning)' : 'rgba(245,158,11,0.4)');
        path.setAttribute('stroke-width', i === 0 ? '2' : '1');
        path.setAttribute('stroke-linecap', 'round');
        svg.appendChild(path);
      }
      return svg;
    }

    overlay.addEventListener('click', function(e) {
      if (isUnlocked) return;

      clickCount++;
      var rect = overlay.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      var pct = Math.min((clickCount / unlockThreshold) * 100, 100);

      // ── 涟漪 ──
      var ripple = document.createElement('div');
      ripple.className = 'cordon-ripple';
      ripple.style.left = x + 'px';
      ripple.style.top  = y + 'px';
      ripple.style.marginLeft = '-100px';
      ripple.style.marginTop  = '-100px';
      fxContainer.appendChild(ripple);
      setTimeout(function() { ripple.remove(); }, 800);

      // ── 电火花 ──
      var sparkCount = 6 + Math.floor(pct / 15);
      for (var i = 0; i < sparkCount; i++) {
        var spark = document.createElement('div');
        spark.className = 'cordon-spark';
        var angle = (Math.PI * 2 / sparkCount) * i + (Math.random() - 0.5) * 0.6;
        var dist  = 30 + Math.random() * 60;
        spark.style.left = x + 'px';
        spark.style.top  = y + 'px';
        spark.style.setProperty('--sx', (Math.cos(angle) * dist).toFixed(1) + 'px');
        spark.style.setProperty('--sy', (Math.sin(angle) * dist).toFixed(1) + 'px');
        fxContainer.appendChild(spark);
        (function(s) { setTimeout(function() { s.remove(); }, 600); })(spark);
      }

      // ── 电弧 ──
      if (pct > 30) {
        var arc = createArc(x, y);
        fxContainer.appendChild(arc);
        setTimeout(function() { arc.remove(); }, 500);
      }

      // ── 电击闪光 ──
      var flash = document.createElement('div');
      flash.className = 'cordon-shock-flash';
      overlay.appendChild(flash);
      setTimeout(function() { flash.remove(); }, 300);

      // ── 轻微抖动反馈 ──
      wrapper.style.animation = 'none';
      void wrapper.offsetHeight;
      wrapper.style.animation = 'cordonShake 0.12s ease';
      setTimeout(function() { wrapper.style.animation = ''; }, 150);

      // ══════════════════════════
      //       ★ 解锁！★
      // ══════════════════════════
      if (clickCount >= unlockThreshold) {
        isUnlocked = true;

        // 警戒线碎裂飞散
        tapes.forEach(function(tape) {
          tape.classList.add('shatter');
        });

        // badge 消失
        badge.style.transition = 'opacity 0.5s, transform 0.5s';
        badge.style.opacity = '0';
        badge.style.transform = 'translate(-50%,-50%) scale(0.7)';

        // 能量爆发
        var burst = document.createElement('div');
        burst.className = 'cordon-unlock-burst';
        overlay.appendChild(burst);

        // 大量庆祝火花
        for (var j = 0; j < 24; j++) {
          (function(idx) {
            setTimeout(function() {
              var sp = document.createElement('div');
              sp.className = 'cordon-spark';
              var a = (Math.PI * 2 / 24) * idx;
              var d = 60 + Math.random() * 100;
              var cx = rect.width / 2, cy = rect.height / 2;
              sp.style.left = cx + 'px';
              sp.style.top  = cy + 'px';
              sp.style.background = ['var(--color-success)','var(--color-warning)','#60a5fa','#f472b6','var(--color-accent-hover)'][idx % 5];
              sp.style.width = '6px';
              sp.style.height = '6px';
              sp.style.setProperty('--sx', (Math.cos(a) * d).toFixed(1) + 'px');
              sp.style.setProperty('--sy', (Math.sin(a) * d).toFixed(1) + 'px');
              fxContainer.appendChild(sp);
              setTimeout(function() { sp.remove(); }, 800);
            }, idx * 30);
          })(j);
        }

        // 成功提示
        setTimeout(function() {
          var toast = document.createElement('div');
          toast.className = 'cordon-success-toast';
          toast.innerHTML =
            '<div class="toast-icon">🎉</div>' +
            '<div class="toast-text">封锁已解除！</div>' +
            '<div class="toast-sub">模块已解锁 · 可以正常使用了</div>';
          wrapper.appendChild(toast);

          wrapper.classList.remove('locked');
          wrapper.classList.add('unlocked');

          setTimeout(function() { toast.remove(); }, 2800);
        }, 500);
      }
    });
  });
}
