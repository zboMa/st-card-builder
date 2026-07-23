/**
 * 管理端 Action Engine boot（独立实例）
 */
import { createActionEngine } from './engine.mjs';

var ADMIN_BINDINGS = [
  { id: 'admin.token.purge', elId: 'btnAdminPurgeTokens' },
  { id: 'admin.backup.run', elId: 'btnAdminBackup' },
  { id: 'admin.user.disable', selector: '[data-user-toggle]' },
  { id: 'admin.share.toggle', selector: '[data-share-soft]' },
  { id: 'admin.share.delete', selector: '[data-share-del]' },
  { id: 'admin.token.revoke', selector: '[data-token-revoke]' },
];

/**
 * @param {object} [deps]
 * @param {() => boolean} [deps.isOps]
 * @param {() => boolean} [deps.backupEnabled]
 */
export function bootAdminActionEngine(deps) {
  var d = deps || {};
  if (typeof window !== 'undefined' && window.__actionEngine__) {
    return window.__actionEngine__;
  }

  var engine = createActionEngine({
    applyNovelGates: false,
    getAdminOps: function() {
      if (typeof d.isOps === 'function') return !!d.isOps();
      return false;
    },
    getBackupEnabled: function() {
      if (typeof d.backupEnabled === 'function') return !!d.backupEnabled();
      return false;
    },
    getAiConfigured: function() { return true; },
    getNovelGates: function() {
      return { hasSource: true, hasChapters: true, canExtract: true, reasons: [] };
    },
    getCardId: function() { return ''; },
    getStoryId: function() { return ''; },
    getTaskCenter: function() { return null; },
  });

  ADMIN_BINDINGS.forEach(function(b) { engine.register(b); });

  if (typeof window !== 'undefined') {
    window.__actionEngine__ = engine;
  }

  engine.refresh();
  return engine;
}

export { ADMIN_BINDINGS };
