import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shareClosed,
  selfApprovalBlocked,
  defaultExpiresAt,
  exceededLabels,
  bearerIdsForUser,
  nextMenuParent,
  menuCanSave,
  announcementVisible,
  pageSlice,
  TASK_IDS,
} from '../server/src/admin/deskLogic.mjs';
import { quotaRows, sortCardsByBytes, sidebarGroups, dictOptions, capNote } from '../src/lib/admin/deskView.mjs';

test('下架后公开分享按已下架拒绝', function() {
  var block = shareClosed({ enabled: true, expiresAt: null }, true, Date.now());
  assert.equal(block.why, 'removed');
  assert.equal(block.status, 404);
});

test('停用和过期各自有原因', function() {
  assert.equal(shareClosed({ enabled: false }, false).why, 'stopped');
  assert.equal(shareClosed({ enabled: true, expiresAt: '2000-01-01T00:00:00.000Z' }, false, Date.now()).why, 'expired');
  assert.equal(shareClosed({ enabled: true }, false), null);
});

test('申请人不能通过自己的删除', function() {
  assert.equal(selfApprovalBlocked('u1', 'u1', true), true);
  assert.equal(selfApprovalBlocked('u1', 'u2', true), false);
  assert.equal(selfApprovalBlocked('u1', 'u1', false), false);
});

test('禁用后该用户的 Token id 会被列出来撤掉', function() {
  var ids = bearerIdsForUser([
    { id: 'bearer/a', userId: 'u1' },
    { id: 'bearer/b', userId: 'u2' },
  ], 'u1');
  assert.deepEqual(ids, ['bearer/a']);
});

test('用户页配额是五行，卡按体积从大到小', function() {
  var rows = quotaRows({
    usage: { cardsOnCloud: 2, cloudBytes: 10, activeShares: 1, bearerTokens: 0, storyNovels: 3 },
    limits: { cardsOnCloud: 1, cloudBytes: 100, activeShares: 3, bearerTokens: 3, storyNovels: 5 },
  });
  assert.equal(rows.length, 5);
  assert.equal(rows[0].over, true);
  var cards = sortCardsByBytes([{ id: 'a', bundleBytes: 1 }, { id: 'b', bundleBytes: 9 }]);
  assert.equal(cards[0].id, 'b');
});

test('字典空着时下拉用内置项', function() {
  var opts = dictOptions('user.status', []);
  assert.ok(opts.some(function(o) { return o.value === 'disabled' && o.label === '已禁用'; }));
  var custom = dictOptions('user.status', [{ value: 'frozen', label: '冻结' }]);
  assert.equal(custom[0].label, '冻结');
});

test('菜单父级决定侧栏分组，且不改已迁移的名称', function() {
  var tree = sidebarGroups([
    { id: 'group-people', name: '用户与权限', group: true, order: 1 },
    { id: 'users', name: '用户', parentId: 'group-people', order: 1 },
  ]);
  assert.equal(tree.groups[0].name, '用户与权限');
  assert.equal(tree.groups[0].children[0].id, 'users');
  var again = nextMenuParent({ name: '成员', parentMigrated: true, parentId: 'group-people' }, 'group-run');
  assert.equal(again.update, false);
  assert.equal(menuCanSave({ id: 'not-a-page', group: false }).ok, false);
});

test('任务只有三种，公告空则不显示，筛选后再计数', function() {
  assert.deepEqual(TASK_IDS, ['index.rebuild', 'token.purge', 'backup.periodic']);
  assert.equal(announcementVisible(''), false);
  assert.equal(announcementVisible('今晚维护'), true);
  var page = pageSlice([1, 2, 3], 1, 1);
  assert.equal(page.total, 3);
  assert.deepEqual(page.items, [2]);
  assert.equal(capNote(true, 2000), '只列出前 2000 条');
});

test('新建分享缺省过期天数，超限标出容量', function() {
  var at = defaultExpiresAt(2, Date.parse('2020-01-01T00:00:00.000Z'));
  assert.equal(at, '2020-01-03T00:00:00.000Z');
  assert.equal(defaultExpiresAt(0), null);
  assert.deepEqual(exceededLabels({ cloudBytes: 11, cardsOnCloud: 1 }, { cloudBytes: 10, cardsOnCloud: 5 }), ['容量']);
});
