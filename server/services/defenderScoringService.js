import { SPS_WEIGHTS, SCORE_BANDS } from '../constants/defenderMapping.js';
import * as store from './defenderStore.js';

function getBand(score) {
  const n = Math.round(Number(score)) || 0;
  const band = SCORE_BANDS.find((b) => n >= b.min && n <= b.max);
  return band || SCORE_BANDS[SCORE_BANDS.length - 1];
}

/**
 * Compute Security Posture Score from snapshots and findings (file-based).
 * Formula: framework 35% + vulnerability 30% + alert 20% + secure score 15% - penalties.
 */
export function computeSecurityPostureScore(opcoName) {
  const snapshots = store.getSnapshotsByOpco(opcoName);
  const findings = store.getFindingsByOpco(opcoName);

  let frameworkCoverage = 0;
  let vulnerability = 100;
  let alertStatus = 100;
  let secureScore = 0;

  const now = new Date();
  const recentCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const recentSnapshots = snapshots.filter((s) => new Date(s.reportDate || s.createdAt) >= recentCutoff);

  for (const s of recentSnapshots) {
    const v = Number(s.value) || 0;
    if (s.reportType === 'secure_score') secureScore = Math.max(secureScore, v);
    if (s.reportType === 'regulatory_compliance') frameworkCoverage = Math.max(frameworkCoverage, v);
    if (s.reportType === 'vulnerability_assessment') vulnerability = Math.min(vulnerability, 100 - v);
    if (s.reportType === 'alert_incident') alertStatus = Math.min(alertStatus, 100 - v);
  }

  if (secureScore === 0 && recentSnapshots.length) {
    const any = recentSnapshots.find((s) => s.value != null);
    secureScore = Number(any?.value) || 0;
  }

  const openCritical = findings.filter((f) => f.status !== 'resolved' && f.severity === 'Critical').length;
  const openHigh = findings.filter((f) => f.status !== 'resolved' && f.severity === 'High').length;
  const penalty = openCritical * 10 + openHigh * 5;
  const raw =
    frameworkCoverage * SPS_WEIGHTS.FRAMEWORK_COVERAGE +
    vulnerability * SPS_WEIGHTS.VULNERABILITY +
    alertStatus * SPS_WEIGHTS.ALERT_STATUS +
    secureScore * SPS_WEIGHTS.SECURE_SCORE -
    penalty;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const band = getBand(score);

  const evidence = {
    frameworkCoverage,
    vulnerability,
    alertStatus,
    secureScore,
    openCritical,
    openHigh,
    penalty,
  };

  const record = {
    opcoName,
    score,
    band: band.label,
    bandColor: band.color,
    evidence,
    computedAt: new Date().toISOString(),
  };

  store.upsertScore(record);
  return record;
}
