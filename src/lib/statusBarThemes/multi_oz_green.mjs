/**
 * 状态栏主题：绿野群像（oz / multi）
 * softmon 信息架构 + 本族换皮 CSS
 */
import { renderSoftmonMulti } from './softmonLayout.mjs';

export const meta = {
  id: "multi_oz_green",
  label: "绿野群像",
  cast: "multi",
  family: "oz",
  blurb: "苔绿群像 · softmon 骨架",
  accent: "#4ade80",
};

const SKIN = {
  ns: "oz",
  footer: "GROVE",
  icons: {"time":"🌿","loc":"🍃","events":"🌱","others":"🌳"},
  accents: ["#4ade80","#22c55e","#86efac","#16a34a","#bbf7d0","#a3e635"],
};

/** @param {object} opts */
export function render(opts) {
  return renderSoftmonMulti(opts, SKIN);
}

export function css() {
  return [
    ".zb-root{box-sizing:border-box;width:100%;max-width:720px;margin:0 auto;padding:12px;font-family:\"Segoe UI\",\"Microsoft YaHei\",sans-serif;font-size:12px;line-height:1.45;color:#14532d;background:radial-gradient(ellipse at 70% 0%,rgba(74,222,128,.2),transparent 45%),linear-gradient(180deg,#ecfdf5,#d1fae5)}",
    ".zb-root *,.zb-root *:before,.zb-root *:after{box-sizing:border-box}",
    ".oz-empty{padding:20px;text-align:center;opacity:.5}",
    ".oz-world{flex:1;display:flex;flex-direction:column;gap:6px}",
    ".oz-world-primary,.oz-world-secondary{display:flex;align-items:center;gap:6px}",
    ".oz-ico{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;line-height:1;opacity:.85}",
    ".oz-chars{padding:8px}",
    ".oz-head{display:flex;align-items:center;gap:10px;padding:10px 12px}",
    ".oz-mini-bars{flex:1;display:flex;gap:8px;min-width:0}",
    ".oz-mini{flex:1;display:flex;align-items:center;gap:5px;min-width:0}",
    ".oz-mini-lab{font-size:10px;opacity:.6;min-width:14px}",
    ".oz-track{flex:1;height:4px;border-radius:2px;overflow:hidden;max-width:100%}",
    ".oz-fill{height:100%;border-radius:2px;transition:width .3s}",
    ".oz-mini-num{font-size:10px;font-weight:600;min-width:20px;text-align:right}",
    ".oz-detail{padding:0 12px 12px}",
    ".oz-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}",
    ".oz-cell.oz-full{grid-column:1/-1}",
    ".oz-cell-k{font-size:9px;opacity:.5;margin-bottom:2px}",
    ".oz-events-h,.oz-event-track-h{font-size:10px;opacity:.65;margin-bottom:6px;display:flex;align-items:center;gap:4px}",
    ".oz-chip-rail{display:flex;gap:8px;flex-wrap:wrap}",
    ".oz-chip b{font-weight:600;margin-right:2px}",
    ".oz-foot{margin-top:4px;padding:8px 0 6px;display:flex;justify-content:center;align-items:center;gap:8px}",
    ".oz-deco{height:1px;width:30px}",
    ".oz-deco-t{font-size:9px;letter-spacing:2px;font-weight:700}",
    ".oz-head{cursor:pointer;list-style:none}",
    ".oz-head::-webkit-details-marker{display:none}",
    ".oz-toggle{width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:5px solid currentColor;opacity:.45;margin-left:4px;transition:transform .2s;flex:0 0 auto}",
    "details.oz-card:not([open])>.oz-head .oz-toggle{transform:rotate(-90deg)}",
    ".oz-card{margin-bottom:6px}",
    ".oz-card:last-child{margin-bottom:0}",
    ".oz-name{color:var(--oz-accent)}",
    ".oz-card{border-left:3px solid var(--oz-accent)}",
    ".oz-others-sec,.oz-events-sec{padding:8px;border-top:1px solid rgba(128,128,128,.2)}",
    ".oz-fold-h{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;cursor:pointer;list-style:none;font-weight:600;font-size:12px}",
    ".oz-fold-h::-webkit-details-marker{display:none}",
    "details.oz-fold:not([open])>.oz-fold-h .oz-toggle{transform:rotate(-90deg)}",
    ".oz-others-list,.oz-events-list{padding:8px 0 0}",
    ".oz-other{margin-bottom:6px;padding:10px 12px;border-left:3px solid var(--oz-accent)}",
    ".oz-other:last-child{margin-bottom:0}",
    ".oz-other-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}",
    ".oz-other-name{color:var(--oz-accent)}",
    ".oz-other-favor{flex:1;display:flex;align-items:center;gap:6px;min-width:0}",
    ".oz-other-favor .oz-track{max-width:80px}",
    ".oz-other-lab{font-size:10px;opacity:.5}",
    ".oz-other-info{display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px}",
    ".oz-other-i.oz-full{grid-column:1/-1}",
    ".oz-other-v{opacity:.8}",
    ".oz-event-row{display:flex;align-items:center;padding:8px 12px;margin-bottom:4px;gap:10px}",
    ".oz-event-name{font-weight:600;font-size:11px;min-width:60px}",
    ".oz-event-status{flex:1;font-size:10px;text-align:right}",
    ".oz-panel{border-radius:14px;overflow:hidden;background:linear-gradient(160deg,#f0fdf4,#ecfdf5);border:1px solid #4ade80;box-shadow:0 6px 20px rgba(34,197,94,.15)}",
    ".oz-top{padding:12px 16px;background:linear-gradient(90deg,rgba(74,222,128,.15),transparent);border-bottom:1px solid rgba(74,222,128,.35)}",
    ".oz-datetime{font-size:13px;font-weight:700;color:#15803d}",
    ".oz-loc{font-size:11px;color:#16a34a}",
    ".oz-ico{font-size:12px}",
    ".oz-card{border-radius:12px;overflow:hidden;background:#fff;border:1px solid #bbf7d0;border-left:3px solid #4ade80}",
    ".oz-name{font-weight:700;font-size:13px;min-width:60px;color:#166534}",
    ".oz-track{background:#dcfce7;border-radius:99px}",
    ".oz-fill{background:linear-gradient(90deg,#22c55e,#4ade80,#a3e635);border-radius:99px}",
    ".oz-mini-num{color:#16a34a}",
    ".oz-cell{padding:7px 9px;border-radius:10px;background:#f0fdf4;border:1px solid #bbf7d0;font-size:11px}",
    ".oz-cell-v,.oz-cell-v .zb-value{color:#14532d!important;font-weight:600}",
    ".oz-chip{padding:4px 12px;border-radius:99px;font-size:10px;background:#dcfce7;color:#15803d;border:1px solid #4ade80}",
    ".oz-deco{background:#4ade80}",
    ".oz-deco-t{color:#16a34a;opacity:.65}",
    ".oz-foot{opacity:.75}",
    ".oz-fold-h{border-radius:12px;background:#dcfce7;border:1px solid #86efac;color:#166534}",
    ".oz-other{border-radius:12px;background:#fff;border:1px solid #bbf7d0}",
    ".oz-chip.done{background:#bbf7d0;color:#14532d}",
    ".oz-event-row{border-radius:10px;background:#f0fdf4;border:1px solid #bbf7d0}",
    ".oz-event-row.unlocked{border-color:#4ade80;background:#dcfce7}",
    ".oz-event-name{color:#15803d}",
    ".oz-event-status{color:#16a34a}",
    ".oz-cell-v .zb-value,.oz-other-v .zb-value{color:#14532d!important}",
    ".oz-others-sec,.oz-events-sec{border-top:1px solid rgba(74,222,128,.3)}"
  ].join('');
}
