#!/usr/bin/env node
/**
 * restore-backup.js
 * =================
 * Restores the GRC application data from a backup created by reset-instance.js.
 *
 * Usage:
 *   node server/scripts/restore-backup.js --list
 *       Lists all available backups with their labels and timestamps.
 *
 *   node server/scripts/restore-backup.js <backupId>
 *       Restores the specified backup (creates a safety backup of current
 *       state first, then overwrites data files and contract uploads).
 *
 *   node server/scripts/restore-backup.js <backupId> --dry-run
 *       Shows what would be restored without making any changes.
 *
 * Example:
 *   node server/scripts/restore-backup.js 2026-03-15T10-30-00-000Z
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR    = path.resolve(__dirname, '../data');
const BACKUP_ROOT = path.join(DATA_DIR, '_backups');
const UPLOADS_DIR = path.join(DATA_DIR, 'contract-uploads');

const DRY_RUN  = process.argv.includes('--dry-run');
const LIST_CMD = process.argv.includes('--list');
const BACKUP_ID = process.argv.find(a => !a.startsWith('--') && a !== process.argv[1] && a !== process.execPath);

// ── Helpers ───────────────────────────────────────────────────────────────────
function log(msg)  { console.log(msg); }
function ok(msg)   { console.log(`  ✓  ${msg}`); }
function warn(msg) { console.warn(`  ⚠  ${msg}`); }
function err(msg)  { console.error(`  ✗  ${msg}`); }

function writeJSON(filePath, value) {
  if (!DRY_RUN) fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function copyFile(src, dest) {
  if (!DRY_RUN) fs.copyFileSync(src, dest);
}

function mkdirp(dir) {
  if (!DRY_RUN) fs.mkdirSync(dir, { recursive: true });
}

function readManifest(backupDir) {
  const mp = path.join(backupDir, 'manifest.json');
  if (!fs.existsSync(mp)) return null;
  return JSON.parse(fs.readFileSync(mp, 'utf8'));
}

// ── List backups ──────────────────────────────────────────────────────────────
function listBackups() {
  if (!fs.existsSync(BACKUP_ROOT)) {
    log('\n  No backups found — run reset-instance.js first.\n');
    return;
  }
  const entries = fs.readdirSync(BACKUP_ROOT)
    .filter(d => {
      const full = path.join(BACKUP_ROOT, d);
      return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'manifest.json'));
    })
    .sort()
    .reverse();  // newest first

  if (entries.length === 0) {
    log('\n  No restorable backups found.\n');
    return;
  }

  log('');
  log('╔══════════════════════════════════════════════════════════════╗');
  log('║                    AVAILABLE BACKUPS                        ║');
  log('╚══════════════════════════════════════════════════════════════╝');
  log('');

  for (const id of entries) {
    const manifest = readManifest(path.join(BACKUP_ROOT, id));
    const label    = manifest?.label ? `  [${manifest.label}]` : '';
    const at       = manifest?.backedUpAt ? new Date(manifest.backedUpAt).toLocaleString() : 'unknown';
    const files    = manifest?.dataFilesCount ?? '?';
    const uploads  = manifest?.uploadFilesCount ?? '?';
    const flag     = manifest?.restorable ? '' : '  [NOT RESTORABLE]';
    log(`  ${id}${label}`);
    log(`     Backed up at : ${at}`);
    log(`     Data files   : ${files}    Contract uploads : ${uploads}${flag}`);
    log('');
  }
  log(`  To restore: node server/scripts/restore-backup.js <backupId>`);
  log('');
}

// ── Restore ───────────────────────────────────────────────────────────────────
function restore(backupId) {
  const backupDir = path.join(BACKUP_ROOT, backupId);

  log('');
  log('╔══════════════════════════════════════════════════════════════╗');
  log('║              GRC INSTANCE — RESTORE FROM BACKUP             ║');
  log('╚══════════════════════════════════════════════════════════════╝');
  if (DRY_RUN) log('  [DRY-RUN mode — no files will be modified]');
  log('');

  // Validate backup exists
  if (!fs.existsSync(backupDir)) {
    err(`Backup not found: ${backupDir}`);
    log('  Run --list to see available backups.');
    log('');
    process.exit(1);
  }

  const manifest = readManifest(backupDir);
  if (!manifest) {
    err('Backup manifest.json missing — this backup may be corrupt.');
    process.exit(1);
  }
  if (!manifest.restorable) {
    err('Backup is marked as not restorable.');
    process.exit(1);
  }

  const label = manifest.label ? ` [${manifest.label}]` : '';
  log(`  Backup ID  : ${backupId}${label}`);
  log(`  Backed up  : ${new Date(manifest.backedUpAt).toLocaleString()}`);
  log(`  Data files : ${manifest.dataFilesCount}`);
  log(`  Uploads    : ${manifest.uploadFilesCount}`);
  log('');

  // ── Safety backup of current state before overwriting ─────────────────────
  const safetyId  = `pre-restore_${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const safetyDir = path.join(BACKUP_ROOT, safetyId);
  log('Step 1 – Creating safety backup of current state');
  mkdirp(safetyDir);
  if (!DRY_RUN) mkdirp(path.join(safetyDir, 'contract-uploads'));

  const safetyFiles = [];
  for (const file of manifest.dataFiles) {
    const src = path.join(DATA_DIR, file);
    if (fs.existsSync(src)) {
      copyFile(src, path.join(safetyDir, file));
      safetyFiles.push(file);
    }
  }
  // Back up current uploads too
  let safetyUploadCount = 0;
  if (fs.existsSync(UPLOADS_DIR)) {
    const uploads = fs.readdirSync(UPLOADS_DIR).filter(f => !f.startsWith('.'));
    for (const f of uploads) {
      copyFile(path.join(UPLOADS_DIR, f), path.join(safetyDir, 'contract-uploads', f));
      safetyUploadCount++;
    }
  }

  // Write safety manifest
  const safetyManifest = {
    backupId:         safetyId,
    backedUpAt:       new Date().toISOString(),
    label:            `auto-safety-before-restore-${backupId}`,
    restorable:       true,
    dataFilesCount:   safetyFiles.length,
    uploadFilesCount: safetyUploadCount,
    dataFiles:        safetyFiles,
  };
  writeJSON(path.join(safetyDir, 'manifest.json'), safetyManifest);
  ok(`Safety backup written to _backups/${safetyId}`);

  // ── Restore data files ─────────────────────────────────────────────────────
  log('\nStep 2 – Restoring data files');
  let restoredCount = 0;
  for (const file of manifest.dataFiles) {
    const src  = path.join(backupDir, file);
    const dest = path.join(DATA_DIR, file);
    if (!fs.existsSync(src)) {
      warn(`${file} not found in backup — skipping`);
      continue;
    }
    copyFile(src, dest);
    ok(file);
    restoredCount++;
  }

  // ── Clear current uploads and restore backed-up uploads ───────────────────
  log('\nStep 3 – Restoring contract uploads');
  const backedUpUploadsDir = path.join(backupDir, 'contract-uploads');

  if (fs.existsSync(UPLOADS_DIR)) {
    const existing = fs.readdirSync(UPLOADS_DIR).filter(f => !f.startsWith('.'));
    if (!DRY_RUN) {
      for (const f of existing) fs.unlinkSync(path.join(UPLOADS_DIR, f));
    }
    ok(`${existing.length} current upload(s) cleared`);
  }

  let uploadRestoreCount = 0;
  if (fs.existsSync(backedUpUploadsDir)) {
    const toRestore = fs.readdirSync(backedUpUploadsDir).filter(f => !f.startsWith('.'));
    if (!DRY_RUN) mkdirp(UPLOADS_DIR);
    for (const f of toRestore) {
      copyFile(path.join(backedUpUploadsDir, f), path.join(UPLOADS_DIR, f));
      uploadRestoreCount++;
    }
    ok(`${uploadRestoreCount} upload file(s) restored`);
  } else {
    ok('No uploads in backup — uploads directory left empty');
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  log('');
  log('╔══════════════════════════════════════════════════════════════╗');
  if (DRY_RUN) {
    log('║  DRY-RUN complete — no changes were made                     ║');
  } else {
    log('║  Restore complete                                            ║');
  }
  log('╚══════════════════════════════════════════════════════════════╝');
  log('');
  log(`  Restored from : ${backupId}${label}`);
  log(`  Data files    : ${restoredCount}`);
  log(`  Upload files  : ${uploadRestoreCount}`);
  log(`  Safety copy   : _backups/${safetyId}`);
  log('');
  if (!DRY_RUN) log('  Restart the application server to pick up the restored data.');
  log('');
}

// ── Entry point ───────────────────────────────────────────────────────────────
if (LIST_CMD) {
  listBackups();
} else if (BACKUP_ID) {
  restore(BACKUP_ID);
} else {
  log('');
  log('  Usage:');
  log('    node server/scripts/restore-backup.js --list');
  log('    node server/scripts/restore-backup.js <backupId>');
  log('    node server/scripts/restore-backup.js <backupId> --dry-run');
  log('');
}
