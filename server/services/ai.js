import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createChatCompletion, isLlmConfigured } from './llm.js';
import { FRAMEWORKS } from '../constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const changesPath = join(__dirname, '../data/changes.json');
const companiesPath = join(__dirname, '../data/companies.json');
const onboardingOpcosPath = join(__dirname, '../data/onboarding-opcos.json');
const poaPath = join(__dirname, '../data/poa.json');
const ipPath = join(__dirname, '../data/ip.json');
const licencesPath = join(__dirname, '../data/licences.json');
const litigationsPath = join(__dirname, '../data/litigations.json');
const tasksPath = join(__dirname, '../data/tasks.json');
const contractsPath = join(__dirname, '../data/contracts.json');
const esgMetricsPath = join(__dirname, '../data/esg-metrics.json');

function buildContext(changes) {
  return changes
    .map(
      (c) =>
        `[${c.framework}] ${c.title} (${c.date})\n${c.fullText}\nCategory: ${c.category}`
    )
    .join('\n\n---\n\n');
}

export async function answerWithContext(userMessage, changesJson) {
  const changes = Array.isArray(changesJson) ? changesJson : [];
  const context = buildContext(changes);

  const systemPrompt = `You are a helpful assistant that answers questions about regulatory and framework changes in the UAE and Saudi Arabia. Use ONLY the following context about recent changes (last 30 days) to answer. If the answer is not in the context, say so and do not make up information.

Context from regulatory changes:
${context || '(No changes data provided)'}

Keep answers concise and cite the relevant framework and change when applicable.`;

  if (!isLlmConfigured()) {
    return 'AI is not configured. Set LLM_BASE_URL and LLM_API_KEY (or OPENAI_API_KEY) in the server .env to enable answers based on the regulation changes.';
  }

  try {
    const completion = await createChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      maxTokens: 800,
      responseFormat: 'text',
    });
    const content = completion.choices?.[0]?.message?.content;
    return content || 'No response generated.';
  } catch (err) {
    console.error('LLM error (answerWithContext):', err.message);
    return `Sorry, I couldn't process your question: ${err.message}. Please try again or rephrase.`;
  }
}

