/**
 * 状态栏主题：冬雪玻璃（snow / single）
 * softmon 信息架构 + 本族换皮 CSS
 */
import { renderSoftmonSingle } from './softmonLayout.mjs';

export const meta = {
  id: "snow_glass",
  label: "冬雪玻璃",
  cast: "single",
  family: "snow",
  blurb: "冰蓝冬雪 · softmon 骨架",
  accent: "#7dd3fc",
};

const SKIN = {
  ns: "sn",
  footer: "SNOW",
  icons: {"time":"❅","loc":"❄","events":"✦","others":"⁕"},
  accents: ["#7dd3fc","#bae6fd","#38bdf8","#e0f2fe","#0ea5e9","#a5f3fc"],
};

/** @param {object} opts */
export function render(opts) {
  return renderSoftmonSingle(opts, SKIN);
}

export function css() {
  return [
    ".zb-root{box-sizing:border-box;width:100%;max-width:720px;margin:0 auto;padding:12px;font-family:\"Segoe UI\",\"Microsoft YaHei\",sans-serif;font-size:12px;line-height:1.45;color:#0c4a6e;background:radial-gradient(circle at 20% 20%,rgba(255,255,255,.9),transparent 40%),linear-gradient(180deg,#e0f2fe,#f0f9ff)}",
    ".zb-root *,.zb-root *:before,.zb-root *:after{box-sizing:border-box}",
    ".sn-empty{padding:20px;text-align:center;opacity:.5}",
    ".sn-world{flex:1;display:flex;flex-direction:column;gap:6px}",
    ".sn-world-primary,.sn-world-secondary{display:flex;align-items:center;gap:6px}",
    ".sn-ico{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;line-height:1;opacity:.85}",
    ".sn-chars{padding:8px}",
    ".sn-head{display:flex;align-items:center;gap:10px;padding:10px 12px}",
    ".sn-mini-bars{flex:1;display:flex;gap:8px;min-width:0}",
    ".sn-mini{flex:1;display:flex;align-items:center;gap:5px;min-width:0}",
    ".sn-mini-lab{font-size:10px;opacity:.6;min-width:14px}",
    ".sn-track{flex:1;height:4px;border-radius:2px;overflow:hidden;max-width:100%}",
    ".sn-fill{height:100%;border-radius:2px;transition:width .3s}",
    ".sn-mini-num{font-size:10px;font-weight:600;min-width:20px;text-align:right}",
    ".sn-detail{padding:0 12px 12px}",
    ".sn-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}",
    ".sn-cell.sn-full{grid-column:1/-1}",
    ".sn-cell-k{font-size:9px;opacity:.5;margin-bottom:2px}",
    ".sn-events-h,.sn-event-track-h{font-size:10px;opacity:.65;margin-bottom:6px;display:flex;align-items:center;gap:4px}",
    ".sn-chip-rail{display:flex;gap:8px;flex-wrap:wrap}",
    ".sn-chip b{font-weight:600;margin-right:2px}",
    ".sn-foot{margin-top:4px;padding:8px 0 6px;display:flex;justify-content:center;align-items:center;gap:8px}",
    ".sn-deco{height:1px;width:30px}",
    ".sn-deco-t{font-size:9px;letter-spacing:2px;font-weight:700}",
    ".sn-panel{border-radius:16px;overflow:hidden;background:rgba(255,255,255,.65);border:1px solid rgba(125,211,252,.6);box-shadow:0 8px 28px rgba(14,165,233,.12);backdrop-filter:blur(10px)}",
    ".sn-top{padding:12px 16px;background:linear-gradient(90deg,rgba(186,230,253,.5),rgba(255,255,255,.3));border-bottom:1px solid rgba(125,211,252,.4)}",
    ".sn-datetime{font-size:13px;font-weight:600;color:#0284c7}",
    ".sn-loc{font-size:11px;color:#0ea5e9}",
    ".sn-ico{color:#38bdf8;font-size:12px;text-shadow:0 0 6px #fff}",
    ".sn-card{border-radius:12px;overflow:hidden;background:rgba(255,255,255,.7);border:1px solid rgba(125,211,252,.45);border-left:3px solid #7dd3fc}",
    ".sn-name{font-weight:600;font-size:13px;min-width:60px;color:#0369a1}",
    ".sn-track{background:rgba(186,230,253,.5);border-radius:99px}",
    ".sn-fill{background:linear-gradient(90deg,#7dd3fc,#38bdf8,#bae6fd);border-radius:99px}",
    ".sn-mini-num{color:#0284c7}",
    ".sn-cell{padding:7px 9px;border-radius:10px;background:rgba(240,249,255,.8);border:1px solid rgba(186,230,253,.6);font-size:11px}",
    ".sn-cell-v,.sn-cell-v .zb-value{color:#0c4a6e!important;font-weight:500}",
    ".sn-chip{padding:4px 12px;border-radius:99px;font-size:10px;background:rgba(186,230,253,.5);color:#0369a1;border:1px solid #7dd3fc}",
    ".sn-deco{background:#7dd3fc}",
    ".sn-deco-t{color:#0ea5e9;opacity:.6}",
    ".sn-foot{opacity:.7}"
  ].join('');
}
