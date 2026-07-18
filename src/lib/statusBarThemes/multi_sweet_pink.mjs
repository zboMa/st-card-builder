/**
 * 状态栏主题：甜齿群像（sweet / multi）
 * softmon 信息架构 + 本族换皮 CSS
 */
import { renderSoftmonMulti } from './softmonLayout.mjs';

export const meta = {
  id: "multi_sweet_pink",
  label: "甜齿群像",
  cast: "multi",
  family: "sweet",
  blurb: "奶油粉群像 · softmon 骨架",
  accent: "#f472b6",
};

const SKIN = {
  ns: "sw",
  footer: "CANDY CAST",
  icons: {"time":"🍡","loc":"🏠","events":"🎀","others":"🧁"},
  accents: ["#f472b6","#fb7185","#f9a8d4","#fda4af","#fbcfe8","#ec4899"],
};

/** @param {object} opts */
export function render(opts) {
  return renderSoftmonMulti(opts, SKIN);
}

export function css() {
  return [
    ".zb-root{box-sizing:border-box;width:100%;max-width:720px;margin:0 auto;padding:14px;font-family:\"Segoe UI\",\"Microsoft YaHei\",sans-serif;font-size:12px;line-height:1.45;color:#831843;background:linear-gradient(180deg,#fff1f5,#fce7f3)}",
    ".zb-root *,.zb-root *:before,.zb-root *:after{box-sizing:border-box}",
    ".sw-empty{padding:20px;text-align:center;opacity:.5}",
    ".sw-world{flex:1;display:flex;flex-direction:column;gap:6px}",
    ".sw-world-primary,.sw-world-secondary{display:flex;align-items:center;gap:6px}",
    ".sw-ico{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;line-height:1;opacity:.85}",
    ".sw-chars{padding:8px}",
    ".sw-head{display:flex;align-items:center;gap:10px;padding:10px 12px}",
    ".sw-mini-bars{flex:1;display:flex;gap:8px;min-width:0}",
    ".sw-mini{flex:1;display:flex;align-items:center;gap:5px;min-width:0}",
    ".sw-mini-lab{font-size:10px;opacity:.6;min-width:14px}",
    ".sw-track{flex:1;height:4px;border-radius:2px;overflow:hidden;max-width:100%}",
    ".sw-fill{height:100%;border-radius:2px;transition:width .3s}",
    ".sw-mini-num{font-size:10px;font-weight:600;min-width:20px;text-align:right}",
    ".sw-detail{padding:0 12px 12px}",
    ".sw-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}",
    ".sw-cell.sw-full{grid-column:1/-1}",
    ".sw-cell-k{font-size:9px;opacity:.5;margin-bottom:2px}",
    ".sw-events-h,.sw-event-track-h{font-size:10px;opacity:.65;margin-bottom:6px;display:flex;align-items:center;gap:4px}",
    ".sw-chip-rail{display:flex;gap:8px;flex-wrap:wrap}",
    ".sw-chip b{font-weight:600;margin-right:2px}",
    ".sw-foot{margin-top:4px;padding:8px 0 6px;display:flex;justify-content:center;align-items:center;gap:8px}",
    ".sw-deco{height:1px;width:30px}",
    ".sw-deco-t{font-size:9px;letter-spacing:2px;font-weight:700}",
    ".sw-head{cursor:pointer;list-style:none}",
    ".sw-head::-webkit-details-marker{display:none}",
    ".sw-toggle{width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:5px solid currentColor;opacity:.45;margin-left:4px;transition:transform .2s;flex:0 0 auto}",
    "details.sw-card:not([open])>.sw-head .sw-toggle{transform:rotate(-90deg)}",
    ".sw-card{margin-bottom:6px}",
    ".sw-card:last-child{margin-bottom:0}",
    ".sw-name{color:var(--sw-accent)}",
    ".sw-card{border-left:3px solid var(--sw-accent)}",
    ".sw-others-sec,.sw-events-sec{padding:8px;border-top:1px solid rgba(128,128,128,.2)}",
    ".sw-fold-h{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;cursor:pointer;list-style:none;font-weight:600;font-size:12px}",
    ".sw-fold-h::-webkit-details-marker{display:none}",
    "details.sw-fold:not([open])>.sw-fold-h .sw-toggle{transform:rotate(-90deg)}",
    ".sw-others-list,.sw-events-list{padding:8px 0 0}",
    ".sw-other{margin-bottom:6px;padding:10px 12px;border-left:3px solid var(--sw-accent)}",
    ".sw-other:last-child{margin-bottom:0}",
    ".sw-other-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}",
    ".sw-other-name{color:var(--sw-accent)}",
    ".sw-other-favor{flex:1;display:flex;align-items:center;gap:6px;min-width:0}",
    ".sw-other-favor .sw-track{max-width:80px}",
    ".sw-other-lab{font-size:10px;opacity:.5}",
    ".sw-other-info{display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px}",
    ".sw-other-i.sw-full{grid-column:1/-1}",
    ".sw-other-v{opacity:.8}",
    ".sw-event-row{display:flex;align-items:center;padding:8px 12px;margin-bottom:4px;gap:10px}",
    ".sw-event-name{font-weight:600;font-size:11px;min-width:60px}",
    ".sw-event-status{flex:1;font-size:10px;text-align:right}",
    ".sw-panel{border-radius:24px;overflow:hidden;background:linear-gradient(160deg,#fff,#fdf2f8);border:2px solid #f9a8d4;box-shadow:0 8px 24px rgba(244,114,182,.2)}",
    ".sw-top{padding:12px 16px;background:linear-gradient(90deg,#fce7f3,#fff);border-bottom:1px solid #fbcfe8}",
    ".sw-datetime{font-size:13px;font-weight:700;color:#db2777}",
    ".sw-loc{font-size:11px;color:#ec4899}",
    ".sw-ico{font-size:13px}",
    ".sw-card{border-radius:18px;overflow:hidden;background:#fff;border:1px solid #fbcfe8;border-left:4px solid #f472b6;box-shadow:0 2px 8px rgba(244,114,182,.1)}",
    ".sw-name{font-weight:700;font-size:13px;min-width:60px;color:#be185d}",
    ".sw-track{background:#fce7f3;border-radius:99px;height:6px}",
    ".sw-fill{background:linear-gradient(90deg,#f472b6,#fb7185,#f9a8d4);border-radius:99px}",
    ".sw-mini-num{color:#db2777}",
    ".sw-cell{padding:8px 10px;border-radius:14px;background:#fdf2f8;border:1px solid #fce7f3;font-size:11px}",
    ".sw-cell-v,.sw-cell-v .zb-value{color:#831843!important;font-weight:600}",
    ".sw-chip{padding:4px 12px;border-radius:99px;font-size:10px;background:#fce7f3;color:#db2777;border:1px solid #f9a8d4}",
    ".sw-deco{background:#f472b6;border-radius:2px}",
    ".sw-deco-t{color:#f472b6;opacity:.7;font-family:Segoe UI,sans-serif}",
    ".sw-foot{opacity:.75}",
    ".sw-fold-h{border-radius:16px;background:#fce7f3;border:1px solid #f9a8d4;color:#be185d}",
    ".sw-other{border-radius:16px;background:#fff;border:1px solid #fbcfe8}",
    ".sw-chip.done{background:#fbcfe8;color:#be185d}",
    ".sw-event-row{border-radius:14px;background:#fdf2f8;border:1px solid #fce7f3}",
    ".sw-event-row.unlocked{border-color:#f472b6;background:#fce7f3}",
    ".sw-event-name{color:#db2777}",
    ".sw-event-status{color:#ec4899}",
    ".sw-cell-v .zb-value,.sw-other-v .zb-value{color:#831843!important}",
    ".sw-others-sec,.sw-events-sec{border-top:1px solid #fbcfe8}"
  ].join('');
}
