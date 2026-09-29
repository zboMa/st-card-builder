/**
 * 管理端页面纯函数：配额五行、侧栏分组、字典回退、上限提示。
 * 不碰 DOM。
 */

export var DICT_FALLBACK = {
  'user.status': [
    { value: 'all', label: '全部' },
    { value: 'active', label: '正常' },
    { value: 'disabled', label: '已禁用' },
  ],
  'share.type': [
    { value: 'all', label: '全部' },
    { value: 'card-share', label: '卡' },
    { value: 'novel-share', label: '小说' },
  ],
  'share.status': [
    { value: 'all', label: '全部' },
    { value: 'active', label: '有效' },
    { value: 'disabled', label: '已停' },
    { value: 'expired', label: '已过期' },
  ],
  'moderation.status': [
    { value: 'open', label: '待处理' },
    { value: 'resolved', label: '已处理' },
  ],
  'audit.action': [
    { value: '', label: '全部动作' },
    { value: 'user.disable', label: '禁用用户' },
    { value: 'user.enable', label: '启用用户' },
    { value: 'content.card.disable', label: '下架卡' },
    { value: 'content.card.restore', label: '恢复卡' },
    { value: 'content.novel.disable', label: '下架小说' },
    { value: 'share.disable', label: '停用分享' },
    { value: 'share.force_delete', label: '删除分享映射' },
  ],
};

export var PERM_LABELS = {
  'admin.user.disable': '禁用或启用用户',
  'admin.share.toggle': '停用或恢复分享',
  'admin.share.delete': '删除分享映射',
  'admin.token.revoke': '撤销插件 Token',
  'admin.token.purge': '清理过期 Token',
  'admin.backup.run': '立即备份',
  'content.card.read': '查看卡',
  'content.card.disable': '下架或恢复卡',
  'content.card.delete': '申请删除卡',
  'content.card.export': '导出卡',
  'content.novel.read': '查看小说',
  'content.novel.disable': '下架或恢复小说',
  'content.novel.delete': '申请删除小说',
  'content.novel.export': '导出小说',
  'content.share.disable': '按内容停分享',
  'moderation.review': '处理举报',
  'moderation.approve': '审批删除',
  'moderation.resolve': '结案',
  'sys.role.manage': '管理角色',
  'sys.menu.manage': '管理菜单',
  'sys.param.manage': '修改参数',
  'sys.dict.manage': '修改字典',
  'sys.log.view': '查看日志',
  'sys.task.manage': '开关定时任务',
  'sys.task.trigger': '立即执行任务',
  'sys.file.manage': '管理文件',
  'sys.invite.manage': '管理邀请码',
  'sys.quota.manage': '修改配额档位',
  'sys.backup.manage': '查看备份',
  'sys.monitor.view': '查看监控',
  'sys.user.manage': '重置密码与角色',
};

export var DICT_TYPES = [
  { type: 'user.status', label: '用户状态' },
  { type: 'share.type', label: '分享类型' },
  { type: 'share.status', label: '分享状态' },
  { type: 'moderation.status', label: '审核状态' },
  { type: 'audit.action', label: '审计动作' },
];

export var MENU_LOCKED = [
  'dashboard', 'users', 'cards', 'novels', 'shares', 'tokens', 'databases',
  'moderation', 'audit', 'system', 'roles', 'menus', 'oplog', 'loginlog',
  'params', 'dicts', 'invites', 'quota', 'files', 'tasks', 'backup',
  'group-people', 'group-content', 'group-run',
];

export function dictOptions(type, items) {
  var fallback = DICT_FALLBACK[type] || [];
  var list = (items || []).filter(function(it) {
    return it && it.value != null && String(it.value) !== '';
  });
  if (!list.length) return fallback.slice();
  return list.map(function(it) {
    return { value: String(it.value), label: String(it.label || it.value) };
  });
}

export function capNote(capped, cap) {
  if (!capped) return '';
  return '只列出前 ' + (cap || 0) + ' 条';
}

export function quotaRows(snapshot) {
  var use = (snapshot && snapshot.usage) || {};
  var lim = (snapshot && snapshot.limits) || {};
  var spec = [
    ['cardsOnCloud', '卡数', false],
    ['cloudBytes', '容量', true],
    ['activeShares', '有效分享', false],
    ['bearerTokens', 'Token', false],
    ['storyNovels', '小说', false],
  ];
  return spec.map(function(row) {
    var used = Number(use[row[0]]) || 0;
    var limit = lim[row[0]];
    var finite = Number.isFinite(limit);
    return {
      key: row[0],
      label: row[1],
      bytes: row[2],
      used: used,
      limit: finite ? limit : null,
      unlimited: !finite,
      over: finite && used > limit,
    };
  });
}

export function sortCardsByBytes(cards) {
  return (cards || []).slice().sort(function(a, b) {
    return (Number(b && b.bundleBytes) || 0) - (Number(a && a.bundleBytes) || 0);
  });
}

export function sidebarGroups(menus) {
  var list = (menus || []).slice().sort(function(a, b) {
    return (Number(a.order) || 0) - (Number(b.order) || 0);
  });
  var groups = list.filter(function(m) { return m.group; });
  var tops = list.filter(function(m) { return !m.parentId && !m.group; });
  return {
    tops: tops,
    groups: groups.map(function(g) {
      return {
        id: g.id,
        name: g.name,
        children: list.filter(function(c) { return c.parentId === g.id && !c.group; }),
      };
    }).filter(function(g) { return g.children.length; }),
  };
}

export function permLabel(code) {
  return PERM_LABELS[code] || code;
}
