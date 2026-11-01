/**
 * 卡管理面板：JSON/PNG 导入解析（从 CardManagerPanel.astro 外提）。
 * 注意：导出 JSON/PNG 由各卡底部触发（导出该卡，不含小说）。
 * 导入入口由 Vue 工具栏（CardManagerToolbar）负责。
 */
export {
  normalizeCardJSON,
  extractPNGCharaChunk,
  parseCardFile,
} from './cardImportParsers.mjs';
