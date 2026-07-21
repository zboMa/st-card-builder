/**
 * 旧 localStorage / IndexedDB → Pouch 一次性迁移
 */
import { DOC, buildCardIndexFromDrafts, novelDocId, storyCatalogDocId, storyNovelDocId, storyActiveDocId, ragDocId } from './docIds.mjs';
import { getLocalDb, putDoc, getDoc } from './pouch.mjs';

var DRAFTS_KEY = 'st_v3_builder_drafts';
var PROMPTS_KEY = 'st_v3_builder_prompts';

export async function isMigrationDone() {
  var doc = await getDoc(DOC.migration);
  return !!(doc && doc.done);
}

/**
 * @param {{ idbGetJson?: Function }} bridges 可选注入 IDB 读取
 */
export async function migrateLegacyToPouch(bridges) {
  bridges = bridges || {};
  if (await isMigrationDone()) {
    return { skipped: true };
  }
  var report = { cards: 0, novels: 0, stories: 0, prompts: false };

  var drafts = {};
  try {
    drafts = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}') || {};
  } catch (e) {
    drafts = {};
  }

  var ids = Object.keys(drafts);
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    var d = drafts[id];
    await putDoc({
      _id: 'card/' + id,
      type: 'card',
      cardId: id,
      data: d,
      updatedAt: (d && d.updatedAt) || new Date().toISOString(),
    });
    report.cards++;

    if (typeof bridges.idbGetJson === 'function') {
      try {
        var novel = await bridges.idbGetJson('novelWorkshopV3:card:' + id);
        if (novel) {
          await putDoc({
            _id: novelDocId(id),
            type: 'novel',
            cardId: id,
            data: novel.data != null ? novel.data : novel,
            updatedAt: novel.updatedAt || new Date().toISOString(),
          });
          report.novels++;
        }
      } catch (e) { /* ignore */ }

      try {
        var rag = await bridges.idbGetJson('novelRagV1:card:' + id);
        if (rag) {
          await putDoc({
            _id: ragDocId(id),
            type: 'rag',
            cardId: id,
            data: rag.data != null ? rag.data : rag,
            updatedAt: rag.updatedAt || new Date().toISOString(),
          });
        }
      } catch (e) { /* ignore */ }

      try {
        var catalog = await bridges.idbGetJson('storyStudioV1:catalog:card:' + id);
        if (catalog) {
          await putDoc({
            _id: storyCatalogDocId(id),
            type: 'story-catalog',
            cardId: id,
            data: catalog.data != null ? catalog.data : catalog,
            updatedAt: catalog.updatedAt || new Date().toISOString(),
          });
          var novels = (catalog.data && catalog.data.novels) || catalog.novels || [];
          if (Array.isArray(novels)) {
            for (var j = 0; j < novels.length; j++) {
              var nid = novels[j] && (novels[j].id || novels[j].novelId);
              if (!nid) continue;
              try {
                var sn = await bridges.idbGetJson('storyStudioV1:card:' + id + ':' + nid);
                if (sn) {
                  await putDoc({
                    _id: storyNovelDocId(id, nid),
                    type: 'story-novel',
                    cardId: id,
                    novelId: nid,
                    data: sn.data != null ? sn.data : sn,
                    updatedAt: sn.updatedAt || new Date().toISOString(),
                  });
                  report.stories++;
                }
              } catch (e2) { /* ignore */ }
            }
          }
        }
        var active = await bridges.idbGetJson('storyStudioV1:active:card:' + id);
        if (active) {
          await putDoc({
            _id: storyActiveDocId(id),
            type: 'story-active',
            cardId: id,
            data: active.data != null ? active.data : active,
            updatedAt: active.updatedAt || new Date().toISOString(),
          });
        }
      } catch (e) { /* ignore */ }
    }
  }

  await putDoc(buildCardIndexFromDrafts(drafts));

  try {
    var prompts = JSON.parse(localStorage.getItem(PROMPTS_KEY) || 'null');
    if (prompts) {
      await putDoc({
        _id: DOC.prompts,
        type: 'prompts',
        data: prompts,
        updatedAt: new Date().toISOString(),
      });
      report.prompts = true;
    }
  } catch (e) { /* ignore */ }

  // 注意：不迁移 AI key（secrets 默认不上云，也不自动进 pouch，除非用户显式操作）
  await putDoc({
    _id: DOC.migration,
    type: 'migration',
    done: true,
    at: new Date().toISOString(),
    report: report,
  });

  await getLocalDb(); // warm
  return report;
}
