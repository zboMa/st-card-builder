import test from 'node:test';
import assert from 'node:assert/strict';

test('admin/routes.mjs 模块可加载（import 链无缺失导出）', async function() {
  var mod = await import('../src/admin/routes.mjs');
  assert.ok(mod.adminRouter, 'adminRouter 已导出');
});
