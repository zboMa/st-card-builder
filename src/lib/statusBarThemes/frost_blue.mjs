/**
 * 状态栏主题：毛玻璃蓝（frost / single）
 * softmon 信息架构 + 本族换皮 CSS
 */
import { renderSoftmonSingle } from './softmonLayout.mjs';

export const meta = {
  id: "frost_blue",
  label: "毛玻璃蓝",
  cast: "single",
  family: "frost",
  blurb: "蓝白毛玻璃 blur · softmon 骨架",
  accent: "#60a5fa",
};

const SKIN = {
  ns: "fr",
  footer: "FROST",
  icons: {"time":"❄","loc":"◇","events":"✧","others":"○"},
  accents: ["#60a5fa","#93c5fd","#38bdf8","#818cf8","#7dd3fc","#a5b4fc"],
};

/** @param {object} opts */
export function render(opts) {
  return renderSoftmonSingle(opts, SKIN);
}

export function css() {
  return [
    ".zb-root{box-sizing:border-box;width:100%;max-width:720px;margin:0 auto;padding:12px;font-family:\"Segoe UI\",\"Microsoft YaHei\",sans-serif;font-size:12px;line-height:1.45;color:#e0f2fe;background:linear-gradient(160deg,#0c1929,#1e3a5f 40%,#172554)}",
    ".zb-root *,.zb-root *:before,.zb-root *:after{box-sizing:border-box}",
    ".fr-empty{padding:20px;text-align:center;opacity:.5}",
    ".fr-world{flex:1;display:flex;flex-direction:column;gap:6px}",
    ".fr-world-primary,.fr-world-secondary{display:flex;align-items:center;gap:6px}",
    ".fr-ico{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;line-height:1;opacity:.85}",
    ".fr-chars{padding:8px}",
    ".fr-head{display:flex;align-items:center;gap:10px;padding:10px 12px}",
    ".fr-mini-bars{flex:1;display:flex;gap:8px;min-width:0}",
    ".fr-mini{flex:1;display:flex;align-items:center;gap:5px;min-width:0}",
    ".fr-mini-lab{font-size:10px;opacity:.6;min-width:14px}",
    ".fr-track{flex:1;height:4px;border-radius:2px;overflow:hidden;max-width:100%}",
    ".fr-fill{height:100%;border-radius:2px;transition:width .3s}",
    ".fr-mini-num{font-size:10px;font-weight:600;min-width:20px;text-align:right}",
    ".fr-detail{padding:0 12px 12px}",
    ".fr-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}",
    ".fr-cell.fr-full{grid-column:1/-1}",
    ".fr-cell-k{font-size:9px;opacity:.5;margin-bottom:2px}",
    ".fr-events-h,.fr-event-track-h{font-size:10px;opacity:.65;margin-bottom:6px;display:flex;align-items:center;gap:4px}",
    ".fr-chip-rail{display:flex;gap:8px;flex-wrap:wrap}",
    ".fr-chip b{font-weight:600;margin-right:2px}",
    ".fr-foot{margin-top:4px;padding:8px 0 6px;display:flex;justify-content:center;align-items:center;gap:8px}",
    ".fr-deco{height:1px;width:30px}",
    ".fr-deco-t{font-size:9px;letter-spacing:2px;font-weight:700}",
    ".fr-panel{border-radius:18px;overflow:hidden;background:rgba(255,255,255,.08);border:1px solid rgba(147,197,253,.35);box-shadow:0 8px 32px rgba(0,0,0,.25);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}",
    ".fr-top{padding:12px 16px;background:rgba(255,255,255,.06);border-bottom:1px solid rgba(147,197,253,.2)}",
    ".fr-datetime{font-size:13px;font-weight:600;color:#93c5fd}",
    ".fr-loc{font-size:11px;color:#bfdbfe}",
    ".fr-ico{color:#60a5fa;font-size:12px}",
    ".fr-card{border-radius:14px;overflow:hidden;background:rgba(255,255,255,.07);border:1px solid rgba(147,197,253,.25);border-left:3px solid #60a5fa;backdrop-filter:blur(8px)}",
    ".fr-name{font-weight:600;font-size:13px;min-width:60px;color:#bfdbfe}",
    ".fr-track{background:rgba(255,255,255,.12);border-radius:99px}",
    ".fr-fill{background:linear-gradient(90deg,#60a5fa,#93c5fd);border-radius:99px}",
    ".fr-mini-num{color:#60a5fa}",
    ".fr-cell{padding:7px 9px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(147,197,253,.15);font-size:11px}",
    ".fr-cell-v,.fr-cell-v .zb-value{color:#e0f2fe!important;font-weight:500}",
    ".fr-chip{padding:4px 12px;border-radius:99px;font-size:10px;background:rgba(96,165,250,.18);color:#bfdbfe;border:1px solid rgba(96,165,250,.35)}",
    ".fr-deco{background:rgba(147,197,253,.6)}",
    ".fr-deco-t{color:#93c5fd;opacity:.55;font-family:Segoe UI,sans-serif}",
    ".fr-foot{opacity:.7}"
  ].join('');
}
