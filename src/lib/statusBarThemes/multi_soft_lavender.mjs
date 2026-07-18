/**
 * 状态栏主题：软紫群像（lavender / multi）
 * softmon 信息架构 + 本族换皮 CSS
 */
import { renderSoftmonMulti } from './softmonLayout.mjs';

export const meta = {
  id: "multi_soft_lavender",
  label: "软紫群像",
  cast: "multi",
  family: "lavender",
  blurb: "星梦群像 · softmon 骨架",
  accent: "#c4b5fd",
};

const SKIN = {
  ns: "lav",
  footer: "DREAM CAST",
  icons: {"time":"✦","loc":"☾","events":"✧","others":"⋆"},
  accents: ["#c4b5fd","#a78bfa","#ddd6fe","#8b5cf6","#e9d5ff","#7c3aed"],
};

/** @param {object} opts */
export function render(opts) {
  return renderSoftmonMulti(opts, SKIN);
}

export function css() {
  return [
    ".zb-root{box-sizing:border-box;width:100%;max-width:720px;margin:0 auto;padding:12px;font-family:\"Segoe UI\",\"Microsoft YaHei\",sans-serif;font-size:12px;line-height:1.45;color:#ede9fe;background:radial-gradient(circle at 10% 20%,rgba(196,181,253,.2),transparent 40%),radial-gradient(circle at 90% 10%,rgba(167,139,250,.15),transparent 35%),linear-gradient(180deg,#1e1b4b,#312e81)}",
    ".zb-root *,.zb-root *:before,.zb-root *:after{box-sizing:border-box}",
    ".lav-empty{padding:20px;text-align:center;opacity:.5}",
    ".lav-world{flex:1;display:flex;flex-direction:column;gap:6px}",
    ".lav-world-primary,.lav-world-secondary{display:flex;align-items:center;gap:6px}",
    ".lav-ico{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;line-height:1;opacity:.85}",
    ".lav-chars{padding:8px}",
    ".lav-head{display:flex;align-items:center;gap:10px;padding:10px 12px}",
    ".lav-mini-bars{flex:1;display:flex;gap:8px;min-width:0}",
    ".lav-mini{flex:1;display:flex;align-items:center;gap:5px;min-width:0}",
    ".lav-mini-lab{font-size:10px;opacity:.6;min-width:14px}",
    ".lav-track{flex:1;height:4px;border-radius:2px;overflow:hidden;max-width:100%}",
    ".lav-fill{height:100%;border-radius:2px;transition:width .3s}",
    ".lav-mini-num{font-size:10px;font-weight:600;min-width:20px;text-align:right}",
    ".lav-detail{padding:0 12px 12px}",
    ".lav-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}",
    ".lav-cell.lav-full{grid-column:1/-1}",
    ".lav-cell-k{font-size:9px;opacity:.5;margin-bottom:2px}",
    ".lav-events-h,.lav-event-track-h{font-size:10px;opacity:.65;margin-bottom:6px;display:flex;align-items:center;gap:4px}",
    ".lav-chip-rail{display:flex;gap:8px;flex-wrap:wrap}",
    ".lav-chip b{font-weight:600;margin-right:2px}",
    ".lav-foot{margin-top:4px;padding:8px 0 6px;display:flex;justify-content:center;align-items:center;gap:8px}",
    ".lav-deco{height:1px;width:30px}",
    ".lav-deco-t{font-size:9px;letter-spacing:2px;font-weight:700}",
    ".lav-head{cursor:pointer;list-style:none}",
    ".lav-head::-webkit-details-marker{display:none}",
    ".lav-toggle{width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:5px solid currentColor;opacity:.45;margin-left:4px;transition:transform .2s;flex:0 0 auto}",
    "details.lav-card:not([open])>.lav-head .lav-toggle{transform:rotate(-90deg)}",
    ".lav-card{margin-bottom:6px}",
    ".lav-card:last-child{margin-bottom:0}",
    ".lav-name{color:var(--lav-accent)}",
    ".lav-card{border-left:3px solid var(--lav-accent)}",
    ".lav-others-sec,.lav-events-sec{padding:8px;border-top:1px solid rgba(128,128,128,.2)}",
    ".lav-fold-h{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;cursor:pointer;list-style:none;font-weight:600;font-size:12px}",
    ".lav-fold-h::-webkit-details-marker{display:none}",
    "details.lav-fold:not([open])>.lav-fold-h .lav-toggle{transform:rotate(-90deg)}",
    ".lav-others-list,.lav-events-list{padding:8px 0 0}",
    ".lav-other{margin-bottom:6px;padding:10px 12px;border-left:3px solid var(--lav-accent)}",
    ".lav-other:last-child{margin-bottom:0}",
    ".lav-other-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}",
    ".lav-other-name{color:var(--lav-accent)}",
    ".lav-other-favor{flex:1;display:flex;align-items:center;gap:6px;min-width:0}",
    ".lav-other-favor .lav-track{max-width:80px}",
    ".lav-other-lab{font-size:10px;opacity:.5}",
    ".lav-other-info{display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px}",
    ".lav-other-i.lav-full{grid-column:1/-1}",
    ".lav-other-v{opacity:.8}",
    ".lav-event-row{display:flex;align-items:center;padding:8px 12px;margin-bottom:4px;gap:10px}",
    ".lav-event-name{font-weight:600;font-size:11px;min-width:60px}",
    ".lav-event-status{flex:1;font-size:10px;text-align:right}",
    ".lav-panel{border-radius:18px;overflow:hidden;background:linear-gradient(145deg,rgba(196,181,253,.12),rgba(49,46,129,.5));border:1px solid rgba(196,181,253,.4);box-shadow:0 0 40px rgba(139,92,246,.15),inset 0 1px 0 rgba(255,255,255,.1)}",
    ".lav-top{padding:12px 16px;background:linear-gradient(90deg,rgba(196,181,253,.15),transparent);border-bottom:1px solid rgba(196,181,253,.25)}",
    ".lav-datetime{font-size:13px;font-weight:600;color:#ddd6fe;text-shadow:0 0 10px rgba(196,181,253,.4)}",
    ".lav-loc{font-size:11px;color:#c4b5fd}",
    ".lav-ico{color:#c4b5fd;font-size:12px;text-shadow:0 0 6px #a78bfa}",
    ".lav-card{border-radius:14px;overflow:hidden;background:rgba(255,255,255,.05);border:1px solid rgba(196,181,253,.25);border-left:3px solid #c4b5fd}",
    ".lav-name{font-weight:600;font-size:13px;min-width:60px;color:#e9d5ff}",
    ".lav-track{background:rgba(255,255,255,.1);border-radius:99px}",
    ".lav-fill{background:linear-gradient(90deg,#8b5cf6,#c4b5fd,#e9d5ff);border-radius:99px}",
    ".lav-mini-num{color:#c4b5fd}",
    ".lav-cell{padding:7px 9px;border-radius:12px;background:rgba(196,181,253,.08);border:1px solid rgba(196,181,253,.15);font-size:11px}",
    ".lav-cell-v,.lav-cell-v .zb-value{color:#ede9fe!important;font-weight:500}",
    ".lav-chip{padding:4px 12px;border-radius:99px;font-size:10px;background:rgba(167,139,250,.2);color:#ddd6fe;border:1px solid rgba(196,181,253,.35)}",
    ".lav-deco{background:linear-gradient(90deg,transparent,#c4b5fd,transparent)}",
    ".lav-deco-t{color:#c4b5fd;opacity:.6;letter-spacing:3px}",
    ".lav-foot{opacity:.7}",
    ".lav-fold-h{border-radius:12px;background:rgba(196,181,253,.1);border:1px solid rgba(196,181,253,.3);color:#e9d5ff}",
    ".lav-other{border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(196,181,253,.2)}",
    ".lav-chip.done{background:rgba(139,92,246,.25);color:#ddd6fe}",
    ".lav-event-row{border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(196,181,253,.15)}",
    ".lav-event-row.unlocked{background:rgba(167,139,250,.15);border-color:#c4b5fd}",
    ".lav-event-name{color:#c4b5fd}",
    ".lav-event-status{color:#ddd6fe}",
    ".lav-cell-v .zb-value,.lav-other-v .zb-value{color:#ede9fe!important}"
  ].join('');
}
