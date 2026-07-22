/**
 * 角色设定面板 boot（从 CharacterPanel.astro 外提）
 */
import {
    normalizeCharacterVersion,
    bumpCharacterVersionMajor,
    bumpCharacterVersionMinor,
  } from './cardRelease.mjs';

export function initCharacterPanel() {
  var versionBaseline = '1.0';

  function versionEl() {
    return document.getElementById('characterVersion');
  }

  function revertBtn() {
    return document.getElementById('btnRevertVersion');
  }

  function syncRevertVisibility() {
    var el = versionEl();
    var btn = revertBtn();
    if (!el || !btn) return;
    var cur = normalizeCharacterVersion(el.value);
    btn.hidden = cur === normalizeCharacterVersion(versionBaseline);
  }

  function captureBaseline() {
    var el = versionEl();
    versionBaseline = normalizeCharacterVersion(el && el.value);
    syncRevertVisibility();
  }

  function applyVersion(next) {
    var el = versionEl();
    if (!el) return;
    el.value = normalizeCharacterVersion(next);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    syncRevertVisibility();
  }

  document.getElementById('btnBumpVersionMajor')?.addEventListener('click', function() {
    var api = window.__assistantCardApi__ || window.__cardManagerPanel__;
    if (api && typeof api.bumpVersion === 'function') {
      api.bumpVersion('major');
      return;
    }
    var el = versionEl();
    var from = normalizeCharacterVersion(el && el.value);
    var to = bumpCharacterVersionMajor(from);
    if (!window.confirm('升级大版本：' + from + ' → ' + to + '？\n小版本将归零。')) return;
    applyVersion(to);
  });
  document.getElementById('btnBumpVersionMinor')?.addEventListener('click', function() {
    var api = window.__assistantCardApi__ || window.__cardManagerPanel__;
    if (api && typeof api.bumpVersion === 'function') {
      api.bumpVersion('minor');
      return;
    }
    var el = versionEl();
    var from = normalizeCharacterVersion(el && el.value);
    var to = bumpCharacterVersionMinor(from);
    if (!window.confirm('升级小版本：' + from + ' → ' + to + '？')) return;
    applyVersion(to);
  });
  document.getElementById('btnRevertVersion')?.addEventListener('click', async function() {
    var el = versionEl();
    var cur = normalizeCharacterVersion(el && el.value);
    var back = normalizeCharacterVersion(versionBaseline);
    if (cur === back) {
      syncRevertVisibility();
      return;
    }
    var api = window.__assistantCardApi__ || window.__cardManagerPanel__;
    if (api && typeof api.switchVersion === 'function') {
      var ok = window.confirm
        ? window.confirm('回退到版本列表中的 v' + back + '？当前草稿会先写入版本列表。')
        : true;
      if (!ok) return;
      try {
        await api.switchVersion(back);
        captureBaseline();
      } catch (e) {
        alert('回退失败：' + (e && e.message || e));
      }
      return;
    }
    if (!window.confirm('回退版本号：' + cur + ' → ' + back + '？\n（未接入版本列表时仅改版号，不恢复内容）')) return;
    applyVersion(back);
  });
  document.getElementById('btnGotoWorldLimitsFromCharacter')?.addEventListener('click', function() {
    location.hash = 'adult-config';
  });

  // 草稿加载后 input 会被赋值；监听 change 以在外部 setVal 后刷新基准
  var verInput = versionEl();
  if (verInput) {
    verInput.addEventListener('change', function() {
      // bump/revert 已自行 sync；外部 loadDraft 也会触发 change——若与基准相同则仅刷新显隐
      syncRevertVisibility();
    });
  }

  window.addEventListener('card-draft-changed', function() {
    // 下一帧读取 DOM（loadDraft 先写 state 再写 input）
    // 仅在切换/加载草稿时重置基准，避免离开角色页再回来后丢失「回退」能力
    setTimeout(captureBaseline, 0);
  });

  captureBaseline();

  (function bindJsonPreviewModal() {
    var modal = document.getElementById('jsonPreviewModal');
    if (!modal) return;
    function openModal() {
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('panel-feature-modal-open');
      try {
        var json = null;
        if (typeof window.__buildCurrentCardJSON__ === 'function') {
          json = window.__buildCurrentCardJSON__();
        }
        if (!json && window.getPreviewJSON) json = window.getPreviewJSON();
        if (typeof window.updatePreviewPanel === 'function' && json) {
          window.updatePreviewPanel(json);
        }
      } catch (e) {}
    }
    function closeModal() {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('panel-feature-modal-open');
    }
    window.__openJsonPreviewModal__ = openModal;
    window.__closeJsonPreviewModal__ = closeModal;
    document.getElementById('btnOpenJsonPreview')?.addEventListener('click', openModal);
    modal.querySelectorAll('[data-json-preview-close]').forEach(function(el) {
      el.addEventListener('click', closeModal);
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && !modal.hidden) closeModal();
    });
  })();
}