async function safeReadJson(path, fallback) {
  try {
    const raw = await readFile(path, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

async function buildAppContext() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const changes = await safeReadJson(changesPath, []);
  const recentChanges = Array.isArray(changes)
    ? changes.filter((c) => {
        const d = new Date(c.date);
        return !Number.isNaN(d.getTime()) && d >= thirtyDaysAgo;
      })
    : [];

  const companies = await safeReadJson(companiesPath, {});
  const onboardingOpcos = await safeReadJson(onboardingOpcosPath, []);
  const poa = await safeReadJson(poaPath, []);
  const ip = await safeReadJson(ipPath, []);
  const licences = await safeReadJson(licencesPath, []);
  const litigations = await safeReadJson(litigationsPath, []);

  // Derive overdue frameworks per company: any change whose deadline is before "now".
  const overdueByCompany = new Map();
  if (Array.isArray(changes)) {
    for (const c of changes) {
      if (!c || !c.deadline) continue;
      const deadline = new Date(c.deadline);
      if (Number.isNaN(deadline.getTime()) || deadline >= now) continue;
      const fw = c.framework || 'Unknown framework';
      const companies = Array.isArray(c.affectedCompanies)
        ? c.affectedCompanies
        : [];
      if (!companies.length) continue;
      for (const rawName of companies) {
        const name =
          typeof rawName === 'string' ? rawName.trim() : String(rawName || '');
        if (!name) continue;
        let entry = overdueByCompany.get(name);
        if (!entry) {
          entry = { opco: name, frameworks: new Set(), totalChanges: 0 };
          overdueByCompany.set(name, entry);
        }
        entry.frameworks.add(fw);
        entry.totalChanges += 1;
      }
    }
  }

  const overdueRanking = Array.from(overdueByCompany.values())
    .map((e) => ({
      opco: e.opco,
      frameworksCount: e.frameworks.size,
      totalOverdueChanges: e.totalChanges,
      frameworks: Array.from(e.frameworks),
    }))
    .sort((a, b) => {
      if (b.frameworksCount !== a.frameworksCount) {
        return b.frameworksCount - a.frameworksCount;
      }
      return b.totalOverdueChanges - a.totalOverdueChanges;
    })
    .slice(0, 20);

  const lines = [];

  lines.push('SECTION: Governance frameworks supported by Raqib');
  lines.push(`Frameworks: ${FRAMEWORKS.join(', ') || 'None configured.'}`);

  lines.push('');
  lines.push('SECTION: Recent regulatory changes (last 30 days)');
  if (recentChanges.length === 0) {
    lines.push('No recent changes found in the local dataset.');
  } else {
    recentChanges.slice(0, 25).forEach((c) => {
      lines.push(
        `- [${c.framework}] ${c.title} (${c.date}) – Category: ${c.category}. Snippet: ${c.snippet || c.fullText?.slice(0, 180) || ''}`
      );
    });
  }

  const parents = [];
  Object.keys(companies || {}).forEach((fw) => {
    const arr = Array.isArray(companies[fw]) ? companies[fw] : [];
    arr.forEach((entry) => {
      if (entry && entry.parent) parents.push(entry.parent);
    });
  });
  const uniqueParents = [...new Set(parents)];

  lines.push('');
  lines.push('SECTION: Parent holdings and OpCos (from companies.json)');
  lines.push(`Parent holdings in dataset: ${uniqueParents.length > 0 ? uniqueParents.join(', ') : 'None'}.`);

  lines.push('');
  lines.push('SECTION: Onboarded OpCos (from onboarding-opcos.json)');
  if (Array.isArray(onboardingOpcos) && onboardingOpcos.length > 0) {
    onboardingOpcos.slice(0, 40).forEach((row) => {
      lines.push(
        `- Parent="${row.parent}", OpCo="${row.opco}", Framework="${row.framework}", AddedAt="${row.addedAt}"`
      );
    });
  } else {
    lines.push('No onboarded OpCos recorded.');
  }

  lines.push('');
  lines.push('SECTION: Power of Attorney (POA) records');
  if (Array.isArray(poa) && poa.length > 0) {
    lines.push(`Total POA records: ${poa.length}. Sample:`);
    poa.slice(0, 40).forEach((r) => {
      lines.push(
        `- Parent="${r.parent}", OpCo="${r.opco}", Holder="${r.holderName}", Type="${r.poaType}", Jurisdiction="${r.jurisdiction}", ValidUntil="${r.validUntil}", Revoked=${!!r.revoked}`
      );
    });
  } else {
    lines.push('No POA records saved yet.');
  }

  lines.push('');
  lines.push('SECTION: IP assets');
  if (Array.isArray(ip) && ip.length > 0) {
    lines.push(`Total IP asset records: ${ip.length}.`);
  } else {
    lines.push('No IP asset records saved yet.');
  }

  lines.push('');
  lines.push('SECTION: Licences');
  if (Array.isArray(licences) && licences.length > 0) {
    lines.push(`Total licence records: ${licences.length}.`);
  } else {
    lines.push('No licence records saved yet.');
  }

  lines.push('');
  lines.push('SECTION: Litigations');
  if (Array.isArray(litigations) && litigations.length > 0) {
    lines.push(`Total litigation records: ${litigations.length}.`);
  } else {
    lines.push('No litigation records saved yet.');
  }

  lines.push('');
  lines.push(
    'SECTION: Overdue frameworks by company (based on regulatory change deadlines before today)',
  );
  if (overdueRanking.length === 0) {
    lines.push(
      'There are currently no overdue frameworks detectable from the regulatory changes dataset (no deadlines in the past).',
    );
  } else {
    overdueRanking.forEach((row, idx) => {
      lines.push(
        `${idx + 1}. Company "${row.opco}" has ${row.frameworksCount} framework(s) with overdue changes (total overdue changes: ${row.totalOverdueChanges}). Frameworks: ${row.frameworks.join(
          ', ',
        )}.`,
      );
    });
  }

  return lines.join('\n');
}

/**
 * Raqib app assistant: answers questions using a snapshot of app data
 * (frameworks, recent changes, onboarded OpCos, POA/IP/Licences/Litigations).
 */
export async function answerWithAppContext(userMessage) {
  if (!isLlmConfigured()) {
    return 'AI is not configured. Set LLM_BASE_URL and LLM_API_KEY (or OPENAI_API_KEY) in the server .env to enable answers based on the Raqib app data.';
  }

  const context = await buildAppContext();

  const systemPrompt = `You are the AI Ask assistant for the \"Raqib – Compliance Intelligence Platform\".\n\nYour job is to answer questions about:\n- Governance and compliance frameworks supported in the app.\n- Parent holdings and their Operating Companies (OpCos).\n- Onboarded entities from the onboarding module.\n- Legal operations: Power of Attorney (POA), IP assets, Licences, and Litigations.\n- Recent regulatory changes and which frameworks they relate to.\n\nYou MAY ONLY use the following application data snapshot as context. If the answer is not clearly supported by this context, say that the information is not available in Raqib yet and DO NOT invent facts.\n\nWhen you do have data:\n- Give a concise, structured summary first.\n- Then list key data points (parents, OpCos, frameworks, POA / licence / litigation details) that support your answer.\n- Where helpful, suggest 1–3 clear, outcome‑based next steps.\n\n---\nAPPLICATION DATA SNAPSHOT\n${context || '(No app data available)'}\n---`;

  try {
    const completion = await createChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      maxTokens: 900,
      responseFormat: 'text',
    });
    const content = completion.choices?.[0]?.message?.content;
    return content || 'No response generated.';
  } catch (err) {
    console.error('LLM error (answerWithAppContext):', err.message);
    return `Sorry, I couldn't process your question: ${err.message}. Please try again or rephrase.`;
  }
}

