/**
 * 按下架 / 硬删除停掉或删掉对应分享映射。恢复内容时不自动重新打开。
 */
import { ensureSharesDatabase } from '../couch.mjs';

async function scanShares(onDoc) {
  var db = await ensureSharesDatabase();
  var start = 'share/';
  var scanned = 0;
  var capped = false;
  for (var page = 0; page < 40; page++) {
    var res = await db.list({
      include_docs: true,
      startkey: start,
      endkey: 'share/\ufff0',
      limit: 500,
    });
    var rows = res.rows || [];
    if (!rows.length) break;
    for (var i = 0; i < rows.length; i++) {
      var doc = rows[i] && rows[i].doc;
      if (!doc) continue;
      scanned += 1;
      await onDoc(db, doc);
    }
    if (rows.length < 500) break;
    start = String(rows[rows.length - 1].id || '') + '\0';
    if (page === 39) capped = true;
  }
  return { scanned: scanned, capped: capped };
}

export async function stopMatchingShares(pred) {
  var stopped = 0;
  var scan = await scanShares(async function(db, doc) {
    if (!pred(doc) || doc.enabled === false) return;
    doc.enabled = false;
    doc.disabledAt = new Date().toISOString();
    doc.disabledBy = 'moderation';
    await db.insert(doc);
    stopped += 1;
  });
  return { stopped: stopped, scanned: scan.scanned, capped: scan.capped };
}

export async function deleteMatchingShares(pred) {
  var removed = 0;
  var scan = await scanShares(async function(db, doc) {
    if (!pred(doc)) return;
    await db.destroy(doc._id, doc._rev);
    removed += 1;
  });
  return { removed: removed, scanned: scan.scanned, capped: scan.capped };
}
