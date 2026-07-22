/**
 * 小说工坊助手 bridge 工厂（拆自 bridge）
 */
import { normalizeCharacterPatch } from '../../assistant/characterFields.mjs';
import { deepCopy } from '../../utils.mjs';
import {
  profileToCharacterFields,
  applyDraftsToWorldbook,
  profileToWorldbookDraft,
  entityPersonToCharacterFields,
  entityPersonToWorldbookDraft,
  styleToWorldbookDraft,
  syncEntitiesToWorldbook,
} from '../sync.mjs';
import { findEntityMatch, upsertEntity, projectEntitiesToLegacy, isEntityEnriched } from '../entityStore.mjs';
import {
  getAdultMode, setAdultMode, getNtlMode, setNtlMode,
  getNsfwFlavor, setNsfwFlavor, getNsfwFlavorItems, setNsfwFlavorItems,
  getNtlTabooTypes, setNtlTabooTypes, getNtlTabooItems, setNtlTabooItems,
  buildStatusBarNsfwDraftFromEntities, buildStatusBarNtlDraftFromEntities,
  setAdultWorldframe, suggestAdultWorldframe, resolveWorldframe,
  NSFW_FLAVOR_PRESETS, NTL_TABOO_TYPES, MAX_NSFW_FLAVOR_ITEMS,
} from '../nsfwSupport.mjs';
import { syncOutputs } from './bridgeSyncOutputs.mjs';