const PERIOD_LABELS = { 30: '30 days', 180: '6 months', 365: '1 year' };

/**
 * Use AI to look up key regulatory/rule changes for a framework in the given period.
 * Returns an array of { id, framework, title, snippet, fullText, date, sourceUrl, category, deadline }.
 * NOTE: We still hard-filter by "date" in the calling route to ensure results strictly respect the time window.
 */
export async function lookupChangesForFramework(framework, days) {
  if (!isLlmConfigured()) return [];
  const periodLabel = PERIOD_LABELS[days] || `${days} days`;
  const prompt = `You are a regulatory research assistant. List the key regulatory or rule changes for "${framework}" in the last ${periodLabel}. Use your knowledge and focus on real, notable updates (circulars, amendments, new rules, policy changes).

Strict rules:
- Only include changes that were released within the last ${periodLabel}. Do NOT include any changes older than this period.
- For each change, provide the date it was released and, if known, the deadline by which regulated entities must comply.

Return a JSON array only, no other text. Each object must have:
- "title" (string),
- "snippet" (1-2 sentences),
- "fullText" (2-4 sentences),
- "date" (YYYY-MM-DD, approximate if unknown),
- "deadline" (YYYY-MM-DD if there is a clear compliance deadline, otherwise an empty string),
- "sourceUrl" (official URL if known, else empty string),
- "category" (e.g. Banking, Cybersecurity, Disclosure).

Use between 2 and 6 items. If you have no specific knowledge of changes in this period, return an empty array [].`;
  try {
    const completion = await createChatCompletion({
      messages: [
        { role: 'system', content: 'You respond only with valid JSON arrays. No markdown, no explanation.' },
        { role: 'user', content: prompt },
      ],
      maxTokens: 2000,
      responseFormat: 'json',
    });
    const content = completion.choices?.[0]?.message?.content?.trim() || '[]';
    const jsonStr = content.replace(/^```json?\s*|\s*```$/g, '').trim();
    const arr = JSON.parse(jsonStr);
    if (!Array.isArray(arr)) return [];

    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - days);
    const todayStr = now.toISOString().slice(0, 10);

    // Filter out any items whose "date" clearly falls outside the requested window.
    const filtered = arr.filter((item) => {
      if (!item || !item.date) return true; // keep if unknown; server will hard-filter by date string later
      const d = new Date(item.date);
      if (Number.isNaN(d.getTime())) return true;
      return d >= from && d <= now;
    });

    return filtered.slice(0, 10).map((item, i) => ({
      id: `lookup-${framework.replace(/\s/g, '-')}-${i}`,
      framework,
      title: item.title || 'Regulatory update',
      snippet: item.snippet || item.fullText?.slice(0, 200) || '',
      fullText: item.fullText || item.snippet || '',
      date: item.date || todayStr,
      sourceUrl: item.sourceUrl || '',
      category: item.category || 'General',
      deadline: item.deadline || '',
    }));
  } catch (err) {
    console.error('Lookup error:', err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL INTELLIGENCE ASSISTANT
// ─────────────────────────────────────────────────────────────────────────────

function daysFromNow(dateStr, days) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + days);
  return d >= new Date() && d <= threshold;
}

