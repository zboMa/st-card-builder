/**
 * 角色卡管理：非 DOM 的生命周期与全局桥接。
 * 列表/筛选/工具栏/菜单的 DOM 交互已迁到 Vue，这里只保留事件、助手 API、保存冲刷。
 */

import { buildExportChecklist } from '../exportChecklist.mjs';
import { buildCardJSONFromDraft, draftDisplayName } from '../state.mjs';
import { engineTryAllowed } from '../../actionEngine/helpers.mjs';
import { hydrateDraftsStore } from '../../draftsStore.mjs';
import { installCardManagerBridge } from './cardManagerBridge.mjs';

/** @param {object} ctx @param {object} s @param {object} panel */
export function attachCardManagerBind(ctx, s, panel) {
  // ---- Event bindings（DOM 部分已迁移到 Vue） ----
  panel.bind = function () {
    installCardManagerBridge(ctx, s, panel);

    // 进入角色卡管理：唯一入口单流程。
    // 数据在 boot 时已就绪（browserApp st-idb-ready 已 hydrate 本地 + 拉云端索引）：
    // 这里只「等已有的加载完成 → 渲染一次」，绝不重复拉取。
    var cardMgrEnterPromise = null;
    panel.enterCardManagerView = function () {
      if (cardMgrEnterPromise) return cardMgrEnterPromise;
      cardMgrEnterPromise = (async function () {
        try {
          await s.ensureIdbReady();
          await hydrateDraftsStore();
          try {
            var sync = await import('../../sync/index.mjs');
            if (sync.ensureCardCloudIndex) await sync.ensureCardCloudIndex();
          } catch (eIdx) {
            console.warn('[card-manager] cloud index', eIdx);
          }
          if (s.getCurrentAppView() === 'card-manager') panel.updateCardManagerUI();
        } finally {
          cardMgrEnterPromise = null;
        }
      })();
      return cardMgrEnterPromise;
    };

    // 进入管理页唯一信号源：app-view-changed（hashchange / 首屏初始视图已由 AppSidebar 收敛到它）
    window.addEventListener('app-view-changed', function (ev) {
      var view = ev && ev.detail && ev.detail.view;
      if (view === 'card-manager') panel.enterCardManagerView();
    });

    // 关页 / 切后台：冲掉双路径 debounce，避免丢最后一次编辑
    function flushPendingCardSaves() {
      try {
        clearTimeout(s.autoSaveTimer);
        if (ctx.sm && typeof ctx.sm.flushSave === 'function') {
          s.syncDomFieldsToState();
          ctx.sm.flushSave();
        } else {
          panel.flushUpdateAndSave();
        }
      } catch (eFlush) { /* ignore */ }
    }
    window.addEventListener('pagehide', flushPendingCardSaves);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flushPendingCardSaves();
    });

    // Assistant card API
    window.__assistantCardApi__ = {
      list: function () {
        var dr = s.getAllDrafts();
        var currentId = s.getCurrentDraftId();
        return {
          currentId: currentId || '',
          cards: Object.keys(dr).map(function (id) {
            return {
              id: id,
              name: draftDisplayName(dr[id]),
              updatedAt: dr[id].updatedAt || '',
              current: id === currentId,
            };
          }),
        };
      },
      switchTo: function (idOrName) {
        var gate = engineTryAllowed('lifecycle.card.switch');
        if (!gate.ok) throw new Error(gate.reason || '任务进行中，禁止切卡');
        var key = String(idOrName || '').trim();
        if (!key) throw new Error('缺少 id 或 name');
        var dr = s.getAllDrafts();
        if (dr[key]) {
          panel.loadDraft(key);
          return { id: key, name: draftDisplayName(dr[key]) };
        }
        var found = Object.keys(dr).find(function (id) {
          return draftDisplayName(dr[id]) === key;
        });
        if (!found) throw new Error('未找到卡片: ' + key);
        panel.loadDraft(found);
        return { id: found, name: draftDisplayName(dr[found]) };
      },
      create: function (opts) {
        var gate = engineTryAllowed('lifecycle.card.create');
        if (!gate.ok) throw new Error(gate.reason || '任务进行中，禁止新建');
        opts = opts || {};
        panel.createBlankDraft({ jumpToCharacter: false });
        if (opts.name) {
          ctx.state.charName = String(opts.name);
          var el = ctx.$('charName');
          if (el) el.value = String(opts.name);
          panel.saveCurrentDraft();
          panel.updateCardManagerUI();
        }
        return { id: ctx.state.draftId, name: ctx.state.charName || '未命名' };
      },
      duplicate: function (id) {
        var gate = engineTryAllowed('lifecycle.card.duplicate');
        if (!gate.ok) throw new Error(gate.reason || '任务进行中，禁止复制');
        var src = id || s.getCurrentDraftId();
        if (!src) throw new Error('无可复制卡片');
        panel.duplicateDraft(src);
        return { id: ctx.state.draftId, name: ctx.state.charName || '副本' };
      },
      rename: function (id, name) {
        return panel.renameDraft(id || s.getCurrentDraftId(), name);
      },
      bumpVersion: function (which) {
        var gate = engineTryAllowed('lifecycle.card.version.bump');
        if (!gate.ok) throw new Error(gate.reason || '任务进行中，禁止增版');
        var id = s.getCurrentDraftId();
        if (!id) throw new Error('无当前卡');
        return panel.bumpDraftVersion(id, which === 'major' ? 'major' : 'minor');
      },
      switchVersion: function (targetVer) {
        var gate = engineTryAllowed('lifecycle.card.version.switch');
        if (!gate.ok) throw new Error(gate.reason || '任务进行中，禁止切版本');
        var id = s.getCurrentDraftId();
        if (!id) throw new Error('无当前卡');
        return panel.switchDraftVersion(id, targetVer);
      },
      delete: async function (id) {
        var gate = engineTryAllowed('lifecycle.card.delete');
        if (!gate.ok) throw new Error(gate.reason || '任务进行中，禁止删卡');
        return panel.deleteDraft(id || s.getCurrentDraftId(), { force: true });
      },
      importJson: function (cardJson) {
        var gate = engineTryAllowed('lifecycle.card.import');
        if (!gate.ok) throw new Error(gate.reason || '任务进行中，禁止导入');
        if (!cardJson || typeof cardJson !== 'object') throw new Error('需要已解析的 cardJson 对象');
        if (typeof window.applyJSONFromEditor !== 'function') throw new Error('导入桥接未就绪');
        window.applyJSONFromEditor(cardJson, { asNew: true });
        panel.saveCurrentDraft();
        panel.updateCardManagerUI();
        return { id: ctx.state.draftId, name: ctx.state.charName || '导入卡' };
      },
      exportCheck: function () {
        if (typeof window.__getExportChecklist__ === 'function') {
          return window.__getExportChecklist__();
        }
        var wb = Array.isArray(ctx.state.worldbookEntries) ? ctx.state.worldbookEntries : [];
        return buildExportChecklist({
          charName: ctx.state.charName,
          charDesc: ctx.state.charDesc,
          firstMes: ctx.state.firstMes || (ctx.$('firstMes') || {}).value || '',
          hasAvatar: !!(ctx.state.avatarInIdb || ctx.state.avatarBase64),
          worldbookCount: wb.length,
          worldbookNoKeys: wb.filter(function (e) {
            return e && e.enabled !== false && (!e.keys || !e.keys.length);
          }).length,
          altGreetingCount: Array.isArray(window.__altGreetings__) ? window.__altGreetings__.length : 0,
        });
      },
    };

    ctx.sm.on(function (result) {
      panel.updateCardManagerUI(result && result.drafts);
    });

    window.addEventListener('card-builder-data-changed', function () {
      if (s.getCurrentAppView() === 'card-manager') panel.updateCardManagerUI();
    });

    import('../../sync/cloudStore.mjs').then(function (cloudMod) {
      if (!cloudMod.onCloudEvent) return;
      cloudMod.onCloudEvent(function (ev) {
        if (!ev || ev.type !== 'index-merged') return;
        if (s.getCurrentAppView() === 'card-manager') panel.updateCardManagerUI();
      });
    }).catch(function () { /* ignore */ });

    window.addEventListener('card-local-saved', function () {
      import('../../sync/index.mjs').then(function (sync) {
        if (!sync.isCloudEnabled || !sync.isCloudEnabled()) return;
        ctx.appFeedback({
          message: '已本地保存；改完请到卡管理点「同步上云」',
          level: 'info',
          channel: 'toast',
          duration: 5000,
        });
      }).catch(function () { /* ignore */ });
    });

    window.addEventListener('assistant-change-summary', function () {
      import('../../sync/index.mjs').then(function (sync) {
        if (!sync.isCloudEnabled || !sync.isCloudEnabled()) return;
        ctx.appFeedback({
          message: '助手已修改卡片；请到卡管理点「同步上云」',
          level: 'info',
          channel: 'toast',
          duration: 5000,
        });
      }).catch(function () { /* ignore */ });
    });

    // 首屏若已在卡管理视图，主动渲染一次
    if (s.getCurrentAppView() === 'card-manager') panel.updateCardManagerUI();
  };
  return panel;
}
