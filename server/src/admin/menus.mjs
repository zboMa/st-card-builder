/**
 * 菜单管理（stcb-admin 库 menu/ 文档）
 * 导航数据驱动：前端从 /api/admin/menus 拉取并按 perm 过滤渲染。
 * 数据模型见 docs/systems/admin.md。
 */
import { ensureAdminDatabase } from '../couch.mjs';

var SEED_MENUS = [
  { id: 'dashboard', name: '仪表盘', parentId: '', perm: '', order: 10 },
  { id: 'users', name: '用户', parentId: '', perm: '', order: 20 },
  { id: 'cards', name: '卡管理', parentId: '', perm: 'content.card.read', order: 25 },
  { id: 'novels', name: '小说管理', parentId: '', perm: 'content.novel.read', order: 35 },
  { id: 'shares', name: '分享', parentId: '', perm: '', order: 40 },
  { id: 'tokens', name: '插件 Token', parentId: '', perm: '', order: 40 },
  { id: 'databases', name: 'Couch 库', parentId: '', perm: '', order: 50 },
  { id: 'moderation', name: '审核', parentId: '', perm: 'moderation.review', order: 55 },
  { id: 'audit', name: '审计', parentId: '', perm: '', order: 60 },
  { id: 'system', name: '系统', parentId: '', perm: '', order: 70 },
  { id: 'sys-group', name: '系统管理', parentId: '', perm: '', order: 80, group: true },
  { id: 'roles', name: '角色管理', parentId: 'sys-group', perm: 'sys.role.manage', order: 10 },
  { id: 'menus', name: '菜单管理', parentId: 'sys-group', perm: 'sys.menu.manage', order: 20 },
  { id: 'oplog', name: '操作日志', parentId: 'sys-group', perm: 'sys.log.view', order: 30 },
  { id: 'loginlog', name: '登录日志', parentId: 'sys-group', perm: 'sys.log.view', order: 40 },
  { id: 'params', name: '参数管理', parentId: 'sys-group', perm: 'sys.param.manage', order: 50 },
  { id: 'dicts', name: '数据字典', parentId: 'sys-group', perm: 'sys.dict.manage', order: 60 },
  { id: 'invites', name: '邀请码', parentId: 'sys-group', perm: 'sys.invite.manage', order: 70 },
  { id: 'quota', name: '配额概览', parentId: 'sys-group', perm: '', order: 80 },
  { id: 'files', name: '文件管理', parentId: 'sys-group', perm: 'sys.file.manage', order: 90 },
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
    if (existing) continue;
    var doc = {
      _id: 'menu/' + m.id,
      type: 'menu',
      id: m.id,
      name: m.name,
      parentId: m.parentId || '',
      perm: m.perm || '',
      group: !!m.group,
      order: Number(m.order) || 0,
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
  if (!menuDoc || !menuDoc.id) throw new Error('missing_menu_id');
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
    updatedAt: new Date().toISOString(),
  };
  if (existing) { doc.createdAt = existing.createdAt; doc._rev = existing._rev; }
  else doc.createdAt = doc.updatedAt;
  await db.insert(doc);
  return doc;
}

export async function deleteMenu(id) {
  var db = await ensureAdminDatabase();
  var doc = await getOrNull(db, 'menu/' + String(id || ''));
  if (doc) await db.destroy(doc._id, doc._rev);
  return { ok: true };
}
