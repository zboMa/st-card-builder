/**
 * 检测当前卡是否具备 MVU 变量设计与状态栏 design
 * 写完同步变量/状态栏仅在两者皆有时生效
 */

import { STATUS_BAR_EXT_KEY } from '../statusBar.mjs';

export var MVU_DESIGN_EXT_KEY = 'zmer_mvu_design';
export { STATUS_BAR_EXT_KEY };

function hasMvuDesignPayload(raw) {
  if (!raw || typeof raw !== 'object') return false;
  if (Array.isArray(raw.variables) && raw.variables.length > 0) return true;
  if (raw.schema && typeof raw.schema === 'object') return true;
  if (Array.isArray(raw.paths) && raw.paths.length > 0) return true;
  // 非空对象且含 summary / design 痕迹
  if (raw.summary || raw.zod || raw.yaml) return true;
  return Object.keys(raw).length > 0 && (raw.variables || raw.runtime || raw.graph);
}

function hasStatusBarDesignPayload(raw) {
  if (!raw || typeof raw !== 'object') return false;
  if (String(raw.bodyHtml || '').trim()) return true;
  if (String(raw.css || '').trim()) return true;
  if (String(raw.html || '').trim()) return true;
  if (raw.themeId || raw.layoutId || raw.custom) return true;
  if (Array.isArray(raw.modules) && raw.modules.length) return true;
  return false;
}

/**
 * @param {((key: string) => any)|object|null} getExtOrMap
 *   可为 window.__getCardExtension__，或 { [key]: value } 映射
 */
export function detectMvuStatusBarDesign(getExtOrMap) {
  var get = typeof getExtOrMap === 'function'
    ? getExtOrMap
    : function(key) {
      return getExtOrMap && typeof getExtOrMap === 'object' ? getExtOrMap[key] : undefined;
    };

  var mvu = null;
  var sb = null;
  try { mvu = get(MVU_DESIGN_EXT_KEY); } catch (e) { mvu = null; }
  try { sb = get(STATUS_BAR_EXT_KEY); } catch (e) { sb = null; }

  var hasMvu = hasMvuDesignPayload(mvu);
  var hasStatusBar = hasStatusBarDesignPayload(sb);
  var ok = hasMvu && hasStatusBar;

  var warnings = [];
  if (!hasMvu) warnings.push('当前卡缺少 MVU 变量设计');
  if (!hasStatusBar) warnings.push('当前卡缺少状态栏 design');

  return {
    hasMvu: hasMvu,
    hasStatusBar: hasStatusBar,
    ok: ok,
    canSync: ok,
    warning: warnings.length ? warnings.join('；') + '。勾选「写完同步变量与状态栏」将不会生效。' : '',
    warnings: warnings,
  };
}

/**
 * 写章后尝试同步（无 design 时返回 skipped）
 * 实际注入依赖主卡桥；此处只做门控与载荷整理
 */
export function trySyncAfterChapter(opts) {
  var o = opts || {};
  var detect = detectMvuStatusBarDesign(o.getExtension || null);
  if (!o.enabled) {
    return { synced: false, skipped: true, reason: 'disabled', detect: detect };
  }
  if (!detect.ok) {
    return { synced: false, skipped: true, reason: 'no_design', detect: detect, warning: detect.warning };
  }
  var payload = {
    chapterTitle: String(o.chapterTitle || ''),
    chapterSummary: String(o.chapterSummary || ''),
    chapterContent: String(o.chapterContent || '').slice(0, 8000),
    at: Date.now(),
  };
  if (typeof o.onSync === 'function') {
    try {
      o.onSync(payload, detect);
      return { synced: true, skipped: false, detect: detect, payload: payload };
    } catch (err) {
      return {
        synced: false,
        skipped: false,
        error: String(err && err.message ? err.message : err),
        detect: detect,
      };
    }
  }
  // 默认：写入扩展钩子痕迹，供后续流水线消费
  if (typeof o.setExtension === 'function') {
    try {
      o.setExtension('zmer_story_studio_last_sync', payload);
    } catch (e) { /* ignore */ }
  }
  return { synced: true, skipped: false, detect: detect, payload: payload };
}
