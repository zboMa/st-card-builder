/**
 * 主站 Action Engine boot
 */
import { createActionEngine } from './engine.mjs';
import { getPipelineGates } from '../novel/state.mjs';

var MAIN_NOVEL_BINDINGS = [
  { id: 'novel.char.scan', elId: 'btnCharScan' },
  { id: 'novel.char.scan', elId: 'btnCharScanConfirm' },
  { id: 'novel.wb.extract', elId: 'btnWbExtract' },
  { id: 'novel.wb.extract', elId: 'btnWbExtractConfirm' },
  { id: 'novel.style.distill', elId: 'btnStyleDistill' },
  { id: 'novel.style.distill', elId: 'btnStyleDistillConfirm' },
  { id: 'novel.setup.generate', elId: 'btnNovelGenCharSetup' },
  { id: 'novel.setup.generate', elId: 'btnNovelSetupConfirm' },
  { id: 'novel.greetings.generate', elId: 'btnNovelGenGreetings' },
  { id: 'novel.greetings.generate', elId: 'btnNovelGreetConfirm' },
  { id: 'novel.rag.index', elId: 'btnNovelRagIndex' },
  { id: 'novel.analyze.all', elId: 'btnNovelAnalyzeAll' },
  { id: 'novel.analyze.all', elId: 'btnNovelAnalyzeConfirm' },
  { id: 'novel.analyze.skeleton', elId: 'btnNovelAnalyzeSkeleton' },
  { id: 'novel.analyze.enrich', elId: 'btnNovelAnalyzeEnrich' },
  { id: 'novel.analyze.retry', elId: 'btnNovelRetryFailed' },
  { id: 'novel.analyze.retry', elId: 'btnNovelAnalyzeFailsRetry' },
  { id: 'novel.analyze.adultDraft', elId: 'btnNovelNsfwStatusDraft' },
  { id: 'novel.analyze.adultDraft', elId: 'btnNovelNtlStatusDraft' },
  { id: 'novel.analyze.adultDraft', elId: 'btnNovelVesselStatusDraft' },
  { id: 'novel.char.enrich', elId: 'btnCharEnrichSelected' },
  { id: 'novel.char.enrich', elId: 'btnKnowledgeEnrichSelected' },
  { id: 'novel.wb.enrich', elId: 'btnWbEnrichSelected' },
  { id: 'novel.graph.relayout', elId: 'btnGraphRelayout' },
  { id: 'lifecycle.novel.graph.clear', elId: 'btnGraphClear' },
  { id: 'lifecycle.novel.graph.clear', elId: 'btnNovelAnalyzeClearConfirm' },
  { id: 'lifecycle.novel.chapters.split', elId: 'btnNovelSplitChapters' },
  { id: 'lifecycle.novel.chapters.split', elId: 'btnNovelSplitConfirm' },
  { id: 'lifecycle.novel.chapters.batch', elId: 'btnChMerge' },
  { id: 'lifecycle.novel.chapters.batch', elId: 'btnChEnable' },
  { id: 'lifecycle.novel.chapters.batch', elId: 'btnChDisable' },
  { id: 'lifecycle.novel.chapters.batch', elId: 'btnChDelete' },
  { id: 'lifecycle.novel.source.clear', elId: 'btnNovelClearFile' },
  { id: 'lifecycle.novel.source.reset', elId: 'btnNovelResetAll' },
  { id: 'lifecycle.card.create', elId: 'btnNewDraft' },
  { id: 'lifecycle.card.import', elId: 'btnImportCard' },
  { id: 'card.engine.generate', elId: 'btnAiGenerate' },
  { id: 'card.engine.enrich', elId: 'btnAiContinueEnrich' },
  { id: 'card.wb.single', elId: 'btnAiSingleWb' },
  { id: 'card.wb.organize', elId: 'btnAiOrganize' },
  { id: 'card.wb.keygen', elId: 'btnAiGenerateKeys' },
  { id: 'card.char.tags', elId: 'btnAiGenCharTags' },
  { id: 'story.outline.generate', elId: 'btnSsOutlineGen' },
  { id: 'story.outline.generate', elId: 'btnSsOutlineContinue' },
  { id: 'story.chapter.write', elId: 'btnSsWriteStart' },
  { id: 'story.chapter.write', elId: 'btnSsWriteRun' },
  { id: 'story.chapter.write', elId: 'btnSsWriteSave' },
  { id: 'story.chapter.batch', elId: 'btnSsWriteStart' },
  { id: 'story.chapter.batch', elId: 'btnSsWriteRun' },
  { id: 'lifecycle.story.create', elId: 'btnSsNewNovel' },
  { id: 'lifecycle.story.create', elId: 'btnSsNewNovelWizard' },
];