function isPast(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) && d < new Date();
}

async function buildGlobalContext(parentHolding) {
  const now = new Date();
  const thirtyAgo = new Date(now); thirtyAgo.setDate(thirtyAgo.getDate() - 30);
  const ninetyAhead = new Date(now); ninetyAhead.setDate(ninetyAhead.getDate() + 90);

  const [changes, companies, onboardingOpcos, poa, ip, licences, litigations, tasks, contracts, esgRaw] =
    await Promise.all([
      safeReadJson(changesPath, []),
      safeReadJson(companiesPath, {}),
      safeReadJson(onboardingOpcosPath, []),
      safeReadJson(poaPath, []),
      safeReadJson(ipPath, []),
      safeReadJson(licencesPath, []),
      safeReadJson(litigationsPath, []),
      safeReadJson(tasksPath, []),
      safeReadJson(contractsPath, []),
      safeReadJson(esgMetricsPath, { metrics: {} }),
    ]);

  const allChanges = Array.isArray(changes) ? changes : [];
  const recentChanges = allChanges.filter(c => { const d = new Date(c.date); return !isNaN(d) && d >= thirtyAgo; });
  const upcomingDeadlines = allChanges.filter(c => daysFromNow(c.deadline, 60));
  const overdueChanges = allChanges.filter(c => isPast(c.deadline));

  // Framework change counts
  const fwCounts = {};
  recentChanges.forEach(c => { fwCounts[c.framework] = (fwCounts[c.framework] || 0) + 1; });
  const topFws = Object.entries(fwCounts).sort((a,b) => b[1]-a[1]).slice(0,6)
    .map(([fw, n]) => `${fw}: ${n}`).join(', ');

  // Parent holdings
  const parentMap = {};
  Object.values(companies).flat().forEach(e => {
    if (e?.parent) { parentMap[e.parent] = (parentMap[e.parent] || new Set()); if (e.companies) e.companies.forEach(c => parentMap[e.parent].add(c)); }
  });
  const parentSummary = Object.entries(parentMap).slice(0, 5)
    .map(([p, cs]) => `${p} (${cs.size} OpCos)`).join(', ');

  // POA analysis
  const poaArr = Array.isArray(poa) ? poa : [];
  const poaExpiring = poaArr.filter(r => daysFromNow(r.validUntil, 90));
  const poaExpired = poaArr.filter(r => isPast(r.validUntil) && !r.revoked);

  // Licences
  const licArr = Array.isArray(licences) ? licences : [];
  const licExpiring = licArr.filter(r => daysFromNow(r.expiryDate || r.validUntil, 90));

  // IP
  const ipArr = Array.isArray(ip) ? ip : [];
  const ipExpiring = ipArr.filter(r => daysFromNow(r.expiryDate || r.renewalDate, 90));

  // Litigations
  const litArr = Array.isArray(litigations) ? litigations : [];
  const activeLit = litArr.filter(r => r.status === 'active' || r.status === 'open' || !r.status);

  // Tasks
  const tasksArr = Array.isArray(tasks) ? tasks : [];
  const openTasks = tasksArr.filter(t => t.status === 'open' || t.status === 'in-progress');
  const overdueTasks = tasksArr.filter(t => isPast(t.dueDate) && (t.status === 'open' || t.status === 'in-progress'));
  const staleTasks = tasksArr.filter(t => {
    if (t.status !== 'open' && t.status !== 'in-progress') return false;
    const upd = new Date(t.updatedAt || t.createdAt);
    return !isNaN(upd) && (now - upd) > 10 * 24 * 3600 * 1000;
  });
  const criticalTasks = tasksArr.filter(t => t.priority === 'critical' && t.status !== 'done');
  const taskByPriority = { critical: 0, high: 0, medium: 0, low: 0 };
  openTasks.forEach(t => { if (taskByPriority[t.priority] !== undefined) taskByPriority[t.priority]++; });

  // ESG
  const esgMetrics = esgRaw?.metrics || {};
  const esgKeys = Object.keys(esgMetrics);
  const latestEsgByOpco = {};
  esgKeys.forEach(key => {
    const [, opco, period] = key.split('::');
    if (!latestEsgByOpco[opco] || period > latestEsgByOpco[opco].period) {
      latestEsgByOpco[opco] = { period, data: esgMetrics[key] };
    }
  });
  const esgSummary = Object.entries(latestEsgByOpco).slice(0, 6)
    .map(([opco, { period }]) => `${opco} (${period})`).join(', ');

  // Contracts
  const contractArr = Array.isArray(contracts) ? contracts : [];
  const contractsExpiring = contractArr.filter(r => daysFromNow(r.expiryDate || r.endDate || r.validUntil, 90));

  // Onboarding
  const onboardArr = Array.isArray(onboardingOpcos) ? onboardingOpcos : [];
  const recentOnboard = onboardArr.filter(o => { const d = new Date(o.addedAt); return !isNaN(d) && (now - d) < 90 * 24 * 3600 * 1000; });

  const lines = [];
  lines.push(`ORGANIZATION: ${parentHolding || 'All holdings'}`);
  lines.push(`DATE: ${now.toISOString().slice(0,10)}`);
  lines.push('');
  lines.push('=== GOVERNANCE & REGULATORY ===');
  lines.push(`Supported frameworks: ${FRAMEWORKS.join(', ')}`);
  lines.push(`Recent changes (30d): ${recentChanges.length} total. By framework: ${topFws || 'none'}`);
  lines.push(`Upcoming deadlines (60d): ${upcomingDeadlines.length} items`);
  if (upcomingDeadlines.length > 0) {
    upcomingDeadlines.slice(0,5).forEach(c => lines.push(`  - [${c.framework}] "${c.title}" deadline: ${c.deadline}, affects: ${(c.affectedCompanies||[]).join(', ')}`));
  }
  lines.push(`Overdue items (past deadline): ${overdueChanges.length} items`);
  if (overdueChanges.length > 0) {
    overdueChanges.slice(0,5).forEach(c => lines.push(`  - [${c.framework}] "${c.title}" was due: ${c.deadline}`));
  }
  lines.push('');
  lines.push('=== COMPANIES & ONBOARDING ===');
  lines.push(`Parent holdings: ${parentSummary || 'none loaded'}`);
  lines.push(`Total onboarded OpCos: ${onboardArr.length}. Recently onboarded (90d): ${recentOnboard.length}`);
  lines.push('');
  lines.push('=== TASKS ===');
  lines.push(`Open/in-progress tasks: ${openTasks.length}`);
  lines.push(`Priority breakdown — critical: ${taskByPriority.critical}, high: ${taskByPriority.high}, medium: ${taskByPriority.medium}, low: ${taskByPriority.low}`);
  lines.push(`Overdue tasks: ${overdueTasks.length}. Stale (no update >10d): ${staleTasks.length}`);
  if (criticalTasks.length > 0) {
    criticalTasks.slice(0,3).forEach(t => lines.push(`  - CRITICAL: "${t.title}" assigned to: ${t.assignedTo || 'unassigned'}`));
  }
  lines.push('');
  lines.push('=== LEGAL ===');
  lines.push(`Power of Attorney — total: ${poaArr.length}, expiring within 90d: ${poaExpiring.length}, already expired: ${poaExpired.length}`);
  if (poaExpiring.length > 0) poaExpiring.slice(0,3).forEach(r => lines.push(`  - POA: ${r.holderName} / ${r.opco}, expires: ${r.validUntil}`));
  lines.push(`IP assets — total: ${ipArr.length}, expiring within 90d: ${ipExpiring.length}`);
  lines.push(`Licences — total: ${licArr.length}, expiring within 90d: ${licExpiring.length}`);
  if (licExpiring.length > 0) licExpiring.slice(0,3).forEach(r => lines.push(`  - Licence: ${r.name || r.licenceName || 'unnamed'} / ${r.opco}, expires: ${r.expiryDate || r.validUntil}`));
  lines.push(`Litigations — total: ${litArr.length}, active: ${activeLit.length}`);
  lines.push(`Contracts — total: ${contractArr.length}, expiring within 90d: ${contractsExpiring.length}`);
  lines.push('');
  lines.push('=== ESG ===');
  lines.push(`ESG data recorded for: ${esgKeys.length} entity-period combinations`);
  lines.push(`Latest ESG entries: ${esgSummary || 'No ESG data entered yet'}`);
  lines.push('');

  return lines.join('\n');
}

