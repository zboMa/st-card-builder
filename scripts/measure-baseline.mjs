#!/usr/bin/env node
/**
 * Phase 0 基线度量：build chunk gzip、saveDraft 耗时（Node 模拟，无 DOM）。
 * 用法：npm run build && node scripts/measure-baseline.mjs
 */
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createDefaultCardState } from '../src/lib/card-builder/state.mjs';
import { createCardStateMachine } from '../src/lib/card-builder/stateMachine.mjs';

function mockStorage() {
  var map = {};
  return {
    getItem: function(k) { return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; },
    setItem: function(k, v) { map[k] = String(v); },
    removeItem: function(k) { delete map[k]; },
  };
}

function measureChunks(distDir) {
  var astro = join(distDir, '_astro');
  var rows = [];
  try {
    readdirSync(astro).forEach(function(name) {
      if (!name.endsWith('.js')) return;
      var buf = readFileSync(join(astro, name));
      rows.push({
        file: name,
        rawKb: (buf.length / 1024).toFixed(1),
        gzipKb: (gzipSync(buf).length / 1024).toFixed(1),
      });
    });
  } catch (e) {
    console.warn('[measure] dist/_astro not found — run npm run build first');
    return [];
  }
  rows.sort(function(a, b) { return parseFloat(b.gzipKb) - parseFloat(a.gzipKb); });
  return rows;
}

function measureSaveDraft() {
  var prev = globalThis.localStorage;
  globalThis.localStorage = mockStorage();
  try {
    function bench(label, setup) {
      var state = createDefaultCardState();
      state.draftId = 'draft_bench';
      setup(state);
      var sm = createCardStateMachine(state);
      sm.saveDraft();
      var t0 = performance.now();
      for (var i = 0; i < 200; i++) sm.saveDraft();
      var ms = (performance.now() - t0) / 200;
      return { label: label, msPerSave: ms.toFixed(3) };
    }
    return [
      bench('small', function(s) { s.charName = 'Test'; }),
      bench('medium-wb', function(s) {
        s.charName = 'Test';
        s.worldbookEntries = Array.from({ length: 80 }, function(_, i) {
          return {
            comment: 'e' + i,
            content: 'content '.repeat(40),
            keys: ['k' + i],
            enabled: true,
          };
        });
      }),
    ];
  } finally {
    globalThis.localStorage = prev;
  }
}

var dist = join(process.cwd(), 'dist');
var chunks = measureChunks(dist);
var saves = measureSaveDraft();

console.log(JSON.stringify({
  measuredAt: new Date().toISOString(),
  topChunksGzipKb: chunks.slice(0, 12),
  saveDraftMs: saves,
}, null, 2));
