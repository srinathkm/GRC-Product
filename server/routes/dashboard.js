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
import { computeDependencyIntelligence } from '../services/dependencyIntelligence.js';

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
  dataSovereignty: join(__dirname, '../data/data-sovereignty-checks.json'),
  aiModelUsage:   join(__dirname, '../data/ai-model-usage.json'),
  tasks:          join(__dirname, '../data/tasks.json'),
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

function norm(v) {
  return String(v || '').trim().toLowerCase();
}

function includesAny(text, terms) {
  const t = norm(text);
  return terms.some((x) => t.includes(norm(x)));
}

export const dashboardRouter = Router();

dashboardRouter.get('/summary', async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const selectedOpco = (req.query.opco || '').trim();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    // ── Load all data sources in parallel ──────────────────────────────────
    const [changesRaw, companies, onboarding, poa, ip, licences, litigations, contracts, feedMeta, dataSovereignty, aiModelUsage, tasks] =
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
        safeRead(paths.dataSovereignty, { checks: [] }),
        safeRead(paths.aiModelUsage, []),
        safeRead(paths.tasks, []),
      ]);

    // ── OpCo filter helper ─────────────────────────────────────────────────
    const matchOpco = (val) => !selectedOpco || (val || '').toLowerCase() === selectedOpco.toLowerCase();

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

    // When filtering by OpCo, resolve its parent from companies data
    let filteredParentSet = parentSet;
    let filteredOpcoSet = opcoSet;
    if (selectedOpco) {
      const resolvedParent = new Set();
      for (const fw of Object.values(companies)) {
        if (!Array.isArray(fw)) continue;
        for (const { parent, companies: cos } of fw) {
          if ((cos || []).some((co) => (co || '').toLowerCase() === selectedOpco.toLowerCase())) {
            if (parent) resolvedParent.add(parent);
          }
        }
      }
      for (const row of onboarding) {
        if ((row.opco || '').toLowerCase() === selectedOpco.toLowerCase() && row.parent) {
          resolvedParent.add(row.parent);
        }
      }
      filteredParentSet = resolvedParent;
      filteredOpcoSet = new Set([selectedOpco]);
    }

    // ── Regulatory changes ─────────────────────────────────────────────────
    const allRecentChanges = changes.filter((c) => isWithinDays(c.date, days));
    const recentChanges = selectedOpco
      ? allRecentChanges.filter((c) => (c.affectedCompanies || []).some((co) => (co || '').toLowerCase() === selectedOpco.toLowerCase()))
      : allRecentChanges;
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
    const activePoa = poa.filter((p) => !p.revoked && matchOpco(p.opco));
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
    const activeLicences = licences.filter((l) => l.status !== 'Revoked' && l.status !== 'Cancelled' && matchOpco(l.opco));
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
    const activeContracts = contracts.filter((c) => (c.status === 'Active' || !c.status) && matchOpco(c.opco));
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
      (l) => !['Closed', 'Settled', 'Dismissed'].includes(l.status) && matchOpco(l.opco),
    );
    const highRiskLitigations = activeLitigations.filter(
      (l) => l.riskLevel === 'High' || l.riskLevel === 'Critical',
    );

    // ── IP assets ──────────────────────────────────────────────────────────
    const activeIp = ip.filter((a) => a.status !== 'Expired' && a.status !== 'Abandoned' && matchOpco(a.opco));

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

    // ── Intelligence: lineage & framework impact from legal operations ──────
    const expiringPoaByOpco = new Map();
    for (const p of expiringPoa) {
      if (!p?.opco) continue;
      const key = p.opco;
      if (!expiringPoaByOpco.has(key)) expiringPoaByOpco.set(key, []);
      expiringPoaByOpco.get(key).push(p);
    }

    const lineageImpacts = [];
    for (const [opcoName, poaList] of expiringPoaByOpco.entries()) {
      const relatedChanges = recentChanges.filter((c) =>
        (c.affectedCompanies || []).some((co) => norm(co) === norm(opcoName))
      );
      const fwCounts = {};
      for (const c of relatedChanges) {
        const fw = c.framework || 'Other';
        fwCounts[fw] = (fwCounts[fw] || 0) + 1;
      }
      const frameworksImpacted = Object.entries(fwCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([framework, count]) => ({ framework, count }));

      if (frameworksImpacted.length === 0) continue;

      const ownerTask = (tasks || []).find((t) =>
        norm(t?.opco) === norm(opcoName) &&
        includesAny(t?.module || '', ['poa', 'power of attorney']) &&
        !includesAny(t?.status || '', ['done', 'closed', 'cancelled'])
      );

      lineageImpacts.push({
        opco: opcoName,
        parent: poaList[0]?.parent || '—',
        legalOwner: ownerTask?.assignee || ownerTask?.assignedTo || 'Legal team',
        expiringPoaCount: poaList.length,
        soonestPoaExpiry: poaList
          .map((p) => p.validUntil)
          .filter(Boolean)
          .sort()[0] || null,
        frameworksImpacted,
        impactScore: Math.max(10, 100 - (poaList.length * 8 + frameworksImpacted.length * 6)),
      });
    }

    lineageImpacts.sort((a, b) => a.impactScore - b.impactScore);

    // ── Intelligence: data compliance / model egress risks ──────────────────
    const modelUsage = Array.isArray(aiModelUsage) ? aiModelUsage : [];
    const sovereigntyChecks = Array.isArray(dataSovereignty?.checks) ? dataSovereignty.checks : [];

    const detectJurisdictionFromLocations = (locations = []) => {
      const joined = locations.join(' ').toLowerCase();
      if (joined.includes('saudi')) return 'KSA';
      if (joined.includes('qatar')) return 'Qatar';
      if (joined.includes('bahrain')) return 'Bahrain';
      if (joined.includes('oman')) return 'Oman';
      if (joined.includes('kuwait')) return 'Kuwait';
      return 'UAE';
    };

    const defaultModelCatalog = [
      { model: 'OpenAI GPT-4o', app: 'Global Assistant', hostRegion: 'US', dataLeavesJurisdiction: true },
      { model: 'Azure OpenAI GPT-4', app: 'Document Intelligence', hostRegion: 'EU', dataLeavesJurisdiction: true },
      { model: 'Local Llama 3', app: 'Internal Analytics', hostRegion: 'UAE', dataLeavesJurisdiction: false },
    ];

    const modelCatalog = modelUsage.length > 0 ? modelUsage : defaultModelCatalog;
    const opcoRows = Array.isArray(onboarding) ? onboarding : [];
    const dataComplianceInsights = [];

    for (const row of opcoRows) {
      if (selectedOpco && norm(row.opco) !== norm(selectedOpco)) continue;
      const jurisdiction = detectJurisdictionFromLocations(Array.isArray(row.locations) ? row.locations : []);
      const sectorList = Array.isArray(row.sectorOfOperations) ? row.sectorOfOperations : [];
      for (const model of modelCatalog) {
        const leaves = !!model.dataLeavesJurisdiction;
        if (!leaves) continue;
        const matchingCheck = sovereigntyChecks.find((c) =>
          includesAny(c.jurisdiction || '', [jurisdiction, 'GCC']) &&
          includesAny(c.name || '', ['data', 'localisation', 'cross-border'])
        );
        dataComplianceInsights.push({
          opco: row.opco,
          parent: row.parent || '—',
          jurisdiction,
          sectors: sectorList,
          model: model.model,
          application: model.app,
          hostRegion: model.hostRegion,
          severity: matchingCheck?.severity || 'High',
          regulation: matchingCheck?.regulation || 'Data residency requirements',
          risk: `${model.model} for ${model.app} may transfer ${jurisdiction} operational data to ${model.hostRegion}.`,
        });
      }
    }

    // ── Intelligence: litigation ↔ contractual/IP obligations ────────────────
    const litigationObligationInsights = [];
    const activeLitigationRows = activeLitigations || [];
    for (const lit of activeLitigationRows) {
      const litText = `${lit.caseId || ''} ${lit.claimType || ''} ${lit.notes || ''} ${lit.subject || ''}`;
      const relatedContracts = activeContracts.filter((c) =>
        (lit.opco && norm(c.opco) === norm(lit.opco)) ||
        includesAny(litText, [c.contractId, c.title, c.counterparty])
      );
      const relatedIp = activeIp.filter((a) =>
        (lit.opco && norm(a.opco) === norm(lit.opco)) ||
        includesAny(litText, [a.mark, a.registrationNo, a.applicationNo])
      );
      if (relatedContracts.length === 0 && relatedIp.length === 0) continue;

      const baseExposure = Number(lit.claimAmount || 0) || 0;
      const contractExposure = relatedContracts.length * 250000;
      const ipExposure = relatedIp.length * 150000;
      const exposure = baseExposure + contractExposure + ipExposure;

      litigationObligationInsights.push({
        caseId: lit.caseId || lit.id || '—',
        opco: lit.opco || '—',
        status: lit.status || 'Open',
        relatedContracts: relatedContracts.map((c) => c.contractId || c.title || 'Contract'),
        relatedIpAssets: relatedIp.map((a) => a.mark || a.registrationNo || 'IP Asset'),
        financialExposure: exposure,
        commercialImpact: exposure >= 1000000 ? 'High' : exposure >= 300000 ? 'Medium' : 'Low',
      });
    }

    // ── Intelligence: incomplete documentation / missing evidence ────────────
    const documentationGaps = [];
    for (const p of poa) {
      if (!matchOpco(p.opco)) continue;
      const missing = [];
      if (p.notarised !== true && norm(p.notarised) !== 'true') missing.push('Notarization');
      if (p.mofaStamp !== true && norm(p.mofaStamp) !== 'true') missing.push('MOFA stamp');
      if (p.embassyStamp !== true && norm(p.embassyStamp) !== 'true') missing.push('Embassy stamp');
      if (missing.length === 0) continue;
      documentationGaps.push({
        module: 'POA',
        recordId: p.fileId || p.id || p.holderName || 'POA record',
        opco: p.opco || '—',
        parent: p.parent || '—',
        missingItems: missing,
        criticality: p.validUntil && isExpiringWithin(p.validUntil, 30) ? 'Critical' : 'High',
      });
    }

    for (const c of contracts) {
      if (!matchOpco(c.opco)) continue;
      const missing = [];
      if (!c.documentLink && !c.documentOriginalName) missing.push('Source contract document');
      if (!c.effectiveDate) missing.push('Effective date');
      if (!c.expiryDate) missing.push('Expiry date');
      if (missing.length === 0) continue;
      documentationGaps.push({
        module: 'Contract',
        recordId: c.contractId || c.id || c.title || 'Contract record',
        opco: c.opco || '—',
        parent: c.parent || '—',
        missingItems: missing,
        criticality: c.riskLevel === 'High' ? 'Critical' : 'Medium',
      });
    }

    documentationGaps.sort((a, b) => {
      const rank = { Critical: 3, High: 2, Medium: 1, Low: 0 };
      return (rank[b.criticality] || 0) - (rank[a.criticality] || 0);
    });

    // ── Feed metadata ──────────────────────────────────────────────────────
    const feedStatus = feedMeta
      ? { lastRun: feedMeta.lastRun, added: feedMeta.added, total: feedMeta.total }
      : null;

    const dependencyIntelligence = await computeDependencyIntelligence({
      days,
      selectedOpco,
      includeAi: false,
    });

    // ── Assemble response ──────────────────────────────────────────────────
    res.json({
      generatedAt: now.toISOString(),
      periodDays: days,
      selectedOpco: selectedOpco || null,

      entities: {
        totalParents: filteredParentSet.size,
        totalOpcos: filteredOpcoSet.size,
        onboardedOpcos: selectedOpco
          ? onboarding.filter((r) => (r.opco || '').toLowerCase() === selectedOpco.toLowerCase()).length
          : onboarding.length,
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
      intelligence: {
        lineageImpacts: lineageImpacts.slice(0, 12),
        dataComplianceInsights: dataComplianceInsights.slice(0, 12),
        litigationObligationInsights: litigationObligationInsights.slice(0, 12),
        documentationGaps: documentationGaps.slice(0, 20),
      },
      dependencyIntelligence: dependencyIntelligence.summary,

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
