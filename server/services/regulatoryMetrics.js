/**
 * Shared regulatory change helpers for dashboard and changes routes.
 * Keeps demo date-shifting and OpCo scoping consistent across executive and governance views.
 */

/**
 * Shift change dates so the latest change falls within the recent window (demo UX).
 * Matches behaviour previously duplicated in dashboard.js and changes.js.
 */
export function normalizeRegulatoryChangeDatesForDemo(data) {
  if (!Array.isArray(data) || data.length === 0) return data;
  const times = data.map((c) => new Date(c?.date || 0).getTime()).filter((t) => Number.isFinite(t));
  if (times.length === 0) return data;
  const now = new Date();
  const latest = new Date(Math.max(...times));
  const oneDayMs = 24 * 60 * 60 * 1000;
  const daysAgo = (now.getTime() - latest.getTime()) / oneDayMs;
  if (daysAgo <= 1) return data;
  const shiftDays = Math.min(Math.floor(daysAgo) - 1, 365);
  return data.map((c) => {
    const d = new Date(c.date);
    if (Number.isNaN(d.getTime())) return c;
    d.setDate(d.getDate() + shiftDays);
    return { ...c, date: d.toISOString().slice(0, 10) };
  });
}

/** True if change lists the OpCo in affectedCompanies (case-insensitive). */
export function changeMatchesOpcoFilter(change, opcoFilter) {
  if (opcoFilter == null || String(opcoFilter).trim() === '') return true;
  const want = String(opcoFilter).trim().toLowerCase();
  const list = Array.isArray(change.affectedCompanies) ? change.affectedCompanies : [];
  return list.some((co) => String(co || '').trim().toLowerCase() === want);
}

export function filterChangesByOpco(data, opcoFilter) {
  if (!Array.isArray(data)) return data;
  if (opcoFilter == null || String(opcoFilter).trim() === '') return data;
  return data.filter((c) => changeMatchesOpcoFilter(c, opcoFilter));
}
