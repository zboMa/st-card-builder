/**
 * Layout 壳层：自定义下拉框 portal 等（从 Layout.astro 外提）
 */

export function initLayoutChrome() {

      var ARROW_SVG = '<svg class="cs-arrow" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';

      /* ── Portal 工具函数 ── */
      var _csJustOpened = false;

      // 将下拉框传送到 body 并用 fixed 定位对齐触发器
      function portalOpen(wrap, dropdown, trigger) {
        var rect = trigger.getBoundingClientRect();
        dropdown.classList.add('cs-portalled');
        document.body.appendChild(dropdown);
        dropdown.style.left = rect.left + 'px';
        dropdown.style.top = rect.bottom + 'px';
        dropdown.style.width = rect.width + 'px';
        // 防止开启瞬间被 scroll 事件关闭
        _csJustOpened = true;
        setTimeout(function() { _csJustOpened = false; }, 60);
      }

      // 将下拉框收回 wrap
      function portalClose(wrap, dropdown) {
        dropdown.classList.remove('cs-portalled');
        dropdown.style.left = '';
        dropdown.style.top = '';
        dropdown.style.width = '';
        // 放回 wrap 内（trigger 之后）
        if (dropdown.parentElement !== wrap) {
          wrap.insertBefore(dropdown, wrap.querySelector('select'));
        }
      }

      function getWrapPanel(el) {
        return el ? el.closest('.panel, .code-window') : null;
      }

      function syncPanelElevated(wrap) {
        var panel = getWrapPanel(wrap);
        if (!panel) return;
        var hasOpen = panel.querySelector('.cs-wrap.cs-open');
        panel.classList.toggle('panel-elevated', !!hasOpen);
      }

      function enhanceSelect(sel) {
        if (!sel || sel.classList.contains('cs-hidden')) return;
        if (sel.classList.contains('cs-native-skip')) return;
        if (sel.hasAttribute('hidden') || sel.getAttribute('aria-hidden') === 'true') return;
        // 跳过 display:none 的 select（如 chatMaxTokens）
        if (sel.offsetParent === null && sel.style.display === 'none') return;

        sel.classList.add('cs-hidden');

        var wrap = document.createElement('div');
        wrap.className = 'cs-wrap';

        var trigger = document.createElement('div');
        trigger.className = 'cs-trigger';
        trigger.setAttribute('tabindex', '0');
        trigger.setAttribute('role', 'combobox');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-haspopup', 'listbox');

        var labelSpan = document.createElement('span');
        labelSpan.className = 'cs-label';
        trigger.appendChild(labelSpan);
        trigger.insertAdjacentHTML('beforeend', ARROW_SVG);

        var dropdown = document.createElement('div');
        dropdown.className = 'cs-dropdown';
        dropdown.setAttribute('role', 'listbox');

        var search = document.createElement('input');
        search.type = 'search';
        search.className = 'cs-search';
        search.setAttribute('placeholder', '搜索选项…');
        search.setAttribute('autocomplete', 'off');
        search.setAttribute('aria-label', '搜索选项');

        var listBox = document.createElement('div');
        listBox.className = 'cs-list';

        dropdown.appendChild(search);
        dropdown.appendChild(listBox);

        sel.parentNode.insertBefore(wrap, sel);
        wrap.appendChild(trigger);
        wrap.appendChild(dropdown);
        wrap.appendChild(sel);

        var activeIdx = -1;

        function syncLabel() {
          labelSpan.textContent = sel.options[sel.selectedIndex]
            ? sel.options[sel.selectedIndex].textContent
            : '';
        }

        function buildOptions() {
          listBox.innerHTML = '';
          var children = sel.children;
          for (var i = 0; i < children.length; i++) {
            var child = children[i];
            if (child.tagName === 'OPTGROUP') {
              var group = document.createElement('div');
              group.className = 'cs-group';
              group.textContent = child.label || '';
              listBox.appendChild(group);
              var opts = child.children;
              for (var j = 0; j < opts.length; j++) {
                appendOption(opts[j], group);
              }
            } else if (child.tagName === 'OPTION') {
              appendOption(child, null);
            }
          }
          var empty = document.createElement('div');
          empty.className = 'cs-empty';
          empty.hidden = true;
          empty.textContent = '无匹配选项';
          listBox.appendChild(empty);
          syncLabel();
          applyFilter(search.value || '');
        }

        function appendOption(opt, groupEl) {
          var div = document.createElement('div');
          div.className = 'cs-option';
          if (opt.selected) div.classList.add('cs-selected');
          if (opt.disabled) {
            div.setAttribute('aria-disabled', 'true');
            div.style.opacity = '0.45';
            div.style.pointerEvents = 'none';
          }
          div.setAttribute('data-value', opt.value);
          div.setAttribute('data-label', opt.textContent || '');
          if (groupEl) div.setAttribute('data-group', groupEl.textContent || '');
          div.setAttribute('role', 'option');
          div.textContent = opt.textContent;
          listBox.appendChild(div);
        }

        function visibleOptions() {
          return Array.prototype.filter.call(listBox.querySelectorAll('.cs-option'), function(o) {
            return !o.hidden && o.getAttribute('aria-disabled') !== 'true';
          });
        }

        function setActive(idx) {
          var opts = visibleOptions();
          listBox.querySelectorAll('.cs-option').forEach(function(o) {
            o.classList.remove('cs-active');
          });
          if (!opts.length) { activeIdx = -1; return; }
          activeIdx = ((idx % opts.length) + opts.length) % opts.length;
          opts[activeIdx].classList.add('cs-active');
          if (opts[activeIdx].scrollIntoView) {
            opts[activeIdx].scrollIntoView({ block: 'nearest' });
          }
        }

        function applyFilter(q) {
          var query = String(q || '').trim().toLowerCase();
          var groups = listBox.querySelectorAll('.cs-group');
          var any = false;
          listBox.querySelectorAll('.cs-option').forEach(function(o) {
            var label = (o.getAttribute('data-label') || o.textContent || '').toLowerCase();
            var hit = !query || label.indexOf(query) !== -1;
            o.hidden = !hit;
            if (hit) any = true;
          });
          groups.forEach(function(g) {
            var next = g.nextElementSibling;
            var has = false;
            while (next && !next.classList.contains('cs-group') && !next.classList.contains('cs-empty')) {
              if (next.classList.contains('cs-option') && !next.hidden) has = true;
              next = next.nextElementSibling;
            }
            g.hidden = !has;
          });
          var empty = listBox.querySelector('.cs-empty');
          if (empty) empty.hidden = any;
          setActive(any ? 0 : -1);
        }

        buildOptions();

        // 监听原生 select 变化（JS 动态修改时）
        var mo = new MutationObserver(function() { buildOptions(); });
        mo.observe(sel, { childList: true, attributes: true, subtree: true });
        sel.addEventListener('change', syncLabel);

        function openDrop() {
          wrap.classList.add('cs-open');
          trigger.setAttribute('aria-expanded', 'true');
          portalOpen(wrap, dropdown, trigger);
          syncPanelElevated(wrap);
          search.value = '';
          applyFilter('');
          setTimeout(function() {
            try { search.focus({ preventScroll: true }); } catch (e) {
              try { search.focus(); } catch (e2) {}
            }
          }, 0);
        }

        function closeDrop() {
          wrap.classList.remove('cs-open');
          trigger.setAttribute('aria-expanded', 'false');
          portalClose(wrap, dropdown);
          syncPanelElevated(wrap);
          activeIdx = -1;
        }

        function closeAllExcept(exceptWrap) {
          document.querySelectorAll('.cs-wrap.cs-open').forEach(function(w) {
            if (w !== exceptWrap) {
              w.classList.remove('cs-open');
              var t = w.querySelector('.cs-trigger');
              if (t) t.setAttribute('aria-expanded', 'false');
              var dd = w._csDropdown || w.querySelector('.cs-dropdown');
              if (dd) portalClose(w, dd);
              syncPanelElevated(w);
            }
          });
        }

        function pickOption(opt) {
          if (!opt || opt.hidden || opt.getAttribute('aria-disabled') === 'true') return;
          var val = opt.getAttribute('data-value');
          sel.value = val;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          listBox.querySelectorAll('.cs-option').forEach(function(o) { o.classList.remove('cs-selected'); });
          opt.classList.add('cs-selected');
          labelSpan.textContent = opt.textContent;
          closeDrop();
        }

        // 保存引用方便外部访问
        wrap._csDropdown = dropdown;
        wrap._csSearch = search;

        trigger.addEventListener('click', function(e) {
          e.stopPropagation();
          closeAllExcept(wrap);
          if (wrap.classList.contains('cs-open')) {
            closeDrop();
          } else {
            openDrop();
          }
        });

        dropdown.addEventListener('click', function(e) {
          e.stopPropagation();
          var opt = e.target.closest('.cs-option');
          if (!opt) return;
          pickOption(opt);
        });

        search.addEventListener('click', function(e) { e.stopPropagation(); });
        search.addEventListener('input', function() {
          applyFilter(search.value);
        });
        search.addEventListener('keydown', function(e) {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive(activeIdx < 0 ? 0 : activeIdx + 1);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive(activeIdx < 0 ? 0 : activeIdx - 1);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            var opts = visibleOptions();
            if (activeIdx >= 0 && opts[activeIdx]) pickOption(opts[activeIdx]);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            closeDrop();
            trigger.focus();
          }
        });

        // 键盘可访问
        trigger.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            trigger.click();
          } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!wrap.classList.contains('cs-open')) openDrop();
            else setActive(e.key === 'ArrowDown' ? activeIdx + 1 : activeIdx - 1);
          } else if (e.key === 'Escape') {
            closeDrop();
          } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            if (!wrap.classList.contains('cs-open')) openDrop();
          }
        });
      }

      // 点击外部关闭所有
      document.addEventListener('click', function() {
        document.querySelectorAll('.cs-wrap.cs-open').forEach(function(w) {
          w.classList.remove('cs-open');
          var dd = w._csDropdown || w.querySelector('.cs-dropdown');
          if (dd) portalClose(w, dd);
          syncPanelElevated(w);
        });
      });

      // 面板滚动时关闭已打开的下拉（避免位置偏移）
      // 只监听 .panel / .code-window 的 scroll，不用 document 捕获
      function attachPanelScrollClose() {
        document.querySelectorAll('.panel, .code-window').forEach(function(p) {
          if (p._csScrollBound) return;
          p._csScrollBound = true;
          p.addEventListener('scroll', function() {
            if (_csJustOpened) return;
            document.querySelectorAll('.cs-wrap.cs-open').forEach(function(w) {
              w.classList.remove('cs-open');
              var dd = w._csDropdown || w.querySelector('.cs-dropdown');
              if (dd) portalClose(w, dd);
              syncPanelElevated(w);
            });
          });
        });
      }
      // DOM ready 后绑定
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachPanelScrollClose);
      } else {
        attachPanelScrollClose();
      }

      // 初始增强
      function init() {
        document.querySelectorAll('select:not(.cs-hidden)').forEach(enhanceSelect);
      }

      // DOM ready 后执行
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }

      // 暴露给动态添加 select 的场景
      window.__enhanceSelect__ = enhanceSelect;
      window.__enhanceAllSelects__ = init;
    
}
