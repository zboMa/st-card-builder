/**
 * AI 引擎弹窗 boot（从 AiEngineModal.astro 外提）
 */

export function initAiEngineModal() {
  var modal = document.getElementById('aiEngineModal');
  if (!modal) return;

  function openAiEngineModal() {
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('ai-engine-modal-open');
    if (typeof window.__refreshAiEngineWorldviewSummary__ === 'function') {
      window.__refreshAiEngineWorldviewSummary__();
    }
    if (typeof window.__syncAiContinueEnrichBtn__ === 'function') {
      window.__syncAiContinueEnrichBtn__();
    }
    var ta = document.getElementById('aiPrompt');
    if (ta) setTimeout(function() { ta.focus(); }, 80);
  }

  function closeAiEngineModal() {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('ai-engine-modal-open');
  }

  window.__openAiEngineModal__ = openAiEngineModal;
  window.__closeAiEngineModal__ = closeAiEngineModal;

  var closeBtn = document.getElementById('btnCloseAiEngine');
  if (closeBtn) closeBtn.addEventListener('click', closeAiEngineModal);

  modal.querySelectorAll('[data-ai-engine-close]').forEach(function(el) {
    el.addEventListener('click', closeAiEngineModal);
  });

  var openBtn = document.getElementById('btnOpenAiEngine');
  if (openBtn) openBtn.addEventListener('click', openAiEngineModal);

  var gotoBtn = document.getElementById('btnAiEngineGotoWorldLimits');
  if (gotoBtn) {
    gotoBtn.addEventListener('click', function() {
      closeAiEngineModal();
      location.hash = 'adult-config';
    });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && !modal.hidden) closeAiEngineModal();
  });
}
