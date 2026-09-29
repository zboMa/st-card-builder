/** 主站顶栏读参数 announcement.topbar。空则不显示。 */
export async function loadAnnouncement() {
  var el = document.getElementById('appAnnouncement');
  if (!el) return;
  try {
    var res = await fetch('/api/data/announcement', { credentials: 'same-origin' });
    if (!res.ok) return;
    var data = await res.json();
    var text = String(data && data.text || '').trim();
    if (!text) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = text;
  } catch (e) {
    el.hidden = true;
  }
}
