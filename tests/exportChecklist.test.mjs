import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildExportChecklist } from '../src/lib/card-builder/exportChecklist.mjs';
import { readCardBuilderBrowserAppSources } from './helpers/uiSources.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readCardManagerSources(base) {
  return [
    'cardManager.mjs',
    'cardManagerShared.mjs',
    'cardManagerRender.mjs',
    'cardManagerCrud.mjs',
    'cardManagerPublishShare.mjs',
    'cardManagerCloud.mjs',
    'cardManagerExport.mjs',
    'cardManagerBind.mjs',
  ].map(function (f) {
    return readFileSync(join(base, 'src/lib/card-builder/panels', f), 'utf8');
  }).join('');
}

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

  it('protagonist desc with adult/person bleed is warning', function() {
    var r = buildExportChecklist({
      charName: '主角',
      charDesc: 'Long enough character description text.\nNSFW_information:\n  body: x\ndesire_palette: hot',
      firstMes: 'hi',
      worldbookCount: 1,
      hasAvatar: true,
    });
    assert.ok(r.items.some(function(i) { return i.id === 'protagonist_adult_bleed'; }));
  });

  it('extraIssues from corruption checklist surface as warnings', function() {
    var r = buildExportChecklist({
      charName: 'A',
      charDesc: 'Long enough character description text for passing the min length gate xx',
      firstMes: 'hi',
      worldbookCount: 1,
      hasAvatar: true,
      extraIssues: [{
        code: 'corruption_no_rules',
        level: 'warning',
        message: '已启用恶堕进度，但缺少世界书',
        view: 'worldbook',
      }],
    });
    assert.ok(r.items.some(function(i) { return i.id === 'corruption_no_rules'; }));
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
    var boot = readCardBuilderBrowserAppSources(root);
    assert.match(boot, /export function initCardBuilder/);
    assert.match(boot, /export function bootCardBuilder/);
    assert.match(boot, /__getExportChecklist__/);
    var index = readFileSync(join(root, 'src/pages/index.astro'), 'utf8');
    assert.match(index, /initCardBuilder/);
    assert.doesNotMatch(index, /registerCardManager/);
    var panel = readFileSync(join(root, 'src/components/CardManagerPanel.astro'), 'utf8');
    assert.match(panel, /exportChecklistBox/);
    assert.match(panel, /btnRefreshExportChecklist/);
    assert.match(panel, /exportChecklistModal/);
    assert.match(panel, /ui-search-bar|wb-search-bar/);
    assert.match(panel, /card-manager-cover-overlay|cover-overlay/);
    var mgr = readCardManagerSources(root);
    assert.match(mgr, /bindExportChecklistUi/);
    assert.match(mgr, /openExportChecklistModal/);
    assert.match(mgr, /card-manager-check-badge/);
    assert.match(mgr, /export-check/);
    assert.match(mgr, /card-more-item|btn-inline/);
    assert.match(mgr, /cloud-upload|cloudUploadOverwrite/);
    assert.doesNotMatch(mgr, /iconBtn\('rename'/);
  });
});