function buildFallbackResponse(message) {
  return {
    module: 'cross',
    summary: 'GRC Intelligence Assistant is ready — AI engine not yet configured.',
    narrative: 'The assistant UI is fully operational, but the AI reasoning engine is not connected.\n\nTo enable full intelligence capabilities, set **LLM_BASE_URL** and **LLM_API_KEY** (or **OPENAI_API_KEY**) in the server `.env` file.\n\nOnce configured, I can:\n- **Answer questions** across all modules (Governance, Legal, ESG, Data, Ownership, Analysis)\n- **Detect cross-module correlations** — e.g., expiring POAs affecting the same OpCos with overdue governance tasks\n- **Suggest actions** with clear reasoning for human review and approval\n- **Surface visual metrics** and breakdowns tailored to your role',
    reasoning: [
      'Received user question: "' + message.slice(0, 80) + '"',
      'Checked LLM configuration → API credentials not found in environment',
      'Returning capability overview instead of AI-generated answer',
    ],
    metrics: [],
    chart: { type: 'none', title: '', data: [] },
    correlations: [],
    actions: [],
    followups: [
      'How do I configure the AI engine?',
      'What data sources does the assistant analyse?',
      'Which modules can the assistant help with?',
    ],
  };
}

function parseStructuredResponse(content, fallbackMessage) {
  try {
    const cleaned = content.replace(/^```json?\s*|\s*```$/gm, '').trim();
    // Find the JSON object in the response
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON object found');
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return {
      module: typeof parsed.module === 'string' ? parsed.module : 'cross',
      summary: typeof parsed.summary === 'string' ? parsed.summary : 'Analysis complete.',
      narrative: typeof parsed.narrative === 'string' ? parsed.narrative : content,
      reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning.slice(0, 5) : [],
      metrics: Array.isArray(parsed.metrics) ? parsed.metrics.slice(0, 4) : [],
      chart: parsed.chart && parsed.chart.type !== 'none' ? parsed.chart : { type: 'none', title: '', data: [] },
      correlations: Array.isArray(parsed.correlations) ? parsed.correlations.slice(0, 3) : [],
      actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 2) : [],
      followups: Array.isArray(parsed.followups) ? parsed.followups.slice(0, 3) : [],
    };
  } catch {
    return {
      module: 'cross',
      summary: content.slice(0, 200),
      narrative: content,
      reasoning: [],
      metrics: [],
      chart: { type: 'none', title: '', data: [] },
      correlations: [],
      actions: [],
      followups: ['Tell me more', 'What should I prioritise?', 'Show me a breakdown'],
    };
  }
}

