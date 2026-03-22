/**
 * dashboard.js
 *
 * GET /api/dashboard/summary
 *
 * Aggregates KPIs from all data sources into a single payload for the
 * Management Dashboard component, avoiding multiple waterfall requests
 * from the browser.
 */

import { Router } from 'express';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { FRAMEWORKS } from '../constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const paths = {
  changes:        join(__dirname, '../data/changes.json'),
  companies:      join(__dirname, '../data/companies.json'),
  onboarding:     join(__dirname, '../data/onboarding-opcos.json'),
  poa:            join(__dirname, '../data/poa.json'),
  ip:             join(__dirname, '../data/ip.json'),
  licences:       join(__dirname, '../data/licences.json'),
  litigations:    join(__dirname, '../data/litigations.json'),
  contracts:      join(__dirname, '../data/contracts.json'),
  feedMeta:       join(__dirname, '../data/feed-meta.json'),
};

async function safeRead(path, fallback) {
  try {
    const raw = await readFile(path, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function normalizeDates(data) {
  if (!Array.isArray(data) || data.length === 0) return data;
  const now = new Date();
  const latest = new Date(Math.max(...data.map((c) => new Date(c.date || 0).getTime())));
  const daysAgo = (now - latest) / 86400000;
  if (daysAgo <= 1) return data;
  const shift = Math.min(Math.floor(daysAgo) - 1, 365);
  return data.map((c) => {
    const d = new Date(c.date);
    d.setDate(d.getDate() + shift);
    return { ...c, date: d.toISOString().slice(0, 10) };
  });
}

function isWithinDays(dateStr, days) {
  const d = new Date(dateStr);
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  return d >= from && d <= now;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return Math.ceil((d - new Date()) / 86400000);
}

function isExpiringWithin(dateStr, withinDays) {
  const du = daysUntil(dateStr);
  return du !== null && du >= 0 && du <= withinDays;
}

function isExpired(dateStr) {
  const du = daysUntil(dateStr);
  return du !== null && du < 0;
}

export const dashboardRouter = Router();

dashboardRouter.get('/summary', async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    // ── Load all data sources in parallel ──────────────────────────────────
    const [changesRaw, companies, onboarding, poa, ip, licences, litigations, contracts, feedMeta] =
      await Promise.all([
        safeRead(paths.changes, []),
        safeRead(paths.companies, {}),
        safeRead(paths.onboarding, []),
        safeRead(paths.poa, []),
        safeRead(paths.ip, []),
        safeRead(paths.licences, []),
        safeRead(paths.litigations, []),
        safeRead(paths.contracts, []),
        safeRead(paths.feedMeta, null),
      ]);

    const changes = normalizeDates(changesRaw);

    // ── Entity counts ──────────────────────────────────────────────────────
    const parentSet = new Set();
    const opcoSet = new Set();
    for (const fw of Object.values(companies)) {
      if (!Array.isArray(fw)) continue;
      for (const { parent, companies: cos } of fw) {
        if (parent) parentSet.add(parent);
        for (const co of cos || []) { if (co) opcoSet.add(co); }
      }
    }
    for (const row of onboarding) {
      if (row.parent) parentSet.add(row.parent);
      if (row.opco) opcoSet.add(row.opco);
    }

    // ── Regulatory changes ─────────────────────────────────────────────────
    const recentChanges = changes.filter((c) => isWithinDays(c.date, days));
    const frameworkCounts = {};
    for (const c of recentChanges) {
      const fw = c.framework || 'Other';
      frameworkCounts[fw] = (frameworkCounts[fw] || 0) + 1;
    }
    const criticalChanges = recentChanges.filter((c) => {
      if (!c.deadline) return false;
      const du = daysUntil(c.deadline);
      return du !== null && du <= 90;
    });
    const overdueChanges = recentChanges.filter((c) => {
      if (!c.deadline) return false;
      return isExpired(c.deadline);
    });

    // Top frameworks by change volume (for bar chart)
    const topFrameworks = Object.entries(frameworkCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([framework, count]) => ({ framework, count }));

    // ── POA expiry ─────────────────────────────────────────────────────────
    const activePoa = poa.filter((p) => !p.revoked);
    const expiringPoa = activePoa.filter((p) => isExpiringWithin(p.validUntil, 60));
    const expiredPoa = activePoa.filter((p) => isExpired(p.validUntil));

    // Soonest expiring POA items (for expiry tracker)
    const upcomingPoa = activePoa
      .filter((p) => daysUntil(p.validUntil) !== null && daysUntil(p.validUntil) >= 0)
      .sort((a, b) => new Date(a.validUntil) - new Date(b.validUntil))
      .slice(0, 5)
      .map((p) => ({
        type: 'POA',
        name: p.holderName || '—',
        opco: p.opco || '—',
        parent: p.parent || '—',
        expiryDate: p.validUntil || '—',
        daysLeft: daysUntil(p.validUntil),
        module: 'poa-management',
      }));

    // ── Licence expiry ─────────────────────────────────────────────────────
    const activeLicences = licences.filter((l) => l.status !== 'Revoked' && l.status !== 'Cancelled');
    const expiringLicences = activeLicences.filter((l) => isExpiringWithin(l.expiryDate, 60));
    const expiredLicences = activeLicences.filter((l) => isExpired(l.expiryDate));

    const upcomingLicences = activeLicences
      .filter((l) => daysUntil(l.expiryDate) !== null && daysUntil(l.expiryDate) >= 0)
      .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))
      .slice(0, 5)
      .map((l) => ({
        type: 'Licence',
        name: l.licenceType || l.licenceName || '—',
        opco: l.opco || '—',
        parent: l.parent || '—',
        expiryDate: l.expiryDate || '—',
        daysLeft: daysUntil(l.expiryDate),
        module: 'licence-management',
      }));

    // ── Contract expiry ────────────────────────────────────────────────────
    const activeContracts = contracts.filter((c) => c.status === 'Active' || !c.status);
    const expiringContracts = activeContracts.filter((c) => isExpiringWithin(c.expiryDate, 60));
    const expiredContracts = activeContracts.filter((c) => isExpired(c.expiryDate));

    const upcomingContracts = activeContracts
      .filter((c) => daysUntil(c.expiryDate) !== null && daysUntil(c.expiryDate) >= 0)
      .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))
      .slice(0, 5)
      .map((c) => ({
        type: 'Contract',
        name: c.title || c.contractId || '—',
        opco: c.opco || '—',
        parent: c.parent || '—',
        expiryDate: c.expiryDate || '—',
        daysLeft: daysUntil(c.expiryDate),
        module: 'contracts-management',
      }));

    // Combined upcoming expiry (sorted by daysLeft)
    const upcomingExpiry = [...upcomingPoa, ...upcomingLicences, ...upcomingContracts]
      .filter((x) => x.daysLeft !== null)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 10);

    // ── Litigations ────────────────────────────────────────────────────────
    const activeLitigations = litigations.filter(
      (l) => !['Closed', 'Settled', 'Dismissed'].includes(l.status),
    );
    const highRiskLitigations = activeLitigations.filter(
      (l) => l.riskLevel === 'High' || l.riskLevel === 'Critical',
    );

    // ── IP assets ──────────────────────────────────────────────────────────
    const activeIp = ip.filter((a) => a.status !== 'Expired' && a.status !== 'Abandoned');

    // ── OpCo alert heat map (top 8 OpCos by total change exposure) ─────────
    const opcoChangeCounts = {};
    for (const c of recentChanges) {
      for (const co of c.affectedCompanies || []) {
        if (co) opcoChangeCounts[co] = (opcoChangeCounts[co] || 0) + 1;
      }
    }
    const topOpcoAlerts = Object.entries(opcoChangeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([opco, changeCount]) => ({ opco, changeCount }));

    // ── Feed metadata ──────────────────────────────────────────────────────
    const feedStatus = feedMeta
      ? { lastRun: feedMeta.lastRun, added: feedMeta.added, total: feedMeta.total }
      : null;

    // ── Assemble response ──────────────────────────────────────────────────
    res.json({
      generatedAt: now.toISOString(),
      periodDays: days,

      entities: {
        totalParents: parentSet.size,
        totalOpcos: opcoSet.size,
        onboardedOpcos: onboarding.length,
      },

      regulatoryChanges: {
        total: recentChanges.length,
        critical: criticalChanges.length,
        overdue: overdueChanges.length,
        frameworkBreakdown: frameworkCounts,
        topFrameworks,
      },

      poa: {
        total: activePoa.length,
        expiringSoon: expiringPoa.length,
        expired: expiredPoa.length,
      },

      licences: {
        total: activeLicences.length,
        expiringSoon: expiringLicences.length,
        expired: expiredLicences.length,
      },

      contracts: {
        total: activeContracts.length,
        expiringSoon: expiringContracts.length,
        expired: expiredContracts.length,
      },

      litigations: {
        total: activeLitigations.length,
        highRisk: highRiskLitigations.length,
      },

      ip: {
        total: activeIp.length,
      },

      upcomingExpiry,
      topOpcoAlerts,

      feedStatus,

      // Summary score (0-100) — weighted mix of green metrics
      complianceHealthScore: (() => {
        const total = recentChanges.length || 1;
        const critPct = criticalChanges.length / total;
        const expiryRisk = (expiringPoa.length + expiringLicences.length + expiringContracts.length);
        const expiryTotal = (activePoa.length + activeLicences.length + activeContracts.length) || 1;
        const expiryPct = expiryRisk / expiryTotal;
        const score = Math.max(0, Math.min(100, Math.round(100 - critPct * 40 - expiryPct * 30 - (overdueChanges.length / total) * 30)));
        return score;
      })(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
