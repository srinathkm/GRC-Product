import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createChatCompletion, isLlmConfigured } from './llm.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, '../data/changes.json');

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

const PERIOD_LABELS = { 30: '30 days', 180: '6 months', 365: '1 year' };

/**
 * Use AI to look up key regulatory/rule changes for a framework in the given period.
 * Returns an array of { id, framework, title, snippet, fullText, date, sourceUrl, category }.
 */
export async function lookupChangesForFramework(framework, days) {
  if (!isLlmConfigured()) return [];
  const periodLabel = PERIOD_LABELS[days] || `${days} days`;
  const prompt = `You are a regulatory research assistant. List the key regulatory or rule changes for "${framework}" in the last ${periodLabel}. Use your knowledge and focus on real, notable updates (circulars, amendments, new rules, policy changes). Return a JSON array only, no other text. Each object must have: "title" (string), "snippet" (1-2 sentences), "fullText" (2-4 sentences), "date" (YYYY-MM-DD, approximate if unknown), "sourceUrl" (official URL if known, else empty string), "category" (e.g. Banking, Cybersecurity, Disclosure). Use between 2 and 6 items. If you have no specific knowledge of changes in this period, return an empty array [].`;
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
    const now = new Date().toISOString().slice(0, 10);
    return arr.slice(0, 10).map((item, i) => ({
      id: `lookup-${framework.replace(/\s/g, '-')}-${i}`,
      framework,
      title: item.title || 'Regulatory update',
      snippet: item.snippet || item.fullText?.slice(0, 200) || '',
      fullText: item.fullText || item.snippet || '',
      date: item.date || now,
      sourceUrl: item.sourceUrl || '',
      category: item.category || 'General',
    }));
  } catch (err) {
    console.error('Lookup error:', err.message);
    return [];
  }
}