const PERSONA_GUIDES = {
  board: 'Board member: provide a 2-paragraph strategic executive summary. Focus on risk exposure, regulatory reputation, and financial impact. Avoid operational detail.',
  'c-level': 'C-Level executive (CEO/CFO/CCO): provide strategic context with financial and reputational impact. Include key metrics and 1-2 clear actions.',
  legal: 'Legal team member: focus on legal obligations, specific deadlines, jurisdiction nuances, and enforcement risk. Be precise about regulatory requirements.',
  governance: 'Governance team member: provide detailed framework-level analysis, OpCo mapping, regulatory change specifics, and compliance status.',
  data: 'Data & Security professional: focus on technical controls, security posture scores, data flow risks, and framework-control gap analysis.',
  operations: 'Operations / Business user: be practical and action-oriented. Focus on what needs to be done, by when, and by whom.',
};

const MODULE_CONTEXT = {
  governance: 'The user is currently in the Governance module, looking at regulatory frameworks and changes.',
  legal: 'The user is currently in the Legal module, managing POAs, IP assets, licences, and litigations.',
  esg: 'The user is currently in the ESG module, reviewing Environmental, Social, and Governance scores.',
  data: 'The user is currently in the Data & Security module, checking data sovereignty and security posture.',
  ownership: 'The user is currently in the Ownership module, reviewing UBO records and beneficial ownership.',
  analysis: 'The user is currently in the Analysis module, running risk predictions and M&A assessments.',
  overview: 'The user is currently viewing an organisation-wide overview dashboard.',
  tasks: 'The user is currently in the Task Tracker, managing compliance action items.',
  cross: 'The user is asking a cross-module or general question.',
};

/**
 * Global GRC Intelligence Assistant — answers questions across all modules
 * with structured JSON responses for rich UI rendering.
 */
