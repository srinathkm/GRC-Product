#!/usr/bin/env node
import { readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const rel = process.argv[2];
if (!rel) {
  console.error('Usage: GITHUB_TOKEN=... node scripts/create-github-issues-from-manifest.mjs <manifest.json>');
  process.exit(1);
}
const manifestPath = resolve(root, rel);
const token = process.env.GITHUB_TOKEN?.trim();
if (!token) {
  console.error('Missing GITHUB_TOKEN');
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
const { repository, labels: defaultLabels = [], issues } = manifest;

async function createIssue({ title, body, labels }) {
  const labelSet = [...new Set([...(defaultLabels || []), ...(labels || [])])];
  const res = await fetch(`https://api.github.com/repos/${repository}/issues`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, body, labels: labelSet }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || res.statusText || String(res.status));
  return data;
}

console.log(`Creating ${issues.length} issues on ${repository}…`);
for (const item of issues) {
  try {
    const created = await createIssue({ title: item.title, body: item.body, labels: item.labels });
    console.log(`${item.id} -> ${created.html_url}`);
  } catch (e) {
    console.error(`${item.id} FAILED:`, e.message);
    process.exitCode = 1;
  }
}
