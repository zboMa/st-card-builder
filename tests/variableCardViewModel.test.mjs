import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGraphView,
  buildInferView,
  buildResultChecklist,
  buildVariableGroups,
  isRuntimeNodeReachable,
} from '../src/lib/mvu/variableCardViewModel.mjs';

function design() {
  return {
    summary: '测试',
    variables: [
      { path: '世界.当前时间', type: 'string', default: '08:00', description: '时间', check: ['推进'] },
      { path: 'NPC.秦玥.好感度', type: 'number', default: 0, description: '好感', check: ['互动'] },
    ],
  };
}

describe('variableCardViewModel', function() {
  it('变量按首段分组并保留顺序', function() {
    const groups = buildVariableGroups(design().variables);
    assert.deepEqual(groups.map(function(g) { return g.name; }), ['世界', 'NPC']);
    assert.equal(groups[0].count, 1);
    assert.equal(groups[1].variables[0].path, 'NPC.秦玥.好感度');
  });

  it('结果清单区分已有 initvar 与普通设计', function() {
    assert.deepEqual(buildResultChecklist(design()).map(function(i) { return i.label; }), ['变量设计']);
    const existing = buildResultChecklist(design(), { existing: true });
    assert.equal(existing.length, 3);
    assert.match(existing[1].badge, /initvar/);
  });

  it('图视图包含固定节点、变量节点与动态连线', function() {
    const graph = buildGraphView(design(), {});
    assert.ok(graph.nodes.some(function(n) { return n.id === 'varmap'; }));
    assert.ok(graph.nodes.some(function(n) { return n.id === 'var:世界.当前时间'; }));
    assert.ok(graph.connections.some(function(c) { return c.dynamicVar; }));
    assert.equal(graph.size.width, 1900);
    assert.ok(graph.size.height >= 980);
  });

  it('已保存位置与断线状态生效', function() {
    const graph = buildGraphView(design(), {
      positions: { 'varmap': { x: 700, y: 500 } },
      disabledDynamicConnections: ['varmap:out=>varpath:世界.当前时间'],
      connections: [],
    });
    const varmap = graph.nodes.find(function(n) { return n.id === 'varmap'; });
    assert.deepEqual({ x: varmap.left, y: varmap.top }, { x: 700, y: 500 });
    assert.equal(graph.connections.filter(function(c) { return c.dynamicVar; }).length, 1);
    assert.equal(graph.connections.some(function(c) { return c.to === 'var:0:in'; }), false);
  });

  it('推断候选视图统计新增；运行时可达判断忽略动态变量线', function() {
    const view = buildInferView([
      { path: '世界.体力', alreadyPresent: false, selected: true },
      { path: 'NPC.秦玥.好感度', alreadyPresent: true, selected: false },
    ]);
    assert.equal(view.count, 2);
    assert.equal(view.newCount, 1);
    assert.equal(isRuntimeNodeReachable([
      { from: 'user-message:out', to: 'st-prompt:in' },
      { from: 'st-prompt:out', to: 'stat-data:in' },
    ], 'stat-data'), true);
    assert.equal(isRuntimeNodeReachable([
      { from: 'user-message:out', to: 'st-prompt:in' },
      { from: 'varmap:out', to: 'var:0:in', dynamicVar: true },
    ], 'var:0'), false);
  });
});