export function createBridge(ctx) {
  var state = ctx.state;
  var $ = ctx.$;

  function isRagIndexStale() {
    if (!state.rag || state.rag.indexStatus !== 'ready') return true;
    if (!(state.rag.chunkCount > 0)) return true;
    var fp = ctx._chaptersSourceFingerprint ? ctx._chaptersSourceFingerprint(state.chapters) : '';
    return fp !== String(state.rag.sourceFingerprint || '');
  }

  return {
    getState: function() {
      var s = ctx._summarizeState ? ctx._summarizeState(state) : {};
      s.cardId = ctx.sm.getBoundCardId();
      if (s.rag) s.rag.stale = isRagIndexStale();
      return s;
    },
    getRawState: function() { return state; },
    getBoundCardId: function() { return ctx.sm.getBoundCardId(); },
    getRagOptions: function() {
      return {
        enabled: !state.rag || state.rag.enabled !== false,
        budget: (state.rag && state.rag.budget) || 12000,
        embedModel: (state.rag && state.rag.embedModel) || '',
      };
    },
    setRagOptions: function(opts) {
      applyRagOptionsFromUi(ctx, opts || {});
      syncRagOptionsToAiPanel(ctx);
      return this.getRagOptions();
    },
    bindCard: ctx.bindCard,
    captureBucket: function() {
      return deepCopy(state);
    },
    restoreBucket: function(snap) {
      if (!snap || typeof snap !== 'object') return;
      var d = createDefaultNovelState();
      Object.keys(state).forEach(function(k) { delete state[k]; });
      Object.assign(state, d, snap);
      ctx.save();
      ctx.renderAll();
    },
    setSource: function(payload) {
      payload = payload || {};
      if (payload.text != null) state.sourceText = String(payload.text);
      if (payload.context != null) state.contextText = String(payload.context);
      ctx.save();
      ctx.renderAll();
      return { sourceLen: (state.sourceText && state.sourceText.length) || 0, contextLen: String(state.contextText || '').length };
    },
    runSplitChapters: function(opts) {
      opts = opts || {};
      if (opts.mode) state.chapterSplitMode = opts.mode;
      var full = (state.sourceText || '').trim();
      if (!full) throw new Error('无原始资料');
      state.chapters = splitIntoChapters(full, {
        mode: state.chapterSplitMode || 'title',
        chunkSize: state.chunkSize || 8000,
      });
      ctx.save();
      ctx.renderAll();
      return { chapterCount: state.chapters.length, mode: state.chapterSplitMode };
    },
    runExtract: async function(opts) {
      opts = opts || {};
      var mode = opts.mode || 'characters';
      if (mode === 'chapters' || mode === 'split') {
        return Object.assign({ mode: 'split' }, this.runSplitChapters(opts));
      }
      if (mode === 'worldbook' || mode === 'wb') {
        if (!ctx.panels.worldbook) throw new Error('世界书面板未挂载');
        return Object.assign({ mode: 'worldbook' }, await ctx.panels.worldbook.runExtractWorldbook());
      }
      if (mode === 'graph' || mode === 'knowledge_graph' || mode === 'unified' || mode === 'analyze') {
        if (!ctx.panels.analyze) throw new Error('分析面板未挂载');
        return Object.assign({ mode: 'analyze' }, await ctx.panels.analyze.runAnalyzeAll());
      }
      if (mode === 'style') {
        if (!ctx.panels.style) throw new Error('文风面板未挂载');
        return Object.assign({ mode: 'style' }, await ctx.panels.style.runDistill());
      }
      if (mode === 'character_setup' || mode === 'char_setup' || mode === 'setup') {
        if (!ctx._runGenerateCharSetup) throw new Error('角色设定生成未挂载');
        return Object.assign({ mode: 'character_setup' }, await ctx._runGenerateCharSetup());
      }
      if (mode === 'greetings' || mode === 'greeting') {
        if (!ctx._runGenerateGreetings) throw new Error('开场白生成未挂载');
        return Object.assign({ mode: 'greetings' }, await ctx._runGenerateGreetings());
      }
      if (!ctx.panels.characters) throw new Error('人物面板未挂载');
      return Object.assign({ mode: 'characters' }, await ctx.panels.characters.runScan());
    },
    runGenerateCharSetup: function() { return ctx._runGenerateCharSetup(); },
    runGenerateGreetings: function() { return ctx._runGenerateGreetings(); },
    patchChapters: function(opts) { return ctx.panels.chapters ? ctx.panels.chapters.patch(opts) : null; },
    expandCharacter: function(opts) {
      var chars = ctx.panels.characters;
      if (!chars) throw new Error('人物面板未挂载');
      opts = opts || {};
      return chars.expand(
        { id: opts.id, name: opts.name || opts.titleMatch },
        { mode: opts.mode || 'expand', instruction: opts.instruction || '', silent: true, skipConfirm: true, openEditor: false }
      );
    },
    mutateCharacter: function(opts) {
      var chars = ctx.panels.characters;
      if (!chars) throw new Error('人物面板未挂载');
      opts = opts || {};
      var t = opts.target || opts;
      return chars.expand(
        { id: t.id, name: t.name || t.titleMatch },
        { mode: opts.mode || 'expand', instruction: opts.instruction || '', silent: true, skipConfirm: true, openEditor: false }
      );
    },
    expandWorldbookEntry: function(opts) {
      if (!ctx.panels.worldbook) throw new Error('世界书面板未挂载');
      opts = opts || {};
      var t = opts.target || opts;
      var index = t.index != null ? Number(t.index) : opts.index;
      return ctx.panels.worldbook.expandWbEntry(
        index != null && !Number.isNaN(index) ? index : { name: t.name || t.titleMatch || opts.name },
        { mode: opts.mode || 'expand', instruction: opts.instruction || '', silent: true, skipConfirm: true }
      );
    },
    listOutputs: function() {
      return {
        characters: (state.characters || []).filter(function(c) { return c.profile; }).map(function(c) {
          return { id: c.id, name: c.name, selected: !!c.selected, syncStatus: c.syncStatus };
        }),
        worldbook: (state.wbEntries || []).map(function(e, i) {
          return { index: i, name: e.name, comment: e.comment, selected: e.selected !== false, syncStatus: e.syncStatus };
        }),
        styleLen: String(state.styleText || '').length,
        styleSyncStatus: state.styleSyncStatus,
        conflictPolicy: state.conflictPolicy,
      };
    },
    syncOutputs: function(opts) { return syncOutputs(ctx, opts); },
    applyResult: function(opts) { return syncOutputs(ctx, opts || {}); },
    searchPassages: async function(query, opts) {
      opts = opts || {};
      var { hybridSearch } = await import('../rag/hybridSearch.mjs');
      var { loadRagIndex } = await import('../rag/store.mjs');
      var { pickRelatedEntities } = await import('../rag/inject.mjs');
      var api = ctx._getApiConfig ? ctx._getApiConfig() : { apiUrl: '', apiKey: '', embedModel: '' };
      var cardId = ctx.sm.getBoundCardId();
      var enabledChapters = (state.chapters || []).filter(function(c) {
        return c && c.enabled !== false && String(c.text || '').trim();
      });
      var chList = enabledChapters.length ? enabledChapters : (state.chapters || []);
      var index = cardId ? await loadRagIndex(cardId) : null;
      var indexStatus = (state.rag && state.rag.indexStatus) || 'idle';
      var stale = isRagIndexStale();
      var budget = opts.budget != null ? opts.budget : ((state.rag && state.rag.budget) || 12000);
      var hybridOpts = {
        chapters: chList,
        query: String(query || ''),
        cardId: cardId,
        index: index,
        budget: budget,
        topK: opts.limit || 24,
        apiUrl: api.apiUrl,
        apiKey: api.apiKey,
        embedModel: api.embedModel || (state.rag && state.rag.embedModel) || '',
      };
      var q = String(query || '').trim();
      var extraTerms = [];
      if (q && (state.entities || []).length) {
        var entitySeeds = pickRelatedEntities(state.entities, q, 4, {
          fallback: 0,
          relations: state.relations,
        });
        entitySeeds.forEach(function(e) {
          if (e && e.name) extraTerms.push(e.name);
          (e.aliases || []).forEach(function(a) { if (a) extraTerms.push(a); });
        });
      }
      if (extraTerms.length) hybridOpts.extraTerms = extraTerms;
      var search = await hybridSearch(hybridOpts);
      if (!search.snippets.length && q && (state.entities || []).length) {
        var seeds = pickRelatedEntities(state.entities, q, 4, { fallback: 0 });
        var entityTerms = [];
        seeds.forEach(function(e) {
          if (e && e.name) entityTerms.push(e.name);
          (e.aliases || []).forEach(function(a) { if (a) entityTerms.push(a); });
        });
        if (entityTerms.length) {
          search = await hybridSearch(Object.assign({}, hybridOpts, {
            query: entityTerms.slice(0, 8).join(' '),
            entityBoost: true,
          }));
        }
      }
      return Object.assign({}, search, {
        indexStatus: indexStatus,
        indexStale: stale,
        indexReady: indexStatus === 'ready' && !stale,
        chunkCount: (state.rag && state.rag.chunkCount) || search.indexChunkCount || 0,
        enabledChapterCount: enabledChapters.length,
        cardId: cardId,
      });
    },
    listEntities: function(opts) {
      opts = opts || {};
      var list = (state.entities || []).slice();
      if (opts.type) list = list.filter(function(e) { return e.type === opts.type; });
      if (opts.query) {
        var q = String(opts.query).toLowerCase();
        list = list.filter(function(e) {
          return ((e.name || '') + ' ' + (e.aliases || []).join(' ')).toLowerCase().indexOf(q) >= 0;
        });
      }
      return list.map(function(e) {
        var profile = (e.attrs && e.attrs.profile) || e.profile || {};
        return {
          id: e.id,
          type: e.type,
          name: e.name,
          aliases: e.aliases,
          summary: e.summary,
          gender: profile.gender || '',
          identity: profile.identity || '',
          selected: e.selected !== false,
          syncStatus: e.syncStatus,
          enriched: isEntityEnriched(e, !!state.strictQuality, getAdultMode(state)),
        };
      });
    },
    getEntity: function(idOrName) {
      var s = String(idOrName || '').trim();
      if (!s) return null;
      var byId = (state.entities || []).find(function(e) { return e.id === s; });
      if (byId) return byId;
      return findEntityMatch(state.entities, s, []);
    },
    patchEntity: function(opts) {
      opts = opts || {};
      var t = opts.target || opts;
      var ent = t.id
        ? (state.entities || []).find(function(e) { return e.id === t.id; })
        : findEntityMatch(state.entities, t.name || t.titleMatch || opts.name, []);
      if (!ent) throw new Error('未找到实体');
      var patch = opts.patch || opts.fields || opts;
      upsertEntity(state.entities, Object.assign({
        type: ent.type,
        name: patch.name || ent.name,
      }, patch), { source: 'assistant' });
      projectEntitiesToLegacy(state);
      ctx.save();
      ctx.renderAll();
      return findEntityMatch(state.entities, patch.name || ent.name, patch.aliases) || ent;
    },
    mergeEntities: function(opts) {
      opts = opts || {};
      function resolveEnt(ref) {
        if (!ref) return null;
        if (typeof ref === 'string') {
          return (state.entities || []).find(function(e) { return e.id === ref; })
            || findEntityMatch(state.entities, ref, []);
        }
        if (ref.id) return (state.entities || []).find(function(e) { return e.id === ref.id; });
        return findEntityMatch(state.entities, ref.name || ref.titleMatch, []);
      }
      var a = resolveEnt(opts.keep) || (state.entities || []).find(function(e) {
        return e.id === (opts.primaryId || opts.intoId || opts.targetId);
      });
      var b = resolveEnt(opts.drop) || (state.entities || []).find(function(e) {
        return e.id === (opts.secondaryId || opts.fromId || opts.sourceId);
      });
      if (!a || !b) throw new Error('实体不存在');
      var primaryId = a.id;
      var secondaryId = b.id;
      a.aliases = Array.from(new Set((a.aliases || []).concat(b.aliases || [], [b.name])));
      if (String(b.content || '').length > String(a.content || '').length) a.content = b.content;
      if (String(b.summary || '').length > String(a.summary || '').length) a.summary = b.summary;
      a.provenance = (a.provenance || []).concat(b.provenance || []);
      a.syncStatus = 'dirty';
      state.entities = (state.entities || []).filter(function(e) { return e.id !== secondaryId; });
      state.relations = (state.relations || []).map(function(r) {
        return Object.assign({}, r, {
          fromId: r.fromId === secondaryId ? primaryId : r.fromId,
          toId: r.toId === secondaryId ? primaryId : r.toId,
        });
      });
      projectEntitiesToLegacy(state);
      ctx.save();
      ctx.renderAll();
      return a;
    },
    runRagIndex: function(opts) {
      if (!ctx.panels.analyze) throw new Error('分析面板未挂载');
      return ctx.panels.analyze.runBuildRagIndex(opts || {});
    },
    retryFailedShards: function() {
      if (!ctx.panels.analyze) throw new Error('分析面板未挂载');
      return ctx.panels.analyze.runRetryFailedShards();
    },
    isRagIndexStale: isRagIndexStale,
    getAdultMode: function() { return getAdultMode(state); },
    setAdultMode: function(on) {
      setAdultMode(state, on);
      ctx.save();
      ctx.renderAll();
      return getAdultMode(state);
    },
    getNtlMode: function() { return getNtlMode(state); },
    setNtlMode: function(on) {
      setNtlMode(state, on);
      ctx.save();
      ctx.renderAll();
      return getNtlMode(state);
    },
    buildNsfwStatusDraft: function(opts) {
      opts = opts || {};
      return buildStatusBarNsfwDraftFromEntities(
        state.entities,
        opts.name || opts.charName || state.setupCharName || ''
      );
    },
    buildNtlStatusDraft: function(opts) {
      opts = opts || {};
      return buildStatusBarNtlDraftFromEntities(
        state.entities,
        opts.name || opts.charName || state.setupCharName || ''
      );
    },
    runAnalyze: function(phase) {
      if (!ctx.panels.analyze) throw new Error('分析面板未挂载');
      var p = String(phase || 'all').toLowerCase();
      if (p === 'skeleton') return ctx.panels.analyze.runAnalyzeSkeleton();
      if (p === 'enrich') return ctx.panels.analyze.runAnalyzeEnrich({});
      if (p === 'relations') return ctx.panels.analyze.runAnalyzeRelations();
      return ctx.panels.analyze.runAnalyzeAll();
    },
    enrichEntity: function(opts) {
      if (!ctx.panels.analyze) throw new Error('分析面板未挂载');
      opts = opts || {};
      var ids = opts.ids || (opts.id ? [opts.id] : []);
      if (!ids.length && opts.name) {
        var hit = findEntityMatch(state.entities, opts.name, []);
        if (hit) ids = [hit.id];
      }
      return ctx.panels.analyze.runAnalyzeEnrich({ ids: ids });
    },
    syncEntities: function(opts) {
      return syncOutputs(ctx, Object.assign({ target: 'entities' }, opts || {}));
    },
    getNsfwFlavor: function() { return getNsfwFlavor(state); },
    getNsfwFlavorItems: function() { return getNsfwFlavorItems(state); },
    setNsfwFlavor: function(id) {
      setNsfwFlavor(state, id);
      if (typeof window.__setNsfwConfig__ === 'function') {
        var cfg = window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {};
        cfg.flavor = id;
        cfg.flavorItems = getNsfwFlavorItems(state);
        window.__setNsfwConfig__(cfg);
      }
      ctx.save();
    },
    setNsfwFlavorItems: function(items) {
      setNsfwFlavorItems(state, items);
      if (typeof window.__setNsfwConfig__ === 'function') {
        var cfg = window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {};
        cfg.flavorItems = getNsfwFlavorItems(state);
        cfg.flavor = getNsfwFlavor(state);
        window.__setNsfwConfig__(cfg);
      }
      ctx.save();
    },
    getNtlTabooTypes: function() { return getNtlTabooTypes(state); },
    setNtlTabooTypes: function(types) {
      setNtlTabooTypes(state, types);
      if (typeof window.__setNsfwConfig__ === 'function') {
        var cfg = window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {};
        cfg.ntlTabooTypes = types;
        cfg.ntlTabooItems = getNtlTabooItems(state);
        window.__setNsfwConfig__(cfg);
      }
      ctx.save();
    },
    getNtlTabooItems: function() { return getNtlTabooItems(state); },
    setNtlTabooItems: function(items) {
      setNtlTabooItems(state, items);
      if (typeof window.__setNsfwConfig__ === 'function') {
        var cfg = window.__getNsfwConfig__ ? window.__getNsfwConfig__() : {};
        cfg.ntlTabooItems = getNtlTabooItems(state);
        cfg.ntlTabooTypes = getNtlTabooTypes(state);
        window.__setNsfwConfig__(cfg);
      }
      ctx.save();
    },
    getNsfwFlavorPresets: function() { return NSFW_FLAVOR_PRESETS; },
    getMaxNsfwFlavorItems: function() { return MAX_NSFW_FLAVOR_ITEMS; },
    getNtlTabooTypeOptions: function() { return NTL_TABOO_TYPES; },
    getAdultWorldframe: function() { return resolveWorldframe(state); },
    setAdultWorldframe: function(frameId) {
      setAdultWorldframe(state, frameId);
      ctx.save();
      return resolveWorldframe(state);
    },
    suggestAdultWorldframe: function(frameId) {
      suggestAdultWorldframe(state, frameId);
      ctx.save();
      return resolveWorldframe(state);
    },
  };
}