export async function answerGlobal({ message, history, currentModule, persona, parentHolding }) {
  if (!isLlmConfigured()) return buildFallbackResponse(message);

  const context = await buildGlobalContext(parentHolding);
  const personaGuide = PERSONA_GUIDES[persona] || PERSONA_GUIDES['c-level'];
  const moduleContext = MODULE_CONTEXT[currentModule] || MODULE_CONTEXT['cross'];

  const historyText = history.length > 0
    ? '\n\nCONVERSATION HISTORY (recent turns):\n' + history.map(h => `${h.role.toUpperCase()}: ${(h.content || '').slice(0, 200)}`).join('\n')
    : '';

  const systemPrompt = `You are the GRC Intelligence Assistant for a GCC multi-entity holding group compliance platform (Raqib). You are a trusted thinking partner for compliance professionals at all organisational levels.

CURRENT USER CONTEXT:
- Persona: ${personaGuide}
- Active module: ${moduleContext}
- Selected organisation: ${parentHolding || 'all holdings'}

YOUR CAPABILITIES:
1. Detect which GRC module(s) the question relates to (governance, legal, esg, data, ownership, analysis, tasks, overview, cross)
2. Surface insights from all platform data, citing specific numbers
3. Identify cross-module correlations (e.g., POA expiry affecting OpCos with overdue governance tasks)
4. Suggest up to 2 concrete, reversible actions with clear human-readable reasoning — never suggest deleting data
5. Adapt response depth and language to the user's persona
6. Provide data for visual rendering (metrics, charts)

RESPOND WITH VALID JSON ONLY — no markdown fences, no extra text. Use this exact schema:
{
  "module": "governance|legal|esg|data|ownership|analysis|tasks|overview|cross",
  "summary": "1-2 sentence headline answer (plain text, no markdown)",
  "narrative": "Full analysis in markdown. Bold key terms with **bold**. Use bullet lists. 2-4 paragraphs. Data-backed. Persona-adapted.",
  "reasoning": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
  "metrics": [
    { "label": "string", "value": "string", "trend": "up|down|flat|none", "change": "string (e.g. +3 this week)", "color": "green|red|amber|blue|purple" }
  ],
  "chart": {
    "type": "bar|ring|none",
    "title": "string",
    "data": [{ "label": "string", "value": 75, "color": "#hex" }]
  },
  "correlations": [
    { "module": "string", "insight": "1-2 sentence cross-module finding", "severity": "critical|high|medium|low" }
  ],
  "actions": [
    {
      "id": "action-1",
      "label": "Short action label",
      "description": "What this action will do",
      "reasoning": "Why this is recommended based on the data",
      "endpoint": "/api/tasks",
      "method": "POST",
      "payload": {},
      "risk": "low|medium|high",
      "requiresApproval": true
    }
  ],
  "followups": ["Question 1?", "Question 2?", "Question 3?"]
}

RULES:
- metrics: 2-4 items, only if you have data. Use "none" trend if not applicable.
- chart: Include only if a bar or ring chart meaningfully visualises the data. "bar" for comparisons, "ring" for a single completion/score percentage. Omit if not useful.
- chart.data values should be 0-100 for ring, or raw numbers for bar.
- correlations: Only genuine data-backed cross-module insights. Max 2.
- actions: Max 2. Only safe, reversible actions: create task, escalate, flag for review, send notification. Never delete data. Always set requiresApproval: true.
- followups: 3 natural follow-up questions.
- Board persona: concise (2 paragraphs max), strategic, financial risk focus.
- narrative uses markdown: **bold**, - bullets, paragraph breaks.

PLATFORM DATA SNAPSHOT:
${context}${historyText}`;

  try {
    const completion = await createChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      maxTokens: 1400,
      responseFormat: 'json',
    });
    const content = completion.choices?.[0]?.message?.content?.trim() || '{}';
    return parseStructuredResponse(content, message);
  } catch (err) {
    console.error('answerGlobal error:', err.message);
    return {
      module: currentModule || 'cross',
      summary: 'I encountered an error processing your question.',
      narrative: `I was unable to process your question due to an error: **${err.message}**\n\nPlease try rephrasing or try again in a moment.`,
      reasoning: ['LLM call failed', err.message],
      metrics: [],
      chart: { type: 'none', title: '', data: [] },
      correlations: [],
      actions: [],
      followups: ['Try a simpler question', 'Check the data in this module', 'View the task tracker'],
    };
  }
}
