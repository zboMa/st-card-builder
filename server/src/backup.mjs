/**
 * 逻辑备份（复用 scripts/backup-couch.sh）+ 备份历史（backup-run/）
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.mjs';
import { ensureAdminDatabase, appendAdminAudit } from './couch.mjs';
import { recordAdminFile } from './admin/system.mjs';

var __dirname = path.dirname(fileURLToPath(import.meta.url));
var SERVER_ROOT = path.resolve(__dirname, '..');
var REPO_ROOT = path.resolve(SERVER_ROOT, '..');

function getOrNull(db, id) {
  return db.get(String(id || '')).then(function(d) { return d; }, function(e) {
    if (e && e.statusCode === 404) return null;
    throw e;
  });
}

function runScript(outDir) {
  var script = path.join(REPO_ROOT, 'scripts', 'backup-couch.sh');
  return new Promise(function(resolve, reject) {
    var child = spawn('bash', [script, outDir], {
      cwd: REPO_ROOT,
      env: Object.assign({}, process.env, {
        ENV_FILE: path.join(SERVER_ROOT, '.env'),
        COUCHDB_URL: config.couch.url,
        COUCHDB_USER: config.couch.user,
        COUCHDB_PASSWORD: config.couch.password,
      }),
    });
    var stdout = '';
    var stderr = '';
    var settled = false;
    var timer = setTimeout(function() {
      try { child.kill('SIGKILL'); } catch (e) { /* ignore */ }
      if (!settled) { settled = true; reject(new Error('backup_timeout')); }
    }, 10 * 60 * 1000);
    child.stdout.on('data', function(d) { stdout += String(d); });
    child.stderr.on('data', function(d) { stderr += String(d); });
    child.on('error', function(err) {
      clearTimeout(timer);
      if (!settled) { settled = true; reject(err); }
    });
    child.on('close', function(code) {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (code === 0) resolve({ stdout: stdout, stderr: stderr });
      else reject(new Error(stderr || stdout || ('exit ' + code)));
    });
  });
}

export async function appendBackupRun(rec) {
  var db = await ensureAdminDatabase();
  var id = 'backup-run/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  var doc = Object.assign({
    _id: id,
    type: 'backup-run',
    at: new Date().toISOString(),
  }, rec || {});
  await db.insert(doc);
  return doc;
}

export async function listBackupRuns() {
  var db = await ensureAdminDatabase();
  var res = await db.list({ include_docs: true, startkey: 'backup-run/', endkey: 'backup-run/\ufff0', descending: true, limit: 200 });
  return (res.rows || []).map(function(r) { return r.doc; }).filter(Boolean);
}

/** 执行逻辑备份并记录历史（routes 手动触发 + scheduler 周期任务共用） */
export async function runBackup(triggeredBy) {
  if (!config.backupEnabled) throw new Error('backup_disabled');
  var outBase = config.backupDir || path.join(SERVER_ROOT, 'backups');
  var stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  var outDir = path.join(outBase, stamp);
  var result = await runScript(outDir);
  var rec = await appendBackupRun({
    status: 'ok',
    outDir: outDir,
    triggeredBy: triggeredBy || 'manual',
    log: String(result.stdout || '').slice(-2000),
  });
  try {
    await recordAdminFile({
      name: 'backup-' + stamp + '.txt',
      source: 'backup',
      by: triggeredBy || '',
      contentType: 'text/plain',
      text: '目录：' + outDir + '\n' + String(result.stdout || '').slice(-4000),
    });
  } catch (eFile) { /* 备份目录已写成，文件页缺行时仍可看备份历史 */ }
  try {
    await appendAdminAudit({ action: 'backup.run', outDir: outDir, by: triggeredBy || '' });
  } catch (e) { /* ignore */ }
  return { ok: true, outDir: outDir, run: rec, log: rec.log };
}
