import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildExportChecklist } from '../src/lib/card-builder/exportChecklist.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('exportChecklist', function() {
  it('missing name/desc critical; missing greeting/avatar warning', function() {
    var r = buildExportChecklist({});
    assert.equal(r.ok, false);
    assert.equal(r.canExportJson, false);
    assert.equal(r.canExportPng, false);
    assert.ok(r.items.some(function(i) { return i.id === 'no_name' && i.level === 'critical'; }));
    assert.ok(r.items.some(function(i) { return i.id === 'short_desc'; }));
    assert.ok(r.items.some(function(i) { return i.id === 'no_first_mes' && i.level === 'warning'; }));
    assert.ok(r.items.some(function(i) { return i.id === 'no_avatar' && i.level === 'warning'; }));
  });

  it('ready for json; png needs avatar', function() {
    var longDesc = 'This is a long enough character description for the checklist gate.';
    var base = {
      charName: 'TestChar',
      charDesc: longDesc,
      firstMes: 'Hello',
      worldbookCount: 2,
      hasAvatar: false,
    };
    var a = buildExportChecklist(base);
    assert.equal(a.ok, true);
    assert.equal(a.canExportJson, true);
    assert.equal(a.canExportPng, false);
    var b = buildExportChecklist(Object.assign({}, base, { hasAvatar: true }));
    assert.equal(b.canExportPng, true);
  });

  it('novel unsynced is warning', function() {
    var r = buildExportChecklist({
      charName: 'A',
      charDesc: 'Long enough character description text for passing the min length gate xx',
      firstMes: 'hi',
      worldbookCount: 1,
      hasAvatar: true,
      novelUnsyncedCount: 3,
    });
    assert.equal(r.ok, true);
    assert.ok(r.items.some(function(i) { return i.id === 'novel_unsynced'; }));
  });

  it('boot and UI wiring exist', function() {
    var boot = readFileSync(join(root, 'src/lib/card-builder/browserApp.mjs'), 'utf8');
    assert.match(boot, /export function initCardBuilder/);
    assert.match(boot, /export function bootCardBuilder/);
    assert.match(boot, /__getExportChecklist__/);
    var index = readFileSync(join(root, 'src/pages/index.astro'), 'utf8');
    assert.match(index, /initCardBuilder/);
    assert.doesNotMatch(index, /registerCardManager/);
    var panel = readFileSync(join(root, 'src/components/CardManagerPanel.astro'), 'utf8');
    assert.match(panel, /exportChecklistBox/);
    assert.match(panel, /btnRefreshExportChecklist/);
  });
});