/**
 * @param {object} [deps]
 */
export function bootMainActionEngine(deps) {
  var d = deps || {};
  if (typeof window !== 'undefined' && window.__actionEngine__) {
    return window.__actionEngine__;
  }

  var engine = createActionEngine({
    applyNovelGates: true,
    getCardId: function() {
      if (typeof d.getCardId === 'function') return d.getCardId();
      if (typeof window.__getCurrentDraftId__ === 'function') {
        return String(window.__getCurrentDraftId__() || '').trim();
      }
      return '';
    },
    getStoryId: function() {
      if (typeof d.getStoryId === 'function') return d.getStoryId();
      if (window.__storyStudio__ && typeof window.__storyStudio__.getCurrentNovelId === 'function') {
        return String(window.__storyStudio__.getCurrentNovelId() || '').trim();
      }
      return '';
    },
    getAiConfigured: function() {
      if (typeof d.getAiConfigured === 'function') return d.getAiConfigured();
      var modelEl = document.getElementById('modelSelect');
      return !!(modelEl && modelEl.value);
    },
    getNovelGates: function() {
      if (typeof d.getNovelGates === 'function') return d.getNovelGates();
      if (window.__novelWorkshop__ && window.__novelWorkshop__.state) {
        return getPipelineGates(window.__novelWorkshop__.state);
      }
      if (typeof window.__getNovelState__ === 'function') {
        return getPipelineGates(window.__getNovelState__() || {});
      }
      return { hasSource: true, hasChapters: true, canExtract: true, reasons: [] };
    },
    getTaskCenter: function() {
      return typeof window !== 'undefined' ? window.__aiTaskCenter__ : null;
    },
  });

  MAIN_NOVEL_BINDINGS.forEach(function(b) {
    engine.register(b);
  });

  // 卡列表破坏性：委托选择器（渲染后 refresh）
  engine.register({ id: 'lifecycle.card.switch', selector: '#cardManagerList [data-card-action="open"], #cardManagerList .card-manager-item' });
  engine.register({ id: 'lifecycle.card.delete', selector: '#cardManagerList [data-card-action="delete"]' });
  engine.register({ id: 'lifecycle.card.duplicate', selector: '#cardManagerList [data-card-action="dup"]' });
  engine.register({ id: 'lifecycle.card.version.switch', selector: '#cardManagerList [data-card-action="versions"], .card-version-item' });
  engine.register({ id: 'lifecycle.card.version.bump', selector: '[data-ss-ver-bump]' });

  engine.register({ id: 'lifecycle.story.open', selector: '#ssNovelList [data-ss-act="open"]' });
  engine.register({ id: 'lifecycle.story.delete', selector: '#ssNovelList [data-ss-act="delete"]' });
  engine.register({ id: 'lifecycle.story.rename', selector: '#ssNovelList [data-ss-act="rename"]' });
  engine.register({ id: 'lifecycle.story.version.switch', selector: '#ssNovelList [data-ss-act="versions"]' });
  engine.register({ id: 'lifecycle.story.version.bump', selector: '#ssNovelList [data-ss-act="bump"]' });
  engine.register({ id: 'lifecycle.story.publish', selector: '#ssNovelList [data-ss-act="publish"]' });

  engine.register({
    id: 'lifecycle.novel.source.upload',
    elId: 'novelSourceFile',
    onView: function(view) {
      var dz = document.getElementById('novelDropzone');
      if (dz) {
        dz.classList.toggle('is-action-disabled', view.enabled === false);
        dz.setAttribute('aria-disabled', view.enabled === false ? 'true' : 'false');
        if (view.reason) dz.title = view.reason;
      }
    },
  });

  if (typeof window !== 'undefined') {
    window.__actionEngine__ = engine;
    window.__ActionDeniedError__ = function(reason, id) {
      var err = new Error(reason || '操作被拒绝');
      err.name = 'ActionDeniedError';
      err.actionId = id || '';
      return err;
    };

    if (window.__aiTaskCenter__ && typeof window.__aiTaskCenter__.subscribe === 'function') {
      window.__aiTaskCenter__.subscribe(function() { engine.refresh(); });
    }
    window.addEventListener('card-draft-changed', function() { engine.refresh(); });
    window.addEventListener('card-builder-data-changed', function() { engine.refresh(); });
    window.addEventListener('app-view-changed', function() { engine.refresh(); });
  }

  // DOM 就绪后再绑一次 el（Astro 面板可能晚挂）
  function rebindEls() {
    MAIN_NOVEL_BINDINGS.forEach(function(b) {
      engine.register(b);
    });
    engine.refresh();
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', rebindEls);
    } else {
      setTimeout(rebindEls, 0);
    }
  }

  return engine;
}

export { MAIN_NOVEL_BINDINGS };
