/**
 * 云端存储：用户偏好（拆自 cloudStore）
 */
import * as api from './cloudApi.mjs';
import { withCloudOrOutbox } from './cloudStoreShared.mjs';

export async function cloudSavePrefs(kind, data) {
  return withCloudOrOutbox('putPrefs', function() {
    return api.putPrefs(kind, data);
  }, {
    op: 'putPrefs',
    body: { kind: kind, data: data },
    dedupeKey: 'putPrefs:' + kind,
  });
}
