/**
 * 菜单管理（stcb-admin 库 menu/ 文档）
 * 导航数据驱动：前端从 /api/admin/menus 拉取并按 perm 过滤渲染。
 * 数据模型见 docs/systems/admin.md。
 */
import { ensureAdminDatabase } from '../couch.mjs';
import { nextMenuParent, menuCanDelete, menuCanSave } from './deskLogic.mjs';

var SEED_MENUS = [
  { id: 'dashboard', name: '仪表盘', parentId: '', perm: '', order: 10 },
  { id: 'group-people', name: '用户与权限', parentId: '', perm: '', order: 20, group: true },
  { id: 'group-content', name: '内容', parentId: '', perm: '', order: 30, group: true },
  { id: 'group-run', name: '运行', parentId: '', perm: '', order: 40, group: true },
  { id: 'users', name: '用户', parentId: 'group-people', perm: '', order: 10 },
  { id: 'quota', name: '配额', parentId: 'group-people', perm: '', order: 20 },
  { id: 'tokens', name: '插件 Token', parentId: 'group-people', perm: '', order: 30 },
  { id: 'invites', name: '邀请码', parentId: 'group-people', perm: 'sys.invite.manage', order: 40 },
  { id: 'roles', name: '角色', parentId: 'group-people', perm: 'sys.role.manage', order: 50 },
  { id: 'loginlog', name: '登录日志', parentId: 'group-people', perm: 'sys.log.view', order: 60 },
  { id: 'cards', name: '卡', parentId: 'group-content', perm: 'content.card.read', order: 10 },
  { id: 'novels', name: '小说', parentId: 'group-content', perm: 'content.novel.read', order: 20 },
  { id: 'shares', name: '分享', parentId: 'group-content', perm: '', order: 30 },
  { id: 'moderation', name: '审核', parentId: 'group-content', perm: 'moderation.review', order: 40 },
  { id: 'tasks', name: '定时任务', parentId: 'group-run', perm: 'sys.task.manage', order: 10 },
  { id: 'backup', name: '备份', parentId: 'group-run', perm: 'sys.backup.manage', order: 20 },
  { id: 'databases', name: 'Couch', parentId: 'group-run', perm: '', order: 30 },
  { id: 'audit', name: '审计', parentId: 'group-run', perm: '', order: 40 },
  { id: 'oplog', name: '操作日志', parentId: 'group-run', perm: 'sys.log.view', order: 50 },
  { id: 'params', name: '参数', parentId: 'group-run', perm: 'sys.param.manage', order: 60 },
  { id: 'dicts', name: '字典', parentId: 'group-run', perm: 'sys.dict.manage', order: 70 },
  { id: 'files', name: '文件', parentId: 'group-run', perm: 'sys.file.manage', order: 80 },
  { id: 'menus', name: '菜单', parentId: 'group-run', perm: 'sys.menu.manage', order: 90 },
  { id: 'system', name: '进程', parentId: 'group-run', perm: '', order: 100 },
];

function forcePut(db, doc) {
  return db.insert(doc).then(function() { return true; }, function(e) {
    if (!e || e.statusCode !== 409) throw e;
    return db.get(doc._id).then(function(ex) {
      return db.insert(Object.assign({}, doc, { _rev: ex._rev })).then(function() { return true; });
    }, function(e2) {
      if (e2 && e2.statusCode === 404) return db.insert(doc).then(function() { return true; });
      throw e2;
    });
  });
}

function getOrNull(db, id) {
  return db.get(String(id || '')).then(function(d) { return d; }, function(e) {
    if (e && e.statusCode === 404) return null;
    throw e;
  });
}

/** 幂等 seed：仅当菜单不存在时创建（不覆盖管理员已改的） */
export async function seedMenus() {
  var db = await ensureAdminDatabase();
  var seeded = [];
  for (var i = 0; i < SEED_MENUS.length; i++) {
    var m = SEED_MENUS[i];
    var existing = await getOrNull(db, 'menu/' + m.id);
    if (existing) {
      var mig = nextMenuParent(existing, m.parentId || '');
      if (mig.update) {
        existing.parentId = mig.parentId;
        existing.parentMigrated = true;
        existing.updatedAt = new Date().toISOString();
        await forcePut(db, existing);
      }
      continue;
    }
    var doc = {
      _id: 'menu/' + m.id,
      type: 'menu',
      id: m.id,
      name: m.name,
      parentId: m.parentId || '',
      perm: m.perm || '',
      group: !!m.group,
      order: Number(m.order) || 0,
      parentMigrated: true,
      createdAt: new Date().toISOString(),
    };
    await forcePut(db, doc);
    seeded.push(m.id);
  }
  return seeded;
}

export async function listMenus() {
  var db = await ensureAdminDatabase();
  var res = await db.list({ include_docs: true, startkey: 'menu/', endkey: 'menu/\ufff0' });
  return (res.rows || []).map(function(r) { return r.doc; }).filter(Boolean);
}

export async function putMenu(menuDoc) {
  var check = menuCanSave(menuDoc);
  if (!check.ok) throw Object.assign(new Error(check.error), { statusCode: 400 });
  var db = await ensureAdminDatabase();
  var id = 'menu/' + menuDoc.id;
  var existing = await getOrNull(db, id);
  var doc = {
    _id: id,
    type: 'menu',
    id: String(menuDoc.id),
    name: String(menuDoc.name || menuDoc.id),
    parentId: String(menuDoc.parentId || ''),
    perm: String(menuDoc.perm || ''),
    group: !!menuDoc.group,
    order: Number(menuDoc.order) || 0,
    parentMigrated: true,
    updatedAt: new Date().toISOString(),
  };
  if (existing) { doc.createdAt = existing.createdAt; doc._rev = existing._rev; }
  else doc.createdAt = doc.updatedAt;
  await db.insert(doc);
  return doc;
}

export async function deleteMenu(id) {
  if (!menuCanDelete(id)) {
    throw Object.assign(new Error('builtin_menu'), { statusCode: 400 });
  }
  var db = await ensureAdminDatabase();
  var doc = await getOrNull(db, 'menu/' + String(id || ''));
  if (doc) await db.destroy(doc._id, doc._rev);
  return { ok: true };
}
