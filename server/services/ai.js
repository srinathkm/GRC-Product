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
