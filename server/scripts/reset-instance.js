#!/usr/bin/env node
/**
 * reset-instance.js
 * =================
 * Resets the GRC application to a clean, empty state — exactly as it would
 * appear on a fresh deployment to a new organisation.
 *
 * What it does:
 *   1. Creates a timestamped backup under  server/data/_backups/<id>/
 *   2. Copies every mutable data file (and any uploaded contract files) there
 *   3. Writes a backup manifest so restore-backup.js can reverse the operation
 *   4. Resets every data file to its correct empty initial structure
 *   5. Clears the contract-uploads directory
 *
 * What it does NOT touch:
 *   - server/data/contract-samples/   (generic demo PDFs — framework-agnostic)
 *   - server/constants.js             (regulatory framework catalogue)
 *   - Any source code
 *
 * Usage:
 *   node server/scripts/reset-instance.js
 *   node server/scripts/reset-instance.js --dry-run   (preview only, no changes)
 *   node server/scripts/reset-instance.js --label "pre-client-demo"
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR   = path.resolve(__dirname, '../data');
const BACKUP_ROOT = path.join(DATA_DIR, '_backups');

// ── CLI flags ─────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
const labelIdx = process.argv.indexOf('--label');
const LABEL   = labelIdx !== -1 ? process.argv[labelIdx + 1] : null;

// ── Files to back up and reset ────────────────────────────────────────────────
// Each entry: { file, emptyValue }
// emptyValue is what the file will contain after the reset.
const DATA_FILES = [
  { file: 'companies.json',             emptyValue: {} },
  { file: 'onboarding-opcos.json',      emptyValue: [] },
  { file: 'opco-multi-shareholders.json', emptyValue: [] },
  { file: 'contracts.json',             emptyValue: [] },
  { file: 'poa.json',                   emptyValue: [] },
  { file: 'changes.json',               emptyValue: [] },
  { file: 'audit.json',                 emptyValue: [] },
  { file: 'esg-metrics.json',           emptyValue: { metrics: {}, frameworkStatus: {}, targets: {} } },
  { file: 'fieldMappings.json',         emptyValue: [] },
  { file: 'ip.json',                    emptyValue: [] },
  { file: 'licences.json',              emptyValue: [] },
  { file: 'litigations.json',           emptyValue: [] },
  { file: 'tasks.json',                 emptyValue: [] },
];

// Uploaded files directory (cleared on reset; backed up first)
const UPLOADS_DIR = path.join(DATA_DIR, 'contract-uploads');

// ── Helpers ───────────────────────────────────────────────────────────────────
function log(msg)  { console.log(msg); }
function warn(msg) { console.warn(`  ⚠  ${msg}`); }
function ok(msg)   { console.log(`  ✓  ${msg}`); }

function writeJSON(filePath, value) {
  if (!DRY_RUN) fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function copyFile(src, dest) {
  if (!DRY_RUN) fs.copyFileSync(src, dest);
}

function mkdirp(dir) {
  if (!DRY_RUN) fs.mkdirSync(dir, { recursive: true });
}

// ── Main ──────────────────────────────────────────────────────────────────────
function main() {
  const now        = new Date();
  const backupId   = now.toISOString().replace(/[:.]/g, '-');
  const backupDir  = path.join(BACKUP_ROOT, backupId);
  const backedUpAt = now.toISOString();

  log('');
  log('╔══════════════════════════════════════════════════════════════╗');
  log('║         GRC INSTANCE RESET — CLEAN DEPLOYMENT STATE         ║');
  log('╚══════════════════════════════════════════════════════════════╝');
  if (DRY_RUN) log('  [DRY-RUN mode — no files will be modified]');
  log('');
  log(`  Backup ID  : ${backupId}`);
  if (LABEL)    log(`  Label      : ${LABEL}`);
  log(`  Backup dir : ${backupDir}`);
  log('');

  // ── 1. Create backup directory ─────────────────────────────────────────────
  log('Step 1 – Creating backup directory');
  mkdirp(backupDir);
  if (!DRY_RUN) mkdirp(path.join(backupDir, 'contract-uploads'));
  ok(`Created ${backupDir}`);

  // ── 2. Back up data files ──────────────────────────────────────────────────
  log('\nStep 2 – Backing up data files');
  const backedUpFiles = [];
  for (const { file } of DATA_FILES) {
    const src = path.join(DATA_DIR, file);
    if (!fs.existsSync(src)) {
      warn(`${file} not found — skipping`);
      continue;
    }
    copyFile(src, path.join(backupDir, file));
    const size = fs.statSync(src).size;
    ok(`${file}  (${size} bytes)`);
    backedUpFiles.push(file);
  }

  // ── 3. Back up contract uploads ────────────────────────────────────────────
  log('\nStep 3 – Backing up contract uploads');
  let uploadCount = 0;
  if (fs.existsSync(UPLOADS_DIR)) {
    const uploads = fs.readdirSync(UPLOADS_DIR).filter(f => !f.startsWith('.'));
    for (const f of uploads) {
      copyFile(
        path.join(UPLOADS_DIR, f),
        path.join(backupDir, 'contract-uploads', f)
      );
      uploadCount++;
    }
    ok(`${uploadCount} uploaded file(s) backed up`);
  } else {
    ok('contract-uploads directory empty or absent — nothing to back up');
  }

  // ── 4. Write backup manifest ───────────────────────────────────────────────
  log('\nStep 4 – Writing backup manifest');
  const manifest = {
    backupId,
    backedUpAt,
    label:            LABEL || null,
    restorable:       true,
    dataFilesCount:   backedUpFiles.length,
    uploadFilesCount: uploadCount,
    dataFiles:        backedUpFiles,
    resetTo: {
      description: 'Clean empty state — no companies, relationships, or entity data',
      companies:             {},
      onboardingOpcos:       [],
      opcoMultiShareholders: [],
      contracts:             [],
      poa:                   [],
      changes:               [],
      audit:                 [],
      esgMetrics:            { metrics: {}, frameworkStatus: {}, targets: {} },
    },
  };
  const manifestPath = path.join(backupDir, 'manifest.json');
  writeJSON(manifestPath, manifest);
  ok('manifest.json written');

  // ── 5. Reset data files ────────────────────────────────────────────────────
  log('\nStep 5 – Resetting data files to clean state');
  for (const { file, emptyValue } of DATA_FILES) {
    const dest = path.join(DATA_DIR, file);
    writeJSON(dest, emptyValue);
    ok(`${file}  →  ${JSON.stringify(emptyValue).slice(0, 40)}`);
  }

  // ── 6. Clear contract uploads directory ────────────────────────────────────
  log('\nStep 6 – Clearing contract-uploads directory');
  if (fs.existsSync(UPLOADS_DIR)) {
    const files = fs.readdirSync(UPLOADS_DIR).filter(f => !f.startsWith('.'));
    if (!DRY_RUN) {
      for (const f of files) fs.unlinkSync(path.join(UPLOADS_DIR, f));
    }
    ok(`${files.length} file(s) removed from contract-uploads/`);
  } else {
    ok('directory absent — nothing to clear');
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  log('');
  log('╔══════════════════════════════════════════════════════════════╗');
  if (DRY_RUN) {
    log('║  DRY-RUN complete — no changes were made                     ║');
  } else {
    log('║  Reset complete — instance is now in clean deployment state  ║');
  }
  log('╚══════════════════════════════════════════════════════════════╝');
  log('');
  log(`  Backup saved to : ${backupDir}`);
  log(`  To restore      : node server/scripts/restore-backup.js ${backupId}`);
  log(`  To list backups : node server/scripts/restore-backup.js --list`);
  log('');
}

main();
