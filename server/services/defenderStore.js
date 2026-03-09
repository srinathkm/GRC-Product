import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

const FILES = {
  uploads: 'defender-uploads.json',
  scores: 'defender-scores.json',
  snapshots: 'defender-snapshots.json',
  findings: 'defender-findings.json',
  summaries: 'defender-summaries.json',
};

function read(name) {
  try {
    const raw = readFileSync(join(DATA_DIR, FILES[name]), 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

function write(name, data) {
  writeFileSync(join(DATA_DIR, FILES[name]), JSON.stringify(data, null, 2), 'utf8');
}

export function getUploads() {
  return read('uploads');
}

export function saveUploads(data) {
  write('uploads', data);
}

export function getScores() {
  return read('scores');
}

export function saveScores(data) {
  write('scores', data);
}

export function getSnapshots() {
  return read('snapshots');
}

export function saveSnapshots(data) {
  write('snapshots', data);
}

export function getFindings() {
  return read('findings');
}

export function saveFindings(data) {
  write('findings', data);
}

export function addUpload(record) {
  const uploads = getUploads();
  const id = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const entry = { id, ...record, createdAt: new Date().toISOString() };
  uploads.push(entry);
  saveUploads(uploads);
  return entry;
}

export function updateUpload(id, updates) {
  const uploads = getUploads();
  const idx = uploads.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  uploads[idx] = { ...uploads[idx], ...updates };
  saveUploads(uploads);
  return uploads[idx];
}

export function getUploadById(id) {
  return getUploads().find((u) => u.id === id);
}

export function getScoresByOpco(opcoName) {
  return getScores().filter((s) => s.opcoName === opcoName);
}

export function getLatestScore(opcoName) {
  const list = getScoresByOpco(opcoName);
  if (!list.length) return null;
  return list.sort((a, b) => new Date(b.computedAt) - new Date(a.computedAt))[0];
}

export function upsertScore(record) {
  const scores = getScores();
  const existing = scores.findIndex(
    (s) => s.opcoName === record.opcoName && s.computedAt === record.computedAt
  );
  const entry = { ...record, computedAt: record.computedAt || new Date().toISOString() };
  if (existing >= 0) scores[existing] = entry;
  else scores.push(entry);
  saveScores(scores);
  return entry;
}

export function getSnapshotsByOpco(opcoName) {
  return getSnapshots().filter((s) => s.opcoName === opcoName);
}

export function addSnapshots(records) {
  const snapshots = getSnapshots();
  snapshots.push(...records);
  saveSnapshots(snapshots);
  return records;
}

export function getFindingsByOpco(opcoName) {
  return getFindings().filter((f) => f.opcoName === opcoName);
}

export function addFindings(records) {
  const findings = getFindings();
  findings.push(...records);
  saveFindings(findings);
  return records;
}

export function updateFindingStatus(findingId, status) {
  const findings = getFindings();
  const idx = findings.findIndex((f) => f.id === findingId);
  if (idx === -1) return null;
  findings[idx].status = status;
  findings[idx].updatedAt = new Date().toISOString();
  saveFindings(findings);
  return findings[idx];
}

function readSummaries() {
  try {
    const raw = readFileSync(join(DATA_DIR, FILES.summaries), 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

function writeSummaries(data) {
  writeFileSync(join(DATA_DIR, FILES.summaries), JSON.stringify(data, null, 2), 'utf8');
}

export function getSummary(opcoName) {
  const list = readSummaries();
  const entry = list.find((s) => s.opcoName === opcoName);
  return entry ? { summary: entry.summary, updatedAt: entry.updatedAt } : null;
}

export function setSummary(opcoName, summary) {
  const list = readSummaries();
  const idx = list.findIndex((s) => s.opcoName === opcoName);
  const updatedAt = new Date().toISOString();
  const entry = { opcoName, summary, updatedAt };
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  writeSummaries(list);
  return entry;
}
