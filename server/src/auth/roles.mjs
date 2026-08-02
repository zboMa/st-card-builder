/**
 * RBAC：权限点定义 + 角色存储 + 用户权限归并
 * 数据模型见 docs/systems/admin.md。
 * 兼容层：用户注册表无 roles[] 时回退 env 判定（ADMIN_DISCORD_IDS / ADMIN_EMAILS…），迁移平滑。
 */
import { ensureAdminDatabase, getUserRegistry } from '../couch.mjs';
import { isOpsAdmin, isAdminUser, getAdminRole } from '../config.mjs';

export var PERMS = {
  userDisable: 'admin.user.disable',
  shareToggle: 'admin.share.toggle',
  shareDelete: 'admin.share.delete',
  tokenRevoke: 'admin.token.revoke',
  tokenPurge: 'admin.token.purge',
  backupRun: 'admin.backup.run',
  cardRead: 'content.card.read',
  cardDisable: 'content.card.disable',
  cardDelete: 'content.card.delete',
  cardExport: 'content.card.export',
  novelRead: 'content.novel.read',
  novelDisable: 'content.novel.disable',
  novelDelete: 'content.novel.delete',
  novelExport: 'content.novel.export',
  shareContentDisable: 'content.share.disable',
  modReview: 'moderation.review',
  modApprove: 'moderation.approve',
  modResolve: 'moderation.resolve',
  roleManage: 'sys.role.manage',
  menuManage: 'sys.menu.manage',
  paramManage: 'sys.param.manage',
  dictManage: 'sys.dict.manage',
  logView: 'sys.log.view',
  taskManage: 'sys.task.manage',
  taskTrigger: 'sys.task.trigger',
  fileManage: 'sys.file.manage',
  inviteManage: 'sys.invite.manage',
  quotaManage: 'sys.quota.manage',
  backupManage: 'sys.backup.manage',
  monitorView: 'sys.monitor.view',
  userManage: 'sys.user.manage',
};

export var ALL_PERMS = Object.keys(PERMS).map(function(k) { return PERMS[k]; });

/** 内置角色定义（role/ 文档缺失时的兜底 + seed 来源） */
export var BUILTIN_ROLES = {
  ops: {
    id: 'ops',
    name: '运维管理员',
    desc: '拥有全部后台权限（含内容处置与系统管理）',
    perms: ALL_PERMS.slice(),
    builtin: true,
  },
  readonly: {
    id: 'readonly',
    name: '只读管理员',
    desc: '仅查看仪表盘 / 列表 / 日志与监控',
    perms: [PERMS.logView, PERMS.monitorView],
    builtin: true,
  },
};

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

/** 幂等：把内置角色写入 stcb-admin（启动时调用） */
export async function seedRoles() {
  var db = await ensureAdminDatabase();
  var now = new Date().toISOString();
  var results = [];
  for (var key in BUILTIN_ROLES) {
    var r = BUILTIN_ROLES[key];
    var doc = {
      _id: 'role/' + r.id,
      type: 'role',
      id: r.id,
      name: r.name,
      desc: r.desc,
      perms: r.perms.slice(),
      builtin: true,
      updatedAt: now,
      createdAt: now,
    };
    await forcePut(db, doc);
    results.push(r.id);
  }
  return results;
}

export async function listRoles() {
  var db = await ensureAdminDatabase();
  var res = await db.list({ include_docs: true, startkey: 'role/', endkey: 'role/\ufff0' });
  return (res.rows || []).map(function(r) { return r.doc; }).filter(Boolean);
}

export async function getRole(id) {
  var db = await ensureAdminDatabase();
  try {
    return await db.get('role/' + String(id || ''));
  } catch (e) {
    if (e && e.statusCode === 404) return BUILTIN_ROLES[id] || null;
    throw e;
  }
}

/** 过滤非法权限点（纯函数，便于单测） */
export function sanitizePerms(perms) {
  var seen = {};
  return (Array.isArray(perms) ? perms : []).filter(function(p) {
    if (ALL_PERMS.indexOf(p) < 0) return false;
    if (seen[p]) return false;
    seen[p] = true;
    return true;
  });
}

export async function putRole(roleDoc) {
  if (!roleDoc || !roleDoc.id) throw new Error('missing_role_id');
  var db = await ensureAdminDatabase();
  var existing = null;
  try { existing = await db.get('role/' + roleDoc.id); } catch (e) {
    if (!e || e.statusCode !== 404) throw e;
  }
  var doc = {
    _id: 'role/' + roleDoc.id,
    type: 'role',
    id: roleDoc.id,
    name: String(roleDoc.name || roleDoc.id),
    desc: String(roleDoc.desc || ''),
    perms: sanitizePerms(roleDoc.perms),
    builtin: !!(existing && existing.builtin),
    updatedAt: new Date().toISOString(),
  };
  if (existing) doc.createdAt = existing.createdAt;
  else doc.createdAt = doc.updatedAt;
  if (existing) doc._rev = existing._rev;
  await db.insert(doc);
  return doc;
}

export async function deleteRole(id) {
  var r = await getRole(id);
  if (r && r.builtin) {
    var err = new Error('builtin_role');
    err.code = 'builtin_role';
    throw err;
  }
  var db = await ensureAdminDatabase();
  try {
    var doc = await db.get('role/' + String(id || ''));
    await db.destroy(doc._id, doc._rev);
  } catch (e) {
    if (!e || e.statusCode !== 404) throw e;
  }
  return { ok: true };
}

/**
 * 解析用户角色列表
 * 优先注册表 roles[]；为空时回退 env 判定（ops → ['ops']，readonly → ['readonly']）。
 */
export async function rolesForUser(user) {
  if (!user || !user.id) return [];
  if (!isAdminUser(user)) return [];
  var roles = [];
  try {
    var reg = await getUserRegistry(user.id);
    if (reg && Array.isArray(reg.roles) && reg.roles.length) {
      roles = reg.roles.slice();
    }
  } catch (e) { /* ignore */ }
  if (!roles.length) {
    var role = getAdminRole(user);
    if (role) roles = [role];
  }
  return roles.filter(Boolean);
}

/** 归并角色权限点（去重） */
export async function permsForUser(user) {
  var roles = await rolesForUser(user);
  var set = {};
  for (var i = 0; i < roles.length; i++) {
    var r = await getRole(roles[i]);
    if (r && Array.isArray(r.perms)) {
      r.perms.forEach(function(p) { set[p] = true; });
    }
  }
  return Object.keys(set);
}

/** 便捷：判断用户是否拥有某权限点 */
export async function hasPerm(user, perm) {
  var perms = await permsForUser(user);
  return perms.indexOf(perm) >= 0;
}

/** Express 中间件：要求指定权限点 */
export function requirePerm(perm) {
  return function(req, res, next) {
    var user = req.session && req.session.user;
    if (!user) return res.status(401).json({ error: 'unauthorized' });
    if (!isAdminUser(user)) {
      return res.status(403).json({ error: 'forbidden', message: '非管理员' });
    }
    permsForUser(user).then(function(perms) {
      if (perms.indexOf(perm) < 0) {
        return res.status(403).json({ error: 'forbidden', message: '权限不足：' + perm, perm: perm });
      }
      req.adminRole = getAdminRole(user);
      req.perms = perms;
      next();
    }).catch(function(e) {
      console.error('[roles/requirePerm]', e);
      res.status(500).json({ error: 'auth_failed' });
    });
  };
}

/** Express 中间件：要求任一写权限存在（前台逻辑层的 admin 门禁） */
export function requireAnyWritePerm() {
  return requirePerm(ALL_PERMS[0]);
}
